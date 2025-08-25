# app_seat/urls.py
from django.urls import path
from .views import (
    whatsapp_twilio_webhook,
    whatsapp_meta_verify,
    whatsapp_meta_webhook,
)

urlpatterns = [
    path("webhooks/whatsapp/twilio/", whatsapp_twilio_webhook, name="whatsapp-twilio"),
    path("webhooks/whatsapp/meta/verify/", whatsapp_meta_verify, name="whatsapp-meta-verify"),
    path("webhooks/whatsapp/meta/", whatsapp_meta_webhook, name="whatsapp-meta"),
]
