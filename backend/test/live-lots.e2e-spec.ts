import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/app';
import { DEFAULT_LIVE_LOTS_LIMIT } from '../src/modules/tender/goszakup/goszakup.config';
import { buildTextNativePdfBytes } from '../src/modules/tender/lot-requirements';
import { LOT_FIXTURES } from '../src/modules/tender/lots.fixtures';
import {
  GOSZAKUP_LOTS_QUERY,
  GOSZAKUP_LOT_DETAIL_QUERY,
  type GoszakupLotDto,
} from '../src/modules/tender/goszakup/goszakup-lots.query';
import { FULL_LOT, MINIMAL_LOT, PAST_DEADLINE_LOT } from './fixtures/goszakup-lots.fixture';

/**
 * CP-09 needs a known instant to compare deadlines against, so this file fixes the clock to
 * `2026-10-01T00:00:00.000Z`. Only `Date` is faked: every timer stays real, and the registry
 * records keep their realistic dates instead of being anchored to the current date.
 */
const FIXED_NOW = new Date('2026-10-01T00:00:00.000Z');

/** Everything except the clock is left alone, so no API behavior depends on the fake. */
const REAL_TIMER_APIS = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

beforeAll(() => {
  jest.useFakeTimers({ now: FIXED_NOW, doNotFake: [...REAL_TIMER_APIS] });
});
afterAll(() => {
  jest.useRealTimers();
});

/**
 * CP-05 guards for the user path of the live source (`TENDER_LOT_SOURCE=goszakup`):
 * the existing lot contract is served from the official OWS v3 registry with bounded reads,
 * the detail lookup is a documented filtered lookup, and an unavailable or tokenless registry
 * fails safely instead of falling back to fixtures.
 *
 * The registry transport is faked — no test here needs a token or network access.
 */
const TOKEN = 'live-e2e-token-must-not-leak';
const UPSTREAM_URL = 'https://ows.goszakup.gov.kz/v3/graphql';

interface UpstreamRequest {
  url: string;
  method: string;
  authorization: string | null;
  query: string;
  variables: {
    filter: { id?: number[]; nameDescriptionRu?: string } | null;
    limit: number;
  };
}

interface DocumentRequest {
  url: string;
  method: string;
  authorization: string | null;
}

let upstreamRequests: UpstreamRequest[] = [];
let documentRequests: DocumentRequest[] = [];

const LIVE_DOC_BYTES: Readonly<Record<string, Uint8Array>> = {
  'https://goszakup.gov.kz/files/download_file/500001/tech-spec.pdf': buildTextNativePdfBytes([
    [
      '1. Предмет закупки',
      'Наименование товара: Столы письменные из ЛДСП',
      'Количество: 6 штук',
      'Габаритные размеры: 1200х600х750 мм',
      'Материал изготовления: ЛДСП 16 мм класса Е1, кромка ПВХ 2 мм',
    ],
  ]),
  'https://goszakup.gov.kz/files/download_file/500002/contract-draft.pdf': buildTextNativePdfBytes([
    [
      '1. Условия поставки',
      'Место и срок поставки: г. Алматы, доставка и сборка в течение 15 календарных дней',
      'Подтверждающие документы: сертификат соответствия ЕАЭС при поставке',
    ],
  ]),
};

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  GOSZAKUP_TOKEN: process.env.GOSZAKUP_TOKEN,
  TENDER_LOT_SOURCE: process.env.TENDER_LOT_SOURCE,
};

function restoreEnvironment(): void {
  globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Official `Query.Lots` answer for the request the backend actually sent. */
function registryLots(variables: UpstreamRequest['variables']): unknown {
  const ids = variables.filter?.id;
  // The bounded list read answers with the page; a bounded id lookup answers with its record.
  const records: GoszakupLotDto[] = [FULL_LOT, MINIMAL_LOT, PAST_DEADLINE_LOT];
  const page = ids
    ? records.filter((lot) => ids.includes(lot.id as number))
    : [FULL_LOT, MINIMAL_LOT];
  return { data: { Lots: page } };
}

/** Records every registry call and answers it like the documented read-only endpoint would. */
function stubRegistry(): void {
  upstreamRequests = [];
  documentRequests = [];
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const authorization = new Headers(init?.headers).get('authorization');
    if (url !== UPSTREAM_URL) {
      documentRequests.push({
        url,
        method: init?.method ?? 'GET',
        authorization,
      });
      const bytes = LIVE_DOC_BYTES[url];
      if (!bytes) return new Response('Not found', { status: 404 });
      return new Response(Buffer.from(bytes), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      });
    }
    const body = JSON.parse(String(init?.body ?? '{}')) as UpstreamRequest;
    upstreamRequests.push({
      url,
      method: init?.method ?? 'GET',
      authorization,
      query: body.query,
      variables: body.variables,
    });
    return jsonResponse(registryLots(body.variables));
  }) as unknown as typeof fetch;
}

