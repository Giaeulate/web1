# core/views.py
from django.conf import settings
from django.shortcuts import redirect
from django.utils.http import url_has_allowed_host_and_scheme
from two_factor.views.core import SetupView as TwoFactorSetupView

class SetupToAdminView(TwoFactorSetupView):
    """
    Redirige a ?next=... si está presente y es segura,
    si no, a LOGIN_REDIRECT_URL o /admin/.
    """
    def done(self, form_list, **kwargs):
        # Ejecuta la lógica original (crea dispositivo, etc.)
        super().done(form_list, **kwargs)

        next_url = self.request.POST.get("next") or self.request.GET.get("next")
        if next_url and url_has_allowed_host_and_scheme(
            next_url, allowed_hosts={self.request.get_host()}
        ):
            return redirect(next_url)
        return redirect(getattr(settings, "LOGIN_REDIRECT_URL", "/admin/"))
