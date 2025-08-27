from django.db.models.signals import post_save
from django.dispatch import receiver
from django.apps import apps
from django.db.models import Field
from django.contrib.auth import get_user_model
from django.contrib import admin

from app_core.models import AdminColumnPreference

# Función utilitaria para obtener los campos extra del ModelAdmin
def get_extra_fields_for_model(model):
    admin_class = admin.site._registry.get(model)
    if not admin_class:
        return []

    # Solo aplicar extra_fields si están definidos explícitamente
    if not hasattr(admin_class, 'extra_fields'):
        return []

    extra_fields = getattr(admin_class, 'extra_fields', [])
    return [f for f in extra_fields if hasattr(admin_class, f)]

@receiver(post_save, sender=get_user_model())
def create_admin_column_preferences(sender, instance, created, **kwargs):
    if not created:
        return

    for model in apps.get_models():
        model_name = model.__name__

        # Campos normales del modelo (excluyendo relaciones e 'id')
        field_names = [
            f.name for f in model._meta.fields
            if isinstance(f, Field) and not f.is_relation and f.name != 'id'
        ]

        # Campos extra definidos en el ModelAdmin
        extra_fields = get_extra_fields_for_model(model)

        # Unir ambos sin duplicados
        all_fields = list(dict.fromkeys(field_names + extra_fields))

        if not all_fields:
            continue

        if not AdminColumnPreference.objects.filter(user=instance, model_name=model_name).exists():
            AdminColumnPreference.objects.create(
                user=instance,
                model_name=model_name,
                columns=all_fields
            )

# @receiver(post_save, sender=get_user_model())
# def create_driver_profile(sender, instance, created, **kwargs):
#     if created and getattr(instance, "is_driver", False) and not hasattr(instance, "driver_profile"):
#         DriverProfile.objects.create(user=instance)
