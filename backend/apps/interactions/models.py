from django.conf import settings
from django.db import models
from django.db.models import F, Q


class Comment(models.Model):
    article = models.ForeignKey(
        "articles.Article", on_delete=models.CASCADE, related_name="comments"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments"
    )
    text = models.TextField(max_length=10000)
    created_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_date", "pk"]

    def __str__(self):
        return f"{self.author}: {self.text[:40]}"


class Like(models.Model):
    article = models.ForeignKey(
        "articles.Article", on_delete=models.CASCADE, related_name="likes"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="likes"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["article", "user"], name="unique_article_like"
            )
        ]

    def __str__(self):
        return f"{self.user} → {self.article}"


class Follow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="following"
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="followers"
    )
    created_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["follower", "following"], name="unique_follow"
            ),
            models.CheckConstraint(
                condition=~Q(follower=F("following")), name="no_self_follow"
            ),
        ]
        ordering = ["-created_date"]

    def __str__(self):
        return f"{self.follower} → {self.following}"
