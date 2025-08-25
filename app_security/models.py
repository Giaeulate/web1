from django.db import models
class SecurityPolicy(models.Model):
    class Meta:
        default_permissions = ()
        permissions = (("require_2fa", "Require Two-Factor Authentication"),)
