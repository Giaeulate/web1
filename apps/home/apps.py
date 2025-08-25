"""
Application configuration for the home app.

This configuration defines the Django application for the Wagtail home
pages. It registers the app's label and default primary key field type.
"""

from django.apps import AppConfig


class HomeConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.home"