# News Blog — Backend и React Frontend

Учебный блог на Python 3.12, Django REST Framework, PostgreSQL и React. Реализованы этапы 1 и 2: backend и адаптивный frontend. Production Compose, Nginx, HTTPS и AWS относятся к отдельному третьему этапу, который пока не начинался.

## Быстрый запуск на Ubuntu

Требуются Docker Engine, Compose Plugin и Python 3 для создания `.env`.

```bash
python3 scripts/create_env.py
docker compose up -d --build --wait
docker compose exec backend python manage.py seed_demo
```

В текущем рабочем каталоге `.env` уже создан со случайными секретами и правами `0600`. Скрипт не заменяет существующий файл. Все зависимости Python, включая транзитивные, зафиксированы в `backend/requirements.txt`; Docker устанавливает их самостоятельно. Локальная `.venv` для запуска контейнеров не нужна.

- Сайт: http://localhost:5173/
- Swagger: http://localhost:8000/api/docs/
- OpenAPI: http://localhost:8000/api/schema/
- Django Admin: http://localhost:8000/admin/
- API: http://localhost:8000/api/v1/
- Проверка приложения и БД: http://localhost:8000/health/

Backend привязан к `127.0.0.1:8000`. Порт PostgreSQL на хост не опубликован. При первом запуске Compose ждёт healthcheck БД; backend выполняет миграции перед запуском сервера. Не запускайте второй `migrate` одновременно с первоначальным запуском. `runserver` и bind mount исходников предназначены для локальной разработки. В Dockerfile установлен Gunicorn для будущего этапа production.

## Демонстрационные аккаунты

Команды управления Django выполняйте внутри контейнера: Compose передаёт ему переменные из `.env` и доступ к PostgreSQL по внутреннему имени `db`. Запуск `python manage.py` непосредственно в локальной `.venv` не загружает `.env` и приводит к `KeyError: 'DJANGO_SECRET_KEY'`; PostgreSQL также не опубликован на хост.

Создание собственного администратора (команда работает из корня проекта и из `backend/`):

```bash
docker compose exec backend python manage.py createsuperuser
```

Для смены пароля существующего демонстрационного администратора:

```bash
docker compose exec backend python manage.py changepassword demo_admin
```

Пароли вводятся интерактивно. Входите по адресу http://localhost:8000/admin/ с именем пользователя, а не email.

| Логин | Пароль | Права |
|---|---|---|
| demo1, demo2, demo3, demo4, demo5 | DemoNews!2026 | Авторы |
| demo_admin | AdminNews!2026 | Администратор |

`seed_demo` разрешён только при `DEMO_MODE=True` **и** `DJANGO_DEBUG=True`. Команда запускается вручную, не при старте контейнера. На чистой БД она создаёт 6 пользователей (5 авторов + администратора), 5 категорий, 10 тегов, 20 русскоязычных статей (15 опубликованных и 5 черновиков), 30 комментариев, 40 лайков и 15 подписок. Повторный запуск не добавляет дубликаты и не меняет пароли существующих пользователей. PNG-заглушки генерируются локально через Pillow и сохраняются в media volume.

## Архитектура

- `backend/apps/users`: пользовательская модель `UserProfile(AbstractUser)`, регистрация, JWT, профили, API подписок.
- `backend/apps/articles`: категории, теги, статьи, фильтры и команда `seed_demo`.
- `backend/apps/interactions`: комментарии, лайки, подписки и ограничения их уникальности.
- `backend/config`: настройки, маршрутизация, общие permissions и обработчик ошибок.
- `backend/tests`: автоматизированные тесты и отдельный HTTP smoke script.
- `postgres/10-app-user.sh`: создание отдельной роли приложения.
- `scripts/create_env.py`: безопасная генерация локального окружения.

Ровно семь основных моделей; служебные таблицы Django и SimpleJWT обслуживают админ-панель, сессии и blacklist токенов. Пользовательская модель настроена до первой миграции. Статьи используют `select_related`, prefetch и агрегаты, количество запросов проверено тестом. Просмотры увеличиваются через `F()`. Уникальность лайков и подписок, а также запрет подписки на себя обеспечиваются БД. Названия категорий и тегов получают предсказуемые уникальные Unicode slug: `Наука` → `наука`, совпадающие slug получают числовой суффикс. Slug сохраняется при переименовании.

