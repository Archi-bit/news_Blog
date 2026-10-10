#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_user="$POSTGRES_APP_USER" --set=app_password="$POSTGRES_APP_PASSWORD" --set=db_name="$POSTGRES_DB" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEROLE', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'app_user') \gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'db_name', :'app_user') \gexec
SELECT format('GRANT ALL ON SCHEMA public TO %I', :'app_user') \gexec
SQL
# pytest создаёт отдельную БД; это разрешено только в локальном demo.
if [ "${DEMO_MODE:-False}" = "True" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=app_user="$POSTGRES_APP_USER" <<'SQL'
SELECT format('ALTER ROLE %I CREATEDB', :'app_user') \gexec
SQL
fi
