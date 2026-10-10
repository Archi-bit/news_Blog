#!/usr/bin/env python3
"""Создать локальный .env с независимыми случайными секретами."""

import secrets
from pathlib import Path

root = Path(__file__).resolve().parent.parent
path = root / ".env"
if path.exists():
    print(".env уже существует; настройки сохранены.")
else:
    content = (root / ".env.example").read_text()
    for placeholder in [
        "replace-with-a-long-random-secret",
        "replace-with-a-random-password",
        "replace-with-another-random-password",
    ]:
        content = content.replace(placeholder, secrets.token_urlsafe(48))
    with path.open("x") as output:
        output.write(content)
    path.chmod(0o600)
    print("Создан .env с правами 0600. Секреты не выводятся.")
