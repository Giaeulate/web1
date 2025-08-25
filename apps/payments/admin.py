"""
Admin registration for the Payment model.

This module configures how payments appear in the Django admin site,
including list display fields, filters and search. Having this
information in the admin allows staff to monitor and reconcile
transactions easily.
"""

from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    """Admin configuration for the Payment model."""

    list_display = (
        "booking",
        "user",
        "amount",
        "provider",
        "status",
        "transaction_id",
        "created_at",
    )
    list_filter = ("provider", "status")
    date_hierarchy = "created_at"
    search_fields = (
        "booking__id",
        "user__username",
        "transaction_id",
    )