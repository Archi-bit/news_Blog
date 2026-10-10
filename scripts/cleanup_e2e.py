#!/usr/bin/env python3
"""Удалить только аккаунты, записанные текущими E2E-тестами, и их файлы."""

import argparse
import json
import re
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--production",
    action="store_true",
    help="Use scripts/prod.sh and PROD_PROJECT/PROD_ENV_FILE",
)
args = parser.parse_args()

root = Path(__file__).resolve().parent.parent
registry = root / "frontend/.e2e-accounts.jsonl"
if not registry.exists():
    print("Нет записанных E2E-аккаунтов.")
    raise SystemExit(0)
usernames = sorted(
    {
        json.loads(line)["username"]
        for line in registry.read_text().splitlines()
        if line.strip()
    }
)
if not all(re.fullmatch(r"e2e_\d+_[a-z0-9]+", username) for username in usernames):
    raise SystemExit("Неожиданное имя в реестре. Удаление отменено.")
code = """from apps.users.models import UserProfile
from apps.articles.models import Article
from django.db import transaction
from django.core.files.storage import default_storage
usernames = USERNAMES
users = UserProfile.objects.filter(username__in=usernames)
files = [user.avatar.name for user in users if user.avatar]
files += [article.thumbnail.name for article in Article.objects.filter(author__in=users) if article.thumbnail]
count = users.count()
with transaction.atomic():
    users.delete()
for name in files:
    if not UserProfile.objects.filter(avatar=name).exists() and not Article.objects.filter(thumbnail=name).exists():
        default_storage.delete(name)
print(f"Удалено записанных E2E-аккаунтов: {count}")
""".replace("USERNAMES", repr(usernames))
command = [str(root / "scripts/prod.sh")] if args.production else ["docker", "compose"]
subprocess.run(
    command + ["exec", "-T", "backend", "python", "manage.py", "shell", "-c", code],
    cwd=root,
    check=True,
)
registry.unlink()