## API и правила доступа

Все бизнес-маршруты имеют префикс `/api/v1/`.

| Маршрут | Методы | Назначение |
|---|---|---|
| auth/csrf/ | GET | Cookie CSRF и токен для заголовка |
| auth/register/ | POST | Регистрация: username, email, password |
| auth/login/ | POST | Вход: username, password |
| auth/refresh/ | POST | Обновление по refresh cookie |
| auth/logout/ | POST | Blacklist refresh и удаление cookie |
| users/, users/{id}/ | GET | Публичные профили без email |
| users/me/ | GET, PATCH | Собственный профиль и email |
| users/{id}/articles/ | GET | Доступные статьи автора |
| users/{id}/followers/, following/ | GET | Подписчики и подписки |
| users/{id}/follow/ | POST, DELETE | Подписаться / отписаться |
| categories/, categories/{slug}/ | GET | Категории |
| tags/, tags/{id}/ | GET | Теги |
| articles/ | GET, POST | Список / создание |
| articles/{id}/ | GET, PUT, PATCH, DELETE | Просмотр / редактирование / удаление |
| articles/my/, articles/drafts/ | GET | Собственные статьи и черновики |
| articles/{id}/publish/, unpublish/ | POST | Публикация / снятие с публикации |
| articles/{id}/like/ | POST, DELETE | Лайк / отмена лайка |
| articles/{id}/comments/ | GET, POST | Комментарии опубликованной статьи |
| comments/{id}/ | PATCH, DELETE | Редактирование / удаление комментария |

Администраторы дополнительно могут создавать, изменять и удалять категории и теги через те же ресурсы и Django Admin. Удаление категории со статьями возвращает 400: сначала перенесите или удалите связанные статьи. Для создания статьи обязательны `title`, `content`, `category` (ID); `tags` — массив ID. Изображения передаются как multipart/form-data, максимум 5 МБ; разрешены только изображения, проходящие проверку Pillow. Поля автора, счётчиков и первой даты публикации недоступны для записи клиентом.

Гости читают опубликованные статьи. Автор и администратор видят черновики и могут редактировать/удалять статьи; запрос чужого черновика возвращает 404. Комментарии и лайки разрешены только для опубликованных статей; изменять комментарий может его автор или администратор. Лайки и подписки идемпотентны: повторный POST не создаёт дубликат, повторный DELETE безопасен.

Списки возвращают `count`, `next`, `previous`, `results`; размер страницы — 10. Примеры:

```text
/api/v1/articles/?search=Python
/api/v1/articles/?category=технологии
/api/v1/articles/?tags=django
/api/v1/articles/?author=1
/api/v1/articles/?is_published=true
/api/v1/articles/?ordering=-published_date
/api/v1/articles/?ordering=-views_count
/api/v1/articles/?ordering=-like_count&page=2
```

Несколько фильтров можно объединять. Сортировка с `-` убывающая, без него возрастающая. Ошибки DRF возвращаются в форме `{"error":{"status":400,"details":{...}}}`. Ошибки CSRF возвращают 403, неверные JWT/учётные данные — 401, нарушение прав — 403, недоступный объект — 404.

## JWT и CSRF

Access JWT живёт 5 минут, возвращается в JSON и передаётся в `Authorization: Bearer <access>`. React-клиент хранит его **в памяти**, без localStorage и sessionStorage. Refresh JWT живёт 7 дней и хранится в cookie `refresh_token` с `HttpOnly`, `SameSite=Lax`, путём `/api/v1/auth/`. При обновлении refresh ротируется, предыдущий попадает в blacklist. Обновление одного токена сериализуется блокировкой строки PostgreSQL.

