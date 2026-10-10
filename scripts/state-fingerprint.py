"""Run via manage.py shell: hash main records and media, without printing private data."""

import hashlib
import json

from django.apps import apps
from django.conf import settings

models = [
    apps.get_model(name)
    for name in [
        "users.UserProfile",
        "articles.Category",
        "articles.Tag",
        "articles.Article",
        "interactions.Comment",
        "interactions.Like",
        "interactions.Follow",
    ]
]
data = {
    model._meta.label: list(model.objects.order_by("pk").values()) for model in models
}
media = {
    str(path.relative_to(settings.MEDIA_ROOT)): hashlib.sha256(
        path.read_bytes()
    ).hexdigest()
    for path in sorted(settings.MEDIA_ROOT.rglob("*"))
    if path.is_file()
}
print(
    json.dumps(
        {
            "counts": {key: len(value) for key, value in data.items()},
            "records_sha256": hashlib.sha256(
                json.dumps(data, default=str, sort_keys=True).encode()
            ).hexdigest(),
            "media_files": len(media),
            "media_sha256": hashlib.sha256(
                json.dumps(media, sort_keys=True).encode()
            ).hexdigest(),
        },
        sort_keys=True,
    )
)
