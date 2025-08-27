from django.contrib import admin
from django import forms
from django.contrib.gis.geos import Point
from import_export.admin import ImportExportModelAdmin
from leaflet_point.admin import LeafletPointAdmin
from decimal import Decimal, ROUND_HALF_UP

from web.admin_utils import DynamicListDisplayMixin

from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.shortcuts import get_object_or_404, render
from django.urls import path, reverse

from .utils import extract_lat_lon_from_link
from .models import (
    Venue,
    Section,
    Row,
    Seat,
    SeatMap,
    Event,
    PriceCategory,
    EventSeat,
    Hold,
    Booking,
)

# <<< IMPORTANTE: importa el sincronizador >>>
from .views import _sync_canvas_to_models


# -------------------------
# Inlines
# -------------------------
class SectionInline(admin.TabularInline):
    model = Section
    extra = 0
    fields = ("name",) if not hasattr(Section, "order") else ("name", "order")
    ordering = ("name",) if not hasattr(Section, "order") else ("order", "name")


class RowInline(admin.TabularInline):
    model = Row
    extra = 0
    fields = ("name", "order")
    ordering = ("order",)


class SeatInline(admin.TabularInline):
    model = Seat
    extra = 0
    fields = ("number", "seat_type")
    ordering = ("number",)


class PriceCategoryInline(admin.TabularInline):
    model = PriceCategory
    extra = 0
    fields = ("name", "price")
    ordering = ("name",)


# -------------------------
# Helpers
# -------------------------
def _q6(x):
    """Cuantiza a 6 decimales como Decimal, compatible con DecimalField."""
    return Decimal(str(x)).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)


# -------------------------
# Venue (con lat/lon + geom)
# -------------------------
class VenueAdminForm(forms.ModelForm):
    map_url = forms.CharField(
        required=False,
        label="Link de mapa (Google/Apple/OSM)",
        help_text="Pega un enlace; se rellenarán lat/lon automáticamente.",
    )
    latitude = forms.DecimalField(
        required=False,
        max_digits=9,
        decimal_places=6,
        localize=False,
        widget=forms.NumberInput(
            attrs={"step": "0.000001", "inputmode": "decimal", "pattern": r"[0-9\.\-]*"}
        ),
    )
    longitude = forms.DecimalField(
        required=False,
        max_digits=9,
        decimal_places=6,
        localize=False,
        widget=forms.NumberInput(
            attrs={"step": "0.000001", "inputmode": "decimal", "pattern": r"[0-9\.\-]*"}
        ),
    )

    class Meta:
        model = Venue
        fields = ("name", "slug", "address", "description")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        inst = getattr(self, "instance", None)
        if inst and getattr(inst, "geom", None):
            try:
                self.fields["latitude"].initial = _q6(inst.geom.y)
                self.fields["longitude"].initial = _q6(inst.geom.x)
            except Exception:
                pass

    def clean(self):
        cleaned = super().clean()
        link = self.data.get("map_url") or cleaned.get("map_url")
        for k in ("latitude", "longitude"):
            v = self.data.get(k) or cleaned.get(k)
            if v not in (None, ""):
                cleaned[k] = _q6(str(v).replace(",", "."))
        lat = cleaned.get("latitude")
        lon = cleaned.get("longitude")
        if (lat in (None, "") or lon in (None, "")) and link:
            pair = extract_lat_lon_from_link(link)
            if not pair:
                raise forms.ValidationError("No se pudo extraer coordenadas del link.")
            plat, plon = pair
            cleaned["latitude"] = _q6(plat)
            cleaned["longitude"] = _q6(plon)
        return cleaned

    def save(self, commit=True):
        obj = super().save(commit=False)
        lat = self.cleaned_data.get("latitude")
        lon = self.cleaned_data.get("longitude")
        if lat not in (None, "") and lon not in (None, ""):
            obj.geom = Point(float(lon), float(lat), srid=4326)
        if commit:
            obj.save()
        return obj


@admin.register(Venue)
class VenueAdmin(ImportExportModelAdmin, DynamicListDisplayMixin, LeafletPointAdmin):
    form = VenueAdminForm
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    config_overrides = {"geocoder": True}

    fieldsets = (
        ("Detalles", {"fields": ("name", "slug", "address", "description")}),
        (
            "Ubicación",
            {
                "fields": ("map_url", ("latitude", "longitude")),
                "description": "Pega el link del mapa; se completarán lat/lon. Ajusta si es necesario.",
            },
        ),
    )

    class Media:
        js = (
            *LeafletPointAdmin.Media.js,
            "js/force_dot_decimal.js",
            "js/map_url_autofill.js",
            "js/map_coords_sync_plus_button.js",
        )


# -------------------------
# Resto de modelos
# -------------------------
@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("venue", "name") if not hasattr(Section, "order") else ("venue", "name", "order")
    list_filter = ("venue",)
    search_fields = ("name",)
    ordering = ("venue", "name") if not hasattr(Section, "order") else ("venue", "order", "name")
    inlines = [RowInline]


