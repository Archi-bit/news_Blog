from io import BytesIO

import pytest
from apps.articles.models import Article, Category, Tag
from apps.interactions.models import Comment, Follow, Like
from apps.users.models import UserProfile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import IntegrityError, connection, transaction
from PIL import Image
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

pytestmark = pytest.mark.django_db


def auth(client, user):
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}"
    )


def test_database_is_postgresql():
    assert connection.vendor == "postgresql"


def test_register_hashes_password(client):
    result = client.post(
        "/api/v1/auth/register/",
        {
            "username": "newuser",
            "password": "MyUniquePass!729",
            "email": "new@example.com",
        },
    )
    assert result.status_code == 201
    user = UserProfile.objects.get(username="newuser")
    assert user.check_password("MyUniquePass!729")
    assert "password" not in result.data


@pytest.mark.parametrize(
    "data",
    [
        {"username": "x", "password": "123"},
        {"username": "", "password": "GoodPass!2026"},
    ],
)
def test_register_validation(client, data):
    assert client.post("/api/v1/auth/register/", data).status_code == 400


def test_register_duplicate(client, users):
    assert (
        client.post(
            "/api/v1/auth/register/",
            {"username": "author", "password": "GoodPass!2026"},
        ).status_code
        == 400
    )


def test_jwt_cookie_rotation_logout(users):
    client = APIClient(enforce_csrf_checks=True)
    endpoint = "/api/v1/auth/"
    assert (
        client.post(
            endpoint + "login/", {"username": "author", "password": "StrongPass!2026"}
        ).status_code
        == 403
    )
    csrf = client.get(endpoint + "csrf/").data["csrfToken"]
    client.credentials(HTTP_X_CSRFTOKEN=csrf)
    login = client.post(
        endpoint + "login/", {"username": "author", "password": "StrongPass!2026"}
    )
    assert login.status_code == 200
    cookie = login.cookies["refresh_token"]
    assert cookie["httponly"] and cookie["samesite"] == "Lax"
    assert "refresh" not in login.data
    old_refresh = cookie.value
    client.credentials(
        HTTP_X_CSRFTOKEN=csrf, HTTP_AUTHORIZATION="Bearer " + login.data["access"]
    )
    assert client.get("/api/v1/users/me/").status_code == 200
    assert client.post(endpoint + "refresh/").status_code == 200
    new_refresh = client.cookies["refresh_token"].value
    client.cookies["refresh_token"] = old_refresh
    assert client.post(endpoint + "refresh/").status_code == 401
    client.cookies["refresh_token"] = new_refresh
    assert client.post(endpoint + "logout/").status_code == 204
    client.cookies["refresh_token"] = new_refresh
    assert client.post(endpoint + "refresh/").status_code == 401


def test_invalid_login(client, users):
    assert (
        client.post(
            "/api/v1/auth/login/", {"username": "author", "password": "bad"}
        ).status_code
        == 401
    )


def test_invalid_access(client):
    client.credentials(HTTP_AUTHORIZATION="Bearer invalid")
    assert client.get("/api/v1/users/me/").status_code == 401


def test_profiles(client, users):
    auth(client, users[0])
    response = client.patch(
        "/api/v1/users/me/", {"bio": "Привет", "is_staff": True, "username": "hacker"}
    )
    assert response.status_code == 200
    users[0].refresh_from_db()
    assert users[0].bio == "Привет" and not users[0].is_staff
    assert users[0].username == "author"
    assert "email" not in client.get(f"/api/v1/users/{users[1].pk}/").data


def test_article_crud(client, users, category, tag):
    auth(client, users[0])
    response = client.post(
        "/api/v1/articles/",
        {
            "title": "Новая статья",
            "content": "Текст",
            "category": category.pk,
            "tags": [tag.pk],
            "author": users[1].pk,
        },
        format="json",
    )
    assert response.status_code == 201
    pk = response.data["id"]
    obj = Article.objects.get(pk=pk)
    assert (
        obj.author == users[0] and not obj.is_published and obj.published_date is None
    )
    assert (
        client.patch(f"/api/v1/articles/{pk}/", {"title": "Обновлено"}).status_code
        == 200
    )
    assert client.post(f"/api/v1/articles/{pk}/publish/").status_code == 200
    obj.refresh_from_db()
    date = obj.published_date
    assert date is not None
    assert client.post(f"/api/v1/articles/{pk}/unpublish/").status_code == 200
    assert client.post(f"/api/v1/articles/{pk}/publish/").status_code == 200
    obj.refresh_from_db()
    assert obj.published_date == date
    assert client.delete(f"/api/v1/articles/{pk}/").status_code == 204


