import os
import environ
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

SECRET_KEY = env('SECRET_KEY')

DEBUG = env('DEBUG')

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    'django.contrib.gis',
    'django_otp',
    'django_otp.plugins.otp_static',
    'django_otp.plugins.otp_totp',
    'two_factor',
    'two_factor.plugins.phonenumber',
    'corsheaders',
    'import_export',
    'leaflet',
    'leaflet_point',
    'rest_framework_simplejwt',

    # apps
    'app_core',
    'app_user',
    'app_security',
    'app_seat',
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # 👇 Debe ir antes de tu middleware que llama a messages.*
    "django.contrib.messages.middleware.MessageMiddleware",
    "django_otp.middleware.OTPMiddleware",
    "web.middleware.Enforce2FAForGroupsMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "web.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "web.wsgi.application"


DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': env('DB_NAME'),
        'HOST': env('DB_HOST'),
        'USER': env('DB_USER'),
        'PASSWORD': env('DB_PASS'),
        'PORT': env('DB_PORT'),
    },
}


AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",},
]

LANGUAGE_CODE = "es"

TIME_ZONE = "America/La_Paz"

USE_I18N = True

USE_TZ = True


STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')

MEDIA_DIR = BASE_DIR / 'media'
MEDIA_ROOT = MEDIA_DIR
MEDIA_URL = '/media/'

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = 'app_user.CustomUser'


LOGIN_URL = 'two_factor:login'
# TWO_FACTOR_QR_FACTORY = "qrcode.image.pil.PilImage"
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": BASE_DIR / ".django_cache",
        "TIMEOUT": 60 * 60 * 24,  # 1 día (lo que quieras)
    }
}
# LOGIN_REDIRECT_URL = "/admin/"

# LOGIN_REDIRECT_URL = 'admin:index'
# TWO_FACTOR_PATCH_ADMIN = True

# AUTHENTICATION_BACKENDS = [
#     'django.contrib.auth.backends.ModelBackend',  # imprescindible
# ]

LEAFLET_CONFIG = {
    'DEFAULT_CENTER': (-16.5, -68.15),
    'DEFAULT_ZOOM': 12,
    'MAX_ZOOM': 18,
    'MIN_ZOOM': 3,
    'SCALE': 'both',
    'ATTRIBUTION_PREFIX': 'Desarrollado por Gianluca',
}

LEAFLET_POINT_CONFIG = {
    # these are defaults...
    'map_height': 400,
    'tile_layer': 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'attibution': '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    'initial_lat': -16,
    'initial_lng': -68,
    'initial_zoom': 15,
    'geocoder': True
}


# settings.py
GENERIC_API = {
    # Si es None → todas las apps; si listas → solo esas apps
    "APPS_ALLOWLIST": ["app_seat"],

    # Modelos a excluir (app_label.ModelName)
    "MODELS_EXCLUDE": [
        "admin.LogEntry",
        "auth.Permission",
        "contenttypes.ContentType",
        "sessions.Session",
        # "auth.User",  # descomenta si no quieres exponerlo
    ],

    # Exclusiones globales de campos (por nombre)
    "GLOBAL_EXCLUDE_FIELDS": ["password"],

    # Ruta al “dependency” de autenticación. Asegúrate de que exista la función
    # get_current_user en fastapi_api/auth.py como te mostré.
    "AUTH_DEPENDENCY": "web.auth_jwt:get_current_user",

    # Configuraciones específicas por modelo
    "MODEL_OPTIONS": {
        # Modelo que quedará protegido con JWT
        "app_seat.Venue": {
            "include": ["id", "name", "slug", "address", "description", "latitude", "longitude"],
            "search_fields": ["name", "slug", "address"],
            "default_order": "name",
            "auth_methods": ["GET"],
            # "auth": True,  # ← obliga a que estos endpoints requieran token JWT
        },

        # Puedes definir otros modelos y dejar "auth": False o no especificarlo
        # si no requieren autenticación.
        # "app_seat.Event": {
        #     "search_fields": ["title", "venue__name"],
        #     "default_order": "-start_date",
        #     "auth": False,
        # },
    },
}
