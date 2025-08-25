from django.contrib import admin
from django.urls import path, include
from app_security.views import ThrottledLoginView
from two_factor.urls import urlpatterns as tf_urls

from app_core.views import SetupToAdminView
# from two_factor.admin import AdminSiteOTPRequired

# admin.site.__class__ = AdminSiteOTPRequired

urlpatterns = [
    path("account/login/", ThrottledLoginView.as_view(), name="two_factor_login_custom"),
    path("account/two_factor/setup/", SetupToAdminView.as_view(), name="two_factor_setup_custom"),
    path('', include(tf_urls)),
    path('admin/', admin.site.urls),
]
