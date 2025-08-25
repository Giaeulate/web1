from django import forms
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta

from two_factor.forms import DeviceValidationForm
from django_otp import login as otp_login
from django_otp.oath import totp  # debug opcional

LOCK_HOURS = 0.1
MAX_FAILS  = 3

def _keys(uid: int):
    return (f"otp_lock:{uid}", f"otp_failcnt:{uid}")

class ThrottledDeviceValidationForm(DeviceValidationForm):
    def __init__(self, device, *args, request=None, **kwargs):
        self.request       = request
        self._uid          = getattr(device, "user_id", None) or getattr(getattr(device, "user", None), "pk", None)
        self.max_fails     = MAX_FAILS
        self.lock_hours    = LOCK_HOURS
        self.lock_minutes  = int(LOCK_HOURS * 60)
        self.attempts_left = None
        super().__init__(device, *args, **kwargs)  # -> self.device

        if self._uid:
            fails = cache.get(_keys(self._uid)[1], 0) or 0
            self.attempts_left = max(0, MAX_FAILS - fails)

        if settings.DEBUG and getattr(self, "device", None):
            try:
                self.debug_device_id   = self.device.pk
                self.debug_server_code = f"{totp(self.device.bin_key, step=self.device.step, t0=getattr(self.device,'t0',0), digits=self.device.digits):0{self.device.digits}d}"
            except Exception:
                self.debug_device_id = None
                self.debug_server_code = None

    def clean_token(self):
        # Si no tenemos UID, delega
        if self._uid is None:
            return super().clean_token()

        lock_key, cnt_key = _keys(self._uid)
        now = timezone.now()

        # ¿Bloqueado?
        locked_until = cache.get(lock_key)
        if locked_until and locked_until > now:
            self.attempts_left = 0
            minutes = max(1, int((locked_until - now).total_seconds() // 60))
            raise forms.ValidationError(
                f"Demasiados intentos fallidos. Inténtalo nuevamente en {minutes} minutos.",
                code="locked",
            )

        # Parseo del token
        raw = self.cleaned_data.get("token")
        try:
            token = int(str(raw).strip())
        except (TypeError, ValueError):
            token = None

        # Idempotencia por request (el wizard puede validar dos veces)
        if self.request is not None:
            already_ok  = getattr(self.request, "_otp_token_valid", False)
            already_val = getattr(self.request, "_otp_token_value", None)
            if already_ok and already_val == token:
                if getattr(self, "device", None):
                    otp_login(self.request, self.device)
                self.attempts_left = MAX_FAILS
                return token

        # --- cálculo de ventana actual (t) y segundos restantes ---
        step   = int(getattr(self.device, "step", 30))
        t0     = int(getattr(self.device, "t0", 0))
        now_ts = int(now.timestamp())
        now_t  = (now_ts - t0) // step
        secs_left = step - ((now_ts - t0) % step)

        # Validación real
        is_valid = bool(self.device and token and self.device.verify_token(token))

        if not is_valid:
            # ★ Detección de reutilización: ya hubo un éxito en esta misma ventana
            last_t = getattr(self.device, "last_t", None)
            if last_t is not None and last_t == now_t:
                # No contamos como fallo ni bloqueamos
                self.attempts_left = max(0, self.attempts_left if self.attempts_left is not None else MAX_FAILS)
                raise forms.ValidationError(
                    f"Ya usaste este código. Espera {secs_left} s hasta que cambie y escribe el siguiente.",
                    code="token_reused",
                )

            # Ruta normal de error: cuenta el fallo y aplica bloqueo si corresponde
            fails = (cache.get(cnt_key, 0) or 0) + 1
            cache.set(cnt_key, fails, int(LOCK_HOURS * 3600))
            if fails >= MAX_FAILS:
                cache.set(lock_key, now + timedelta(hours=LOCK_HOURS), int(LOCK_HOURS * 3600))
                self.attempts_left = 0
                raise forms.ValidationError(
                    f"Has superado los {MAX_FAILS} intentos. Tu cuenta queda bloqueada por {LOCK_HOURS} horas.",
                    code="locked",
                )
            self.attempts_left = MAX_FAILS - fails
            raise forms.ValidationError(
                f"Código inválido. Te quedan {self.attempts_left} intento(s) antes del bloqueo.",
                code="invalid_token",
            )

        # Éxito: limpia contador/bloqueo y marca OTP en sesión
        cache.delete_many([lock_key, cnt_key])
        self.attempts_left = MAX_FAILS
        if self.request is not None:
            otp_login(self.request, self.device)
            setattr(self.request, "_otp_token_valid", True)
            setattr(self.request, "_otp_token_value", token)
        return token
