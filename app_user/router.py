# web/auth_endpoints.py
from __future__ import annotations

import io
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, status, Depends, Body
from pydantic import BaseModel

from django.contrib.auth import authenticate, get_user_model
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone as dj_timezone

from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.exceptions import TokenError

# JWT: dependencia que valida Bearer y devuelve el payload (con user_id)
from web.auth_jwt import get_current_user

# TOTP de django-two-factor-auth / django-otp
from django_otp.plugins.otp_totp.models import TOTPDevice

router = APIRouter(tags=["Auth"])
User = get_user_model()

# --------------------------
# Config throttling TOTP
# --------------------------
LOCK_HOURS = getattr(settings, "TOTP_LOCK_HOURS", 0.1)  # ~6 minutos por defecto
MAX_FAILS  = getattr(settings, "TOTP_MAX_FAILS", 3)

def _otp_keys(uid: int):
    return (f"otp_lock:{uid}", f"otp_failcnt:{uid}")

# --------------------------
# Modelos de request/response
# --------------------------
class LoginIn(BaseModel):
    username: str
    password: str

class TokenPair(BaseModel):
    access: str
    refresh: str
    token_type: str = "bearer"
    expires_in: int  # segundos hasta que expire el access

class RefreshIn(BaseModel):
    refresh: str

class CodeModel(BaseModel):
    code: str  # 6 dígitos

# --------------------------
# Utilidades
# --------------------------
def _access_expires_in_seconds(access: AccessToken) -> int:
    exp_ts = int(access["exp"])
    now_ts = int(datetime.now(tz=timezone.utc).timestamp())
    return max(exp_ts - now_ts, 0)

def _get_user_from_jwt(current_user: dict) -> User:
    user_id = current_user.get("user_id") or current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    try:
        return User.objects.get(pk=user_id)
    except User.DoesNotExist:
        raise HTTPException(status_code=401, detail="User not found")

def _build_qr_data_uri(otpauth_url: str) -> str:
    """
    Genera un PNG embebido (data:image/png;base64,...) para mostrar en <img src="...">.
    Usa qrcode + Pillow (PilImage) para evitar el error PyPNGImage.save(...).
    """
    try:
        import qrcode
        from qrcode.image.pil import PilImage  # requiere Pillow
    except Exception as e:
        # Si no están instalados, recomendamos instalarlos explícitamente.
        raise HTTPException(
            status_code=500,
            detail=f"QR dependencies missing: install 'qrcode[pil]' and 'Pillow'. Error: {e}"
        )

    buf = io.BytesIO()
    qrcode.make(
        otpauth_url,
        image_factory=PilImage,  # <- importante para que .save(format="PNG") funcione
        box_size=8,
        border=2,
    ).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

# --------------------------
# Login / Refresh clásicos
# --------------------------
@router.post("/login", response_model=TokenPair, tags=["Auth"], summary="Login (password)")
def login(data: LoginIn):
    user = authenticate(username=data.username, password=data.password)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    refresh = RefreshToken.for_user(user)
    access = refresh.access_token
    access["username"] = user.get_username()
    access["email"] = getattr(user, "email", "") or ""

    return TokenPair(
        access=str(access),
        refresh=str(refresh),
        expires_in=_access_expires_in_seconds(access),
    )

@router.post("/refresh", response_model=TokenPair, tags=["Auth"], summary="Refresh token")
def refresh_token(body: RefreshIn):
    try:
        refresh = RefreshToken(body.refresh)
    except TokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    access = refresh.access_token
    return TokenPair(
        access=str(access),
        refresh=str(refresh),  # mismo refresh si no rotas
        expires_in=_access_expires_in_seconds(access),
    )

# --------------------------
# TOTP (enrolamiento) - Opción 1
# --------------------------
@router.post("/totp-create", tags=["Auth"], summary="Create TOTP + QR (PNG data URI)")
def totp_create(current_user: dict = Depends(get_current_user)):
    """
    Crea (o reutiliza) el TOTPDevice del usuario autenticado y retorna:
      - otpauth_url: provisioning URI (otpauth://...)
      - qr_data_uri: imagen PNG embebida (data:image/png;base64,...) para <img src="...">
    Requiere: Authorization: Bearer <access>.
    """
    user = _get_user_from_jwt(current_user)

    # Reutiliza el device "default" si existe; si no, crea uno sin confirmar
    device = TOTPDevice.objects.filter(user=user, name="default").first()
    if not device:
        device = TOTPDevice.objects.create(user=user, confirmed=False, name="default")

    provisioning_uri = getattr(device, "config_url", None)
    if not provisioning_uri:
        raise HTTPException(
            status_code=409,
            detail="TOTP provisioning URL is not available; verify django-two-factor-auth install."
        )

    # Construimos el QR para el front (opción 1)
    qr_data_uri = _build_qr_data_uri(provisioning_uri)

    return {
        "status": True,
        "message": "Success",
        "item": {
            "otpauth_url": provisioning_uri,
            "qr_data_uri": qr_data_uri,
            "format": "png"
        },
    }