@pytest.mark.parametrize("method", ["patch", "delete", "post"])
def test_article_owner_permissions(client, users, article, method):
    auth(client, users[1])
    path = f"/api/v1/articles/{article.pk}/" + (
        "unpublish/" if method == "post" else ""
    )
    assert getattr(client, method)(path, {"title": "Wrong"}).status_code == 403


def test_admin_can_edit(client, users, article, draft):
    auth(client, users[2])
    assert (
        client.patch(
            f"/api/v1/articles/{article.pk}/", {"title": "Moderated"}
        ).status_code
        == 200
    )
    assert client.get(f"/api/v1/articles/{draft.pk}/").status_code == 200


@pytest.mark.parametrize("identity", [None, 1])
def test_draft_hidden(client, users, draft, identity):
    if identity is not None:
        auth(client, users[identity])
    assert client.get(f"/api/v1/articles/{draft.pk}/").status_code == 404
    assert client.get("/api/v1/articles/").data["count"] == 0
    assert client.get(f"/api/v1/users/{users[0].pk}/articles/").data["count"] == 0


def test_own_drafts(client, users, draft):
    auth(client, users[0])
    assert client.get("/api/v1/articles/drafts/").data["count"] == 1
    assert client.get("/api/v1/articles/my/").data["count"] == 1


@pytest.mark.parametrize(
    "data",
    [
        {"title": "", "content": "x"},
        {"title": "x", "content": " "},
        {"title": "x", "content": "x", "category": 999},
    ],
)
def test_article_validation(client, users, category, data):
    auth(client, users[0])
    data.setdefault("category", category.pk)
    assert client.post("/api/v1/articles/", data).status_code == 400


def test_anonymous_write_blocked(client, article):
    for path in [
        "/api/v1/articles/",
        f"/api/v1/articles/{article.pk}/like/",
        f"/api/v1/articles/{article.pk}/comments/",
    ]:
        assert client.post(path, {"text": "x"}).status_code == 401


def test_views_increment(client, article, draft, users):
    client.get(f"/api/v1/articles/{article.pk}/")
    client.get(f"/api/v1/articles/{article.pk}/")
    article.refresh_from_db()
    assert article.views_count == 2
    auth(client, users[0])
    client.get(f"/api/v1/articles/{draft.pk}/")
    draft.refresh_from_db()
    assert draft.views_count == 0


def test_comment_crud_permissions(client, article, users):
    auth(client, users[1])
    url = f"/api/v1/articles/{article.pk}/comments/"
    response = client.post(url, {"text": "Мнение", "author": users[0].pk})
    assert response.status_code == 201
    pk = response.data["id"]
    assert Comment.objects.get(pk=pk).author == users[1]
    assert client.get(url).data["count"] == 1
    assert (
        client.patch(f"/api/v1/comments/{pk}/", {"text": "Правка"}).status_code == 200
    )
    auth(client, users[0])
    assert client.delete(f"/api/v1/comments/{pk}/").status_code == 403
    auth(client, users[2])
    assert client.delete(f"/api/v1/comments/{pk}/").status_code == 204


def test_empty_comment_and_draft_interactions(client, article, draft, users):
    auth(client, users[0])
    assert (
        client.post(
            f"/api/v1/articles/{article.pk}/comments/", {"text": " "}
        ).status_code
        == 400
    )
    assert (
        client.post(
            f"/api/v1/articles/{draft.pk}/comments/", {"text": "Text"}
        ).status_code
        == 404
    )
    assert client.post(f"/api/v1/articles/{draft.pk}/like/").status_code == 404


def test_likes_idempotent(client, users, article):
    auth(client, users[1])
    url = f"/api/v1/articles/{article.pk}/like/"
    assert client.post(url).status_code == 200
    assert client.post(url).data["like_count"] == 1
    assert client.get(f"/api/v1/articles/{article.pk}/").data["is_liked"]
    assert Like.objects.count() == 1
    assert client.delete(url).data["like_count"] == 0
    assert client.delete(url).status_code == 200


