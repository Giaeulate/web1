from django.contrib.gis import admin
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.apps import apps
from import_export.admin import ImportExportModelAdmin
from app_core.forms import AdminColumnPreferenceForm, TranslationAdminForm
from web.admin_utils import DynamicListDisplayMixin, TranslationMixin
from django.contrib.contenttypes.admin import GenericTabularInline
from .models import Translation, AdminColumnPreference
from django.utils.html import format_html


@admin.register(AdminColumnPreference)
class AdminColumnPreferenceAdmin(admin.ModelAdmin):
    form = AdminColumnPreferenceForm
    list_display = ("user", "model_name")
    search_fields = ("user__email", "model_name")


@admin.register(Translation)
class TranslationAdmin(ImportExportModelAdmin, DynamicListDisplayMixin, admin.ModelAdmin):
    form = TranslationAdminForm
    search_fields = ('translation', 'field', 'language')
    extra_exclude_fields = ('object_id', 'field')
    list_filter = ('model', 'language')

    def _redirect_to_model_changelist(self, request, obj):
        model_name = obj.model.lower()
        try:
            model = next(m for m in apps.get_models()
                         if m.__name__.lower() == model_name)
            return HttpResponseRedirect(reverse(f"admin:{model._meta.app_label}_{model._meta.model_name}_changelist"))
        except StopIteration:
            return super().response_add(request, obj)

    response_add = _redirect_to_model_changelist
    response_change = _redirect_to_model_changelist


# @admin.register(Unit)
# class UnitAdmin(ImportExportModelAdmin, TranslationMixin):
#     search_fields = ['name', 'label']


# class PhoneInline(GenericTabularInline):
#     model = Phone
#     extra = 1


# @admin.register(ApkVersionType)
# class ApkVersionTypeAdmin(admin.ModelAdmin):
#     list_display = [x.name for x in ApkVersionType._meta.fields]
#     # search_fields = ['',]

# @admin.register(ApkVersion)
# class ApkVersionAdmin(admin.ModelAdmin):
#     list_display = ('type', 'version', 'download_link')

#     def download_link(self, obj):
#         if obj.apk_file:
#             return format_html("<a href='{}' target='_blank'>Descargar</a>", obj.apk_file.url)
#         return "-"
#     download_link.short_description = "Descarga"