#!/bin/sh
# Stable wrapper; changing project name changes ALL named volumes.
set -eu
cd "$(dirname "$0")/.."
exec docker compose --env-file "${PROD_ENV_FILE:-.env.prod}" --project-name "${PROD_PROJECT:-news-blog-prod}" -f docker-compose.prod.yml "$@"
