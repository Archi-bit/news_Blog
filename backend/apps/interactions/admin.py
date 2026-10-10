from django.contrib import admin

from .models import Comment, Follow, Like


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ["article", "author", "created_date"]
    search_fields = ["text", "author__username", "article__title"]
    list_filter = ["created_date"]
    readonly_fields = ["created_date"]
    list_select_related = ["article", "author"]
    ordering = ["-created_date"]


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ["article", "user"]
    search_fields = ["article__title", "user__username"]
    list_filter = ["article__category"]
    list_select_related = ["article", "user"]
    ordering = ["-id"]


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ["follower", "following", "created_date"]
    search_fields = ["follower__username", "following__username"]
    list_filter = ["created_date"]
    readonly_fields = ["created_date"]
    list_select_related = ["follower", "following"]
    ordering = ["-created_date"]
