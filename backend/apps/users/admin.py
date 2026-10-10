from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Профиль", {"fields": ("avatar", "bio", "social_link", "date_register")}),
    )
    readonly_fields = ["date_register"]
    list_display = ["username", "email", "is_staff", "date_register"]
