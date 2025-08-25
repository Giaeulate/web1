from django.db.models import *
from django.conf import settings
from django.utils import timezone
from app_core.models import AutoDateTimeIdAbstract, GeomPointIdAbstract


class Venue(GeomPointIdAbstract):
    """Recinto físico (estadio, teatro, sala)."""
    name = CharField(max_length=255, unique=True)
    slug = SlugField(max_length=255, unique=True)
    address = TextField(blank=True)
    description = TextField(blank=True)

    class Meta:
        verbose_name_plural = "Venues"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Section(AutoDateTimeIdAbstract):
    """Sección dentro de un recinto (p. ej. platea, anfiteatro, VIP)."""

    venue = ForeignKey(Venue, on_delete=CASCADE, related_name="sections")
    name = CharField(max_length=255)
    sort_order = IntegerField(default=0)

    class Meta:
        verbose_name_plural = "Sections"
        ordering = ["venue", "sort_order", "name"]

    def __str__(self) -> str:
        return f"{self.venue.name} – {self.name}"


class Row(AutoDateTimeIdAbstract):
    """Fila dentro de una sección."""

    section = ForeignKey(Section, on_delete=CASCADE, related_name="rows")
    name = CharField(max_length=50)
    order = IntegerField(default=0)

    class Meta:
        verbose_name_plural = "Rows"
        ordering = ["section", "order", "name"]

    def __str__(self) -> str:
        return f"{self.section.name} – fila {self.name}"


class Seat(AutoDateTimeIdAbstract):
    """Butaca concreta dentro de una fila."""

    SEAT_TYPE_CHOICES = [
        ("standard", "Standard"),
        ("vip", "VIP"),
        ("accessible", "Accessible"),
    ]

    row = ForeignKey(Row, on_delete=CASCADE, related_name="seats")
    number = CharField(max_length=10)
    seat_type = CharField(
        max_length=20, choices=SEAT_TYPE_CHOICES, default="standard"
    )

    class Meta:
        verbose_name_plural = "Seats"
        ordering = ["row", "number"]
        unique_together = ["row", "number"]

    def __str__(self) -> str:
        # Incluye sección y fila para identificar fácilmente el asiento
        return f"{self.row.section.name} {self.row.name} – asiento {self.number}"


class SeatMap(AutoDateTimeIdAbstract):
    """Plano de butacas asociado a un recinto. Guarda la disposición como JSON."""

    venue = ForeignKey(Venue, on_delete=CASCADE, related_name="seatmaps")
    name = CharField(max_length=255)
    data = JSONField(default=dict, blank=True)

    class Meta:
        verbose_name_plural = "Seat maps"
        unique_together = ["venue", "name"]
        ordering = ["venue", "name"]

    def __str__(self) -> str:
        return f"{self.venue.name} – {self.name}"


class Event(AutoDateTimeIdAbstract):
    """Evento programado en un recinto con un plano de asientos concreto."""

    name = CharField(max_length=255)
    slug = SlugField(max_length=255, unique=True)
    venue = ForeignKey(Venue, on_delete=CASCADE, related_name="events")
    seatmap = ForeignKey(SeatMap, on_delete=CASCADE, related_name="events")
    start_datetime = DateTimeField()
    end_datetime = DateTimeField(null=True, blank=True)
    description = TextField(blank=True)

    class Meta:
        verbose_name_plural = "Events"
        ordering = ["start_datetime"]

    def __str__(self) -> str:
        return f"{self.name} ({self.start_datetime})"


class PriceCategory(AutoDateTimeIdAbstract):
    """Categorías de precio para un evento (p. ej. VIP, General)."""

    event = ForeignKey(
        Event, on_delete=CASCADE, related_name="price_categories"
    )
    name = CharField(max_length=100)
    price = DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        verbose_name_plural = "Price categories"
        unique_together = ["event", "name"]
        ordering = ["event", "name"]

    def __str__(self) -> str:
        return f"{self.name} – {self.price} ({self.event.name})"


class EventSeat(AutoDateTimeIdAbstract):
    """Estado de un asiento para un evento concreto."""

    STATUS_CHOICES = [
        ("available", "Available"),
        ("held", "Held"),
        ("booked", "Booked"),
    ]

    event = ForeignKey(
        Event, on_delete=CASCADE, related_name="seats"
    )
    seat = ForeignKey(
        Seat, on_delete=CASCADE, related_name="event_seats"
    )
    status = CharField(
        max_length=10, choices=STATUS_CHOICES, default="available"
    )
    price_category = ForeignKey(
        PriceCategory, on_delete=SET_NULL, null=True, blank=True
    )
    hold_expires_at = DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "Event seats"
        unique_together = ["event", "seat"]
        ordering = ["event", "seat__row__section", "seat__row", "seat__number"]

    def __str__(self) -> str:
        return f"{self.event.name} – {self.seat} [{self.status}]"


class Hold(AutoDateTimeIdAbstract):
    """Retención temporal de uno o varios asientos para un evento.

    Una retención impide que otros usuarios reserven las mismas butacas
    mientras el cliente finaliza la compra. Expira en `expires_at`.
    """

    user = ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=SET_NULL,
        null=True,
        blank=True,
        related_name="holds",
        help_text="Usuario que creó esta retención, si aplica.",
    )
    event = ForeignKey(
        Event,
        on_delete=CASCADE,
        related_name="holds",
        help_text="Evento para el que se están reteniendo asientos.",
    )
    seats = ManyToManyField(
        EventSeat,
        related_name="holds",
        help_text="Asientos del evento actualmente en espera.",
    )
    expires_at = DateTimeField(
        help_text="Fecha y hora en que expira la retención y los asientos vuelven a estar disponibles."
    )

    class Meta:
        verbose_name_plural = "Holds"
        ordering = ["expires_at"]

    def __str__(self) -> str:
        user_display = self.user.get_username() if self.user else "guest"
        return f"Hold for {self.event.name} by {user_display}"

    def is_expired(self) -> bool:
        """Devuelve True si la retención ha expirado."""
        return timezone.now() >= self.expires_at


class Booking(AutoDateTimeIdAbstract):
    """Reserva de asientos confirmada o en proceso para un evento.

    Registra la compra final de asientos (o un checkout en curso)
    después de una retención. Incluye el precio total, el estado y
    los asientos reservados.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("cancelled", "Cancelled"),
    ]

    user = ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=SET_NULL,
        null=True,
        blank=True,
        related_name="bookings",
        help_text="Usuario que realizó la reserva, si aplica.",
    )
    event = ForeignKey(
        Event,
        on_delete=CASCADE,
        related_name="bookings",
        help_text="Evento para el que se reservan los asientos.",
    )
    seats = ManyToManyField(
        EventSeat,
        related_name="bookings",
        help_text="Asientos del evento incluidos en la reserva.",
    )
    total_price = DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Precio total pagado por esta reserva.",
    )
    status = CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Estado actual de la reserva.",
    )

    class Meta:
        verbose_name_plural = "Bookings"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Booking #{self.pk} for {self.event.name}"
