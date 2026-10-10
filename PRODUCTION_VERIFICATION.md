# Этап 3: результаты локальных production-проверок

Дата: 9 октября 2026. Работа выполнена в существующем News Blog. Реальный AWS, SSH на EC2 и публичная выдача Let's Encrypt не выполнялись.

## Конфигурация

`docker-compose.prod.yml`: отдельный проект `news-blog-prod`, PostgreSQL 17.11-bookworm, Django/Gunicorn от UID 1000, Nginx 1.30.5 с React production build. Certbot 5.8.0 запускается через профиль tools. Production runtime не содержит Vite/Node. Nginx публикует 80/443; backend и БД без host ports, в отдельных внутренних сетях. Для теста использованы `news-blog-prod-check` и отдельные named volumes, localhost 8080/8443, `.env` в `/tmp` с правами 0600.

Production startup: check → migrate → createcachetable → collectstatic → Gunicorn (2 workers). Debug/demo выключены, cookies Secure, refresh HttpOnly, CSRF и trusted HTTPS origins включены, forwarded headers перезаписываются Nginx, HTTPS redirect/HSTS настроены. DB cache общий для workers. Logs ограничены 10 MiB × 3 на контейнер; access logs не включают query strings, cookies, токены и тела запросов.

Версии production сверены с [Nginx security advisories](https://nginx.org/en/security_advisories.html) и [PostgreSQL security](https://www.postgresql.org/support/security/). Существующий dev PostgreSQL 17.6 и его volume не обновлялись.

## Фактические результаты

| Проверка | Результат |
|---|---|
| Production Compose config --quiet | Успешно |
| Docker build backend + React/Nginx | Успешно, npm audit: 0 найденных уязвимостей npm-зависимостей |
| Production db/backend/nginx up --wait | Все 3 healthy |
| Реальные версии | nginx/1.30.5, PostgreSQL 17.11, certbot 5.8.0 |
| Nginx nginx -t | Успешно |
| Backend regression pytest | 49 passed, 30.18 s |
| Playwright production HTTPS | 5 passed, 12.4 s на финальных версиях |
| ESLint / Prettier | Успешно |
| Ruff новых Python-файлов и настроек | Успешно |
| sh -n startup/backup/renew/wrapper | Успешно |
| Django check --deploy | Нет ошибок; ожидаемые security.W005/W021 |
| App PostgreSQL role | NOSUPERUSER, NOCREATEDB, NOCREATEROLE |
| Backend OS user | UID 1000 |
| Общий cache | DatabaseCache, записи создаются реальными HTTP-запросами |
| HTTPS React/SPA/assets | 200; /profile отдаёт SPA; несуществующий /assets/*.js — 404 |
| Cache headers | index no-cache; hashed assets immutable |
| Django admin/static и Swagger/JS | 200 за Nginx |
| CSRF / JWT / refresh / logout | Реальный API, Secure HttpOnly refresh, rotation/logout успешны |
| POST auth без CSRF / с чужим Origin | 403 / 403 |
| Подменённый X-Forwarded-Proto=http через HTTPS | Nginx перезаписывает; API работает без redirect loop |
| HTTP redirect | 308 на https://DOMAIN/ |
| HTTP ACME challenge | Тестовый challenge из общего volume: 200 |
| DB outage | Остановка только тестовой db: /health/ → 503; запуск db → восстановление |
| Генератор production env | Случайные secrets, 0600, отказ перезаписи и небезопасного ввода |
| Backup/restore | Custom pg_dump и media tar восстановлены в отдельный проект; hashes совпали |
| Полный down → up без -v | Все 3 healthy; SHA-256 всех основных записей и media совпали |
| Финальный pg_dump/pg_restore PostgreSQL 17.11 | Восстановление в новую БД news_blog_restore_final; hash записей совпал |
| Исходная dev-БД | SHA-256 всех основных записей до/после совпадает |

E2E проверяет реальную регистрацию, вход, JWT refresh при параллельных 401, редактор/preview, drafts/publish/unpublish, CRUD статьи, изображения, лайки, комментарии, профиль/avatar, follow/unfollow, logout, guest permissions, поиск/пагинацию/сортировку, мобильный интерфейс и WCAG axe. Успешные API-ответы не подменяются.

Тестовые fixtures созданы только в локальном проверочном проекте явным одноразовым `exec env DJANGO_DEBUG=True DEMO_MODE=True ... seed_demo`; работающий production backend сохранял DEBUG=False/DEMO_MODE=False. На новой production-БД fixtures и demo admin автоматически не создаются. Зарегистрированные E2E-аккаунты удалены только из тестового проекта через `cleanup_e2e.py --production`.

Накопленные повторными HTTP/E2E прогонами auth-запросы достигли лимита 30/hour: сервер вернул 429, что подтверждает сохранение общего лимита между workers/restarts. Для чистого повторного E2E сброшен только cache локального тестового проекта; рабочие production rate limits не увеличивались.

## Сохранность данных

Исходная dev-БД: 6 users, 5 categories, 10 tags, 20 articles, 30 comments, 40 likes, 15 follows. SHA-256 сериализованных основных записей до/после этапа:

```text
be3684e02aab82c9ea381a985bee748cd6e8735d199805d6b2c4d66607789d8b
```

Первый проверенный production backup восстановлен в `news-blog-prod-restore-check`, без удаления существующих БД. Исходные и восстановленные 7 основных таблиц дали одинаковый hash:

```text
bda92fb3f218426b73f2899e9ddb2f3050474feb8ce41b45abe172f1cc9e41a4
```

Все 22 media-файла этого снимка совпали по совокупному hash путей и содержимого:

```text
6b5b3548a502cbbb99897a2316e7fc784e4a538c7afbbad28bf96f242c046f46
```

Backup-файлы имеют 0600. Helper `scripts/state-fingerprint.py` запускается через `manage.py shell`, выводит количества и hashes без приватных полей. Обычный `down`/`up` сохраняет volumes; `down -v` и volume prune не выполнялись.

## Что остаётся проверить на реальном EC2

Локальный TLS использовал временный self-signed сертификат с SAN localhost. Python smoke проверял цепочку через `--ca`; Playwright разрешал только этот тестовый self-signed сертификат через `E2E_IGNORE_HTTPS_ERRORS=true`. Для настоящего сервера это исключение не требуется.

Публичные DNS, Security Group, выдача/renewal Let's Encrypt, systemd timer и работа после перезагрузки EC2 требуют доступа к выбранному серверу/домену и отдельно разрешённого развёртывания. Команды подготовлены в [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md). Начальные HSTS includeSubDomains/preload выключены осознанно; предупреждения Django не скрываются.

Локальные временные production/restore контейнеры после проверок остановлены, их volumes сохранены. Исходные dev-контейнеры остаются healthy на localhost:5173/8000.
