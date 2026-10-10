from django.contrib.auth.models import AbstractUser
from django.db import models


class UserProfile(AbstractUser):
    avatar = models.ImageField(upload_to="avatars/", blank=True)
    bio = models.TextField(blank=True, max_length=5000)
    social_link = models.URLField(blank=True)
    date_register = models.DateTimeField(auto_now_add=True)

    @property
    def followers_count(self):
        return (
            self._followers_count
            if hasattr(self, "_followers_count")
            else self.followers.count()
        )

    def __str__(self):
        return self.username