const LIVE_LOT = {
  id: 'goszakup:900000001',
  source: 'goszakup',
  sourceUrl: 'https://goszakup.gov.kz/ru/view/lots/index/id/900000001',
  title: 'Столы из ЛДСП (пример)',
  customer: 'Учебный центр (пример)',
  amount: 420000,
  region: 'Алматы',
  district: null,
  bidDeadline: '2026-10-20T12:00:00.000Z',
  description: 'Шесть столов из ЛДСП с доставкой. БИН заказчика: 000740000001',
  procurement: {
    lotNumber: '1',
    announcementNumber: '0001-1',
    customerBin: '000740000001',
    publishedAt: '2026-09-20T08:00:00.000Z',
    procurementMethod: 'Запрос котировок (пример)',
    officialStatus: 'Приём заявок (пример)',
  },
  // The registry never supplies a district, so Alatau can only stay a preference for live lots.
  actionability: { status: 'TAKE' },
  assessment: {
    status: 'MATCH',
    reasons: [
      'Amount is within 500,000 KZT',
      'Region is Almaty',
      'LDSP signal found',
      'Furniture signal found',
    ],
  },
  // CP-09: derived from `TrdBuy.endDate` only — not from the official status of the record.
  timing: {
    status: 'OPEN_BY_DEADLINE',
    deadline: '2026-10-20T12:00:00.000Z',
    remainingMinutes: 28080,
  },
};

const LIVE_LOT_WITHOUT_OPTIONAL_FIELDS = {
  id: 'goszakup:900000002',
  source: 'goszakup',
  sourceUrl: 'https://goszakup.gov.kz/ru/view/lots/index/id/900000002',
  title: '',
  customer: '',
  amount: 500000,
  region: '',
  district: null,
  bidDeadline: '',
  description: '',
  procurement: {
    lotNumber: null,
    announcementNumber: null,
    customerBin: null,
    publishedAt: null,
    procurementMethod: null,
    officialStatus: null,
  },
  actionability: { status: 'REVIEW' },
  assessment: {
    status: 'REVIEW',
    reasons: ['Amount is within 500,000 KZT', 'Insufficient evidence for automatic match'],
  },
  // CP-09: the announcement carries no endDate, so the deadline state is unknown, not closed.
  timing: { status: 'DEADLINE_UNKNOWN', deadline: null, remainingMinutes: null },
};