Для login, refresh и logout обязательны CSRF cookie и заголовок `X-CSRFToken`. Сначала выполните `GET /api/v1/auth/csrf/`, сохраните cookie, затем передавайте `csrfToken` из JSON. В Swagger выполните этот GET и вставьте полученный токен в поле `X-CSRFToken` у auth POST. Cookie браузер отправляет сам. JWT для остальных запросов задаётся кнопкой **Authorize**. В React уже настроен `withCredentials: true` для запросов auth, совпадающее имя хоста и разрешённый origin.

Локально `COOKIE_SECURE=False` разрешает HTTP. В окружении с `DJANGO_DEBUG=False` приложение требует `COOKIE_SECURE=True`. Для HTTPS cookie должны быть Secure. Logout отзывает refresh; уже выпущенный access действует до истечения 5 минут. Это стандартная выбранная семантика выхода.

Пример проверки через curl (требуются Python 3 и curl):

```bash
curl -s -c /tmp/news-blog.cookies http://localhost:8000/api/v1/auth/csrf/ > /tmp/news-blog.csrf.json
CSRF_TOKEN=$(python3 -c 'import json; print(json.load(open("/tmp/news-blog.csrf.json"))["csrfToken"])')
curl -s -b /tmp/news-blog.cookies -c /tmp/news-blog.cookies \
  -H "X-CSRFToken: $CSRF_TOKEN" -H 'Content-Type: application/json' \
  -d '{"username":"demo1","password":"DemoNews!2026"}' \
  http://localhost:8000/api/v1/auth/login/
curl -s -b /tmp/news-blog.cookies -c /tmp/news-blog.cookies \
  -H "X-CSRFToken: $CSRF_TOKEN" -X POST http://localhost:8000/api/v1/auth/refresh/
curl -i -b /tmp/news-blog.cookies -H "X-CSRFToken: $CSRF_TOKEN" \
  -X POST http://localhost:8000/api/v1/auth/logout/
```

Пароли хешируются Django, применяется стандартная проверка сложности. Автор статьи/комментария определяется из JWT. Публичный профиль не раскрывает email и права. Изменение профиля не позволяет выдать себе права администратора. Настроены CORS allowlist и ограничения частоты запросов, включая 30 auth-запросов в час с одного IP. Локальный memory cache подходит для этого этапа; в production включён общий PostgreSQL cache для Gunicorn workers; строгий rate limiting при масштабировании потребует отдельного решения.

## PostgreSQL и сохранность данных

`POSTGRES_USER` — служебная роль инициализации кластера. Django использует другую роль, `POSTGRES_APP_USER`, с отдельным паролем, без SUPERUSER и CREATEROLE. Служебный пароль не передаётся backend-контейнеру. Только в demo роль приложения получает CREATEDB, чтобы pytest мог создать отдельную тестовую базу. Production использует отдельный volume и новую app-роль NOCREATEDB. Перенос данных описан в AWS_DEPLOYMENT.md; изменение `.env` само по себе не пересоздаёт роли существующего volume.

Проверка БД и подключения:

```bash
docker compose ps
docker compose exec db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT current_database(), version();"'
docker compose exec backend python manage.py showmigrations
docker compose exec backend python manage.py shell -c 'from django.db import connection; print(connection.vendor); print(connection.settings_dict["USER"])'
```

Данные находятся в volumes `news-blog_postgres_data` и `news-blog_media_data`. Для проверки сохранности:

```bash
docker compose exec backend python manage.py shell -c 'from apps.articles.models import Article; print(Article.objects.count())'
docker compose restart db
docker compose up -d --wait
docker compose exec backend python manage.py shell -c 'from apps.articles.models import Article; print(Article.objects.count())'
```

Остановка `docker compose stop` и обычный `docker compose down` сохраняют volumes. Не используйте `down -v`, если хотите сохранить данные. Init-скрипт исполняется автоматически только на пустом volume. Пароли в `.env` должны соответствовать уже созданным ролям: смена переменной не меняет пароль в PostgreSQL.

## Проверки

```bash
docker compose exec backend python manage.py check
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend python manage.py spectacular --validate --fail-on-warn --file /tmp/schema.yml
docker compose exec backend pytest -q
docker compose exec backend python tests/http_smoke.py
```

