import uuid
from django.contrib.gis.db.models import *
from django.db.models.signals import pre_save
from django.core.validators import MaxValueValidator, MinValueValidator
from django.contrib.contenttypes.fields import GenericRelation
from django.utils.functional import lazy
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from app_user.models import CustomUser


class TranslatableModel(Model):
    class Meta:
        abstract = True

    def get_translation(self, field, lang='es'):
        from .models import Translation
        try:
            return Translation.objects.get(
                model=self.__class__.__name__,
                object_id=self.id,
                field=field,
                language=lang
            ).text
        except Translation.DoesNotExist:
            return getattr(self, field)


class AutoDateTimeAbstract(TranslatableModel, Model):
    order = IntegerField(default=1, verbose_name='Orden')
    active = BooleanField(default=True, verbose_name='Activo')
    created_at = DateTimeField(auto_now_add=True, verbose_name='Creado el')
    updated_at = DateTimeField(auto_now=True, verbose_name='Actualizado el')

    class Meta:
        abstract = True


class AutoDateTimeIdAbstract(AutoDateTimeAbstract):
    id = CharField(primary_key=True, max_length=150, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class GeomPointAbstract(AutoDateTimeAbstract):
    geom = PointField(blank=True, null=True, srid=4326, verbose_name='Ubicación')
    latitude = DecimalField(max_digits=9, decimal_places=6, null=True)
    longitude = DecimalField(max_digits=9, decimal_places=6, null=True)

    class Meta:
        abstract = True


class GeomPointIdAbstract(AutoDateTimeIdAbstract):
    # geom = PointField(blank=True, null=True, srid=4326, verbose_name='Ubicación')
    latitude = DecimalField(max_digits=9, decimal_places=6, null=True)
    longitude = DecimalField(max_digits=9, decimal_places=6, null=True)

    class Meta:
        abstract = True


class AdminColumnPreference(AutoDateTimeIdAbstract):
    user = ForeignKey(CustomUser, on_delete=CASCADE, verbose_name='Usuario')
    model_name = CharField(max_length=100, verbose_name='Modelo')
    columns = JSONField(default=list, verbose_name='Columnas')

    class Meta:
        unique_together = ("user", "model_name")
        verbose_name = "Preferencia de columnas"
        verbose_name_plural = "Preferencias de columnas"


# class Unit(AutoDateTimeIdAbstract):
#     name = CharField(max_length=150, verbose_name='Nombre')
#     label = CharField(max_length=150, verbose_name='Etiqueta')
#     conversion = FloatField(default=1, verbose_name='Conversión')

#     class Meta:
#         ordering = ('updated_at',)
#         verbose_name = 'Unidad'
#         verbose_name_plural = 'Unidades'

#     def __str__(self):
#         return str(self.name)


def get_all_model_choices(apps_whitelist=None):
    def _get():
        choices = []
        from django.apps import apps
        for model in apps.get_models():
            if not apps_whitelist or model._meta.app_label in apps_whitelist:
                model_name = model.__name__
                label = f"{model._meta.app_label}.{model_name}"
                # choices.append((model_name, label))
                choices.append((model_name, f"{model_name}"))
        return sorted(choices)
    return _get


LANGUAGE_CHOICES = [
    ('en', 'English'),
    ('es', 'Spanish'),
]


class Translation(AutoDateTimeIdAbstract):
    model = CharField(
        max_length=50,
        choices=lazy(get_all_model_choices(apps_whitelist=['app_core']), list)(),
        verbose_name='Modelo'
    )
    object_id = CharField(max_length=255, verbose_name='ID del objeto')
    field = CharField(max_length=50, verbose_name='Campo')
    language = CharField(max_length=10, choices=settings.LANGUAGES)
    translation = TextField(verbose_name='Traducción')

    class Meta:
        unique_together = ('model', 'object_id', 'field', 'language')
        indexes = [
            Index(fields=['model', 'object_id', 'field', 'language']),
        ]
        ordering = ('updated_at',)
        verbose_name = 'Traducción'
        verbose_name_plural = 'Traducciones'

    def __str__(self):
        return f"{self.model}.{self.field}[{self.language}]: {self.translation}"


# class Country(AutoDateTimeIdAbstract):
#     name = CharField(max_length=100, verbose_name='Nombre')
#     phone_code = CharField(max_length=10, verbose_name='Código de país')
#     iso_code = CharField(max_length=5,  unique=True, verbose_name='Código ISO')

#     class Meta:
#         ordering = ('updated_at',)
#         verbose_name = 'País'
#         verbose_name_plural = 'Países'

#     def __str__(self):
#         return f"{self.name} ({self.phone_code})"


# class Phone(AutoDateTimeIdAbstract):
#     # country = ForeignKey(Country, on_delete=CASCADE, blank=True, null=True, verbose_name='País')
#     number = CharField(max_length=150, verbose_name='Número')
#     content_type = ForeignKey(ContentType, on_delete=CASCADE, verbose_name='Tipo de contenido')
#     object_id = CharField(max_length=255, verbose_name='ID del objeto')
#     parent = GenericForeignKey('content_type', 'object_id')

#     class Meta:
#         ordering = ('updated_at',)
#         verbose_name = 'Teléfono'
#         verbose_name_plural = 'Teléfonos'

#     def __str__(self):
#         return f'{self.number} ({self.content_type} - {self.object_id})'




# class ApkVersionType(AutoDateTimeIdAbstract):
#     name = CharField(max_length=50, verbose_name="Nombre")

#     class Meta:
#         # ordering = ['-created_at']
#         verbose_name = "Tipo de APK"
#         verbose_name_plural = "Tipos de APK"

#     def __str__(self):
#         return self.name


# class ApkVersion(AutoDateTimeIdAbstract):
#     type = ForeignKey(ApkVersionType, on_delete=CASCADE, verbose_name="Tipo de APK")
#     version = CharField(max_length=20, verbose_name="Versión")
#     apk_file = FileField(upload_to='apk/', verbose_name="Archivo APK")

#     class Meta:
#         ordering = ['-created_at']
#         verbose_name = "Versión de APK"
#         verbose_name_plural = "APK internas"

#     def __str__(self):
#         return f"v{self.version} - {self.created_at.strftime('%Y-%m-%d')}"