describe('Live lots API with TENDER_LOT_SOURCE=goszakup', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.TENDER_LOT_SOURCE = 'goszakup';
    process.env.GOSZAKUP_TOKEN = TOKEN;
    stubRegistry();
    app = await createApp({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    restoreEnvironment();
  });

  beforeEach(() => {
    upstreamRequests = [];
    documentRequests = [];
  });

  it('lists normalized live lots from one bounded registry request', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/lots').expect(200);

    expect(response.body).toEqual([LIVE_LOT, LIVE_LOT_WITHOUT_OPTIONAL_FIELDS]);
    expect(upstreamRequests).toHaveLength(1);

    const [call] = upstreamRequests;
    expect(call?.url).toBe(UPSTREAM_URL);
    expect(call?.method).toBe('POST');
    expect(call?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(call?.variables.limit).toBe(DEFAULT_LIVE_LOTS_LIMIT);
    expect(call?.variables.filter).toBeNull();
    expect(call?.query).toContain('Lots(filter: $filter, limit: $limit)');
    // CP-08 metadata rides along in the same single bounded query — no N+1 enrichment.
    for (const field of [
      'lotNumber',
      'trdBuyNumberAnno',
      'publishDate',
      'RefTradeMethods',
      'RefBuyStatus',
    ]) {
      expect(call?.query).toContain(field);
    }

    // The registry token stays on the server.
    expect(response.text).not.toContain(TOKEN);
    expect(response.text).not.toContain('ows.goszakup.gov.kz');
  });

  it.each([
    [{ maxAmount: '450000' }, ['goszakup:900000001']],
    [{ region: ' Алматы ' }, ['goszakup:900000001']],
    [{ district: 'Алатауский' }, []],
    [{ q: 'столы' }, ['goszakup:900000001']],
    [{ q: 'несуществующий' }, []],
    [{ status: 'MATCH' }, ['goszakup:900000001']],
    [{ status: 'REVIEW' }, ['goszakup:900000002']],
    [{ status: 'EXCLUDE' }, []],
    [{ status: 'MATCH', maxAmount: '500000', region: 'Алматы' }, ['goszakup:900000001']],
    // CP-09: the deadline state is derived locally and never reaches the registry.
    [{ deadlineStatus: 'OPEN_BY_DEADLINE' }, ['goszakup:900000001']],
    [{ deadlineStatus: 'DEADLINE_UNKNOWN' }, ['goszakup:900000002']],
    [{ deadlineStatus: 'CLOSED_BY_DEADLINE' }, []],
    [{ actionStatus: 'TAKE' }, ['goszakup:900000001']],
    [{ actionStatus: 'REVIEW' }, ['goszakup:900000002']],
    [{ actionStatus: 'SKIP' }, []],
  ])('applies the existing filters %j to the live page', async (query, ids) => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/lots')
      .query(query)
      .expect(200);

    expect((response.body as Array<{ id: string }>).map((lot) => lot.id)).toEqual(ids);
    expect(upstreamRequests).toHaveLength(1);
    if ('q' in query) {
      expect(upstreamRequests[0]?.variables.filter).toEqual({ nameDescriptionRu: query.q });
    } else {
      expect(upstreamRequests[0]?.variables.filter).toBeNull();
    }
  });

  it('pushes the documented text filter, keeps amount and location local, and still post-filters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/lots')
      .query({ q: 'столы', maxAmount: '500000', region: 'Алматы' })
      .expect(200);

    expect((response.body as Array<{ id: string }>).map((lot) => lot.id)).toEqual([
      'goszakup:900000001',
    ]);
    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0]?.variables).toEqual({
      filter: { nameDescriptionRu: 'столы' },
      limit: DEFAULT_LIVE_LOTS_LIMIT,
    });
  });

  it('filters live lots by assessment status locally, without touching the registry semantics', async () => {
    const cases: ReadonlyArray<[string, string[]]> = [
      ['MATCH', ['goszakup:900000001']],
      ['REVIEW', ['goszakup:900000002']],
      ['EXCLUDE', []],
    ];

    for (const [status, ids] of cases) {
      upstreamRequests = [];
      const response = await request(app.getHttpServer())
        .get('/api/v1/lots')
        .query({ status })
        .expect(200);
      const lots = response.body as Array<{ id: string; assessment: { status: string } }>;

      expect(lots.map((lot) => lot.id)).toEqual(ids);
      expect(lots.every((lot) => lot.assessment.status === status)).toBe(true);
      // One bounded page read; the assessment status is local and never becomes a query filter.
      expect(upstreamRequests).toHaveLength(1);
      expect(upstreamRequests[0]?.variables).toEqual({
        filter: null,
        limit: DEFAULT_LIVE_LOTS_LIMIT,
      });
    }
  });

  it('derives the deadline state of live lots without pushing it to the registry', async () => {
    const cases: ReadonlyArray<[string, string[]]> = [
      ['OPEN_BY_DEADLINE', ['goszakup:900000001']],
      ['DEADLINE_UNKNOWN', ['goszakup:900000002']],
      ['CLOSED_BY_DEADLINE', []],
    ];

    for (const [deadlineStatus, ids] of cases) {
      upstreamRequests = [];
      const response = await request(app.getHttpServer())
        .get('/api/v1/lots')
        .query({ deadlineStatus })
        .expect(200);
      const lots = response.body as Array<{ id: string; timing: { status: string } }>;

      expect(lots.map((lot) => lot.id)).toEqual(ids);
      expect(lots.every((lot) => lot.timing.status === deadlineStatus)).toBe(true);
      // One bounded page read; the deadline filter is local and never becomes an upstream filter.
      expect(upstreamRequests).toHaveLength(1);
      expect(upstreamRequests[0]?.variables).toEqual({
        filter: null,
        limit: DEFAULT_LIVE_LOTS_LIMIT,
      });
    }
  });

  it('reports CLOSED_BY_DEADLINE for a live record whose endDate has passed', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/lots/goszakup:900000003')
      .expect(200);

    expect(response.body).toMatchObject({
      id: 'goszakup:900000003',
      bidDeadline: '2026-09-20T12:00:00.000Z',
      timing: {
        status: 'CLOSED_BY_DEADLINE',
        deadline: '2026-09-20T12:00:00.000Z',
        remainingMinutes: null,
      },
    });
    // Still one bounded lookup by id — the expired record is read exactly like any other.
    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0]?.variables).toEqual({ filter: { id: [900000003] }, limit: 1 });
  });

  it('opens a listed lot through /lots/:id with a documented bounded id lookup', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/lots').expect(200);
    expect(list.body[0]).toEqual(LIVE_LOT);
    // The list route never downloads documents or extracts requirements.
    expect(documentRequests).toHaveLength(0);

    const detail = await request(app.getHttpServer())
      .get('/api/v1/lots/goszakup:900000001')
      .expect(200);

    expect(detail.body).toEqual({
      ...LIVE_LOT,
      documents: [
        {
          id: '500001',
          name: 'Техническая спецификация',
          type: null,
          mimeType: 'application/pdf',
          sizeBytes: null,
          sourceUrl: 'https://goszakup.gov.kz/files/download_file/500001/tech-spec.pdf',
        },
        {
          id: '500002',
          name: 'Проект договора',
          type: null,
          mimeType: 'application/pdf',
          sizeBytes: null,
          sourceUrl: 'https://goszakup.gov.kz/files/download_file/500002/contract-draft.pdf',
        },
      ],
      requirements: {
        status: 'AVAILABLE',
        items: [
          {
            category: 'SUBJECT',
            text: 'Наименование товара: Столы письменные из ЛДСП',
            sourceDocumentId: '500001',
            sourceLocator: 'Стр. 1',
          },
          {
            category: 'QUANTITY',
            text: 'Количество: 6 штук',
            sourceDocumentId: '500001',
            sourceLocator: 'Стр. 1',
          },
          {
            category: 'DIMENSIONS',
            text: 'Габаритные размеры: 1200х600х750 мм',
            sourceDocumentId: '500001',
            sourceLocator: 'Стр. 1',
          },
          {
            category: 'MATERIAL',
            text: 'Материал изготовления: ЛДСП 16 мм класса Е1, кромка ПВХ 2 мм',
            sourceDocumentId: '500001',
            sourceLocator: 'Стр. 1',
          },
          {
            category: 'DELIVERY',
            text: 'Место и срок поставки: г. Алматы, доставка и сборка в течение 15 календарных дней',
            sourceDocumentId: '500002',
            sourceLocator: 'Стр. 1',
          },
          {
            category: 'SUPPORTING_DOCUMENT',
            text: 'Подтверждающие документы: сертификат соответствия ЕАЭС при поставке',
            sourceDocumentId: '500002',
            sourceLocator: 'Стр. 1',
          },
        ],
        warnings: [],
      },
    });
    // The list read one bounded page; the detail read one record by id — nothing else.
    expect(upstreamRequests).toHaveLength(2);
    expect(upstreamRequests[0]?.query).toBe(GOSZAKUP_LOTS_QUERY);
    expect(upstreamRequests[1]?.query).toBe(GOSZAKUP_LOT_DETAIL_QUERY);
    expect(upstreamRequests[1]?.variables).toEqual({ filter: { id: [900000001] }, limit: 1 });
    expect(documentRequests).toEqual([
      {
        url: 'https://goszakup.gov.kz/files/download_file/500001/tech-spec.pdf',
        method: 'GET',
        authorization: null,
      },
      {
        url: 'https://goszakup.gov.kz/files/download_file/500002/contract-draft.pdf',
        method: 'GET',
        authorization: null,
      },
    ]);
    expect(detail.text).not.toContain(TOKEN);
  });

  it('returns 404 when the registry genuinely has no such lot', async () => {
    await request(app.getHttpServer()).get('/api/v1/lots/goszakup:900000404').expect(404);

    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0]?.variables).toEqual({ filter: { id: [900000404] }, limit: 1 });
  });

  it.each([
    ['fixture-1'],
    ['900000001'],
    ['goszakup:'],
    ['goszakup:not-a-number'],
    ['goszakup:0'],
    ['goszakup:2147483648'],
  ])('returns 404 for the unusable id %s without calling the registry', async (id) => {
    await request(app.getHttpServer())
      .get(`/api/v1/lots/${encodeURIComponent(id)}`)
      .expect(404);

    expect(upstreamRequests).toHaveLength(0);
  });

  it('reports the live source without exposing the token or configuration internals', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/lots/source').expect(200);

    expect(response.body).toEqual({ mode: 'goszakup', live: true, label: 'Goszakup' });
    expect(response.text).not.toContain(TOKEN);
    expect(response.text).not.toContain('ows.goszakup.gov.kz');
    expect(response.text).not.toContain('TOKEN');
  });

  it('keeps the health endpoint working', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({ status: 'ok', service: 'tender-assistant-backend' });
  });
});

