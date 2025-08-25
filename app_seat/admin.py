from django.contrib import admin, messages
from leaflet.admin import LeafletGeoAdmin
from leaflet_point.admin import LeafletPointAdmin
from import_export.admin import ImportExportModelAdmin
from web.admin_utils import DynamicListDisplayMixin, ExportSelectedMixin
from django import forms
from django.urls import path, reverse
from django.shortcuts import render, redirect
from decimal import Decimal, ROUND_HALF_UP
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


# Inlines para editar jerarquías dentro del administrador
class SectionInline(admin.TabularInline):
    model = Section
    extra = 0
    fields = ("name", "sort_order")
    ordering = ("sort_order",)


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



def _q6(x):
    """Cuantiza a 6 decimales como Decimal, compatible con tus DecimalField."""
    return Decimal(str(x)).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

class VenueAdminForm(forms.ModelForm):
    map_url = forms.CharField(
        required=False,
        label="Link de mapa (Google/Apple/OSM)",
        help_text="Pega un enlace de Google/Apple/OSM; se rellenarán lat/lon automáticamente."
    )

    # 👇 Clave: localize=False + NumberInput con step
    latitude = forms.DecimalField(
        max_digits=9, decimal_places=6, localize=False,
        widget=forms.NumberInput(attrs={'step': '0.000001', 'inputmode': 'decimal', 'pattern': r'[0-9\.\-]*'})
    )
    longitude = forms.DecimalField(
        max_digits=9, decimal_places=6, localize=False,
        widget=forms.NumberInput(attrs={'step': '0.000001', 'inputmode': 'decimal', 'pattern': r'[0-9\.\-]*'})
    )

    class Meta:
        model = Venue
        fields = ("map_url", "name", "slug", "address", "description", "latitude", "longitude")

    def clean(self):
        cleaned = super().clean()
        link = cleaned.get("map_url")

        # Normaliza si el usuario pegó con coma
        for k in ("latitude", "longitude"):
            v = cleaned.get(k)
            if v is not None:
                v = str(v).replace(",", ".")
                cleaned[k] = _q6(v)

        # Si no hay lat/lon pero sí link, extraer
        if (cleaned.get("latitude") is None or cleaned.get("longitude") is None) and link:
            pair = extract_lat_lon_from_link(link)
            if not pair:
                raise forms.ValidationError("No se pudo extraer coordenadas del link.")
            plat, plon = pair
            cleaned["latitude"]  = _q6(plat)
            cleaned["longitude"] = _q6(plon)

        return cleaned
    
@admin.register(Venue)
class VenueAdmin(ImportExportModelAdmin, LeafletPointAdmin):
    form = VenueAdminForm
    list_display = ("name", "slug", "address")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    config_overrides = {"geocoder": True}

    fieldsets = (
        ("Detalles", {
            "fields": ("name", "slug", "address", "description")
        }),
        ("Ubicación", {
            "fields": ("map_url", ("latitude", "longitude")),  # mapa irá justo DEBAJO con el JS
            "description": "Pega el link del mapa; se completarán lat/lon. Ajusta si es necesario."
        }),
    )

    class Media:
        js = (
            *LeafletPointAdmin.Media.js,
            "js/force_dot_decimal.js",
            "js/map_url_autofill.js",
            "js/map_coords_sync_plus_button.js",
        )


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("venue", "name", "sort_order")
    list_filter = ("venue",)
    search_fields = ("name",)
    ordering = ("venue", "sort_order", "name")
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


@admin.register(SeatMap)
class SeatMapAdmin(admin.ModelAdmin):
    list_display = ("venue", "name")
    list_filter = ("venue",)
    search_fields = ("name",)
    ordering = ("venue", "name")


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
    list_display = (
        "event",
        "seat",
        "status",
        "price_category",
        "hold_expires_at",
    )
    list_filter = ("status", "event", "price_category")
    search_fields = (
        "event__name",
        "seat__row__section__name",
        "seat__row__name",
        "seat__number",
    )
    ordering = ("event", "seat__row__section", "seat__row__order", "seat__number")
    raw_id_fields = ("seat",)  # Evita cargar todos los asientos en un desplegable


@admin.register(Hold)
class HoldAdmin(admin.ModelAdmin):
    list_display = ("event", "user", "expires_at")
    list_filter = ("event", "expires_at")
    search_fields = ("event__name", "user__username")
    ordering = ("expires_at",)
    filter_horizontal = ("seats",)  # interfaz mejorada para ManyToMany


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("event", "user", "total_price", "status", "created_at")
    list_filter = ("status", "event")
    search_fields = ("event__name", "user__username")
    ordering = ("-created_at",)
    filter_horizontal = ("seats",)
