"""
Models for ticket holds and bookings.

This module defines two core models used during the ticket purchasing
workflow: ``Hold`` and ``Booking``. ``Hold`` records a temporary
reservation of seats for a specific event, optionally linked to a user.
``Booking`` represents a confirmed or pending purchase of one or more
seats for an event. Together they help prevent double booking of
seats and provide a record of completed purchases.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.events.models import Event, EventSeat


class Hold(models.Model):
    """A temporary hold on one or more seats for a given event.

    Holds are used to prevent other users from reserving the same seats
    while a customer completes the checkout process. They expire after
    ``expires_at`` and can optionally be associated with an authenticated
    user. When a hold expires, the seats should return to the
    ``available`` status.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="holds",
        help_text="The user that created this hold, if applicable.",
    )
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="holds",
        help_text="The event for which seats are being held.",
    )
    seats = models.ManyToManyField(
        EventSeat,
        related_name="holds",
        help_text="The event seats that are currently on hold.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(help_text="When this hold expires and seats become available again.")

    class Meta:
        verbose_name_plural = "Holds"
        ordering = ["expires_at"]

    def __str__(self) -> str:
        user_display = self.user.get_username() if self.user else "guest"
        return f"Hold for {self.event.name} by {user_display}"

    def is_expired(self) -> bool:
        """Return True if the hold has expired based on the current time."""

        return timezone.now() >= self.expires_at


class Booking(models.Model):
    """A confirmed or pending booking of seats for an event.

    Bookings record the finalised purchase of seats (or an in‑progress
    checkout) after a hold. They include the total price, status and
    timestamps for auditing. A booking can optionally be associated with
    an authenticated user.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("cancelled", "Cancelled"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bookings",
        help_text="The user who made this booking, if applicable.",
    )
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="bookings",
        help_text="The event for which seats are booked.",
    )
    seats = models.ManyToManyField(
        EventSeat,
        related_name="bookings",
        help_text="The event seats included in this booking.",
    )
    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="The total price paid for this booking.",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="The current status of the booking.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Bookings"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Booking #{self.pk} for {self.event.name}"