describe('Live lots API when the registry fails', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.TENDER_LOT_SOURCE = 'goszakup';
    process.env.GOSZAKUP_TOKEN = TOKEN;
    app = await createApp({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    restoreEnvironment();
  });

  const stubFailure = (response: Response | Error): void => {
    upstreamRequests = [];
    globalThis.fetch = jest.fn(async (...args: Parameters<typeof fetch>) => {
      const init = args[1] as RequestInit | undefined;
      const body = JSON.parse(String(init?.body ?? '{}')) as UpstreamRequest;
      upstreamRequests.push({
        url: String(args[0]),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
        query: body.query,
        variables: body.variables,
      });
      if (response instanceof Error) throw response;
      return response;
    }) as unknown as typeof fetch;
  };

  it.each([
    ['HTTP 401', jsonResponse({ message: 'Unauthorized' }, 401)],
    [
      'GraphQL errors on HTTP 200',
      jsonResponse({ errors: [{ message: `token ${TOKEN} revoked` }] }),
    ],
    ['a transport failure', new Error(`socket closed while sending ${TOKEN}`)],
  ])('answers %s with a safe 503 for the list and the detail', async (_case, failure) => {
    stubFailure(failure);

    for (const path of ['/api/v1/lots', '/api/v1/lots/goszakup:900000001']) {
      const response = await request(app.getHttpServer()).get(path).expect(503);

      expect(response.body).toEqual({
        statusCode: 503,
        message: 'Lot source is temporarily unavailable',
      });
      expect(response.text).not.toContain(TOKEN);
      expect(response.text).not.toContain('ows.goszakup.gov.kz');
      expect(response.text).not.toContain('GOSZAKUP_TOKEN');
      expect(response.text).not.toContain('stack');
      // A live failure must never be presented as fixture data.
      for (const fixture of LOT_FIXTURES) expect(response.text).not.toContain(fixture.id);
    }
  });

  it('still reports the live source while the registry is down', async () => {
    stubFailure(jsonResponse({}, 503));

    await request(app.getHttpServer()).get('/api/v1/lots').expect(503);
    const response = await request(app.getHttpServer()).get('/api/v1/lots/source').expect(200);

    expect(response.body).toEqual({ mode: 'goszakup', live: true, label: 'Goszakup' });
  });
});

