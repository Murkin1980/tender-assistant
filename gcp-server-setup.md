# Инструкция по созданию инфраструктуры Google Cloud для проекта «Тендерный помощник ИП»

## 1. Подготовка аккаунта и проекта

1. Зарегистрируйтесь в Google Cloud и активируйте стартовый кредит (≈ 300 USD).
2. В консоли Google Cloud создайте новый проект, например:
   - **Project ID:** `tender-assistant`
   - **Project name:** `Tender Assistant IP`
3. Привяжите платежный аккаунт к проекту (Billing), убедитесь, что кредит активен именно на этом проекте.

## 2. Включение необходимых API

В разделе **APIs & Services → Library** включите минимум следующие API:

- **Compute Engine API** — для VM.
- **Cloud SQL Admin API** — для управляемой БД PostgreSQL.
- **Cloud Storage API** — для хранения документов.
- (Опционально) **Secret Manager API** — для хранения ключей внешних LLM и токенов.

## 3. Настройка сервисных аккаунтов и ролей

1. Зайдите в **IAM & Admin → Service Accounts**.
2. Создайте сервисный аккаунт, например:
   - Name: `backend-sa`
   - ID: `backend-sa`
3. Назначьте ему роли:
   - `Compute Instance Admin` (минимально необходимый доступ к VM, можно ограничить до `Compute Viewer` если будете создавать VM руками).
   - `Cloud SQL Client` — для доступа к базе.
   - `Storage Object Viewer` и `Storage Object Creator` — для чтения/записи файлов в Cloud Storage.
4. Сохраните email сервисного аккаунта — он понадобится при привязке к VM и Cloud SQL.

## 4. Создание VM (Compute Engine) под backend и ETL

### 4.1. Параметры машины

1. Перейдите в **Compute Engine → VM instances → Create instance**.
2. Задайте параметры:
   - **Name:** `backend-vm`
   - **Region/Zone:** выберите ближайший к вам регион (например, `europe-west1-b`), учитывая будущие цены.
   - **Machine family:** `General-purpose`.
   - **Series:** `N4`.
   - **Machine type:**
     - на старте: `n4-standard-4` (4 vCPU, 16 GB RAM);
     - при росте нагрузки можно поднять до `n4-standard-8`.
3. **Boot disk:**
   - Image: Ubuntu LTS (например, Ubuntu 22.04 LTS).
   - Disk type: Balanced SSD.
   - Size: 200–300 GB.
4. **Identity and API access:**
   - Service account: выберите `backend-sa`.
   - Access scopes: `Allow full access to all Cloud APIs` либо «По умолчанию», если используете IAM‑ролями.
5. **Firewall:**
   - Отметьте `Allow HTTP traffic` и `Allow HTTPS traffic`, если будете сразу поднимать HTTP‑сервер.

### 4.2. Подключение к VM

1. После создания VM нажмите кнопку **SSH** в консоли, чтобы открыть терминал.
2. Установите базовый софт:

```bash
sudo apt update
sudo apt install -y git build-essential
# Установка Node.js (через nvm или из репозитория)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Установка PostgreSQL клиента (psql)
sudo apt install -y postgresql-client
```

3. Склонируйте репозиторий проекта (`tender-assistant`), настройте `.env` для подключения к Cloud SQL и Cloud Storage.

## 5. Создание Cloud SQL для PostgreSQL

### 5.1. Инстанс базы

1. Перейдите в **Cloud SQL → Create instance → PostgreSQL**.
2. Параметры:
   - **Instance ID:** `tender-assistant-db`
   - **Region:** желательно тот же, что у VM, или соседний.
   - **Edition:** General purpose (не shared core).
   - **Machine type:** 2 vCPU, 8 GB RAM.
   - **Storage:** SSD, 100–200 GB.
3. Задайте **root‑пароль** (сохраните в Secret Manager или локальном менеджере паролей).

### 5.2. Сетевой доступ

1. В настройках инстанса Cloud SQL:
   - В разделе **Connections → Networking** включите **Private IP** и привяжите к той же VPC, где живёт VM.
   - При необходимости включите **Public IP** и добавьте IP‑адрес своего ноутбука в список авторизованных (для прямого доступа через psql/GUI).
