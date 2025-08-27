# urls.py
from django.urls import path
from .views import seatmap_load, seatmap_save

app_name = "designer"

urlpatterns = [
    path("venues/<int:venue_id>/seatmap/load/", seatmap_load, name="seatmap_load"),
    path("venues/<int:venue_id>/seatmap/save/", seatmap_save, name="seatmap_save"),
]
