# security/views.py
from django.conf import settings
from django.shortcuts import redirect
from django.utils.http import url_has_allowed_host_and_scheme

from two_factor.views.core import LoginView as BaseLoginView, SetupView as BaseSetupView
from two_factor.utils import default_device
from django_otp import login as otp_login
from django_otp.plugins.otp_totp.models import TOTPDevice

from .forms import ThrottledDeviceValidationForm


class ThrottledLoginView(BaseLoginView):
    """
    - Usa ThrottledDeviceValidationForm en el paso 'token'
    - Inyecta el TOTPDevice confirmado más reciente (o el default)
    - Marca OTP en sesión en done(), después de auth.login()
    """

    def get_form_list(self):
        base = super().get_form_list()
        try:
            mapping = base.copy()
        except AttributeError:
            from collections import OrderedDict
            if isinstance(base, (list, tuple)):
                mapping = OrderedDict(base)
            else:
                mapping = OrderedDict()
                mapping.update(base)
        if "token" in mapping:
            mapping["token"] = ThrottledDeviceValidationForm
        return mapping

    def get_device(self, user=None):
        u = user or self.get_user()
        if not (u and getattr(u, "is_authenticated", False)):
            return None
        dev = default_device(u)
        if dev:
            return dev
        return (
            TOTPDevice.objects
            .filter(user=u, confirmed=True)
            .order_by("-id")
            .first()
        )

    def get_form_kwargs(self, step=None):
        kwargs = super().get_form_kwargs(step)
        step = step or self.steps.current
        if step == "token":
            # No dejes 'user' para el form custom (la base lo usaría)
            kwargs.pop("user", None)
            kwargs["device"]  = self.get_device(kwargs.get("user"))
            kwargs["request"] = self.request
        elif step == "backup":
            kwargs["user"] = self.get_user()
        return kwargs

    def done(self, form_list, **kwargs):
        # Primero deja que la base haga auth.login (rotación de sesión)
        response = super().done(form_list, **kwargs)

        # Ahora marcamos OTP en la sesión definitiva
        dev = self.get_device()
        if dev:
            otp_login(self.request, dev)
        return response


class SetupToAdminView(BaseSetupView):
    def done(self, form_list, **kwargs):
        super().done(form_list, **kwargs)
        next_url = self.request.POST.get("next") or self.request.GET.get("next")
        if next_url and url_has_allowed_host_and_scheme(next_url, allowed_hosts={self.request.get_host()}):
            return redirect(next_url)
        return redirect(getattr(settings, "LOGIN_REDIRECT_URL", "/admin/"))
