import os

from web.fastapi_registry import mount_from_settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "web.settings")

from django.conf import settings
from django.apps import apps
from django.core.wsgi import get_wsgi_application
from django.conf import settings as django_settings
import socketio

sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    async_mode="asgi",
    ping_interval=25,
    ping_timeout=60
)


# from .socket_handlers import register_socket_handlers
# register_socket_handlers(sio)

# ⚙️ FastAPI y middlewares
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.wsgi import WSGIMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import HTTPException, RequestValidationError
# 📦 Rutas y utilidades
from fastapi.responses import JSONResponse
from fastapi.openapi.utils import get_openapi
from fastapi.responses import FileResponse
import json
import mimetypes

apps.populate(settings.INSTALLED_APPS)

from app_user.router import router as router_user
# from core.utils import JwtBearer
# from web.utils import CustomResponse
# from web.exception_handlers import custom_http_exception_handler, custom_validation_exception_handler
# from user.router import router as user_router


def get_application() -> FastAPI:
    app = FastAPI(
        title=getattr(settings, "PROJECT_NAME", "FastAPI + Django"),
        debug=getattr(settings, "DEBUG", True),
        openapi_url="/api/v1/openapi.json"
    )

    # 🚨 Manejadores de errores
    # app.add_exception_handler(HTTPException, custom_http_exception_handler)
    # app.add_exception_handler(RequestValidationError, custom_validation_exception_handler)

    # 🌍 CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_HOSTS or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/download-openapi", tags=["Docs"])
    def download_openapi():
        openapi_schema = get_openapi(
            title=app.title,
            version=app.version,
            routes=app.routes,
        )
        filepath = "openapi.json"

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(openapi_schema, f, indent=2)

        return FileResponse(filepath, media_type='application/json', filename="openapi.json")

    mount_from_settings(app)
    # 📦 Rutas protegidas y públicas
    app.include_router(router_user, prefix="/api/auth")
    # app.include_router(user_router, prefix="/api/auth")
    # app.include_router(driver_router_public, prefix="/api/public/driver")

    # 🗂️ Archivos estáticos
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("text/css", ".css")
    
    # Mount static files conditionally to avoid RuntimeError when directory doesn't exist
    static_dir = None
    try:
        # Prefer collected static files if available
        if getattr(django_settings, "STATIC_ROOT", None):
            root_path = str(django_settings.STATIC_ROOT)
            if root_path and os.path.isdir(root_path):
                static_dir = root_path
        # Fallback to sources in development
        if not static_dir and getattr(django_settings, "STATICFILES_DIRS", None):
            for p in django_settings.STATICFILES_DIRS:
                if p and os.path.isdir(p):
                    static_dir = str(p)
                    break
    except Exception:
        static_dir = None

    if static_dir:
        app.mount(
            django_settings.STATIC_URL,
            StaticFiles(directory=static_dir),
            name="static"
        )

    # 🧬 Django embebido
    app.mount("/", WSGIMiddleware(get_wsgi_application()))

    return app

# 🚀 App ASGI combinada
app = socketio.ASGIApp(sio, get_application())
