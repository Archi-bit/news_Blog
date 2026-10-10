from rest_framework import serializers
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.views import exception_handler as drf_handler


def exception_handler(exc, context):
    response = drf_handler(exc, context)
    if response is not None:
        response.data = {
            "error": {"status": response.status_code, "details": response.data}
        }
    return response


class OwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        return (
            request.method in SAFE_METHODS
            or request.user.is_staff
            or obj.author_id == request.user.id
        )


class AdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or (
            request.user.is_authenticated and request.user.is_staff
        )


def validate_image(value):
    if value and value.size > 5 * 1024 * 1024:
        raise serializers.ValidationError("Изображение должно быть не больше 5 МБ.")
    return value
