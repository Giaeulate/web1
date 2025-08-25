from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _
from django.db.models.functions import Lower

from app_core.models import AdminColumnPreference


def translations_link(obj):
    url = (
        reverse("admin:core_translation_changelist")
        + f"?model={obj.__class__.__name__}&object_id={obj.id}"
    )
    return format_html('<a href="{}">{}</a>', url, _("View translations"))

translations_link.short_description = _("Translations")

class DynamicListDisplayMixin:

    class Media:
        js = (
            # "js/admin_leaflet_tilelayer.js",
            # "js/show_waypoints.js",
            "js/admin_leaflet_expand.js",
        )
        css = {
            "all": ("css/custom_admin.css",)
        }
        
    def get_list_display(self, request):
        list_display = super().get_list_display(request)

        model_name = self.model._meta.model_name
        user = request.user

        try:
            pref = AdminColumnPreference.objects.get(user=user, model_name__iexact=model_name)
            if pref.columns:
                # 👇 Obtener los campos del modelo
                valid_fields = [f.name for f in self.model._meta.get_fields()]

                # 👇 Agregar extra_fields definidos en la clase admin
                extra_fields = getattr(self, 'extra_fields', ())
                valid_fields += list(extra_fields)

                # 👇 Filtrar solo los que existan
                filtered = [f for f in pref.columns if f in valid_fields]
                if filtered:
                    return filtered
        except AdminColumnPreference.DoesNotExist:
            pass

        return list_display


class TranslationMixin(DynamicListDisplayMixin, admin.ModelAdmin):
    extra_fields = ('translations_link',)
    def translations_link(self, obj): return translations_link(obj)






# admin_utils.py
import io
import csv
import json
from typing import Iterable, List, Any

from datetime import datetime, date, time as dtime, timedelta
from decimal import Decimal

from django.contrib import admin
from django.http import HttpResponse, HttpResponseBadRequest
from django.urls import path
from django.utils import timezone as djtz
from django.db.models.fields.files import FieldFile, ImageFieldFile
from django.core.files.base import File

try:
    from openpyxl import Workbook
    HAS_OPENPYXL = True
except Exception:
    HAS_OPENPYXL = False


class ExportSelectedMixin(admin.ModelAdmin):
    """
    Añade un botón en el changelist para exportar SOLO los registros seleccionados.
    Funciona para cualquier ModelAdmin que herede de este mixin.

    Personalización opcional por clase:
      - export_selected_format = "xlsx" | "csv"  (por defecto 'xlsx' si hay openpyxl, si no 'csv')
      - export_selected_filename_prefix = "prefijo" (por defecto: model_name)
      - export_selected_fields = ("id", "name", ...) (por defecto: concrete_fields)
      - export_selected_label = "Exportar seleccionados (XLSX)" (texto del botón)
    """
    export_selected_format: str = "xlsx" if HAS_OPENPYXL else "csv"
    export_selected_filename_prefix: str | None = None
    export_selected_fields: Iterable[str] | None = None
    export_selected_label: str = "Exportar seleccionados"

    # ---------- URLs ----------
    def get_urls(self):
        urls = super().get_urls()
        my = [
            path(
                "export-selected/",
                self.admin_site.admin_view(self._export_selected_view),
                name=f"{self.model._meta.app_label}_{self.model._meta.model_name}_export_selected",
            ),
        ]
        return my + urls

    # ---------- Campos ----------
    def get_export_selected_fields(self) -> List[str]:
        if self.export_selected_fields:
            return list(self.export_selected_fields)
        # Por defecto: todos los campos concretos (sin M2M)
        return [f.name for f in self.model._meta.concrete_fields]

    # ---------- Serialización de celdas ----------
    def _serialize_value(self, value: Any) -> Any:
        # --- NUEVO: FileField / ImageField ---
        if isinstance(value, FieldFile):
            # Si no hay archivo, devuelve cadena vacía
            if not value:
                return ""
            # Intenta URL pública; si no la hay, usa el nombre
            try:
                return value.url
            except Exception:
                return value.name or ""

        # 1) Datetime: Excel no soporta tz; hacer naive
        if isinstance(value, datetime):
            if djtz.is_aware(value):
                value = djtz.localtime(value)
            return value.replace(tzinfo=None)

        # 2) Time
        if isinstance(value, dtime):
            if value.tzinfo is not None:
                value = value.replace(tzinfo=None)
            return value

        # 3) Date
        if isinstance(value, date):
            return value

        # 4) Durations -> HH:MM:SS
        if isinstance(value, timedelta):
            total_seconds = int(value.total_seconds())
            hh = total_seconds // 3600
            mm = (total_seconds % 3600) // 60
            ss = total_seconds % 60
            return f"{hh:02d}:{mm:02d}:{ss:02d}"

        # 5) Geometrías (GEOSGeometry) -> WKT
        if hasattr(value, "wkt"):
            return value.wkt

        # 6) JSON (dict/list) -> string JSON
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False)

        # 7) Decimal -> str
        if isinstance(value, Decimal):
            return str(value)

        # 8) Relaciones -> str()
        try:
            from django.db.models import Model
            if isinstance(value, Model):
                return str(value)
        except Exception:
            pass

        # 9) Otros tipos básicos
        return value
    
    # ---------- Vista principal ----------
    def _export_selected_view(self, request):
        ids = request.POST.getlist("ids") or request.POST.getlist("ids[]")
        if not ids:
            return HttpResponseBadRequest("No se recibieron IDs para exportar.")

        qs = self.model.objects.filter(pk__in=ids)
        fields = self.get_export_selected_fields()
        prefix = self.export_selected_filename_prefix or self.model._meta.model_name
        ts = djtz.now().strftime("%Y%m%d_%H%M%S")

        fmt = (self.export_selected_format or "xlsx").lower()
        if fmt == "xlsx" and HAS_OPENPYXL:
            # XLSX
            wb = Workbook()
            ws = wb.active
            ws.title = "Export"

            ws.append(fields)
            for obj in qs:
                row = [self._serialize_value(getattr(obj, f, None)) for f in fields]
                ws.append(row)

            stream = io.BytesIO()
            wb.save(stream)
            stream.seek(0)
            resp = HttpResponse(
                stream.getvalue(),
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            resp["Content-Disposition"] = f'attachment; filename="{prefix}_{ts}.xlsx"'
            return resp

        # CSV (fallback o elegido)
        resp = HttpResponse(content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="{prefix}_{ts}.csv"'
        writer = csv.writer(resp)
        writer.writerow(fields)
        for obj in qs:
            row = [self._serialize_value(getattr(obj, f, None)) for f in fields]
            writer.writerow(row)
        return resp

    # ---------- Botón/JS ----------
    class Media:
        js = ("js/admin_export_selected_button.js",)

    # Texto del botón disponible para el JS (via data-attr)
    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context["export_selected_label"] = getattr(self, "export_selected_label", "Exportar seleccionados")
        return super().changelist_view(request, extra_context=extra_context)
