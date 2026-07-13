# Техническая спецификация: Веб-инструмент «Тендерный помощник ИП»

## 1. Цель

Создать B2B веб‑инструмент, который:
- агрегирует данные тендеров (goszakup + Самрук‑Казына) за прошлые годы;
- нормализует их в PostgreSQL;
- парсит тендерные документы (ТЗ, спецификации, протоколы);
- индексирует текст в векторном хранилище (RAG‑слой);
- предоставляет веб‑интерфейс и API для поиска, анализа и ИИ‑ассистента.

## 2. Технологический стек

### Backend
- Node.js + TypeScript.
- NestJS (предпочтительно) или Express + modular architecture.
- PostgreSQL (Cloud SQL for PostgreSQL).
- pgvector (расширение PostgreSQL для векторного поиска) или отдельный векторный движок (Qdrant) на следующем этапе.
- ETL/скрейпинг: Node.js (TypeScript) или отдельный Python‑сервис.

### Frontend
- React + Next.js.
- Любая UI‑библиотека (MUI/Chakra/Tailwind) — по выбору.

### Инфраструктура (GCP)
- Compute Engine: `n4-standard-4` или `n4-standard-8` (4–8 vCPU, 16–32 GB RAM), 200–300 GB SSD.
- Cloud SQL for PostgreSQL: 2 vCPU, 8 GB RAM, 100–200 GB SSD.
- Cloud Storage: bucket для оригинальных тендерных документов.

## 3. Структура репозитория

```text
tender-assistant/
  backend/
    src/
      modules/
        ingestion/
        tender/
        documents/
        rag/
        users/
      common/
      config/
    test/
  frontend/
    src/
      pages/
      components/
      hooks/
      lib/
  infra/
    terraform/
    k8s/
  docs/
    architecture.md
    api-spec.md
    ingestion-spec.md
```

Принципы:
- Чёткое разделение модулей.
- Явные импорты, минимум «магии».
- Все сущности и DTO описаны через TypeScript интерфейсы.

## 4. Модуль ingestion (загрузка данных тендеров)

### Источники
- Goszakup:
  - веб‑портал: реестр лотов, объявлений, отчёты.
  - API/унифицированные сервисы (OWS v2/v3): REST + GraphQL, тип `Lots`, отчёты по актам/закупкам.
- Самрук‑Казына:
  - EPIS 2.0 портал (zakup.sk.kz): тендерные объявления, документация.
  - на старте — скрейпинг/ручные выгрузки или API сторонних агрегаторов.

### Конфиг источников

`backend/src/modules/ingestion/ingestion.config.ts`:

```ts
export interface IngestionSourceConfig {
  id: string;              // 'goszakup' | 'samruk'
  type: 'goszakup' | 'samruk';
  baseUrl: string;
  authToken?: string;
  enabled: boolean;
}

export const SOURCES: IngestionSourceConfig[] = [
  {
    id: 'goszakup',
    type: 'goszakup',
    baseUrl: 'https://ows.goszakup.gov.kz',
    enabled: true,
  },
  {
    id: 'samruk',
    type: 'samruk',
    baseUrl: 'https://zakup.sk.kz',
    enabled: false,
  },
];
```

### Сервис ingestion

`backend/src/modules/ingestion/ingestion.service.ts`:

```ts
export class IngestionService {
  constructor(
    private readonly lotImporter: LotImporter,
    private readonly documentDownloader: DocumentDownloader,
  ) {}

  /**
   * Запускает полный импорт лотов и документов для указанного источника и года.
   */
  async runFullImport(sourceId: string, year: number): Promise<void> {
    const lots = await this.lotImporter.fetchLots(sourceId, year);
    await this.lotImporter.saveLots(lots);
    await this.documentDownloader.downloadForLots(lots);
  }
}
```

### Интерфейс LotImporter

```ts
export interface LotImporter {
  fetchLots(sourceId: string, year: number): Promise<LotRaw[]>;
  saveLots(lots: LotRaw[]): Promise<void>;
}
```

### Интерфейс DocumentDownloader

```ts
export interface DocumentDownloader {
  downloadForLots(lots: LotRaw[]): Promise<void>;
}
```

Задача кодера: реализовать конкретные импортеры для goszakup (GraphQL/REST) и Самрук‑Казына.

## 5. Модуль tender (реляционные сущности)

### Сущности (TypeScript)

`backend/src/modules/tender/tender.entities.ts`:

