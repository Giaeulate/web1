from django.apps import AppConfig


class AppCoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "app_core"

    def ready(self):
        import app_core.signals