def test_follow_idempotent_and_lists(client, users):
    auth(client, users[1])
    url = f"/api/v1/users/{users[0].pk}/follow/"
    assert client.post(url).status_code == 200
    assert client.post(url).data["followers_count"] == 1
    assert (
        client.get(f"/api/v1/users/{users[0].pk}/followers/").data["results"][0]["id"]
        == users[1].pk
    )
    assert (
        client.get(f"/api/v1/users/{users[1].pk}/following/").data["results"][0]["id"]
        == users[0].pk
    )
    assert client.post(f"/api/v1/users/{users[1].pk}/follow/").status_code == 400
    assert client.delete(url).data["followers_count"] == 0
    assert client.delete(url).status_code == 200


def test_constraints(users, article):
    Like.objects.create(article=article, user=users[0])
    with pytest.raises(IntegrityError), transaction.atomic():
        Like.objects.create(article=article, user=users[0])
    with pytest.raises(IntegrityError), transaction.atomic():
        Follow.objects.create(follower=users[0], following=users[0])
    Follow.objects.create(follower=users[0], following=users[1])
    with pytest.raises(IntegrityError), transaction.atomic():
        Follow.objects.create(follower=users[0], following=users[1])


@pytest.mark.parametrize(
    "query",
    [
        "search=Космос",
        "search=галактик",
        "search=Телескоп",
        "category=наука",
        "tags=space",
    ],
)
def test_search_filter(client, article, query):
    assert client.get("/api/v1/articles/?" + query).data["count"] == 1
    assert client.get("/api/v1/articles/?search=notfound").data["count"] == 0


def test_pagination_ordering(client, users, category):
    for i in range(12):
        Article.objects.create(
            title=f"Статья {i}",
            content="Text",
            category=category,
            author=users[0],
            is_published=True,
            views_count=i,
        )
    response = client.get("/api/v1/articles/?ordering=-views_count")
    assert response.data["count"] == 12 and len(response.data["results"]) == 10
    assert response.data["results"][0]["views_count"] == 11
    assert len(client.get("/api/v1/articles/?page=2").data["results"]) == 2


def test_taxonomy_permissions_slugs(client, users):
    auth(client, users[1])
    assert client.post("/api/v1/categories/", {"name": "Спорт"}).status_code == 403
    auth(client, users[2])
    result = client.post("/api/v1/categories/", {"name": "Спорт"})
    assert result.status_code == 201 and result.data["slug"] == "спорт"
    assert client.get("/api/v1/categories/спорт/").status_code == 200
    first = Tag.objects.create(name="C++")
    second = Tag.objects.create(name="C#")
    assert first.slug != second.slug


def test_images(client, users, article):
    auth(client, users[0])
    buffer = BytesIO()
    Image.new("RGB", (16, 16), "blue").save(buffer, "PNG")
    image = SimpleUploadedFile(
        "avatar.png", buffer.getvalue(), content_type="image/png"
    )
    assert (
        client.patch(
            "/api/v1/users/me/", {"avatar": image}, format="multipart"
        ).status_code
        == 200
    )
    image = SimpleUploadedFile(
        "article.png", buffer.getvalue(), content_type="image/png"
    )
    assert (
        client.patch(
            f"/api/v1/articles/{article.pk}/", {"thumbnail": image}, format="multipart"
        ).status_code
        == 200
    )
    bad = SimpleUploadedFile("bad.png", b"not an image", content_type="image/png")
    assert (
        client.patch(
            "/api/v1/users/me/", {"avatar": bad}, format="multipart"
        ).status_code
        == 400
    )


def test_seed_idempotent(settings):
    settings.DEBUG = settings.DEMO_MODE = True
    call_command("seed_demo")
    expected = [6, 5, 10, 20, 30, 40, 15]
    models = [UserProfile, Category, Tag, Article, Comment, Like, Follow]
    assert [m.objects.count() for m in models] == expected
    call_command("seed_demo")
    assert [m.objects.count() for m in models] == expected


def test_seed_disabled(settings):
    from django.core.management.base import CommandError

    settings.DEMO_MODE = False
    with pytest.raises(CommandError):
        call_command("seed_demo")