describe('Live lots API without a configured token', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.TENDER_LOT_SOURCE = 'goszakup';
    delete process.env.GOSZAKUP_TOKEN;
    // An unauthenticated request would be a defect, so make it fail loudly.
    globalThis.fetch = jest.fn(async () => {
      throw new Error('The registry must not be called without a token');
    }) as unknown as typeof fetch;
    app = await createApp({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    restoreEnvironment();
  });

  it('fails the live list safely instead of serving fixtures', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/lots').expect(503);

    expect(response.body).toEqual({
      statusCode: 503,
      message: 'Lot source is temporarily unavailable',
    });
    expect(response.text).not.toContain('GOSZAKUP_TOKEN');
    expect(response.text).not.toContain('fixture-');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('fails a live detail lookup the same way and keeps fixture ids unreachable', async () => {
    await request(app.getHttpServer()).get('/api/v1/lots/goszakup:900000001').expect(503);
    // Live mode does not fall back to the demo records.
    await request(app.getHttpServer()).get('/api/v1/lots/fixture-1').expect(404);

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('still reports live mode, and keeps the health endpoint working', async () => {
    const source = await request(app.getHttpServer()).get('/api/v1/lots/source').expect(200);
    expect(source.body).toEqual({ mode: 'goszakup', live: true, label: 'Goszakup' });

    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });
});
