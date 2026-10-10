# News Blog: развёртывание на AWS EC2 Ubuntu 24.04 LTS

Проект подготовлен и проверен локально. Команды ниже выполняет владелец сервера; в рамках этапа 3 реальный AWS не использовался. Бизнес-модели и API сохранены.

## 1. Архитектура и требования

Один EC2 Ubuntu 24.04: Nginx обслуживает React production build, `/static/` и `/media/`, передаёт `/api/`, `/admin/`, `/health/` в Gunicorn. PostgreSQL доступен только backend через внутреннюю Docker-сеть. Публичные порты только 80/443. Node и Vite в runtime отсутствуют. Production pins: PostgreSQL 17.11, Nginx 1.30.5, Certbot 5.8.0; версии сверены с [PostgreSQL security](https://www.postgresql.org/support/security/) и [Nginx advisories](https://nginx.org/en/security_advisories.html). Dev PostgreSQL 17.6 этим этапом не обновлялся. Сертификат бесплатный Let's Encrypt; Redis, RDS, ALB, S3, платные API не требуются. Сам EC2, диски и трафик оплачиваются по условиям вашего AWS-аккаунта; бесплатность AWS не предполагается.

Для сборки разумный исходный размер — 2 GiB RAM и 20 GiB диска, с последующим контролем `free -h`, `df -h`, `docker stats`. Используйте существующий DNS-домен, A-запись на публичный IPv4 EC2. AAAA добавляйте только при действительно работающем IPv6. Смена IP требует обновления DNS. HTTPS нужен для Secure refresh/session cookies; работа production-авторизации по обычному HTTP не поддерживается.

Security Group: TCP 22 только с вашего текущего IP `/32`; TCP 80 и 443 публично. Не открывать 5432, 8000, 5173. Исходящий доступ нужен для Docker registry и ACME. По [инструкции AWS SSH](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-linux-inst-ssh.html), для Ubuntu используется пользователь `ubuntu`.

```bash
chmod 400 news-blog.pem
ssh -i news-blog.pem ubuntu@PUBLIC_IPV4
```

## 2. Docker на новом Ubuntu-сервере

На новом EC2 установите Docker из [официального apt-репозитория](https://docs.docker.com/engine/install/ubuntu/):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl python3
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
exit
```

Подключитесь повторно через SSH. Членство в группе docker даёт полный административный доступ к хосту. Проверка: `docker version` и `docker compose version`.

## 3. Передать именно существующий проект

На локальном компьютере, в корне проекта, создайте архив без секретов, данных и зависимостей:

```bash
tar --exclude='./.git' --exclude='./.venv' --exclude='./.env' \
  --exclude='./.env.prod' --exclude='./.env.prod.*' --exclude='./backups' \
  --exclude='./frontend/node_modules' --exclude='./frontend/dist' \
  --exclude='./frontend/test-results' --exclude='./frontend/playwright-report' \
  --exclude='./frontend/.e2e-accounts.jsonl' --exclude='./backend/media' \
  --exclude='./backend/staticfiles' --exclude='__pycache__' \
  -czf /tmp/news-blog-source.tar.gz .
# Добавить production-шаблон, исключённый шаблоном .env.prod.*:
tar -czf /tmp/news-blog-production-template.tar.gz .env.prod.example
scp -i news-blog.pem /tmp/news-blog-source.tar.gz /tmp/news-blog-production-template.tar.gz ubuntu@PUBLIC_IPV4:/home/ubuntu/
```

На EC2:

```bash
mkdir -p /home/ubuntu/news_blog
cd /home/ubuntu/news_blog
tar -xzf /home/ubuntu/news-blog-source.tar.gz
tar -xzf /home/ubuntu/news-blog-production-template.tar.gz
chmod +x scripts/*.sh
```

Исходная локальная `.env` на сервер не переносится. Для переноса существующей БД см. раздел 9, до открытия приложения пользователям.

## 4. Production .env и запуск ACME bootstrap

Введите **свой** домен без `https://`, пути и порта, и почту для сертификата:

```bash
cd /home/ubuntu/news_blog
read -r -p 'Domain: ' NEWS_DOMAIN
read -r -p 'Certificate email: ' NEWS_EMAIL
python3 scripts/create_prod_env.py --domain "$NEWS_DOMAIN" --email "$NEWS_EMAIL"
chmod 600 .env.prod
./scripts/prod.sh config --quiet
TLS_MODE=bootstrap ./scripts/prod.sh up -d --build --wait
./scripts/prod.sh ps
```

Генератор создаёт отдельные случайные Django/PostgreSQL-секреты и отказывается перезаписывать файл. `.env.prod` исключён из Git и Docker build context. Не публикуйте `docker compose config` без `--quiet`: он раскрывает значения секретов.

В production Compose принудительно `DEBUG=False`, `DEMO_MODE=False`, Secure cookies и HTTPS redirect; dev `.env` здесь не применяется. Startup backend выполняет `check`, `migrate`, создание общей DB cache и `collectstatic`, затем Gunicorn от пользователя `app` (UID 1000). Bootstrap Nginx даёт 503 для сайта, но обслуживает ACME challenge. Проверить DNS/HTTP можно:

```bash
curl -I "http://$NEWS_DOMAIN/"
```

Ожидается 503. До TLS сайт не принимает логины по HTTP. Если bootstrap не запускается, сначала смотрите `./scripts/prod.sh logs --tail 100 backend nginx db`.

## 5. Бесплатный TLS и полный запуск

Только когда домен действительно указывает на EC2 и порт 80 доступен извне:

```bash
./scripts/prod.sh run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --cert-name "$NEWS_DOMAIN" -d "$NEWS_DOMAIN" \
  --email "$NEWS_EMAIL" --agree-tos --non-interactive
./scripts/prod.sh up -d --wait
./scripts/prod.sh exec -T nginx nginx -t
curl -I "http://$NEWS_DOMAIN/"
curl -I "https://$NEWS_DOMAIN/"
python3 scripts/production-smoke.py --url "https://$NEWS_DOMAIN"
```

Без `TLS_MODE=bootstrap` используется `.env.prod` с `TLS_MODE=https`. Ожидаются HTTP 308 → HTTPS, HTTPS 200 и успешный smoke. `curl -k` на настоящем сервере не нужен. [Certbot webroot](https://eff-certbot.readthedocs.io/en/stable/using.html) использует общий ACME volume; HTTP challenge сохраняется и после включения HTTPS. При ошибке выдачи исправляйте DNS, Security Group, AAAA и доступность challenge; не запускайте повторные выдачи без устранения причины.

Создать собственный admin:

```bash
./scripts/prod.sh exec backend python manage.py createsuperuser
./scripts/prod.sh exec -T backend python manage.py check --deploy
```

Пользователь и пароль выбираются вами, demo admin в новой production-БД отсутствует. Админка `https://DOMAIN/admin/`, API `https://DOMAIN/api/v1/`, Swagger `https://DOMAIN/api/docs/`.

`check --deploy` при безопасных начальных настройках сообщает **W005 и W021**: includeSubDomains/preload намеренно выключены. Ошибок быть не должно. Эти предупреждения не скрыты. Начальный HSTS 3600 секунд позволяет проверить TLS. После проверки можно увеличить `SECURE_HSTS_SECONDS=31536000`. Включение `SECURE_HSTS_INCLUDE_SUBDOMAINS=True` требует HTTPS на всех поддоменах, а `SECURE_HSTS_PRELOAD=True` — осознанного выполнения условий preload; не включайте их только ради исчезновения предупреждений. См. [Django production checklist](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/).

## 6. Автоматическое продление и обслуживание

Проверьте renewal на настоящем EC2:

```bash
./scripts/prod.sh run --rm certbot renew --dry-run
sudo tee /etc/systemd/system/news-blog-renew.service >/dev/null <<'EOF'
[Unit]
Description=Renew News Blog TLS certificates
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
User=ubuntu
WorkingDirectory=/home/ubuntu/news_blog
ExecStart=/home/ubuntu/news_blog/scripts/renew-certificates.sh
EOF
sudo tee /etc/systemd/system/news-blog-renew.timer >/dev/null <<'EOF'
[Unit]
Description=Check News Blog TLS certificates twice daily

[Timer]
OnCalendar=*-*-* 03,15:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now news-blog-renew.timer
systemctl list-timers news-blog-renew.timer
```

Оставьте 80 доступным для обновления. Скрипт после `certbot renew` проверяет и перечитывает конфигурацию Nginx. Проверка ошибок: `journalctl -u news-blog-renew.service`.

Периодически очищайте служебные истёкшие записи, не статьи/пользователей:

```bash
./scripts/prod.sh exec -T backend python manage.py clearsessions
./scripts/prod.sh exec -T backend python manage.py flushexpiredtokens
```

Общий PostgreSQL cache обеспечивает одинаковое состояние DRF throttling для двух Gunicorn workers. DRF throttling не является защитой от DDoS и не гарантирует строго атомарный лимит при параллельных запросах. Nginx перезаписывает forwarded headers; backend не публикует порт, доверие proxy применяется только в этой архитектуре. Не подключайте посторонние контейнеры к application-сети.

## 7. Данные, volumes и резервное копирование

Постоянное имя проекта `news-blog-prod` задаёт volumes:

- `news-blog-prod_postgres_data`: PostgreSQL;
- `news-blog-prod_media_data`: загруженные файлы;
- `news-blog-prod_static_data`: collectstatic;
- `news-blog-prod_certificates`: сертификаты/ключи;
- `news-blog-prod_acme_webroot`: ACME challenge.

Dev volumes `news-blog_*` независимы. `up`, `restart`, `down` без `-v` сохраняют данные. **Не выполнять `down -v`, `docker volume prune`, `docker system prune --volumes`. Не менять имя проекта ради обновления.** Изменение пароля в env не меняет пароль уже существующей роли PostgreSQL; при ротации нужен согласованный SQL `ALTER ROLE` и env backend. Init-скрипт выполняется только на пустом PG volume.

Backup с коротким прекращением записи API:

```bash
./scripts/backup-prod.sh
ls -lh backups/
```

Скрипт отказывается перезаписывать существующую папку backup, временно останавливает backend, сохраняет custom `pg_dump` и `media.tar.gz` одной точки записи, затем запускает backend даже при ошибке. Сайт/API в это время могут отдавать 502. Права файлов 0600; каталог создаётся с закрытыми правами. Скопируйте backup на собственный компьютер, отдельно от EC2. Не публикуйте дампы, .env и TLS private key. Static можно пересобрать; сертификаты перевыпустить. Для аварийного восстановления нужны source, `.env.prod`, DB dump и media.

## 8. Проверяемое восстановление без удаления текущей БД

Прежде чем восстанавливать рабочую БД, проверьте архив в **новом** project/volumes. Домен остаётся тем же, порты нового стенда привязываются только к localhost; Nginx на нём не запускается.

```bash
cp .env.prod .env.prod.restore
chmod 600 .env.prod.restore
export PROD_ENV_FILE=.env.prod.restore PROD_PROJECT=news-blog-restore
./scripts/prod.sh up -d --wait db
./scripts/prod.sh build backend
# В этом новом проекте backend НЕ запускался: база действительно пустая.
./scripts/prod.sh exec -T db sh -c \
  'pg_restore --exit-on-error --no-owner --no-acl --role="$POSTGRES_APP_USER" -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backups/BACKUP_TIMESTAMP/database.dump
./scripts/prod.sh run --rm --no-deps --entrypoint tar backend \
  -xzf - -C /app/media < backups/BACKUP_TIMESTAMP/media.tar.gz
./scripts/prod.sh up -d --wait backend
./scripts/prod.sh exec -T backend python manage.py check
./scripts/prod.sh exec -T backend python manage.py shell -c \
  'from apps.articles.models import Article; print("Articles:", Article.objects.count())'
./scripts/prod.sh stop
unset PROD_ENV_FILE PROD_PROJECT
```

Подставьте существующую папку backup. Если архив отсутствует, перенаправление завершится ошибкой до `pg_restore`. Восстановление в непустую БД с `--exit-on-error` прервётся вместо автоматического удаления таблиц. Не используйте `--clean` на рабочем проекте. Для реального переключения согласуйте окно обслуживания, сначала сделайте backup текущей БД и выберите проверенный новый volume/project; не накладывайте dump на действующую БД.

## 9. Перенос существующих локальных данных

Новая production-БД по умолчанию пустая; существующая локальная dev-БД не копируется автоматически. Если хотите перенести свои данные, в dev-корне остановите только backend для согласованного снимка:

```bash
umask 077
mkdir -p backups/migration
docker compose stop backend
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' \
  > backups/migration/database.dump
docker compose run --rm --no-deps --entrypoint tar backend \
  -czf - -C /app/media . > backups/migration/media.tar.gz
docker compose start backend
```

Перенесите архивы безопасно через SCP. На EC2 **до первого запуска backend** запустите только db и восстановите через команды раздела 8, но с обычным `news-blog-prod`. Затем запускайте bootstrap/HTTPS. Если backend уже создал таблицы, проверяйте восстановление в новом проекте раздела 8.

Дамп с `--no-owner --no-acl` не переносит dev-привилегию CREATEDB; новая app-роль остаётся NOSUPERUSER/NOCREATEDB/NOCREATEROLE. Перед открытием перенесённых данных уберите demo-аккаунты либо смените все известные demo-пароли через `changepassword`, включая `demo_admin`. Не открывайте публичный сайт с опубликованными учебными паролями. `seed_demo` в production запрещён.

## 10. Обновления и диагностика

```bash
cd /home/ubuntu/news_blog
./scripts/backup-prod.sh
# Передайте/обновите source, сохранив .env.prod и volumes.
./scripts/prod.sh up -d --build --wait
./scripts/prod.sh exec -T nginx nginx -t
python3 scripts/production-smoke.py --url "https://YOUR_DOMAIN"
./scripts/prod.sh ps
./scripts/prod.sh logs --tail 100 backend nginx db
```

Миграции запускаются автоматически одним backend-контейнером, до Gunicorn. Развёртывание на одном EC2 не обещает zero downtime. Перед откатом исходников проверяйте совместимость миграций с прежним кодом; backup храните до подтверждения обновления.

Типовые причины: 502 — backend health/logs; отсутствующая CSS админки — collectstatic/static volume; 413 — загрузка больше 6 MiB Nginx; 403 CSRF — неправильный https origin/домен, cookie либо отсутствие X-CSRFToken; циклический redirect — сломано доверие private Nginx/forwarded proto; TLS startup error — сертификат ещё не получен или DOMAIN отличается от cert-name; PostgreSQL authentication failed после изменения env — пароль существующей роли не был изменён SQL. Compose обычно показывает env-секреты в inspect/config; не присылайте эти выводы целиком.
