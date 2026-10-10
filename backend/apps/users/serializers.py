from config.api import validate_image
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import UserProfile


class PublicUserSerializer(serializers.ModelSerializer):
    followers_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "avatar",
            "bio",
            "social_link",
            "date_register",
            "followers_count",
        ]
        read_only_fields = fields


class MeSerializer(PublicUserSerializer):
    class Meta(PublicUserSerializer.Meta):
        fields = PublicUserSerializer.Meta.fields + ["email", "is_staff"]
        read_only_fields = [
            "id",
            "username",
            "date_register",
            "followers_count",
            "is_staff",
        ]

    validate_avatar = staticmethod(validate_image)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, max_length=128)

    class Meta:
        model = UserProfile
        fields = ["id", "username", "email", "password"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        validate_password(
            attrs["password"],
            UserProfile(username=attrs["username"], email=attrs.get("email", "")),
        )
        return attrs

    def create(self, validated_data):
        return UserProfile.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class AccessSerializer(serializers.Serializer):
    access = serializers.CharField(read_only=True)


class CsrfSerializer(serializers.Serializer):
    csrfToken = serializers.CharField(read_only=True)


class FollowStateSerializer(serializers.Serializer):
    followers_count = serializers.IntegerField(read_only=True)
    is_following = serializers.BooleanField(read_only=True)
