#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
./scripts/prod.sh run --rm certbot renew --webroot -w /var/www/certbot --quiet
./scripts/prod.sh exec -T nginx nginx -t
./scripts/prod.sh exec -T nginx nginx -s reload