```ts
export interface Source {
  id: number;
  code: 'goszakup' | 'samruk' | 'other';
  name: string;
  baseUrl: string;
}

export interface Lot {
  id: number;
  sourceId: number;
  externalId: string;
  number: string;
  status: 'PUBLISHED' | 'COMPLETED' | 'CANCELLED' | 'OTHER';
  procedureType: 'OPEN_TENDER' | 'REQUEST_FOR_QUOTATIONS' | 'DIRECT_CONTRACT' | 'OTHER';
  customerName: string;
  customerBin: string;
  publishedAt: Date;
  bidDeadline: Date | null;
  planAmount: number | null;
  finalAmount: number | null;
  categoryCode: string | null;
}

export interface Contract {
  id: number;
  lotId: number;
  contractNumber: string;
  signDate: Date;
  supplierName: string;
  supplierBin: string;
  amount: number;
  status: string;
}

export interface Document {
  id: number;
  lotId?: number;
  contractId?: number;
  sourceId: number;
  type: 'TERMS' | 'SPECIFICATION' | 'PROTOCOL' | 'COMPLAINT' | 'OTHER';
  filePath: string;   // gs://bucket/path
  mimeType: string;
  sizeBytes: number;
}

export interface Complaint {
  id: number;
  lotId: number;
  filePath: string;
  status: 'CONSIDERED' | 'UPHELD' | 'REJECTED' | 'OTHER';
  reason: string;
}
```

Кодеру: реализовать ORM‑слой (TypeORM/Prisma/Knex) и миграции под эти сущности.

## 6. Модуль documents (парсинг)

### Интерфейсы

`backend/src/modules/documents/documents.types.ts`:

```ts
export type ParsedSectionType =
  | 'SUBJECT'
  | 'TECH_REQUIREMENTS'
  | 'QUALIFICATION'
  | 'DELIVERY_PAYMENT'
  | 'OTHER';

export interface ParsedSection {
  documentId: number;
  type: ParsedSectionType;
  text: string;
}

export interface ParsedDocument {
  documentId: number;
  rawText: string;
  sections: ParsedSection[];
}
```

### Сервис парсинга

```ts
export class DocumentParsingService {
  /**
   * Загружает файл из Cloud Storage, извлекает текст и разбивает его на секции.
   */
  async parseDocument(document: Document): Promise<ParsedDocument> {
    const rawText = await this.loadAndExtractText(document.filePath);
    const sections = this.splitIntoSections(rawText);
    return { documentId: document.id, rawText, sections };
  }

  private async loadAndExtractText(filePath: string): Promise<string> {
    // TODO: интеграция с Cloud Storage + pdf/doc/xls парсеры
    return '';
  }

  private splitIntoSections(rawText: string): ParsedSection[] {
    // TODO: базовая эвристика по заголовкам и ключевым словам
    return [];
  }
}
```

Задача кодера: реализовать загрузку из Cloud Storage и парсер для PDF/DOC/XLS (можно вынести в отдельный Python‑сервис).

## 7. Модуль RAG (векторный индекс)

### Сущности

`backend/src/modules/rag/rag.entities.ts`:

```ts
export interface TextChunk {
  id: number;
  documentId: number;
  sectionType: ParsedSectionType;
  chunkIndex: number;
  text: string;
  // embedding хранится либо в отдельной таблице, либо в колонке vector
  year?: number;
  customerBin?: string;
  sourceCode?: string;
  categoryCode?: string;
  hasComplaints?: boolean;
  procurementMethod?: string;
}

export interface RagSearchQuery {
  query: string;
  filters?: {
    year?: number;
    customerBin?: string;
    sourceCode?: string;
    categoryCode?: string;
    hasComplaints?: boolean;
    procurementMethod?: string;
  };
  limit?: number;
}

export interface RagSearchResult {
  chunkId: number;
  text: string;
  score: number;
  metadata: {
    lotId?: number;
    contractId?: number;
    sectionType: ParsedSectionType;
    year?: number;
    customerName?: string;
    sourceCode?: string;
  };
}
```

### Сервис RAG

`backend/src/modules/rag/rag.service.ts`:

```ts
export class RagService {
  constructor(private readonly embeddingClient: EmbeddingClient) {}

  /**
   * Выполняет поиск по RAG‑индексу с учётом фильтров.
   */
  async search(query: RagSearchQuery): Promise<RagSearchResult[]> {
    const queryEmbedding = await this.embeddingClient.embed(query.query);
    // TODO: vector search в pgvector/Qdrant + применение фильтров
    return [];
  }
}
```

