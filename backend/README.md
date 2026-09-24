# Marvel Timeline Board — Backend

Serverless REST API для проекта Marvel Timeline Board. Разворачивается в **Yandex Cloud Functions** (runtime `nodejs22`), данные хранятся в **Yandex YDB** (Document API). Реализован на чистом Node.js без внешних npm-зависимостей.

## Быстрый старт (локально)

```bash
cd backend
npm run check   # проверка синтаксиса всех модулей
```

По умолчанию хранилище — in-memory (`MemoryStore`), поэтому для локальной отладки ничего дополнительно настраивать не нужно: эндпоинты можно вызывать, например, через локальный HTTP-триггер или юнит-тесты.

## Деплой

Автоматический деплой в Yandex Cloud настроен через SourceCraft CI/CD (`.sourcecraft/ci.yaml` в корне репозитория): при пуше в `master`/`main` по путям `backend/**` запускается workflow `deploy-backend`, который публикует новую версию Cloud Function через готовый кубик `yc-function`.

Параметры функции (см. `.sourcecraft/ci.yaml`):

| Параметр | Значение |
| --- | --- |
| Имя функции | `marvel-timeline-api` |
| Runtime | `nodejs22` |
| Entry point | `index.handler` |
| Source path | `./backend` |
| Public | `true` |

Для работы деплоя необходимо:

1. В Yandex Cloud создать сервисный аккаунт с ролью `functions.admin` (например `functions-cicd-sa`).
2. В SourceCraft создать сервисное подключение (`default-service-connection`) к этому аккаунту.
3. (Опционально) Заполнить блок `ENVIRONMENT` в `.sourcecraft/ci.yaml` значениями для YDB и почтового webhook.

## Переменные окружения

| Переменная | Назначение | Обязательная |
| --- | --- | --- |
| `YDB_DOCAPI_ENDPOINT` | URL Document API YDB, например `https://docapi.serverless.yandexcloud.net/ru-central1/<db-id>` | да, для YDB |
| `YDB_TABLE_PREFIX` | Префикс таблиц в YDB (по умолчанию `marvel_`) | нет |
| `YDB_IAM_TOKEN` | Статический IAM-токен сервисного аккаунта (если не задан — берётся из metadata-сервиса функции) | нет |
| `STORAGE=memory` | Принудительно использовать in-memory хранилище (для разработки) | нет |
| `MAIL_WEBHOOK_URL` | URL почтового webhook/шлюза для отправки одноразовых кодов | нет |
| `MAIL_WEBHOOK_TOKEN` | Bearer-токен для почтового webhook | нет |
| `FRONTEND_URL` | Базовый URL фронтенда, куда редиректит после OAuth (по умолчанию `http://localhost:3000`) | нет |
| `OAUTH_REDIRECT_BASE` | База URL для redirect_uri OAuth (по умолчанию `FRONTEND_URL`) | нет |
| `OAUTH_<PROVIDER>_CLIENT_ID` | Client ID OAuth-приложения (Яндекс/Google/VK) | нет |
| `OAUTH_<PROVIDER>_CLIENT_SECRET` | Client Secret OAuth-приложения | нет |
| `OAUTH_<PROVIDER>_REDIRECT_URI` | Полный redirect_uri для конкретного провайдера (иначе `${FRONTEND_URL}/api/auth/oauth/<provider>/callback`) | нет |

Если `MAIL_WEBHOOK_URL` не задан, код входа пишется в лог и возвращается в ответе как `debugCode` (режим разработки).

IAM-токен из metadata-сервиса кэшируется на время жизни токена (минус 60 секунд запаса), поэтому дополнительные HTTP-запросы к metadata делаются не чаще раза в час.

## Создание таблиц в YDB

Таблицы создаются через **Document API** (DynamoDB-совместимый HTTP). Готовый скрипт — `scripts/create-tables.sh`. Требуется установленный AWS CLI и статический access key сервисного аккаунта:

```bash
aws configure
# AWS Access Key ID:     <key_id>
# AWS Secret Access Key: <secret>
# Default region name:   ru-central1
# Default output format: json

./scripts/create-tables.sh
```

Скрипт использует endpoint из переменной `ENDPOINT` внутри файла. Если база другая — отредактируйте endpoint перед запуском. Таблицы создаются в режиме `PAY_PER_REQUEST` (serverless, оплата по факту).

## Эндпоинты

Все ответы — JSON. Для авторизованных маршрутов нужен заголовок `Authorization: Bearer <token>`.

### Health

`GET /health` → `200 { ok: true }`

### Auth (passwordless)

`POST /auth/code`
```json
{ "email": "user@example.com" }
```
Ответ: `200 { ok: true, debugCode?: "123456" }` (в dev-режиме). Код живёт 10 минут, повторная отправка — не чаще раза в минуту (429), максимум 5 попыток ввода.

`POST /auth/verify`
```json
{ "email": "user@example.com", "code": "123456" }
```
Ответ: `200 { token, user, watched: { items } }`. Сессия живёт 90 дней.

`GET /auth/oauth/:provider/authorize` — перенаправляет пользователя на страницу согласия провайдера (Яндекс/Google/VK). Без настроенного приложения возвращает `501 not_configured`.

`GET /auth/oauth/:provider/callback?code=...&format=json` — обменивает авторизационный код на токен сессии, создаёт/находит пользователя и либо редиректит на `FRONTEND_URL/?auth=<token>`, либо возвращает JSON `{ token, user, watched }` при `format=json`.

`POST /auth/oauth/:provider` — обратная совместимость: эквивалент authorize-редиректа.

`POST /auth/logout` — завершает текущую сессию (по Bearer-токену).

### Me

`GET /me` → `200 { user, watched: { items } }`

### Синхронизация «Просмотрено»

`GET /me/watched` → `200 { items: { [mediaId]: { watched, updatedAt } } }`

`POST /me/watched/merge`
```json
{
  "items": {
    "movie-1": { "watched": true, "updatedAt": "2025-01-01T00:00:00.000Z" }
  }
}
```
Стратегия — last-write-wins по `updatedAt` для каждого `mediaId`. Ответ — `200 { items }` (актуальное состояние после слияния).

## Схема таблиц YDB

Префикс таблиц — `marvel_` (настраивается через `YDB_TABLE_PREFIX`). Каждая запись хранится как JSON-документ в атрибуте `data` с ключом-идентификатором.

| Таблица | Ключ | Значение (`data`) |
| --- | --- | --- |
| `users` | `id` | полный профиль пользователя |
| `users_by_email` | `email` | `{ userId }` (индекс) |
| `users_by_provider` | `providerId` (`provider:providerId`) | `{ userId }` (индекс) |
| `sessions` | `token` | сессия (userId, expiresAt) |
| `codes` | `email` | одноразовый код (codeHash, expiresAt, attempts) |
| `watched` | `userId` | `{ items, updatedAt }` |

## Структура кода

- `index.js` — точка входа Cloud Function (маршрутизация);
- `src/utils.js` — JSON/CORS-ответы, хэширование, генерация токенов и кодов;
- `src/mailer.js` — отправка кода через webhook или лог (dev);
- `src/store.js` — `MemoryStore` и `YdbStore` (общий интерфейс);
- `src/auth.js` — passwordless-аутентификация, сессии, OAuth-каркас;
- `src/watched.js` — синхронизация отметок «Просмотрено» (last-write-wins).