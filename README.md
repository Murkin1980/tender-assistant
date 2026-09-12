# Тендерный помощник ИП

B2B веб-инструмент для агрегации, парсинга и анализа тендерных данных (goszakup + Самрук-Казына) за прошлые годы с использованием RAG-поиска и ИИ-ассистента.

## Технологический стек

- **Backend:** Node.js 22 + TypeScript + NestJS
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

- Node.js 22 или новее
- pnpm 12.4.1. Если pnpm не установлен глобально, включите Corepack:

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

   `NEXT_PUBLIC_API_BASE_URL=/api` оставляет запросы frontend same-origin. Next.js проксирует `/api/*` к адресу из `BACKEND_INTERNAL_URL`; браузер не обращается к localhost другого сервиса напрямую.

3. Запустите backend и frontend одновременно:

   ```bash
   pnpm dev
   ```

4. Откройте <http://localhost:3001>. Страница должна показать `Backend is available`.

   Проверить API отдельно можно так:

   ```bash
   curl -i http://localhost:3000/api/v1/health
   ```

   Ожидаемый ответ содержит поля `status`, `service` и `timestamp`, например:

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

Или запускать команды из конкретного workspace согласно его `package.json`. Для Docker-конфигурации:

```bash
docker compose config
```

## Конфигурация

- `backend/.env.example` — `NODE_ENV`, порт API и явно заданный список CORS origins.
- `frontend/.env.example` — публичный путь API и внутренний URL backend для server-side rewrite.
- Реальные `.env` и `.env.local` не должны коммититься. Секретов в текущей конфигурации нет.

## Scope bootstrap-окружения

Текущий increment намеренно не содержит авторизацию, пользователей и организации, базу данных, очереди, object storage, обработку документов, OCR, RAG, LLM SDK и облачную инфраструктуру.
