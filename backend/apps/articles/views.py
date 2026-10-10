from config.api import AdminOrReadOnly, OwnerOrAdmin
from django.db.models import BooleanField, Count, Exists, F, OuterRef, Q, Value
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from django_filters import rest_framework as filters
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from apps.interactions.models import Like
from apps.interactions.serializers import CommentSerializer

from .models import Article, Category, Tag
from .serializers import (
    ArticleSerializer,
    CategorySerializer,
    LikeStateSerializer,
    TagSerializer,
)


def article_queryset(user):
    qs = (
        Article.objects.select_related("author", "category")
        .prefetch_related("tags", "author__followers")
        .annotate(
            like_count=Count("likes", distinct=True),
            comment_count=Count("comments", distinct=True),
        )
    )
    if user.is_authenticated:
        qs = qs.annotate(
            is_liked=Exists(Like.objects.filter(article=OuterRef("pk"), user=user))
        )
        if not user.is_staff:
            qs = qs.filter(Q(is_published=True) | Q(author=user))
    else:
        qs = qs.filter(is_published=True).annotate(
            is_liked=Value(False, output_field=BooleanField())
        )
    return qs.order_by("-published_date", "-pk")


class ArticleFilter(filters.FilterSet):
    category = filters.CharFilter(field_name="category__slug")
    tags = filters.CharFilter(field_name="tags__slug", distinct=True)
    author = filters.NumberFilter(field_name="author_id")

    class Meta:
        model = Article
        fields = ["category", "tags", "author", "is_published"]


class ArticleViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, OwnerOrAdmin]
    filterset_class = ArticleFilter
    search_fields = ["title", "excerpt", "content"]
    ordering_fields = ["published_date", "views_count", "like_count"]
    ordering = ["-published_date", "-id"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Article.objects.none()
        return article_queryset(self.request.user)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        article = self.get_object()
        if article.is_published:
            Article.objects.filter(pk=article.pk).update(
                views_count=F("views_count") + 1
            )
            article.refresh_from_db(fields=["views_count"])
        return Response(self.get_serializer(article).data)

    @extend_schema(responses=ArticleSerializer(many=True))
    @action(detail=False, permission_classes=[IsAuthenticated])
    def my(self, request):
        return self._list(self.get_queryset().filter(author=request.user))

    @extend_schema(responses=ArticleSerializer(many=True))
    @action(detail=False, permission_classes=[IsAuthenticated])
    def drafts(self, request):
        return self._list(
            self.get_queryset().filter(author=request.user, is_published=False)
        )

    def _list(self, queryset):
        page = self.paginate_queryset(self.filter_queryset(queryset))
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, OwnerOrAdmin],
    )
    def publish(self, request, pk=None):
        article = self.get_object()
        article.is_published = True
        article.save()
        return Response(self.get_serializer(article).data)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, OwnerOrAdmin],
    )
    def unpublish(self, request, pk=None):
        article = self.get_object()
        article.is_published = False
        article.save()
        return Response(self.get_serializer(article).data)

    @extend_schema(request=None, responses=LikeStateSerializer)
    @action(
        detail=True, methods=["post", "delete"], permission_classes=[IsAuthenticated]
    )
    def like(self, request, pk=None):
        article = get_object_or_404(self.get_queryset(), pk=pk, is_published=True)
        if request.method == "POST":
            Like.objects.get_or_create(article=article, user=request.user)
        else:
            Like.objects.filter(article=article, user=request.user).delete()
        return Response(
            {"like_count": article.likes.count(), "is_liked": request.method == "POST"}
        )

    @extend_schema(methods=["GET"], responses=CommentSerializer(many=True))
    @extend_schema(
        methods=["POST"], request=CommentSerializer, responses={201: CommentSerializer}
    )
    @action(detail=True, methods=["get", "post"], serializer_class=CommentSerializer)
    def comments(self, request, pk=None):
        article = get_object_or_404(self.get_queryset(), pk=pk, is_published=True)
        if request.method == "POST":
            serializer = CommentSerializer(
                data=request.data, context={"request": request}
            )
            serializer.is_valid(raise_exception=True)
            serializer.save(article=article, author=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        page = self.paginate_queryset(
            article.comments.select_related("author").prefetch_related(
                "author__followers"
            )
        )
        return self.get_paginated_response(
            CommentSerializer(page, many=True, context={"request": request}).data
        )


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AdminOrReadOnly]
    lookup_field = "slug"

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise ValidationError(
                {"category": "Сначала перенесите или удалите статьи этой категории."}
            ) from exc


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [AdminOrReadOnly]
