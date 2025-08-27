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

    'jazzmin',

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



JAZZMIN_SETTINGS = {
    # title of the window (Will default to current_admin_site.site_title if absent or None)
    "site_title": "Seats Admin",

    # Title on the login screen (19 chars max) (defaults to current_admin_site.site_header if absent or None)
    "site_header": "Seats",

    # Title on the brand (19 chars max) (defaults to current_admin_site.site_header if absent or None)
    "site_brand": "Seats",

    # Logo to use for your site, must be present in static files, used for brand on top left
    # "site_logo": "books/img/logo.png",

    # Logo to use for your site, must be present in static files, used for login form logo (defaults to site_logo)
    "login_logo": None,

    # Logo to use for login form in dark themes (defaults to login_logo)
    "login_logo_dark": None,

    # CSS classes that are applied to the logo above
    "site_logo_classes": "img-circle",

    # Relative path to a favicon for your site, will default to site_logo if absent (ideally 32x32 px)
    "site_icon": None,

    # Welcome text on the login screen
    "welcome_sign": "Inicio de sesión",

    # Copyright on the footer
    "copyright": "Libelula",

    # List of model admins to search from the search bar, search bar omitted if excluded
    # If you want to use a single search field you dont need to use a list, you can use a simple string 
    "search_model": ["auth.User", "auth.Group"],

    # Field name on user model that contains avatar ImageField/URLField/Charfield or a callable that receives the user
    "user_avatar": None,

    ############
    # Top Menu #
    ############

    # Links to put along the top menu
    # "topmenu_links": [

    #     # Url that gets reversed (Permissions can be added)
    #     {"name": "Home",  "url": "admin:index", "permissions": ["auth.view_user"]},

    #     # external url that opens in a new window (Permissions can be added)
    #     {"name": "Support", "url": "https://github.com/farridav/django-jazzmin/issues", "new_window": True},

    #     # model admin to link to (Permissions checked against model)
    #     {"model": "auth.User"},

    #     # App with dropdown menu to all its models pages (Permissions checked against models)
    #     {"app": "books"},
    # ],

    #############
    # User Menu #
    #############

    # Additional links to include in the user menu on the top right ("app" url type is not allowed)
    "usermenu_links": [
        {"name": "Support", "url": "https://github.com/farridav/django-jazzmin/issues", "new_window": True},
        {"model": "auth.user"}
    ],

    #############
    # Side Menu #
    #############

    # Whether to display the side menu
    "show_sidebar": True,

    # Whether to aut expand the menu
    "navigation_expanded": True,

    # Hide these apps when generating side menu e.g (auth)
    "hide_apps": [],

    # Hide these models when generating side menu (e.g auth.user)
    "hide_models": [],

    # List of apps (and/or models) to base side menu ordering off of (does not need to contain all apps/models)
    # "order_with_respect_to": ["auth", "books", "books.author", "books.book"],

    # Custom links to append to app groups, keyed on app name
    "custom_links": {
        # "books": [{
        #     "name": "Make Messages", 
        #     "url": "make_messages", 
        #     "icon": "fas fa-comments",
        #     "permissions": ["books.view_book"]
        # }]
    },

    # Custom icons for side menu apps/models See https://fontawesome.com/icons?d=gallery&m=free&v=5.0.0,5.0.1,5.0.10,5.0.11,5.0.12,5.0.13,5.0.2,5.0.3,5.0.4,5.0.5,5.0.6,5.0.7,5.0.8,5.0.9,5.1.0,5.1.1,5.2.0,5.3.0,5.3.1,5.4.0,5.4.1,5.4.2,5.13.0,5.12.0,5.11.2,5.11.1,5.10.0,5.9.0,5.8.2,5.8.1,5.7.2,5.7.1,5.7.0,5.6.3,5.5.0,5.4.2
    # for the full list of 5.13.0 free icon classes
    "icons": {
        "auth": "fas fa-users-cog",
        "auth.user": "fas fa-user",
        "auth.Group": "fas fa-users",
    },
    # Icons that are used when one is not manually specified
    "default_icon_parents": "fas fa-chevron-circle-right",
    "default_icon_children": "fas fa-circle",

    #################
    # Related Modal #
    #################
    # Use modals instead of popups
    "related_modal_active": False,

    #############
    # UI Tweaks #
    #############
    # Relative paths to custom CSS/JS scripts (must be present in static files)
    "custom_css": None,
    "custom_js": None,
    # Whether to link font from fonts.googleapis.com (use custom_css to supply font otherwise)
    "use_google_fonts_cdn": True,
    # Whether to show the UI customizer on the sidebar
    "show_ui_builder": False,

    ###############
    # Change view #
    ###############
    # Render out the change view as a single form, or in tabs, current options are
    # - single
    # - horizontal_tabs (default)
    # - vertical_tabs
    # - collapsible
    # - carousel
    "changeform_format": "horizontal_tabs",
    # override change forms on a per modeladmin basis
    "changeform_format_overrides": {"auth.user": "collapsible", "auth.group": "vertical_tabs"},
    # Add a language dropdown into the admin
    # "language_chooser": True,
}


