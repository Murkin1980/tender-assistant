# Тендерный помощник ИП

B2B веб-инструмент для агрегации, парсинга и анализа тендерных данных (goszakup + Самрук-Казына) за прошлые годы с использованием RAG-поиска и ИИ-ассистента.

## Технологический стек

- **Backend:** Node.js 22.22.3 + TypeScript + NestJS
- **Frontend:** React 19 + Next.js 16
- **Package manager:** pnpm 12
- **Дальнейшие этапы:** PostgreSQL/pgvector, объектное хранилище и фоновые задачи будут добавлены отдельными задачами.

## Структура репозитория

```text
tender-assistant/
  backend/          # Серверная часть (NestJS API)
  frontend/         # Клиентская часть (Next.js)
  infra/            # Инфраструктурные скрипты и конфигурации
  docs/             # Документация и спецификации
```

## Документы проекта

- [Техническая спецификация](tender-assistant-spec.md)
- [Инструкция по настройке инфраструктуры GCP](gcp-server-setup.md)

## Local development

### Требования

- Node.js `22.22.3`. Версия зафиксирована в `.nvmrc` и совпадает с Docker base image:

  ```bash
  nvm install
  nvm use
  ```

  Если `nvm` не используется, установите Node.js `22.22.3` другим способом.
- pnpm `12.4.1`. Если pnpm не установлен глобально, включите Corepack:

  ```bash
  corepack enable
  corepack prepare pnpm@12.4.1 --activate
  ```

- Docker Engine с Docker Compose v2 — только для контейнерного сценария

### Запуск приложений напрямую

1. Установите зависимости из корня репозитория:

   ```bash
   pnpm install
   ```

2. Создайте локальные файлы конфигурации:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```

   `BACKEND_INTERNAL_URL` используется только server-side Route Handler Next.js. Браузер всегда обращается к same-origin endpoint `/api/v1/health`; внутренний URL backend не попадает в клиентский JavaScript.

3. Запустите backend и frontend одновременно:

   ```bash
   pnpm dev
   ```

4. Откройте <http://localhost:3001>. Страница должна показать `Сервер доступен`.

   Проверить backend напрямую можно так:

   ```bash
   curl --fail -i http://localhost:3000/api/v1/health
   ```

   Проверить frontend Route Handler и его proxy к backend можно так:

   ```bash
   curl --fail -i http://localhost:3001/api/v1/health
   ```

   Ожидаемый успешный ответ содержит поля `status`, `service` и `timestamp`, например:

   ```json
   {
     "status": "ok",
     "service": "tender-assistant-backend",
     "timestamp": "2026-01-01T00:00:00.000Z"
   }
   ```

### Запуск через Docker Compose

Docker Compose не требует локальных `.env`-файлов: безопасные development-значения заданы в compose-файле.

```bash
docker compose up --build
```

После успешного запуска:

- frontend: <http://localhost:3001>
- backend health: <http://localhost:3000/api/v1/health>
- frontend health proxy: <http://localhost:3001/api/v1/health>

Остановить контейнеры:

```bash
docker compose down
```

Hot reload настроен только для запуска напрямую через `pnpm dev`. Docker Compose собирает production-like образы без bind mounts; после изменения исходников повторите `docker compose up --build`.

### Проверки

Из корня можно выполнить основные проверки:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Для конфигурации CORS используйте точный production allowlist, например:

```bash
CORS_ORIGIN=https://app.example.com,https://admin.example.com
```

Не используйте wildcard `*` для production.

## Конфигурация

- `backend/.env.example` — `NODE_ENV`, порт API и явно заданный список CORS origins.
- `frontend/.env.example` — `BACKEND_INTERNAL_URL`, доступный только server-side Route Handler.
- Реальные `.env` и `.env.local` не должны коммититься. Секретов в текущей конфигурации нет.

## Ограничение проверки Docker

В текущей среде Docker Engine отсутствует, поэтому сборка Dockerfile и запуск Compose не подтверждены. Перед созданием CI quality-gates PR необходимо выполнить на машине или runner с Docker Engine:

```bash
docker compose config
docker compose build
docker compose up -d
curl --fail http://localhost:3000/api/v1/health
curl --fail http://localhost:3001/api/v1/health
docker compose down -v
```

Ожидаемый результат второго `curl` — health JSON, возвращённый frontend Route Handler после обращения к backend.

## Scope bootstrap-окружения

Текущий increment намеренно не содержит авторизацию, пользователей и организации, базу данных, очереди, object storage, обработку документов, OCR, RAG, LLM SDK и облачную инфраструктуру.