2. В разделе **Connections → Service accounts** убедитесь, что `backend-sa` имеет роль `Cloud SQL Client`.

### 5.3. Инициализация схемы

1. Подключитесь к базе с VM:

```bash
psql "host=<DB_HOST> user=postgres dbname=postgres password=<PASSWORD>"
```

2. Создайте отдельную базу, пользователя для приложения и примените миграции (через ORM/скрипты).

## 6. Создание Cloud Storage bucket

1. Перейдите в **Cloud Storage → Buckets → Create**.
2. Параметры:
   - **Name:** `tender-assistant-docs` (должно быть глобально уникальным).
   - **Location type:** Region, тот же регион, что VM/Cloud SQL.
   - **Storage class:** Standard.
3. Настройте права доступа:
   - Добавьте сервисный аккаунт `backend-sa` в `Storage Object Creator` и `Storage Object Viewer`.

Bucket будет использоваться для хранения оригинальных тендерных документов (PDF/DOC/XLS) и возможно промежуточных файлов.

## 7. Настройка переменных окружения и Secret Manager

1. В **Secret Manager** создайте секреты:
   - `DB_PASSWORD` — пароль PostgreSQL.
   - `LLM_API_KEY` — ключ OpenAI/Qwen/DeepSeek и т.п.

2. На VM настройте переменные окружения (`/etc/environment` или через systemd‑units), либо используйте библиотеку, которая читает секреты из Secret Manager.

Пример `.env` для backend:

```env
DB_HOST=<Cloud SQL private IP or instance connection name>
DB_PORT=5432
DB_USER=<app user>
DB_PASSWORD=<from Secret Manager>
DB_NAME=tender_assistant

GCS_BUCKET=tender-assistant-docs
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

LLM_API_KEY=<from Secret Manager>
```

## 8. Базовая деплой‑схема backend

1. На VM:
   - Склонировать репозиторий.
   - Собрать backend:

```bash
cd tender-assistant/backend
npm install
npm run build
```

2. Запустить сервер (NestJS/Express) через `pm2` или systemd.

Пример systemd‑unit:

```ini
[Unit]
Description=Tender Assistant Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/tender-assistant/backend
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
EnvironmentFile=/home/ubuntu/tender-assistant/backend/.env

[Install]
WantedBy=multi-user.target
```

3. Включить юнит:

```bash
sudo systemctl enable tender-backend
sudo systemctl start tender-backend
```

## 9. Настройка фронтенда (Next.js)

1. На той же VM или отдельной (если нужно разделить нагрузки) разверните frontend:

```bash
cd tender-assistant/frontend
npm install
npm run build
npm run start
```

2. Настройте reverse proxy (например, nginx) для выдачи фронта и проксирования API.

Пример nginx конфигурации (схематично):

```nginx
server {
  listen 80;
  server_name <your-domain>;

  location /api/ {
    proxy_pass http://localhost:3001/; # backend
  }

  location / {
    proxy_pass http://localhost:3000/; # frontend
  }
}
```

## 10. Режим экономии кредита

- Останавливайте VM вне активной работы (ночью/выходные), чтобы не расходовать кредит на CPU.
- Следите за потреблением ресурсов через **Billing → Reports** и **Monitoring**, корректируйте размеры инстансов при необходимости.
- На старте избегайте GPU‑инстансов, все эмбеддинги и базовую аналитику делайте на CPU или через дешёвые внешние API.

## 11. Checklist для кодера/девопса

- [ ] Создан проект GCP и включены нужные API.
- [ ] Создан сервисный аккаунт `backend-sa` с ролями.
- [ ] Развернута VM `backend-vm` (N4, 4–8 vCPU, 16–32 GB RAM, 200–300 GB SSD).
- [ ] Развернут Cloud SQL PostgreSQL (2 vCPU, 8 GB RAM, 100–200 GB SSD), настроен приватный доступ.
- [ ] Создан Cloud Storage bucket `tender-assistant-docs`.
- [ ] Настроены переменные окружения и секреты.
- [ ] Backend и frontend задеплоены и доступны по HTTP/HTTPS.
