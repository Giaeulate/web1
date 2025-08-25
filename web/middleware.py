# security/middleware.py
from django.contrib import messages
from django.shortcuts import redirect
from django.urls import reverse
from django_otp.plugins.otp_totp.models import TOTPDevice

ADMIN_URL_PREFIX = "/admin/"
EXEMPT_PREFIXES = ("/account/login", "/account/two_factor", "/admin/logout", "/static/", "/media/")

class Enforce2FAForGroupsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        u = getattr(request, "user", None)
        if u and u.is_authenticated and request.path.startswith(ADMIN_URL_PREFIX):
            if any(request.path.startswith(p) for p in EXEMPT_PREFIXES):
                return self.get_response(request)

            # 🌟 Chequeo dinámico: ¿tiene el permiso?
            if u.has_perm("security.require_2fa"):
                has_totp = TOTPDevice.objects.filter(user=u, confirmed=True).exists()
                is_verified = False
                if hasattr(u, "is_verified"):
                    try:
                        is_verified = u.is_verified()
                    except TypeError:
                        is_verified = bool(u.is_verified)

                if not has_totp:
                    messages.info(request, "Debes configurar la verificación en dos pasos para acceder al admin.")
                    return redirect(f"{reverse('two_factor_setup_custom')}?next={request.get_full_path()}")
                
                # print("data middleware", is_verified, u)
                if not is_verified:
                    messages.warning(request, "Verifica tu 2FA para continuar.")
                    return redirect(f"{reverse('two_factor_login_custom')}?next={request.get_full_path()}")

        return self.get_response(request)
