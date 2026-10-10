from config.api import validate_image
from rest_framework import serializers

from apps.users.serializers import PublicUserSerializer

from .models import Article, Category, Tag


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "image"]
        extra_kwargs = {"slug": {"required": False}}

    validate_image = staticmethod(validate_image)


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]
        extra_kwargs = {"slug": {"required": False}}


class ArticleSerializer(serializers.ModelSerializer):
    author = PublicUserSerializer(read_only=True)
    like_count = serializers.IntegerField(read_only=True, default=0)
    comment_count = serializers.IntegerField(read_only=True, default=0)
    is_liked = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Article
        fields = [
            "id",
            "title",
            "content",
            "thumbnail",
            "excerpt",
            "author",
            "category",
            "tags",
            "is_published",
            "published_date",
            "views_count",
            "like_count",
            "comment_count",
            "is_liked",
        ]
        read_only_fields = ["published_date", "views_count"]

    validate_thumbnail = staticmethod(validate_image)


class LikeStateSerializer(serializers.Serializer):
    like_count = serializers.IntegerField(read_only=True)
    is_liked = serializers.BooleanField(read_only=True)
