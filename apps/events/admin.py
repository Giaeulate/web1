"""
Admin registrations for the events app.

This module registers the Event, PriceCategory and EventSeat models with
the Django admin. It provides list displays, filters and search to make
managing events and their seating status straightforward from the
administration interface.
"""

from django.contrib import admin

from .models import Event, PriceCategory, EventSeat


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    """Admin configuration for the Event model."""

    list_display = ("name", "venue", "start_datetime", "end_datetime")
    list_filter = ("venue",)
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name", "venue__name")
    ordering = ("start_datetime",)


@admin.register(PriceCategory)
class PriceCategoryAdmin(admin.ModelAdmin):
    """Admin configuration for the PriceCategory model."""

    list_display = ("event", "name", "price")
    list_filter = ("event",)
    search_fields = ("name", "event__name")
    ordering = ("event", "name")


@admin.register(EventSeat)
class EventSeatAdmin(admin.ModelAdmin):
    """Admin configuration for the EventSeat model."""

    list_display = ("event", "seat", "status", "price_category", "hold_expires_at")
    list_filter = ("event", "status", "price_category")
    search_fields = (
        "event__name",
        "seat__row__section__venue__name",
        "seat__row__name",
        "seat__number",
    )
    ordering = ("event", "seat__row__section", "seat__row", "seat__number")