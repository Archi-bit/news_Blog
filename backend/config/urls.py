from apps.articles.views import ArticleViewSet, CategoryViewSet, TagViewSet
from apps.interactions.views import CommentViewSet
from apps.users.views import (
    CsrfView,
    LoginView,
    LogoutView,
    RefreshView,
    RegisterView,
    UserViewSet,
)
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
for prefix, view, basename in [
    ("users", UserViewSet, "user"),
    ("articles", ArticleViewSet, "article"),
    ("categories", CategoryViewSet, "category"),
    ("tags", TagViewSet, "tag"),
    ("comments", CommentViewSet, "comment"),
]:
    router.register(prefix, view, basename=basename)


def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "ok"})
    except Exception:
        return JsonResponse({"status": "unavailable"}, status=503)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health),
    path("api/v1/", include(router.urls)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
for name, view in [
    ("csrf", CsrfView),
    ("register", RegisterView),
    ("login", LoginView),
    ("refresh", RefreshView),
    ("logout", LogoutView),
]:
    urlpatterns.append(path(f"api/v1/auth/{name}/", view.as_view()))
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
