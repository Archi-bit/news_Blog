#!/bin/sh
set -eu
case "$DOMAIN" in *[!a-zA-Z0-9.-]*|"") echo "Invalid DOMAIN" >&2; exit 1;; esac
case "$SECURE_HSTS_SECONDS" in *[!0-9]*|"") echo "Invalid HSTS seconds" >&2; exit 1;; esac
case "${TLS_MODE:-https}" in bootstrap|https) ;; *) echo "TLS_MODE must be bootstrap or https" >&2; exit 1;; esac
envsubst '${DOMAIN} ${SECURE_HSTS_SECONDS}' < "/etc/news-blog/templates/${TLS_MODE:-https}.conf.template" > /etc/nginx/conf.d/default.conf
HSTS_HEADER="max-age=${SECURE_HSTS_SECONDS}"
[ "${SECURE_HSTS_INCLUDE_SUBDOMAINS:-False}" != True ] || HSTS_HEADER="$HSTS_HEADER; includeSubDomains"
[ "${SECURE_HSTS_PRELOAD:-False}" != True ] || HSTS_HEADER="$HSTS_HEADER; preload"
export HSTS_HEADER
envsubst '${HSTS_HEADER}'  < /etc/news-blog/security-headers.conf > /etc/news-blog/security-headers.rendered.conf
mv /etc/news-blog/security-headers.rendered.conf /etc/news-blog/security-headers.conf
nginx -t