@admin.register(Row)
class RowAdmin(admin.ModelAdmin):
    list_display = ("section", "name", "order")
    list_filter = ("section__venue", "section")
    search_fields = ("name",)
    ordering = ("section__venue", "section", "order", "name")
    inlines = [SeatInline]


@admin.register(Seat)
class SeatAdmin(admin.ModelAdmin):
    list_display = ("row", "number", "seat_type")
    list_filter = ("row__section__venue", "row__section", "seat_type")
    search_fields = ("number", "row__name")
    ordering = ("row__section__venue", "row__section", "row__order", "number")


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("name", "venue", "start_datetime", "end_datetime")
    list_filter = ("venue", "start_datetime")
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("start_datetime",)
    inlines = [PriceCategoryInline]


@admin.register(PriceCategory)
class PriceCategoryAdmin(admin.ModelAdmin):
    list_display = ("event", "name", "price")
    list_filter = ("event",)
    search_fields = ("name",)
    ordering = ("event", "name")


@admin.register(EventSeat)
class EventSeatAdmin(admin.ModelAdmin):
    list_display = ("event", "seat", "status", "price_category", "hold_expires_at")
    list_filter = ("status", "event", "price_category")
    search_fields = (
        "event__name",
        "seat__row__section__name",
        "seat__row__name",
        "seat__number",
    )
    ordering = ("event", "seat__row__section__name", "seat__row__name", "seat__number")
    raw_id_fields = ("seat",)


@admin.register(Hold)
class HoldAdmin(admin.ModelAdmin):
    list_display = ("event", "user", "expires_at")
    list_filter = ("event", "expires_at")
    search_fields = ("event__name", "user__username")
    ordering = ("expires_at",)
    filter_horizontal = ("seats",)


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("event", "user", "total_price", "status", "created_at")
    list_filter = ("status", "event")
    search_fields = ("event__name", "user__username")
    ordering = ("-created_at",)
    filter_horizontal = ("seats",)


# ---------- Designer SeatMap en Admin ----------
@admin.register(SeatMap)
class SeatMapAdmin(admin.ModelAdmin):
    list_display = ("venue", "name")
    list_filter = ("venue",)
    search_fields = ("name",)
    ordering = ("venue", "name")
    change_form_template = "admin/app_seat/seatmap/change_form.html"

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path("<uuid:pk>/designer/", self.admin_site.admin_view(self.designer_view), name="seatmap_designer"),
            path("<uuid:pk>/api/load/", self.admin_site.admin_view(self.api_load), name="seatmap_api_load"),
            path("<uuid:pk>/api/save/", self.admin_site.admin_view(self.api_save), name="seatmap_api_save"),
        ]
        return custom + urls

    def designer_view(self, request, pk):
        sm = get_object_or_404(SeatMap, pk=pk)
        return render(
            request,
            "admin/seatmap_designer.html",
            {
                "title": f"Designer · {sm.venue.name} / {sm.name}",
                "seatmap": sm,
                "load_url": reverse("admin:seatmap_api_load", args=[sm.pk]),
                "save_url": reverse("admin:seatmap_api_save", args=[sm.pk]),
            },
        )

    @method_decorator(require_http_methods(["GET"]))
    def api_load(self, request, pk):
        sm = get_object_or_404(SeatMap, pk=pk)
        data = sm.data or {}
        if "version" not in data:
            data = {
                "version": 1,
                "canvas": {"width": 2000, "height": 1000},
                "sections": [],
                "legend": [],
            }

        # ► NUEVO: incluir snapshot vivo de secciones en BD
        from django.forms.models import model_to_dict
        db_sections_qs = Section.objects.filter(venue=sm.venue).order_by(
            *(("order",) if hasattr(Section, "order") else tuple()), "name"
        )
        db_sections = []
        for s in db_sections_qs:
            db_sections.append(
                {
                    "id": str(s.pk),
                    "name": s.name,
                    "category": getattr(s, "category", "") or "",
                    "order": getattr(s, "order", None),
                }
            )

        return JsonResponse({"ok": True, "data": data, "db_sections": db_sections})

    @method_decorator(require_http_methods(["POST"]))
    def api_save(self, request, pk):
        import json
        sm = get_object_or_404(SeatMap, pk=pk)
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except Exception:
            return HttpResponseBadRequest("JSON inválido")

        data = payload.get("data")
        if not isinstance(data, dict):
            return HttpResponseBadRequest("Falta 'data' dict")

        # Guarda el JSON para poder reabrir el diseñador
        sm.data = data
        sm.save(update_fields=["data"])

        # <<< SINCRONIZA A TABLAS (incluye BORRADOS) >>>
        _sync_canvas_to_models(sm.venue, data)

        return JsonResponse({"ok": True})
