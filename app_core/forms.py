from django import forms
from django.apps import apps
from django.db.models import CharField, TextField
from .models import Translation, AdminColumnPreference



class AdminColumnPreferenceForm(forms.ModelForm):
    MODEL_CHOICES = [('', '---------')]

    for model in apps.get_models():
        label = model.__name__  # 🧠 esto es lo que se guarda (y lo que usás en signals)
        verbose = f"{model._meta.app_label}.{model.__name__}"
        MODEL_CHOICES.append((label, verbose))

    model_name = forms.ChoiceField(
        choices=MODEL_CHOICES,
        required=True,
        widget=forms.Select(attrs={'class': 'vSelect form-control'})
    )

    class Meta:
        model = AdminColumnPreference
        fields = ['user', 'model_name', 'columns']

    class Media:
        css = {
            'all': (
                'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css',
            )
        }
        js = (
            'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js',
        )

class TranslationAdminForm(forms.ModelForm):
    # ✅ Construimos las opciones para todos los modelos disponibles
    MODEL_CHOICES = [('', '---------')]

    for model in apps.get_models():
        label = model._meta.label_lower  # Ej: 'core.unit'
        verbose = f"{model._meta.app_label}.{model.__name__}"  # Ej: 'core.Unit'
        MODEL_CHOICES.append((label, verbose))

    model = forms.ChoiceField(
        choices=MODEL_CHOICES,
        required=False,
        widget=forms.Select(attrs={'class': 'vSelect form-control'})
    )
    field = forms.ChoiceField(choices=[], required=False)
    object_id = forms.ChoiceField(choices=[], required=False)

    class Meta:
        model = Translation
        fields = ['model', 'field', 'object_id', 'language', 'translation']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        model_label = None

        # ✅ Obtenemos el valor del modelo desde la instancia o del POST
        if self.instance and self.instance.model:
            model_label = self.instance.model
        elif 'model' in self.data:
            model_label = self.data.get('model')

        if model_label:
            try:
                model = apps.get_model(model_label)
            except LookupError:
                model = None

            if model:
                # ✅ Agregamos solo campos de texto que sean editables
                field_choices = [
                    (f.name, f.verbose_name.title())
                    for f in model._meta.fields
                    if isinstance(f, (CharField, TextField)) and f.editable and f.name != 'id'
                ]
                self.fields['field'].choices = [('', '---------')] + field_choices

                field_selected = self.data.get('field') or self.instance.field
                if field_selected:
                    obj_queryset = model.objects.all().values('id', field_selected)
                    obj_choices = [
                        (obj['id'], obj[field_selected] or f"ID {obj['id']}")
                        for obj in obj_queryset
                    ]
                    self.fields['object_id'].choices = [('', '---------')] + obj_choices

    class Media:
        css = {
            'all': (
                'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css',
                # 'core/css/select2_dark.css',
            )
        }
        js = (
            # 'admin/js/jquery.init.js',
            # 'core/js/select2_patch.js',
            'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js',
            'js/translation_admin.js',
        )
