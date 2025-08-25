# # views.py
# from django.views.decorators.csrf import csrf_exempt
# from django.http import HttpResponse
# from django.shortcuts import get_object_or_404
# from app_seat.models import Venue
# from django.contrib.gis.geos import Point

# @csrf_exempt
# def whatsapp_webhook(request):
#     latitude = request.POST.get('Latitude') or request.POST.get('latitude')
#     longitude = request.POST.get('Longitude') or request.POST.get('longitude')
#     # nombre opcional del lugar
#     name = request.POST.get('Body') or request.POST.get('name') or 'Ubicación WhatsApp'

#     if latitude and longitude:
#         lat = float(latitude)
#         lon = float(longitude)
#         # si usas geom PointField:
#         geom = Point(lon, lat)  # GeoDjango almacena (longitud, latitud)
#         venue = Venue.objects.create(
#             name=name,
#             latitude=lat,
#             longitude=lon,
#             geom=geom,
#         )
#         # o actualiza un registro existente, p.ej. vinculado a la reserva
#     return HttpResponse(status=204)


# app_seat/views.py (Twilio y Meta)
import json
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse, JsonResponse, HttpResponseBadRequest
from django.contrib.gis.geos import Point
from .models import Venue

# --- TWILIO: /webhooks/whatsapp/twilio/ ---
@csrf_exempt
def whatsapp_twilio_webhook(request):
    """
    Twilio envía application/x-www-form-urlencoded.
    Para mensajes de tipo ubicación tendrás:
      Latitude, Longitude, Body (opcional), ProfileName, From, etc.
    """
    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    latitude = request.POST.get('Latitude') or request.POST.get('latitude')
    longitude = request.POST.get('Longitude') or request.POST.get('longitude')
    name = request.POST.get('Body') or request.POST.get('ProfileName') or 'Ubicación WhatsApp'

    if latitude and longitude:
        lat = float(str(latitude).replace(",", "."))
        lon = float(str(longitude).replace(",", "."))
        v = Venue.objects.create(
            name=name,
            latitude=lat,
            longitude=lon,
            geom=Point(lon, lat, srid=4326),
        )
        # 204: no content; Twilio no necesita respuesta específica
        return HttpResponse(status=204)

    # Si Body trae un link de mapas (copiado desde WhatsApp)
    body = request.POST.get("Body")
    if body:
        from .utils import extract_lat_lon_from_link
        pair = extract_lat_lon_from_link(body.strip())
        if pair:
            lat, lon = pair
            Venue.objects.create(
                name=name,
                latitude=lat,
                longitude=lon,
                geom=Point(lon, lat, srid=4326),
            )
            return HttpResponse(status=204)

    return HttpResponse(status=204)


# app_seat/views.py (continúa)
import hmac, hashlib

VERIFY_TOKEN = "tu_token_verificacion"  # ponlo en settings/variables de entorno
APP_SECRET = None  # si deseas validar X-Hub-Signature-256

def _verify_meta_signature(request):
    if not APP_SECRET:
        return True
    sig = request.headers.get("X-Hub-Signature-256", "")
    if not sig.startswith("sha256="):
        return False
    digest = hmac.new(APP_SECRET.encode(), request.body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, f"sha256={digest}")

@csrf_exempt
def whatsapp_meta_verify(request):
    # GET para verificación del webhook: Meta llamará con hub.mode, hub.verify_token, hub.challenge
    mode = request.GET.get("hub.mode")
    token = request.GET.get("hub.verify_token")
    challenge = request.GET.get("hub.challenge")
    if mode == "subscribe" and token == VERIFY_TOKEN:
        return HttpResponse(challenge)
    return HttpResponseBadRequest("Verification failed")

@csrf_exempt
def whatsapp_meta_webhook(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    if not _verify_meta_signature(request):
        return HttpResponse(status=403)

    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return HttpResponseBadRequest("Invalid JSON")

    # Recorre entradas -> cambios -> mensajes
    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            msgs = value.get("messages", [])
            for m in msgs:
                if m.get("type") == "location":
                    lat = float(m["location"]["latitude"])
                    lon = float(m["location"]["longitude"])
                    name = m["location"].get("name") or "Ubicación WhatsApp"
                    Venue.objects.create(
                        name=name,
                        latitude=lat,
                        longitude=lon,
                        geom=Point(lon, lat, srid=4326),
                    )
                elif m.get("type") == "text":
                    # Si te envían un link de mapas como texto
                    body = m["text"].get("body", "")
                    from .utils import extract_lat_lon_from_link
                    pair = extract_lat_lon_from_link(body)
                    if pair:
                        lat, lon = pair
                        Venue.objects.create(
                            name="Ubicación WhatsApp",
                            latitude=lat,
                            longitude=lon,
                            geom=Point(lon, lat, srid=4326),
                        )
    return HttpResponse(status=200)