def test_docs_and_health(client):
    assert client.get("/health/").status_code == 200
    assert client.get("/api/docs/").status_code == 200
    assert client.get("/api/schema/").status_code == 200


def test_database_role_is_not_superuser():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT rolsuper, rolcreaterole FROM pg_roles WHERE rolname = current_user"
        )
        assert cursor.fetchone() == (False, False)


def test_like_ordering(client, users, category, article):
    other = Article.objects.create(
        title="Other",
        content="text",
        author=users[0],
        category=category,
        is_published=True,
    )
    Like.objects.create(article=article, user=users[1])
    Like.objects.create(article=other, user=users[1])
    Like.objects.create(article=other, user=users[0])
    assert (
        client.get("/api/v1/articles/?ordering=-like_count").data["results"][0]["id"]
        == other.pk
    )


def test_own_comment_delete_and_no_reassignment(client, users, article, draft):
    auth(client, users[1])
    comment = Comment.objects.create(article=article, author=users[1], text="Text")
    url = f"/api/v1/comments/{comment.pk}/"
    assert (
        client.patch(
            url, {"article": draft.pk, "author": users[0].pk, "text": "Updated"}
        ).status_code
        == 200
    )
    comment.refresh_from_db()
    assert comment.article == article and comment.author == users[1]
    assert client.delete(url).status_code == 204


def test_csrf_invalid_and_refresh_missing(users):
    client = APIClient(enforce_csrf_checks=True)
    csrf = client.get("/api/v1/auth/csrf/").data["csrfToken"]
    client.credentials(HTTP_X_CSRFTOKEN="invalid")
    assert client.post("/api/v1/auth/refresh/").status_code == 403
    client.credentials(HTTP_X_CSRFTOKEN=csrf, HTTP_ORIGIN="https://untrusted.example")
    assert (
        client.post(
            "/api/v1/auth/login/", {"username": "author", "password": "StrongPass!2026"}
        ).status_code
        == 403
    )
    client.credentials(HTTP_X_CSRFTOKEN=csrf)
    assert client.post("/api/v1/auth/refresh/").status_code == 401


def test_secure_refresh_cookie(client, users, settings):
    settings.COOKIE_SECURE = True
    response = client.post(
        "/api/v1/auth/login/", {"username": "author", "password": "StrongPass!2026"}
    )
    assert response.cookies["refresh_token"]["secure"]


def test_large_image_rejected(client, users):
    auth(client, users[0])
    buffer = BytesIO()
    Image.new("RGB", (16, 16), "red").save(buffer, "PNG")
    image = SimpleUploadedFile(
        "large.png",
        buffer.getvalue() + b"x" * (5 * 1024 * 1024),
        content_type="image/png",
    )
    assert (
        client.patch(
            "/api/v1/users/me/", {"avatar": image}, format="multipart"
        ).status_code
        == 400
    )


@pytest.mark.parametrize("prefix", ["categories", "tags"])
def test_admin_taxonomy_crud(client, users, prefix):
    auth(client, users[2])
    response = client.post(f"/api/v1/{prefix}/", {"name": "Test"})
    assert response.status_code == 201
    key = response.data["slug"] if prefix == "categories" else response.data["id"]
    url = f"/api/v1/{prefix}/{key}/"
    assert client.patch(url, {"name": "Updated"}).status_code == 200
    assert client.delete(url).status_code == 204


def test_seed_disabled_without_debug(settings):
    from django.core.management.base import CommandError

    settings.DEMO_MODE = True
    settings.DEBUG = False
    with pytest.raises(CommandError):
        call_command("seed_demo")


def test_list_query_count_is_bounded(
    client, users, category, django_assert_max_num_queries
):
    for i in range(20):
        Article.objects.create(
            title=f"Article {i}",
            content="text",
            author=users[i % 3],
            category=category,
            is_published=True,
        )
    with django_assert_max_num_queries(6):
        assert client.get("/api/v1/articles/").status_code == 200


def test_used_category_delete_returns_validation_error(client, users, article):
    auth(client, users[2])
    response = client.delete(f"/api/v1/categories/{article.category.slug}/")
    assert response.status_code == 400
    assert Category.objects.filter(pk=article.category_id).exists()
