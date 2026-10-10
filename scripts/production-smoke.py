#!/usr/bin/env python3
"""Read-only HTTP checks. --ca validates a local test certificate, without disabling TLS."""

import argparse
import json
import re
import ssl
from urllib.error import HTTPError
from urllib.request import HTTPSHandler, Request, build_opener

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", required=True)
parser.add_argument("--ca")
args = parser.parse_args()
if not args.url.startswith("https://"):
    parser.error("Use HTTPS")
opener = build_opener(HTTPSHandler(context=ssl.create_default_context(cafile=args.ca)))


def fetch(path, status=200):
    try:
        response = opener.open(Request(args.url.rstrip("/") + path), timeout=15)
    except HTTPError as error:
        response = error
    assert response.status == status, (path, response.status, status)
    return response, response.read()


response, index = fetch("/")
assert b'<div id="root">' in index
assert response.headers.get("X-Content-Type-Options") == "nosniff"
assert response.headers.get("Strict-Transport-Security")
for asset in re.findall(rb'(?:src|href)="(/assets/[^\"]+)"', index):
    response, _ = fetch(asset.decode())
    assert "immutable" in response.headers.get("Cache-Control", "")
fetch("/assets/missing.js", 404)
assert fetch("/profile")[1] == index
assert json.loads(fetch("/health/")[1]) == {"status": "ok"}
fetch("/admin/login/")
fetch("/static/admin/css/base.css")
fetch("/api/docs/")
fetch("/static/drf_spectacular_sidecar/swagger-ui-dist/swagger-ui-bundle.js")
articles = json.loads(fetch("/api/v1/articles/")[1])
assert isinstance(articles["results"], list)
response, _ = fetch("/api/v1/auth/csrf/")
assert any("Secure" in value for value in response.headers.get_all("Set-Cookie", []))
fetch("/api/v1/users/me/", 401)
print(
    "Production smoke OK: HTTPS, React/SPA/assets, DRF/DB health, admin/static, Swagger, Secure CSRF cookie, permissions"
)
