from rest_framework import serializers

from apps.users.serializers import PublicUserSerializer

from .models import Comment


class CommentSerializer(serializers.ModelSerializer):
    author = PublicUserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "article", "author", "text", "created_date"]
        read_only_fields = ["article", "created_date"]