# --------------------------
# TOTP (verificación + throttling)
# --------------------------
@router.post("/totp-login", tags=["Auth"], summary="Login TOTP")
def totp_login(
    body: CodeModel = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Verifica el código TOTP del usuario autenticado.
    - Cuenta intentos fallidos en caché.
    - Bloquea temporalmente tras MAX_FAILS fallos.
    - Detecta reuso de código en la misma ventana (no cuenta como fallo).
    """
    user = _get_user_from_jwt(current_user)

    device = TOTPDevice.objects.filter(user=user, name="default").first()
    if not device:
        return _resp(False, "TOTP not configured", attempts_left=_get_attempts_left(user.pk), item=[])

    lock_key, cnt_key = _otp_keys(user.pk)
    now = dj_timezone.now()

    # ¿Bloqueado?
    locked_until = cache.get(lock_key)
    if locked_until and locked_until > now:
        remaining_seconds = int((locked_until - now).total_seconds())
        remaining_minutes = max(1, remaining_seconds // 60)
        return _resp(
            False,
            f"Demasiados intentos fallidos. Intenta nuevamente en {remaining_seconds} segundos.",
            attempts_left=0,
            item=[],
            lock_minutes=remaining_minutes,
        )

    # Parse token
    try:
        token_int = int(str(body.code).strip())
    except (TypeError, ValueError):
        token_int = None

    # Ventana temporal actual y segundos restantes (para mensajes)
    step = int(getattr(device, "step", 30))
    t0 = int(getattr(device, "t0", 0))
    now_ts = int(now.timestamp())
    now_t = (now_ts - t0) // step
    secs_left = step - ((now_ts - t0) % step)

    is_valid = bool(device and token_int and device.verify_token(token_int))
    if not is_valid:
        # Re-uso de código (ya hubo éxito en esta misma ventana): no cuenta como fallo
        last_t = getattr(device, "last_t", None)
        if last_t is not None and last_t == now_t:
            return _resp(
                False,
                f"Ya usaste este código. Espera {secs_left} segundos y escribe el siguiente.",
                attempts_left=_get_attempts_left(user.pk),
                item=[],
            )

        # Ruta normal de error: suma fallo y aplica bloqueo si corresponde
        fails = (cache.get(cnt_key, 0) or 0) + 1
        cache.set(cnt_key, fails, int(LOCK_HOURS * 3600))
        if fails >= MAX_FAILS:
            cache.set(lock_key, now + timedelta(hours=LOCK_HOURS), int(LOCK_HOURS * 3600))
            return _resp(
                False,
                f"Has superado los {MAX_FAILS} intentos. Tu cuenta queda bloqueada por {int(LOCK_HOURS * 60)} minutos.",
                attempts_left=0,
                item=[],
                lock_minutes=int(LOCK_HOURS * 60),
            )

        return _resp(
            False,
            f"Código inválido. Te quedan {MAX_FAILS - fails} intento(s) antes del bloqueo.",
            attempts_left=MAX_FAILS - fails,
            item=[],
        )

    # Éxito: limpia lock/contador y confirma si es primera vez
    cache.delete_many([lock_key, cnt_key])
    if not device.confirmed:
        device.confirmed = True
        device.save()

    return _resp(True, "Success", attempts_left=MAX_FAILS, item=[])

# --------------------------
# Helpers de respuesta
# --------------------------
def _get_attempts_left(uid: int) -> int:
    fails = cache.get(_otp_keys(uid)[1], 0) or 0
    return max(0, MAX_FAILS - int(fails))

def _resp(status_ok: bool, message: str, *, attempts_left: int, item: Any,
          lock_minutes: Optional[int] = None) -> Dict[str, Any]:
    data: Dict[str, Any] = {
        "status": status_ok,
        "message": message,
        "attempts_left": attempts_left,  # 👈 lo exponemos claramente
        "item": item,
    }
    if lock_minutes is not None:
        data["lock_minutes"] = lock_minutes
    return data
