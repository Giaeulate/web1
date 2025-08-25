"""
Admin registrations for ticket hold and booking models.

Provides intuitive list displays and filters for administrators to manage
temporary holds and confirmed bookings. Seats can be viewed and edited
via the many‑to‑many widget in the admin interface.
"""

from django.contrib import admin

from .models import Hold, Booking


@admin.register(Hold)
class HoldAdmin(admin.ModelAdmin):
    """Admin configuration for the Hold model."""

    list_display = ("event", "user", "expires_at", "created_at")
    list_filter = ("event", "expires_at")
    date_hierarchy = "expires_at"
    filter_horizontal = ("seats",)
    search_fields = ("event__name", "user__username")


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    """Admin configuration for the Booking model."""

    list_display = (
        "id",
        "event",
        "user",
        "status",
        "total_price",
        "created_at",
        "updated_at",
    )
    list_filter = ("event", "status")
    date_hierarchy = "created_at"
    filter_horizontal = ("seats",)
    search_fields = ("id", "event__name", "user__username")