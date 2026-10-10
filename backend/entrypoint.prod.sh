#!/bin/sh
set -eu
python manage.py check --fail-level ERROR
python manage.py migrate --noinput
python manage.py createcachetable
python manage.py collectstatic --noinput
exec gunicorn config.wsgi:application --config /app/gunicorn.conf.py
