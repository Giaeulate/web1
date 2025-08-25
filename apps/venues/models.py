"""
Models for venues and seating structure.

Defines Venue, Section, Row, and Seat models to represent physical seating
arrangements. Each Venue can have multiple Sections, each Section can have
multiple Rows, and each Row can have multiple Seats.
"""

from django.db import models


class Venue(models.Model):
    """Represents a physical venue (stadium, theater, hall)."""

    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True)
    address = models.TextField(blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Venues"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Section(models.Model):
    """A section within a venue (e.g. balcony, floor, VIP)."""

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name="sections")
    name = models.CharField(max_length=255)
    sort_order = models.IntegerField(default=0)

    class Meta:
        verbose_name_plural = "Sections"
        ordering = ["venue", "sort_order", "name"]

    def __str__(self) -> str:
        return f"{self.venue.name} – {self.name}"


class Row(models.Model):
    """A row within a section."""

    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="rows")
    name = models.CharField(max_length=50)
    order = models.IntegerField(default=0)

    class Meta:
        verbose_name_plural = "Rows"
        ordering = ["section", "order", "name"]

    def __str__(self) -> str:
        return f"{self.section.name} Row {self.name}"


class Seat(models.Model):
    """A seat within a row."""

    SEAT_TYPE_CHOICES = [
        ("standard", "Standard"),
        ("vip", "VIP"),
        ("accessible", "Accessible"),
    ]

    row = models.ForeignKey(Row, on_delete=models.CASCADE, related_name="seats")
    number = models.CharField(max_length=10)
    seat_type = models.CharField(max_length=20, choices=SEAT_TYPE_CHOICES, default="standard")

    class Meta:
        verbose_name_plural = "Seats"
        ordering = ["row", "number"]
        unique_together = ["row", "number"]

    def __str__(self) -> str:
        return f"Seat {self.number} ({self.row.section.venue.name})"