# settings.py
# GENERIC_API = {
#     # Si es None → todas las apps; si listas → solo esas apps
#     "APPS_ALLOWLIST": ["app_seat"],

#     # Modelos a excluir (app_label.ModelName)
#     "MODELS_EXCLUDE": [
#         "admin.LogEntry",
#         "auth.Permission",
#         "contenttypes.ContentType",
#         "sessions.Session",
#         # "auth.User",  # descomenta si no quieres exponerlo
#     ],

#     # Exclusiones globales de campos (por nombre)
#     "GLOBAL_EXCLUDE_FIELDS": ["password"],

#     # Ruta al “dependency” de autenticación. Asegúrate de que exista la función
#     # get_current_user en fastapi_api/auth.py como te mostré.
#     "AUTH_DEPENDENCY": "web.auth_jwt:get_current_user",

#     # Configuraciones específicas por modelo
#     "MODEL_OPTIONS": {
#         # Modelo que quedará protegido con JWT
#         "app_seat.Venue": {
#             "include": ["id", "name", "slug", "address", "description", "latitude", "longitude"],
#             "search_fields": ["name", "slug", "address"],
#             "default_order": "name",

#             "expand_allowed": ["events", "events.seats", "events.seats.section", "city", "owner", "sections"],
#             "expand_default": [],
#             "expand_max_depth": 3,
#             # "auth_methods": ["GET"],
#             # "auth": True,  # ← obliga a que estos endpoints requieran token JWT
#         },
#         "app_seat.Event": {
#             "expand_allowed": ["venue", "seats", "seats.section"],
#         },
#         "app_seat.Section": {
#             "expand_allowed": ["venue"],
#         },

#         # Puedes definir otros modelos y dejar "auth": False o no especificarlo
#         # si no requieren autenticación.
#         # "app_seat.Event": {
#         #     "search_fields": ["title", "venue__name"],
#         #     "default_order": "-start_date",
#         #     "auth": False,
#         # },
#     },
# }

