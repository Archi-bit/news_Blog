from django.contrib import admin

from .models import Article, Category, Tag


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug"]
    search_fields = ["name", "slug"]
    ordering = ["name"]


@admin.register(Tag)
class TagAdmin(CategoryAdmin):
    pass


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "author",
        "category",
        "is_published",
        "published_date",
        "views_count",
    ]
    search_fields = ["title", "content", "author__username"]
    list_filter = ["is_published", "category", "tags"]
    readonly_fields = ["published_date", "views_count"]
    list_select_related = ["author", "category"]
    filter_horizontal = ["tags"]
    ordering = ["-published_date"]
