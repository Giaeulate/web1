"""
Admin registrations for venue‑related models.
"""

from django.contrib import admin

from .models import Venue, Section, Row, Seat


@admin.register(Venue)
class VenueAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "address")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("name", "venue", "sort_order")
    list_filter = ("venue",)
    ordering = ("venue", "sort_order")


@admin.register(Row)
class RowAdmin(admin.ModelAdmin):
    list_display = ("name", "section", "order")
    list_filter = ("section__venue", "section")
    ordering = ("section", "order")


@admin.register(Seat)
class SeatAdmin(admin.ModelAdmin):
    list_display = ("number", "row", "seat_type")
    list_filter = ("row__section__venue", "row__section", "seat_type")
    ordering = ("row", "number")