GENERIC_API = {
    # Solo montar endpoints del app de asientos
    "APPS_ALLOWLIST": ["app_seat"],

    # Modelos globalmente excluidos
    "MODELS_EXCLUDE": [
        "admin.LogEntry",
        "auth.Permission",
        "contenttypes.ContentType",
        "sessions.Session",
    ],

    # Campos a excluir en todos los modelos
    "GLOBAL_EXCLUDE_FIELDS": ["password"],

    # Protege endpoints con tu dependencia (opcional)
    "AUTH_DEPENDENCY": "web.auth_jwt:get_current_user",

    # Opciones por modelo
    "MODEL_OPTIONS": {
        # ============ Recinto ============
        "app_seat.Venue": {
            "include": ["id", "name", "slug", "address", "description", "latitude", "longitude"],
            "search_fields": ["name", "slug", "address"],
            "default_order": "name",
            # qué expansiones se permiten
            "expand_allowed": [
                "sections",
                "sections.rows",
                "sections.rows.seats",
                "seatmaps",
                "events",
                "events.price_categories",
                "events.seats",
                "events.seats.seat",
                "events.seats.seat.row",
                "events.seats.seat.row.section",
            ],
            # si quieres traer siempre las sections:
            # "expand_default": ["sections"],
            "expand_max_depth": 4,
        },

        # ============ Section ============
        "app_seat.Section": {
            "include": ["id", "venue", "name", "category", "order"],
            "search_fields": ["name", "category", "venue__name"],
            "default_order": "order",
            "expand_allowed": [
                "venue",
                "rows",
                "rows.seats",
            ],
            "expand_max_depth": 3,
        },

        # ============ Row ============
        "app_seat.Row": {
            "include": ["id", "section", "name", "order"],
            "search_fields": ["name", "section__name", "section__venue__name"],
            "default_order": "order",
            "expand_allowed": [
                "section",
                "section.venue",
                "seats",
            ],
        },

        # ============ Seat ============
        "app_seat.Seat": {
            "include": ["id", "row", "number", "seat_type"],
            "search_fields": ["number", "row__name", "row__section__name", "row__section__venue__name"],
            "default_order": "row",
            "expand_allowed": [
                "row",
                "row.section",
                "row.section.venue",
            ],
        },

        # ============ SeatMap ============
        "app_seat.SeatMap": {
            "include": ["id", "venue", "name", "data"],
            "search_fields": ["name", "venue__name"],
            "default_order": "name",
            "expand_allowed": ["venue"],
        },

        # ============ Event ============
        "app_seat.Event": {
            "include": ["id", "name", "slug", "venue", "seatmap", "start_datetime", "end_datetime", "description"],
            "search_fields": ["name", "slug", "venue__name"],
            "default_order": "-start_datetime",
            "expand_allowed": [
                "venue",
                "seatmap",
                "price_categories",
                "seats",
                "seats.seat",
                "seats.seat.row",
                "seats.seat.row.section",
            ],
            "expand_max_depth": 4,
        },

        # ============ PriceCategory ============
        "app_seat.PriceCategory": {
            "include": ["id", "event", "name", "price"],
            "search_fields": ["name", "event__name"],
            "default_order": "name",
            "expand_allowed": ["event"],
        },

        # ============ EventSeat ============
        "app_seat.EventSeat": {
            "include": ["id", "event", "seat", "status", "price_category", "hold_expires_at"],
            "search_fields": ["event__name", "seat__row__section__venue__name", "seat__row__section__name", "seat__row__name", "seat__number"],
            "default_order": "seat__row__section__name",
            "expand_allowed": [
                "event",
                "seat",
                "seat.row",
                "seat.row.section",
                "price_category",
            ],
        },

        # ============ Hold ============
        "app_seat.Hold": {
            "include": ["id", "user", "event", "seats", "expires_at"],
            "search_fields": ["user__username", "event__name"],
            "default_order": "expires_at",
            "expand_allowed": [
                "user",
                "event",
                "seats",
                "seats.seat",
                "seats.seat.row",
                "seats.seat.row.section",
                "seats.price_category",
            ],
        },

        # ============ Booking ============
        "app_seat.Booking": {
            "include": ["id", "user", "event", "seats", "total_price", "status"],
            "search_fields": ["user__username", "event__name", "status"],
            "default_order": "-created_at",
            "expand_allowed": [
                "user",
                "event",
                "seats",
                "seats.seat",
                "seats.seat.row",
                "seats.seat.row.section",
                "seats.price_category",
            ],
        },
    },
}
