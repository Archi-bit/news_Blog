#!/usr/bin/env python3
"""Create a new production environment; never overwrite existing secrets."""

import argparse
import os
import re
import secrets
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--domain", required=True)
parser.add_argument("--email", required=True)
parser.add_argument("--output", default=".env.prod")
args = parser.parse_args()
if (
    not re.fullmatch(r"[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?", args.domain)
    or len(args.domain) > 253
):
    parser.error("Use a DNS hostname, without scheme, path or port")
if not re.fullmatch(r"[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", args.email):
    parser.error("Invalid email")
root = Path(__file__).resolve().parent.parent
content = (root / ".env.prod.example").read_text()
for old, new in {
    "news.example.com": args.domain.lower(),
    "admin@example.com": args.email,
    "replace-with-a-long-random-secret": secrets.token_urlsafe(64),
    "replace-with-a-random-password": secrets.token_urlsafe(32),
    "replace-with-another-random-password": secrets.token_urlsafe(32),
}.items():
    content = content.replace(old, new)
fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, "w") as stream:
    stream.write(content)
print(f"Created {args.output} (0600); existing files were not modified")
