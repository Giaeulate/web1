"""
Custom user model for the seats clone project.

Extends Django's AbstractUser without adding additional fields. You can
customize this model (add fields, methods) as needed.
"""

from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Custom user model that extends AbstractUser without changes."""

    def __str__(self) -> str:
        return self.get_username()
