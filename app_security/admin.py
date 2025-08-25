# app_security/admin.py
from django import forms
from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin as DjangoGroupAdmin
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType

from .models import SecurityPolicy

REQUIRE_2FA_CODENAME = "require_2fa"


class GroupAdminForm(forms.ModelForm):
    """
    ModelForm (tiene save_m2m). Añade el checkbox 'require_2fa'.
    NO toca M2M aquí (commit puede ser False en el add view).
    """
    require_2fa = forms.BooleanField(
        required=False,
        label="Requiere 2FA",
        help_text="Si está marcado, los miembros del grupo deben usar 2FA para acceder al admin.",
    )

    class Meta:
        model = Group
        fields = ("name", "permissions", "require_2fa")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        try:
            ct = ContentType.objects.get_for_model(SecurityPolicy)
            perm = Permission.objects.get(content_type=ct, codename=REQUIRE_2FA_CODENAME)
            if self.instance and self.instance.pk:
                self.fields["require_2fa"].initial = self.instance.permissions.filter(pk=perm.pk).exists()
        except Permission.DoesNotExist:
            # si aún no migraste, deja el checkbox en False
            self.fields["require_2fa"].initial = False

    # NO toques M2M aquí. Deja que el admin guarde y luego sincronizamos en save_related().
    # def save(self, commit=True): return super().save(commit=commit)


class GroupAdmin(DjangoGroupAdmin):
    form = GroupAdminForm
    filter_horizontal = ("permissions",)
    list_display = ("name", "require_2fa_flag")

    def get_form(self, request, obj=None, **kwargs):
        # Asegura nuestro ModelForm tanto en add como en change
        defaults = {"form": GroupAdminForm}
        defaults.update(kwargs)
        return super().get_form(request, obj, **defaults)

    def save_related(self, request, form, formsets, change):
        """
        El admin ya guardó el Group (tiene pk) y sus M2M.
        Aquí sincronizamos el permiso 'app_security.require_2fa' según el checkbox.
        """
        super().save_related(request, form, formsets, change)
        try:
            ct = ContentType.objects.get_for_model(SecurityPolicy)
            perm = Permission.objects.get(content_type=ct, codename=REQUIRE_2FA_CODENAME)
        except Permission.DoesNotExist:
            return  # permiso aún no creado (faltan migraciones)

        group = form.instance  # ya tiene id
        if form.cleaned_data.get("require_2fa"):
            group.permissions.add(perm)
        else:
            group.permissions.remove(perm)

    def require_2fa_flag(self, obj):
        try:
            ct = ContentType.objects.get_for_model(SecurityPolicy)
            return obj.permissions.filter(content_type=ct, codename=REQUIRE_2FA_CODENAME).exists()
        except Exception:
            return False

    require_2fa_flag.short_description = "Requiere 2FA"
    require_2fa_flag.boolean = True


# Desregistrar el admin por defecto y registrar el nuestro
try:
    admin.site.unregister(Group)
except admin.sites.NotRegistered:
    pass

admin.site.register(Group, GroupAdmin)
