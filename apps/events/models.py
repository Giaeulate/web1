"""
Models for events and pricing.

Defines Event, PriceCategory and EventSeat models. Each Event represents a
scheduled show or performance and is associated with a venue and a seat map.
Price categories define ticket prices for different sections or seat types.
EventSeat instances represent the status of each physical seat within the event.
"""

from django.db import models
from apps.venues.models import Venue, Seat
from apps.seatmaps.models import SeatMap


class Event(models.Model):
    """A scheduled event at a venue with a specific seat map."""

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="events")
    seatmap = models.ForeignKey(SeatMap, on_delete=models.CASCADE, related_name="events")
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField(null=True, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Events"
        ordering = ["start_datetime"]

    def __str__(self) -> str:
        return f"{self.name} ({self.start_datetime})"


class PriceCategory(models.Model):
    """Defines pricing categories for an event (e.g. VIP, Standard)."""

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="price_categories")
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        verbose_name_plural = "Price categories"
        unique_together = ["event", "name"]
        ordering = ["event", "name"]

    def __str__(self) -> str:
        return f"{self.name} – {self.price} ({self.event.name})"


class EventSeat(models.Model):
    """Represents the status of a seat for a specific event."""

    STATUS_CHOICES = [
        ("available", "Available"),
        ("held", "Held"),
        ("booked", "Booked"),
    ]
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="seats")
    seat = models.ForeignKey(Seat, on_delete=models.CASCADE, related_name="event_seats")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="available")
    price_category = models.ForeignKey(PriceCategory, on_delete=models.SET_NULL, null=True, blank=True)
    hold_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "Event seats"
        unique_together = ["event", "seat"]
        ordering = ["event", "seat__row__section", "seat__row", "seat__number"]

    def __str__(self) -> str:
        return f"{self.event.name} – {self.seat} [{self.status}]"
