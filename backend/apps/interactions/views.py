from config.api import OwnerOrAdmin
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.articles.views import article_queryset

from .models import Comment
from .serializers import CommentSerializer


class CommentViewSet(
    mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated, OwnerOrAdmin]
    http_method_names = ["patch", "delete", "options", "head"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Comment.objects.none()
        return (
            Comment.objects.select_related("author", "article")
            .prefetch_related("author__followers")
            .filter(article__in=article_queryset(self.request.user))
        )