pytest использует PostgreSQL и создаёт/удаляет отдельную `test_news_blog_db`; основная demo-база сохраняется. HTTP smoke проверяет реально запущенный сервер и ожидает исходные demo-аккаунты и 15 опубликованных статей. Если вы изменили демонстрационные данные, некоторые проверки smoke могут ожидаемо не пройти.

Результаты фактической проверки записаны в `VERIFICATION.md` и `FRONTEND_VERIFICATION.md`.

## Текущие границы этапа

Приложение реализовано для локального обучения и проверки. HTML в `content` хранится как текст: React выводит пользовательские абзацы и комментарии без `dangerouslySetInnerHTML`, поэтому HTML не исполняется. Отправка email, восстановление пароля и вложенные ветки комментариев не входят в задание этого этапа. Production Compose, HTTPS/Nginx/Gunicorn и резервное копирование подготовлены на этапе 3. Локальные проверки описаны в [PRODUCTION_VERIFICATION.md](PRODUCTION_VERIFICATION.md), команды EC2 — в [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md). Реальный AWS не развёртывался.


## React Frontend — этап 2

Интерфейс доступен на **http://localhost:5173/**. Все функции используют реальный Django API. Шрифты с кириллицей включены в приложение; внешние CDN и платные сервисы не используются.

Страницы:

| Адрес | Страница |
|---|---|
| `/` | Лента: публикации, темы, выбор читателей |
| `/register`, `/login` | Регистрация и авторизация |
| `/users/{id}` | Профиль, статьи, подписчики и подписки автора |
| `/profile/edit` | Редактирование собственного профиля и аватара |
| `/articles/{id}` | Статья, лайки и комментарии |
| `/articles/new`, `/articles/{id}/edit` | Создание и редактирование статьи |
| `/my-articles`, `/drafts` | Собственные статьи и черновики |
| `/categories`, `/categories/{slug}` | Темы и статьи по теме |
| `/search?q=...&tag=...&category=...` | Поиск и фильтры |
| `/following` | Авторы, на которых вы подписаны |
| Любой неизвестный адрес | Страница 404 |

Редактор поддерживает тему, несколько тегов, обложку, предварительный просмотр, сохранение черновика и публикацию. При полном сохранении multipart используется PUT: удаление всех тегов и загрузка изображения выполняются одним API-запросом. Черновики недоступны гостям и другим авторам. Статьи, комментарии и профили обновляются только после успешного ответа сервера. Удаление требует подтверждения; ошибки и уведомления отображаются в интерфейсе.

При перезагрузке страницы приложение восстанавливает сессию через HttpOnly refresh-cookie. После HTTP 401 короткоживущий access обновляется автоматически; параллельные запросы используют один refresh. Refresh-cookie и CSRF работают через Vite proxy `/api` и `/media`; backend URL для Docker задаётся `API_PROXY_TARGET=http://backend:8000`. Адреса медиа, возвращённые DRF с внутренним hostname, приводятся к `/media/...`. Собственный профиль содержит read-only `is_staff`, чтобы интерфейс показывал администратору разрешённые действия; публичные профили это поле не раскрывают.

Для авторизации используйте один hostname: рекомендуемый адрес — **localhost**, указанный в `CSRF_TRUSTED_ORIGINS`. Если хотите использовать `127.0.0.1:5173`, добавьте `http://127.0.0.1:5173` в разрешённые CORS/CSRF origins в `.env` и пересоздайте backend через `docker compose up -d backend`. Сам frontend обращается к относительным URL, менять JavaScript не нужно.

### Разработка и проверки через Docker

```bash
docker compose up -d --build --wait
docker compose exec frontend npm run lint
docker compose exec frontend npm run format:check
docker compose exec frontend npm run build
```

Контейнер frontend использует закреплённый Node.js 22.22.0. Установленный на хосте Node.js 18 не подходит для выбранного Vite. Исходники монтируются в контейнер: Vite применяет изменения без ручной пересборки. Зависимости закреплены в `package.json` и `package-lock.json` и устанавливаются через `npm ci`. После изменения lock-файла обновите отдельный volume зависимостей:

```bash
docker compose exec frontend npm ci
docker compose restart frontend
```

Для локального запуска без frontend-контейнера нужен Node.js **22.13+**:

```bash
# Из корня проекта: backend и PostgreSQL остаются в Docker.
docker compose up -d backend
cd frontend
npm ci
npm run dev
```

Остановите frontend-контейнер через `docker compose stop frontend`, если порт 5173 уже занят. Сборка `npm run build` создаёт `frontend/dist`; production Dockerfile `nginx/Dockerfile` собирает React и размещает результат за Nginx. Текущий Vite dev-server не предназначен для публикации в интернете.

### Браузерные тесты

Тесты Playwright работают с запущенным сайтом и настоящим PostgreSQL через API. Успешные API-ответы не подменяются. Для проверки ошибок один тест прерывает сетевые запросы, а другой меняет Authorization двух исходящих запросов: Django возвращает настоящие 401, после чего клиент делает один настоящий refresh и успешно повторяет запросы.

Нужны Node.js 22.13+ и установленный Google Chrome:

```bash
cd frontend
npm ci
CHROME_PATH=/usr/bin/google-chrome npm run test:e2e
# Из корня проекта после завершения тестов:
python3 scripts/cleanup_e2e.py
```

`E2E_BASE_URL` позволяет указать другой адрес сайта. HTML-отчёт сохраняется в `frontend/playwright-report`, traces и screenshots ошибок — в `frontend/test-results`. Axe проверяет WCAG A/AA на desktop и mobile; также проверяется отсутствие горизонтальной прокрутки. Тесты используют исходные 5 demo-категорий и не менее 10 опубликованных статей.

Тест создаёт аккаунт с уникальным именем `e2e_...`, записывает его в игнорируемый `.e2e-accounts.jsonl` и удаляет созданную статью в конце сценария. Скрипт cleanup удаляет только точные имена из этого реестра, а также связанные с этими аккаунтами объекты и назначенные им изображения. Демонстрационные и собственные аккаунты пользователя он не затрагивает.

Auth API ограничен 30 запросами в час с одного IP. При многократных локальных прогонах перед тестами можно перезапустить backend, чтобы очистить локальный memory cache: `docker compose restart backend` и затем `docker compose up -d --wait`. В обычном использовании лимит не меняется.

Официальные справочники: [Vite proxy](https://vite.dev/config/server-options#server-proxy), [React Router](https://reactrouter.com/start/modes), [Axios](https://axios-http.com/docs/intro).

## Production — этап 3

Используйте отдельный `docker-compose.prod.yml` и `.env.prod`; dev Compose и его PostgreSQL volume сохраняются. Production frontend обслуживает Nginx, backend — Gunicorn, static/media лежат в persistent volumes. Внешние порты — 80/443, БД и Gunicorn наружу не опубликованы.

Полная последовательность установки Ubuntu, переноса проекта, TLS bootstrap, создания admin, обновлений и backup/restore: [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md). Отчёт фактических локальных проверок: [PRODUCTION_VERIFICATION.md](PRODUCTION_VERIFICATION.md).

```bash
python3 scripts/create_prod_env.py --domain YOUR_DOMAIN --email YOUR_EMAIL
TLS_MODE=bootstrap ./scripts/prod.sh up -d --build --wait
./scripts/prod.sh run --rm certbot certonly --webroot -w /var/www/certbot \
  --cert-name YOUR_DOMAIN -d YOUR_DOMAIN --email YOUR_EMAIL --agree-tos --non-interactive
./scripts/prod.sh up -d --wait
./scripts/prod.sh exec backend python manage.py createsuperuser
python3 scripts/production-smoke.py --url https://YOUR_DOMAIN
```

Эти команды для сервера с настроенным доменом и доступным портом 80. Настоящий сертификат локально не запрашивался. Для просмотра статуса и логов: `./scripts/prod.sh ps`, `./scripts/prod.sh logs --tail 100`. Backup: `./scripts/backup-prod.sh`. Данные сохраняются при обычном `down` и `up`; не используйте `down -v`.
