import pytest
from apps.articles.models import Article, Category, Tag
from apps.users.models import UserProfile
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def users(db):
    return [
        UserProfile.objects.create_user(
            username=n, password="StrongPass!2026", is_staff=n == "admin"
        )
        for n in ["author", "reader", "admin"]
    ]


@pytest.fixture
def category(db):
    return Category.objects.create(name="Наука")


@pytest.fixture
def tag(db):
    return Tag.objects.create(name="Space")


@pytest.fixture
def article(users, category, tag):
    article = Article.objects.create(
        title="Космос",
        content="Исследование галактик",
        excerpt="Телескоп",
        author=users[0],
        category=category,
        is_published=True,
    )
    article.tags.add(tag)
    return article


@pytest.fixture
def draft(users, category):
    return Article.objects.create(
        title="Черновик", content="План", author=users[0], category=category
    )


@pytest.fixture(autouse=True)
def local_media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
