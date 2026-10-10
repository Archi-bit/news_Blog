from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class SlugModel(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=160, unique=True, blank=True, allow_unicode=True)

    class Meta:
        abstract = True
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name, allow_unicode=True) or "item"
            candidate, suffix = base, 2
            while (
                type(self).objects.exclude(pk=self.pk).filter(slug=candidate).exists()
            ):
                candidate = f"{base}-{suffix}"
                suffix += 1
            self.slug = candidate
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Category(SlugModel):
    name = models.CharField(max_length=120, unique=True)
    image = models.ImageField(upload_to="categories/", blank=True)


class Tag(SlugModel):
    pass


class Article(models.Model):
    title = models.CharField(max_length=250)
    content = models.TextField()
    thumbnail = models.ImageField(upload_to="articles/", blank=True)
    excerpt = models.TextField(blank=True, max_length=1000)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="articles"
    )
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="articles"
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name="articles")
    is_published = models.BooleanField(default=False, db_index=True)
    published_date = models.DateTimeField(null=True, blank=True, editable=False)
    views_count = models.PositiveIntegerField(default=0, editable=False)

    class Meta:
        ordering = ["-published_date", "-pk"]
        indexes = [models.Index(fields=["is_published", "published_date"])]

    def save(self, *args, **kwargs):
        if self.is_published and self.published_date is None:
            self.published_date = timezone.now()
        super().save(*args, **kwargs)

    def get_like_count(self):
        return self.likes.count()

    def get_comment_count(self):
        return self.comments.count()

    def __str__(self):
        return self.title
