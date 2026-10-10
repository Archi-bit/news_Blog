#!/bin/sh
# Pause application writes while copying DB and media for a consistent pair.
set -eu
umask 077
cd "$(dirname "$0")/.."
backup_dir="${1:-backups/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p -- "$(dirname "$backup_dir")"
mkdir -- "$backup_dir"
./scripts/prod.sh stop backend
trap './scripts/prod.sh start backend >/dev/null' EXIT HUP INT TERM
./scripts/prod.sh exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > "$backup_dir/database.dump"
./scripts/prod.sh run --rm --no-deps --entrypoint tar backend -czf - -C /app/media . > "$backup_dir/media.tar.gz"
./scripts/prod.sh start backend
trap - EXIT HUP INT TERM
printf 'Backup: %s\n' "$backup_dir"
