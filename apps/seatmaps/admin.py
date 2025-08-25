"""
Admin registrations for seat map models.
"""

from django.contrib import admin

from .models import SeatMap


@admin.register(SeatMap)
class SeatMapAdmin(admin.ModelAdmin):
    list_display = ("name", "venue", "created_at", "updated_at")
    list_filter = ("venue",)
    search_fields = ("name",)