### Интерфейс EmbeddingClient

```ts
export interface EmbeddingClient {
  embed(text: string): Promise<number[]>;
}
```

Кодеру: реализовать EmbeddingClient через локальную модель или внешний API.

## 8. Модуль LLM‑ответов

`backend/src/modules/llm/llm.service.ts`:

```ts
export interface LlmAnswer {
  answerText: string;
  usedChunks: RagSearchResult[];
}

export class LlmService {
  constructor(private readonly ragService: RagService) {}

  /**
   * Формирует ответ по вопросу пользователя, используя RAG‑контекст.
   */
  async answerQuestion(query: string, filters?: RagSearchQuery['filters']): Promise<LlmAnswer> {
    const chunks = await this.ragService.search({ query, filters, limit: 8 });
    const prompt = this.buildPrompt(query, chunks);
    const llmResponse = await this.callExternalLlm(prompt);

    return {
      answerText: llmResponse,
      usedChunks: chunks,
    };
  }

  private buildPrompt(query: string, chunks: RagSearchResult[]): string {
    // TODO: собрать промпт из вопроса и текстов чанков
    return '';
  }

  private async callExternalLlm(prompt: string): Promise<string> {
    // TODO: вызов OpenAI/Qwen/DeepSeek API
    return '';
  }
}
```

Codex‑задача: дописать реализацию построения промпта и вызов конкретного LLM‑API.

## 9. REST API (backend)

Пример контроллеров NestJS:

```ts
// backend/src/modules/tender/tender.controller.ts

@Controller('lots')
export class TenderController {
  constructor(private readonly tenderService: TenderService) {}

  @Get()
  async listLots(@Query() query: ListLotsDto): Promise<Lot[]> {
    return this.tenderService.listLots(query);
  }

  @Get(':id')
  async getLot(@Param('id') id: string): Promise<LotDetailDto> {
    return this.tenderService.getLotById(Number(id));
  }
}
```

```ts
// backend/src/modules/rag/rag.controller.ts

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Get('search')
  async search(@Query() query: RagSearchQueryDto): Promise<RagSearchResult[]> {
    return this.ragService.search({
      query: query.query,
      filters: query.filters,
      limit: query.limit,
    });
  }
}
```

## 10. Frontend (Next.js)

### Основные страницы

- `/` — дашборд по статистике тендеров.
- `/lots` — список лотов с фильтрами.
- `/lots/[id]` — подробная карточка тендера.
- `/search` — страница RAG‑поиска и ИИ‑ответов.

Пример страницы поиска:

```tsx
// frontend/src/pages/search.tsx

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RagSearchResult[]>([]);
  const [answer, setAnswer] = useState<string>('');

  const handleSearch = async () => {
    const res = await fetch(`/api/rag/search?query=${encodeURIComponent(query)}`);
    const data: RagSearchResult[] = await res.json();
    setResults(data);
    // TODO: вызвать backend /llm/answer для получения ответа
  };

  return (
    <div>
      <h1>Поиск по тендерам</h1>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <button onClick={handleSearch}>Искать</button>
      <div>
        <h2>Ответ ИИ</h2>
        <p>{answer}</p>
      </div>
      <div>
        <h2>Результаты</h2>
        {results.map(r => (
          <div key={r.chunkId}>
            <pre>{r.text}</pre>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchPage;
```

## 11. Требования к стилю кода

- Небольшие функции, явные интерфейсы.
- Использование TypeScript типов и интерфейсов для всех сущностей.
- Комментарии/докстринги на ключевых сервисах и контроллерах.
- Разделение ответственности: ingestion, tender, documents, rag, llm.

## 12. Этапы реализации

1. Поднять инфраструктуру (VM, Cloud SQL, Storage), настроить подключение.
2. Реализовать ingestion‑модуль для goszakup (лоты + базовые документы).
3. Реализовать реляционные сущности и миграции (PostgreSQL).
4. Реализовать парсинг документов и запись ParsedDocument/ParsedSection.
5. Реализовать RAG‑индекс (TextChunk + embeddings).
6. Реализовать REST API для лотов, контрактов и RAG‑поиска.
7. Собрать базовый frontend (список лотов, карточка, поиск).
8. Добавить LLM‑слой (внешний API) для ответов ассистента.
