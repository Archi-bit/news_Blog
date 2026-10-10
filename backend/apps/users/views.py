from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Count
from django.middleware.csrf import get_token
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, viewsets
from rest_framework.authentication import CSRFCheck
from rest_framework.decorators import action
from rest_framework.exceptions import (
    AuthenticationFailed,
    PermissionDenied,
    ValidationError,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.articles.serializers import ArticleSerializer
from apps.interactions.models import Follow

from .models import UserProfile
from .serializers import (
    AccessSerializer,
    CsrfSerializer,
    FollowStateSerializer,
    LoginSerializer,
    MeSerializer,
    PublicUserSerializer,
    RegisterSerializer,
)

CSRF_HEADER = OpenApiParameter(
    name="X-CSRFToken",
    type=str,
    location=OpenApiParameter.HEADER,
    required=True,
    description="csrfToken из GET /api/v1/auth/csrf/. Cookie нужно отправлять вместе с заголовком.",
)


class CsrfView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=CsrfSerializer)
    def get(self, request):
        return Response({"csrfToken": get_token(request._request)})


class CookieAuthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def get_authenticate_header(self, request):
        return "Bearer"

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        check = CSRFCheck(lambda r: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise PermissionDenied("CSRF: " + reason)

    def token_response(self, access, refresh):
        response = Response({"access": str(access)})
        response.set_cookie(
            "refresh_token",
            str(refresh),
            max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite="Lax",
            path="/api/v1/auth/",
        )
        response["Cache-Control"] = "no-store"
        return response


class LoginView(CookieAuthView):
    @extend_schema(
        request=LoginSerializer, responses=AccessSerializer, parameters=[CSRF_HEADER]
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request, **serializer.validated_data)
        if user is None:
            raise AuthenticationFailed("Неверный логин или пароль.")
        refresh = RefreshToken.for_user(user)
        return self.token_response(refresh.access_token, refresh)


class RefreshView(CookieAuthView):
    @extend_schema(request=None, responses=AccessSerializer, parameters=[CSRF_HEADER])
    def post(self, request):
        raw_token = request.COOKIES.get("refresh_token", "")
        if not raw_token:
            raise InvalidToken("Refresh cookie отсутствует.")
        # Блокировка не позволяет двум запросам одновременно обновить один token.
        with transaction.atomic():
            list(OutstandingToken.objects.select_for_update().filter(token=raw_token))
            serializer = TokenRefreshSerializer(data={"refresh": raw_token})
            try:
                serializer.is_valid(raise_exception=True)
            except TokenError as exc:
                raise InvalidToken(str(exc)) from exc
            return self.token_response(
                serializer.validated_data["access"],
                serializer.validated_data["refresh"],
            )


class LogoutView(CookieAuthView):
    @extend_schema(request=None, responses={204: None}, parameters=[CSRF_HEADER])
    def post(self, request):
        token = request.COOKIES.get("refresh_token")
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
        response = Response(status=204)
        response.delete_cookie("refresh_token", path="/api/v1/auth/", samesite="Lax")
        return response


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        UserProfile.objects.filter(is_active=True)
        .annotate(_followers_count=Count("followers", distinct=True))
        .order_by("id")
    )
    serializer_class = PublicUserSerializer
    permission_classes = [AllowAny]

    @action(
        detail=False,
        methods=["get", "patch"],
        permission_classes=[IsAuthenticated],
        serializer_class=MeSerializer,
    )
    def me(self, request):
        serializer = (
            MeSerializer(
                request.user,
                data=request.data,
                partial=True,
                context={"request": request},
            )
            if request.method == "PATCH"
            else MeSerializer(request.user, context={"request": request})
        )
        if request.method == "PATCH":
            serializer.is_valid(raise_exception=True)
            serializer.save()
        return Response(serializer.data)

    @extend_schema(responses=ArticleSerializer(many=True))
    @action(detail=True)
    def articles(self, request, pk=None):

        from apps.articles.serializers import ArticleSerializer
        from apps.articles.views import ArticleFilter, article_queryset

        author = self.get_object()
        queryset = ArticleFilter(
            request.query_params,
            queryset=article_queryset(request.user).filter(author=author),
        ).qs
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(
            ArticleSerializer(page, many=True, context={"request": request}).data
        )

    @extend_schema(responses=PublicUserSerializer(many=True))
    @action(detail=True)
    def followers(self, request, pk=None):
        page = self.paginate_queryset(
            self.queryset.filter(following__following=self.get_object())
        )
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    @extend_schema(responses=PublicUserSerializer(many=True))
    @action(detail=True)
    def following(self, request, pk=None):
        page = self.paginate_queryset(
            self.queryset.filter(followers__follower=self.get_object())
        )
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    @extend_schema(request=None, responses=FollowStateSerializer)
    @action(
        detail=True, methods=["post", "delete"], permission_classes=[IsAuthenticated]
    )
    def follow(self, request, pk=None):
        target = self.get_object()
        if target == request.user:
            raise ValidationError("Нельзя подписаться на себя.")
        if request.method == "POST":
            Follow.objects.get_or_create(follower=request.user, following=target)
        else:
            Follow.objects.filter(follower=request.user, following=target).delete()
        return Response(
            {
                "followers_count": target.followers.count(),
                "is_following": request.method == "POST",
            }
        )
