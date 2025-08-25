"""
Models for seat map definitions.

Seat maps store the layout of seats for a given venue as JSON data. A seat
map can be reused across multiple events, allowing administrators to design
layouts once and apply them to different dates or configurations.
"""

from django.db import models
from apps.venues.models import Venue


class SeatMap(models.Model):
    """A seat map linked to a specific venue, storing layout as JSON."""

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="seatmaps")
    name = models.CharField(max_length=255)
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Seat maps"
        unique_together = ["venue", "name"]
        ordering = ["venue", "name"]

    def __str__(self) -> str:
        return f"{self.venue.name} – {self.name}"
