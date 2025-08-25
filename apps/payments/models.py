"""
Models for payment processing.

The Payment model stores transaction details for a booking. It keeps
track of the payment provider, transaction status and identifiers so
that administrators can audit payments and reconcile them with
external payment gateways (e.g. Stripe, PayPal). Each payment is
linked to a single booking.
"""

from django.conf import settings
from django.db import models

from apps.tickets.models import Booking


class Payment(models.Model):
    """Represents a payment made for a booking."""

    PROVIDER_CHOICES = [
        ("stripe", "Stripe"),
        ("paypal", "PayPal"),
        ("manual", "Manual"),
    ]
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name="payment",
        help_text="The booking this payment is associated with.",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
        help_text="The user who completed the payment, if known.",
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="The total amount paid.",
    )
    provider = models.CharField(
        max_length=20,
        choices=PROVIDER_CHOICES,
        default="stripe",
        help_text="The payment provider used for this transaction.",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="The current status of the payment.",
    )
    transaction_id = models.CharField(
        max_length=255,
        blank=True,
        help_text="The provider's transaction identifier.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Payments"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Payment for booking #{self.booking.pk}" if self.booking_id else "Payment"