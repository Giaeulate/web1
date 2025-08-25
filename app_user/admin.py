# admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import CustomUser
from .forms import UserCreationForm, UserChangeForm


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin):
    # Formularios que usará el admin
    add_form = UserCreationForm     # formulario al crear
    form = UserChangeForm           # formulario al editar
    model = CustomUser

    # Columnas que se ven en el listado
    list_display = ('id', 'email', 'is_staff', 'is_active')
    ordering = ('email',)

    # Búsqueda
    search_fields = ('email',)

    # Campos que aparecen cuando EDITAS un usuario
    fieldsets = (
        (None, {"fields": ('email', 'password')}),
        # (_("Personal info"), {"fields": ()}),
        (_("Permissions"), {
            "fields": (
                "is_active",
                "is_staff",
                "is_superuser",
                "groups",
                "user_permissions",
            ),
        }),
        (_("Important dates"), {"fields": ("last_login",)}),
    )

    # Campos que aparecen cuando CREAS un usuario
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "password1", "password2"),
        }),
    )