from django.db.models import *
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
from django.urls import reverse
from .managers import CustomUserManager



class CustomUser(AbstractUser):
    username = None
    first_name = None
    last_name = None
    email = EmailField(_('email address'), unique=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def get_view_on_site_url(self, obj=None):
        if not obj:
            return None
        return reverse("admin:user_customuser_change", args=[obj.pk])

    
    class Meta:
        ordering = ('id',)
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return self.email
