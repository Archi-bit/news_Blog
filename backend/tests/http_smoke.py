"""Проверка запущенного HTTP-сервера (не входит в pytest)."""

import json
from http.cookiejar import CookieJar
from urllib.parse import urlsplit
from urllib.request import HTTPCookieProcessor, Request, build_opener

base = "http://127.0.0.1:8000"
opener = build_opener(HTTPCookieProcessor(CookieJar()))


def request(path, data=None, headers=None):
    headers = headers or {}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    with opener.open(Request(base + path, data=body, headers=headers)) as response:
        content = response.read()
        return response.status, json.loads(content) if content and response.headers.get(
            "Content-Type", ""
        ).startswith("application/json") else content


assert request("/health/")[1] == {"status": "ok"}
assert request("/api/docs/")[0] == 200
assert request("/admin/login/")[0] == 200
assert (
    request("/static/drf_spectacular_sidecar/swagger-ui-dist/swagger-ui-bundle.js")[0]
    == 200
)
articles = request("/api/v1/articles/")[1]
assert articles["count"] == 15
assert request(urlsplit(articles["results"][0]["thumbnail"]).path)[0] == 200
assert request("/api/v1/categories/")[1]["count"] == 5
assert request("/api/v1/tags/")[1]["count"] == 10
csrf = request("/api/v1/auth/csrf/")[1]["csrfToken"]
headers = {"X-CSRFToken": csrf}
access = request(
    "/api/v1/auth/login/", {"username": "demo1", "password": "DemoNews!2026"}, headers
)[1]["access"]
assert (
    request("/api/v1/users/me/", headers={"Authorization": "Bearer " + access})[1][
        "username"
    ]
    == "demo1"
)
assert request("/api/v1/auth/refresh/", {}, headers)[0] == 200
assert request("/api/v1/auth/logout/", {}, headers)[0] == 204
print(
    "HTTP smoke: health, Swagger и его JS, admin, demo API, JWT login/me/refresh/logout — OK"
)
