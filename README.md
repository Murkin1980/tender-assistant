# Тендерный помощник ИП

B2B веб-инструмент для агрегации, парсинга и анализа тендерных данных (goszakup + Самрук-Казына) за прошлые годы с использованием RAG-поиска и ИИ-ассистента.

## Технологический стек

- **Backend:** Node.js + TypeScript + NestJS + PostgreSQL (pgvector)
- **Frontend:** React + Next.js
- **Инфраструктура:** Google Cloud Platform (Compute Engine, Cloud SQL, Cloud Storage, Secret Manager)

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
