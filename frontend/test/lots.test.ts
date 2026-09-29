import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LotsPage from '../src/app/lots/page';
import LotPage from '../src/app/lots/[id]/page';
import LotNotFound from '../src/app/lots/[id]/not-found';
import { lotQuery, timingLabel, type Lot, type LotSourceStatus } from '../src/lib/lots';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const lot: Lot = {
  id: 'api-record',
  source: 'Goszakup',
  sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
  title: 'Столы из ЛДСП',
  customer: 'Заказчик из API',
  amount: 420000,
  region: 'Алматы',
  district: 'Алатауский',
  bidDeadline: '2026-10-15T12:00:00.000Z',
  description: 'Ламинированная плита, доставка и сборка.',
  procurement: {
    lotNumber: '3',
    announcementNumber: 'DEMO-ANN-0003',
    customerBin: '000000000003',
    publishedAt: '2026-09-10T08:00:00.000Z',
    procurementMethod: 'Запрос котировок (пример)',
    officialStatus: 'Приём заявок (пример)',
  },
  assessment: {
    status: 'MATCH',
    reasons: [
      'Amount is within 500,000 KZT',
      'Region is Almaty',
      'LDSP signal found',
      'Preferred district: Alatau',
    ],
  },
  actionability: { status: 'TAKE' },
  timing: {
    status: 'OPEN_BY_DEADLINE',
    deadline: '2026-10-15T12:00:00.000Z',
    remainingMinutes: 3000,
  },
};

const docLot: Lot = {
  ...lot,
  id: 'api-with-docs',
  documents: [
    {
      id: 'doc-1',
      name: 'Техническая спецификация',
      type: null,
      mimeType: 'application/pdf',
      sizeBytes: null,
      sourceUrl: 'https://goszakup.gov.kz/files/download_file/1/tech.pdf',
    },
    {
      id: 'doc-2',
      name: 'Проект договора',
      type: null,
      mimeType: null,
      sizeBytes: null,
      sourceUrl: 'https://goszakup.gov.kz/files/download_file/2/contract.pdf',
    },
  ],
};

/** CP-09: a valid deadline that has already passed. */
const closedLot: Lot = {
  ...lot,
  id: 'api-closed',
  bidDeadline: '2026-09-20T12:00:00.000Z',
  timing: {
    status: 'CLOSED_BY_DEADLINE',
    deadline: '2026-09-20T12:00:00.000Z',
    remainingMinutes: null,
  },
};

/** CP-09: a deadline the source does not provide. */
const unknownDeadlineLot: Lot = {
  ...lot,
  id: 'api-unknown-deadline',
  bidDeadline: '',
  timing: { status: 'DEADLINE_UNKNOWN', deadline: null, remainingMinutes: null },
};

const reviewLot: Lot = {
  ...lot,
  actionability: { status: 'REVIEW' },
  id: 'api-review',
  district: null,
  assessment: {
    status: 'REVIEW',
    reasons: ['Amount is within 500,000 KZT', 'Insufficient evidence for automatic match'],
  },
};

const excludedLot: Lot = {
  ...lot,
  actionability: { status: 'SKIP' },
  id: 'api-excluded',
  amount: 780000,
  assessment: {
    status: 'EXCLUDE',
    reasons: ['Amount exceeds 500,000 KZT', 'Metallic cabinet signal found'],
  },
};

const liveLot: Lot = {
  ...lot,
  id: 'goszakup:900000001',
  source: 'goszakup',
  sourceUrl: 'https://goszakup.gov.kz/ru/view/lots/index/id/900000001',
  district: null,
  bidDeadline: '',
  description: '',
  // The registry supplied none of the optional CP-08 metadata for this record.
  procurement: {
    lotNumber: null,
    announcementNumber: null,
    customerBin: null,
    publishedAt: null,
    procurementMethod: null,
    officialStatus: null,
  },
  timing: { status: 'DEADLINE_UNKNOWN', deadline: null, remainingMinutes: null },
};

const fixtureSource: LotSourceStatus = { mode: 'fixture', live: false, label: 'Demo fixtures' };
const liveSource: LotSourceStatus = { mode: 'goszakup', live: true, label: 'Goszakup' };

const fetchMock = vi.fn<typeof fetch>();
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

type Routes = {
  source?: Response;
  list?: Response;
  detail?: Response;
};

/** Routes the three server-side backend calls of the lot pages by path. */
function mockApi(routes: Routes = {}): void {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const { pathname } = new URL(String(input));
    if (pathname === '/api/v1/lots/source') return routes.source ?? response(fixtureSource);
    if (pathname === '/api/v1/lots') return routes.list ?? response([lot]);
    return routes.detail ?? response(lot);
  });
}

/** Request URLs of every backend call made to one path. */
const callsTo = (pathname: string): string[] =>
  fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((input) => new URL(input).pathname === pathname);

describe('Lots server pages through the backend API', () => {
  beforeEach(() => {
    vi.stubEnv('BACKEND_INTERNAL_URL', 'http://backend:4000/');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('renders API data, GET filters with retained values and a detail link', async () => {
    mockApi({ list: response([lot]) });
    const html = renderToStaticMarkup(
      await LotsPage({
        searchParams: Promise.resolve({
          q: 'ЛДСП',
          maxAmount: '500000',
          region: 'Алматы',
          district: 'Алатауский',
        }),
      }),
    );
    const url = new URL(callsTo('/api/v1/lots')[0] as string);
    expect(url.origin + url.pathname).toBe('http://backend:4000/api/v1/lots');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'ЛДСП',
      maxAmount: '500000',
      region: 'Алматы',
      district: 'Алатауский',
    });
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    });
    for (const text of [
      lot.title,
      lot.customer,
      'href="/lots/api-record"',
      'method="get"',
      'action="/lots"',
      'name="actionStatus"',
      'Брать в работу',
      'value="500000"',
      'value="ЛДСП"',
      'value="Алатауский"',
      'Сбросить',
    ])
      expect(html).toContain(text);
    expect(html).not.toContain('http://backend');
  });

  it('shows the triage status of every listed lot and the operator note', async () => {
    mockApi({ list: response([lot, reviewLot, excludedLot]) });
    const html = renderToStaticMarkup(await LotsPage({ searchParams: Promise.resolve({}) }));

    for (const status of ['MATCH', 'REVIEW', 'EXCLUDE']) {
      expect(html).toContain(`data-status="${status}"`);
      expect(html).toContain(`>${status}</span>`);
    }
    expect(html).toContain('data-action="TAKE"');
    expect(html).toContain('data-action="REVIEW"');
    expect(html).toContain('data-action="SKIP"');
    expect(html).toContain(
      'Статус — автоматический предварительный отбор по простым правилам. Финальное решение принимает оператор.',
    );
    expect(html).not.toContain('рекоменд');
  });

  it('shows the deadline state of every listed lot without claiming an official status', async () => {
    mockApi({ list: response([lot, closedLot, unknownDeadlineLot]) });
    const html = renderToStaticMarkup(await LotsPage({ searchParams: Promise.resolve({}) }));

    for (const status of ['OPEN_BY_DEADLINE', 'CLOSED_BY_DEADLINE', 'DEADLINE_UNKNOWN']) {
      expect(html).toContain(`data-timing="${status}"`);
    }
    expect(html).toContain('Срок открыт · 2 дн. 2 ч.');
    expect(html).toContain('Срок истёк');
    expect(html).toContain('Срок не указан');
    // Deadline arithmetic is never presented as the official status of the tender.
    expect(html).not.toContain('Тендер открыт');
    expect(html).not.toContain('Приём заявок открыт');
    // Expired lots stay visible until the operator filters them out.
    expect(html).toContain(closedLot.title);
  });

  it('offers the deadline filter and keeps the other query parameters', async () => {
    mockApi({ list: response([lot]) });
    const html = renderToStaticMarkup(
      await LotsPage({
        searchParams: Promise.resolve({
          q: 'ЛДСП',
          maxAmount: '500000',
          region: 'Алматы',
          district: 'Алатауский',
          deadlineStatus: 'open_by_deadline',
        }),
      }),
    );

    const url = new URL(callsTo('/api/v1/lots')[0] as string);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'ЛДСП',
      maxAmount: '500000',
      region: 'Алматы',
      district: 'Алатауский',
      deadlineStatus: 'OPEN_BY_DEADLINE',
    });
    for (const text of ['name="deadlineStatus"', 'Все сроки', 'selected="">Срок открыт'])
      expect(html).toContain(text);
  });

  it('applies the assessment status filter without dropping the other query parameters', async () => {
    mockApi({ list: response([lot]) });
    const html = renderToStaticMarkup(
      await LotsPage({
        searchParams: Promise.resolve({
          q: 'ЛДСП',
          maxAmount: '500000',
          region: 'Алматы',
          district: 'Алатауский',
          status: 'MATCH',
        }),
      }),
    );

    const url = new URL(callsTo('/api/v1/lots')[0] as string);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'ЛДСП',
      maxAmount: '500000',
      region: 'Алматы',
      district: 'Алатауский',
      status: 'MATCH',
    });
    for (const text of [
      'name="status"',
      'selected="">MATCH',
      'value="500000"',
      'value="ЛДСП"',
      'value="Алатауский"',
    ])
      expect(html).toContain(text);
  });

  it('never hides excluded lots behind the default status', async () => {
    mockApi({ list: response([lot, excludedLot]) });
    const html = renderToStaticMarkup(await LotsPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain(excludedLot.title);
    expect(html).toContain('data-status="EXCLUDE"');
  });

  it('offers a shareable current-profile preset that also asks for an open deadline', async () => {
    mockApi({ source: response(liveSource), list: response([liveLot]) });
    const html = renderToStaticMarkup(await LotsPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('Наш профиль');
    expect(html).toContain(
      'href="/lots?maxAmount=500000&amp;region=Алматы&amp;deadlineStatus=OPEN_BY_DEADLINE"',
    );

    const presetHtml = renderToStaticMarkup(
      await LotsPage({
        searchParams: Promise.resolve({
          maxAmount: '500000',
          region: 'Алматы',
          deadlineStatus: 'OPEN_BY_DEADLINE',
        }),
      }),
    );
    // The active deadline filter stays visible in the form instead of being hidden.
    expect(presetHtml).toContain('name="maxAmount"');
    expect(presetHtml).toContain('value="500000"');
    expect(presetHtml).toContain('selected="">Алматы');
    expect(presetHtml).toContain('selected="">Срок открыт');
    expect(presetHtml).not.toContain('value="ЛДСП"');
  });

  it('marks the fixture source as demo data on the list page', async () => {
    mockApi({ source: response(fixtureSource), list: response([lot]) });
    const html = renderToStaticMarkup(await LotsPage({ searchParams: Promise.resolve({}) }));

    expect(callsTo('/api/v1/lots/source')).toHaveLength(1);
    expect(html).toContain('DEMO');
    expect(html).toContain('Demo fixtures');
    expect(html).toContain('синтетические тестовые данные');
    expect(html).toContain('Найдено: 1');
    expect(html).not.toContain('LIVE');
    expect(html).not.toContain('Goszakup (только чтение)');
  });

  it('marks the live source, its bounded sample and never calls it demo data', async () => {
    mockApi({ source: response(liveSource), list: response([liveLot]) });
    const html = renderToStaticMarkup(await LotsPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('LIVE');
    expect(html).toContain('Goszakup');
    expect(html).toContain('ограниченная выборка');
    expect(html).toContain('только чтение');
    expect(html).not.toContain('DEMO');
    expect(html).not.toContain('синтетические тестовые данные');
    // The count is not presented as an exhaustive answer.
    expect(html).not.toContain('Найдено:');
  });

  it('shows a temporary-unavailable message instead of fixtures when the live source fails', async () => {
    mockApi({ source: response(liveSource), list: response({}, 503) });
    const html = renderToStaticMarkup(await LotsPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('role="alert"');
    expect(html).toContain('Источник Goszakup временно недоступен');
    expect(html).not.toContain('Ничего не найдено');
    expect(html).not.toContain(lot.title);
  });

  it('makes no source claim when the source status cannot be read', async () => {
    mockApi({ source: response({}, 500) });
    const html = renderToStaticMarkup(await LotsPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('Источник данных не определён');
    expect(html).not.toContain('DEMO');
    expect(html).not.toContain('LIVE');
  });

  it('renders the assessment status above the source-backed Данные закупки section', async () => {
    mockApi({ source: response(fixtureSource), detail: response(lot) });
    const html = renderToStaticMarkup(await LotPage({ params: Promise.resolve({ id: lot.id }) }));

    expect(html).toContain('Данные закупки');
    for (const text of [
      'Номер лота',
      lot.procurement.lotNumber!,
      'Номер объявления',
      lot.procurement.announcementNumber!,
      'БИН заказчика',
      lot.procurement.customerBin!,
      'Опубликовано',
      // 2026-09-10T08:00Z rendered with the established Almaty (UTC+5) handling.
      '13:00',
      'Способ закупки',
      lot.procurement.procurementMethod!,
      'Официальный статус',
      lot.procurement.officialStatus!,
      lot.bidDeadline,
    ])
      expect(html).toContain(text);

    // Assessment stays above the metadata so the operator reads the triage first.
    expect(html.indexOf('data-status')).toBeLessThan(html.indexOf('Данные закупки'));
    expect(html.indexOf('Данные закупки')).toBeLessThan(html.indexOf('Открыть источник'));
  });

  it('distinguishes the official status from the deadline-derived state on the detail page', async () => {
    mockApi({ source: response(fixtureSource), detail: response(lot) });
    const html = renderToStaticMarkup(await LotPage({ params: Promise.resolve({ id: lot.id }) }));

    // The deadline state is shown next to the deadline and never replaces the official status.
    expect(html).toContain('data-timing="OPEN_BY_DEADLINE"');
    expect(html).toContain('Срок открыт · 2 дн. 2 ч.');
    expect(html).toContain('Официальный статус');
    expect(html).toContain(lot.procurement.officialStatus!);
    expect(html).toContain('не является официальным статусом закупки');
    expect(html).toContain('первоисточником остаётся запись источника');
  });

  it('renders unavailable procurement metadata as Не указано instead of inventing it', async () => {
    mockApi({ source: response(liveSource), detail: response(liveLot) });
    const html = renderToStaticMarkup(
      await LotPage({ params: Promise.resolve({ id: liveLot.id }) }),
    );

    // lotNumber, announcementNumber, customerBin, publishedAt, method and official status.
    expect(html.match(/Не указано/g)).toHaveLength(6);
    expect(html).toContain('Срок не указан');
    expect(html).not.toContain('DEMO-ANN');
  });

  it('renders detail fields, source link and explicit fixture notice', async () => {
    mockApi({ source: response(fixtureSource), detail: response(lot) });
    const html = renderToStaticMarkup(await LotPage({ params: Promise.resolve({ id: lot.id }) }));

    expect(callsTo('/api/v1/lots/api-record')).toHaveLength(1);
    for (const text of [
      lot.id,
      lot.title,
      lot.source,
      lot.customer,
      lot.region,
      lot.district!,
      lot.description,
      lot.bidDeadline,
      lot.sourceUrl,
      '420',
      '000 KZT',
      '17:00',
      'UTC+5',
      'DEMO',
      'вымышленный пример',
      'rel="noopener noreferrer"',
    ])
      expect(html).toContain(text);
  });

  it('opens a live lot without the fixture wording and shows a missing registry deadline', async () => {
    mockApi({ source: response(liveSource), detail: response(liveLot) });
    const html = renderToStaticMarkup(
      await LotPage({ params: Promise.resolve({ id: liveLot.id }) }),
    );

    // A live id must reach the backend exactly once encoded, not twice.
    expect(callsTo('/api/v1/lots/goszakup%3A900000001')).toHaveLength(1);

    expect(html).toContain('LIVE');
    expect(html).toContain('goszakup');
    expect(html).toContain(liveLot.sourceUrl);
    expect(html).toContain('data-timing="DEADLINE_UNKNOWN"');
    expect(html).toContain('Срок не указан');
    expect(html).toContain('Описание не указано.');
    expect(html).not.toContain('вымышленный пример');
    expect(html).not.toContain('Тестовые данные');
  });

  it('renders the assessment status and its reasons on the detail page', async () => {
    mockApi({ source: response(fixtureSource), detail: response(excludedLot) });
    const html = renderToStaticMarkup(
      await LotPage({ params: Promise.resolve({ id: excludedLot.id }) }),
    );

    expect(html).toContain('Статус');
    expect(html).toContain('data-status="EXCLUDE"');
    for (const reason of excludedLot.assessment.reasons) expect(html).toContain(reason);
  });

  it('reads a live detail page whose id arrives percent-encoded, as Next delivers it', async () => {
    mockApi({ source: response(liveSource), detail: response(liveLot) });
    const html = renderToStaticMarkup(
      await LotPage({ params: Promise.resolve({ id: 'goszakup%3A900000001' }) }),
    );

    expect(callsTo('/api/v1/lots/goszakup%3A900000001')).toHaveLength(1);
    expect(html).toContain('LIVE');
    expect(html).toContain(liveLot.title);
  });

  it('shows the temporary-unavailable message for a live detail failure', async () => {
    mockApi({ source: response(liveSource), detail: response({}, 503) });
    const html = renderToStaticMarkup(
      await LotPage({ params: Promise.resolve({ id: liveLot.id }) }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Источник Goszakup временно недоступен');
    expect(html).not.toContain(liveLot.title);
    expect(html).not.toContain('Документы не указаны источником');
  });

  it('renders procurement documents with official links and metadata on detail', async () => {
    mockApi({ source: response(fixtureSource), detail: response(docLot) });
    const html = renderToStaticMarkup(
      await LotPage({ params: Promise.resolve({ id: docLot.id }) }),
    );

    expect(html).toContain('Документы закупки');
    expect(html).toContain('Техническая спецификация');
    expect(html).toContain('application/pdf');
    expect(html).toContain('https://goszakup.gov.kz/files/download_file/1/tech.pdf');
    expect(html).toContain('Проект договора');
    expect(html).toContain('https://goszakup.gov.kz/files/download_file/2/contract.pdf');
    expect(html).toContain('Открыть документ');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('renders empty documents state when no documents are provided', async () => {
    mockApi({ source: response(fixtureSource), detail: response({ ...lot, documents: [] }) });
    const html = renderToStaticMarkup(await LotPage({ params: Promise.resolve({ id: lot.id }) }));

    expect(html).toContain('Документы закупки');
    expect(html).toContain('Документы не указаны источником.');
  });

  it('never displays documents or performs document queries on the list page', async () => {
    mockApi({ source: response(fixtureSource), list: response([docLot]) });
    const html = renderToStaticMarkup(await LotsPage({ searchParams: Promise.resolve({}) }));

    expect(callsTo('/api/v1/lots')).toHaveLength(1);
    expect(callsTo(`/api/v1/lots/${docLot.id}`)).toHaveLength(0);
    expect(html).not.toContain('Документы закупки');
    expect(html).not.toContain('Документы не указаны источником');
    expect(html).not.toContain('<h2>Требования</h2>');
  });

  it('renders AVAILABLE requirements grouped by category with source document and locator', async () => {
    const lotWithAvailableReqs: Lot = {
      ...docLot,
      requirements: {
        status: 'AVAILABLE',
        items: [
          {
            category: 'SUBJECT',
            text: 'Наименование товара: Столы письменные из ЛДСП',
            sourceDocumentId: 'doc-1',
            sourceLocator: 'Стр. 1',
          },
          {
            category: 'DIMENSIONS',
            text: 'Габаритные размеры: 1200х600х750 мм',
            sourceDocumentId: 'doc-1',
            sourceLocator: 'Стр. 1, п. 2.1',
          },
          {
            category: 'SUPPORTING_DOCUMENT',
            text: 'Подтверждающие документы: сертификат соответствия ЕАЭС',
            sourceDocumentId: 'doc-2',
            sourceLocator: null,
          },
        ],
        warnings: [],
      },
    };
    mockApi({ source: response(fixtureSource), detail: response(lotWithAvailableReqs) });
    const html = renderToStaticMarkup(
      await LotPage({ params: Promise.resolve({ id: lotWithAvailableReqs.id }) }),
    );

    expect(html).toContain('<h2>Требования</h2>');
    expect(html).toContain('data-requirements="AVAILABLE"');
    expect(html).toContain('AVAILABLE · Извлечены из документов');
    expect(html).toContain(
      'Извлечённые факты из официальных документов закупки приводятся отдельно от внутренней операционной рекомендации',
    );
    expect(html).toContain('<h3>Предмет закупки</h3>');
    expect(html).toContain('Наименование товара: Столы письменные из ЛДСП');
    expect(html).toContain('(Документ: Техническая спецификация · Стр. 1)');
    expect(html).toContain('<h3>Размеры и габариты</h3>');
    expect(html).toContain('(Документ: Техническая спецификация · Стр. 1, п. 2.1)');
    expect(html).toContain('<h3>Подтверждающие документы</h3>');
    expect(html).toContain('(Документ: Проект договора)');
    expect(html).not.toContain('Нужно проверить вручную:');
  });

  it('renders PARTIAL requirements with extracted items and manual-review warnings', async () => {
    const lotWithPartialReqs: Lot = {
      ...docLot,
      requirements: {
        status: 'PARTIAL',
        items: [
          {
            category: 'MATERIAL',
            text: 'Материал: ЛДСП толщиной 16 мм, кромка ПВХ 2 мм',
            sourceDocumentId: 'doc-1',
            sourceLocator: 'Табл. 1, стр. 3',
          },
        ],
        warnings: [
          'Документ «Техническая спецификация» (Абз. 1): обнаружена отсылка к чертежу, схеме или неполным данным — нужно проверить вручную.',
        ],
      },
    };
    mockApi({ source: response(fixtureSource), detail: response(lotWithPartialReqs) });
    const html = renderToStaticMarkup(
      await LotPage({ params: Promise.resolve({ id: lotWithPartialReqs.id }) }),
    );

    expect(html).toContain('data-requirements="PARTIAL"');
    expect(html).toContain('PARTIAL · Извлечены частично · нужно проверить вручную');
    expect(html).toContain('<h3>Материалы</h3>');
    expect(html).toContain('Материал: ЛДСП толщиной 16 мм, кромка ПВХ 2 мм');
    expect(html).toContain('(Документ: Техническая спецификация · Табл. 1, стр. 3)');
    expect(html).toContain('Нужно проверить вручную:');
    expect(html).toContain('обнаружена отсылка к чертежу, схеме или неполным данным');
  });

  it('renders UNAVAILABLE requirements state for unsupported or missing documents', async () => {
    const lotWithUnavailableReqs: Lot = {
      ...docLot,
      requirements: {
        status: 'UNAVAILABLE',
        items: [],
        warnings: [
          'Документ «Техническая спецификация»: текстовый слой в PDF отсутствует (возможно, скан без текстового слоя; OCR не используется) — нужно проверить вручную.',
        ],
      },
    };
    mockApi({ source: response(fixtureSource), detail: response(lotWithUnavailableReqs) });
    const html = renderToStaticMarkup(
      await LotPage({ params: Promise.resolve({ id: lotWithUnavailableReqs.id }) }),
    );

    expect(html).toContain('data-requirements="UNAVAILABLE"');
    expect(html).toContain('UNAVAILABLE · Не удалось извлечь · нужно проверить вручную');
    expect(html).toContain('Нужно проверить вручную:');
    expect(html).toContain('текстовый слой в PDF отсутствует');
  });

  it('makes no origin claim on a detail page whose source status is unreadable', async () => {
    mockApi({ source: response({}, 500), detail: response(lot) });
    const html = renderToStaticMarkup(await LotPage({ params: Promise.resolve({ id: lot.id }) }));

    expect(html).toContain('Источник данных не определён');
    expect(html).toContain('Ссылка ведёт в реестр источника.');
    expect(html).not.toContain('вымышленный пример');
    expect(html).not.toContain('LIVE');
  });

  it('handles missing district', async () => {
    mockApi({ detail: response({ ...lot, district: null }) });
    expect(
      renderToStaticMarkup(await LotPage({ params: Promise.resolve({ id: lot.id }) })),
    ).toContain('Не указан');
  });

  it('renders empty results', async () => {
    mockApi({ list: response([]) });
    expect(renderToStaticMarkup(await LotsPage({ searchParams: Promise.resolve({}) }))).toContain(
      'Ничего не найдено',
    );
  });

  it.each([400, 500])('shows safe list errors for HTTP %s', async (status) => {
    mockApi({ list: response({}, status) });
    const html = renderToStaticMarkup(await LotsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('Ничего не найдено');
  });

  it('handles backend failure in list and detail without leaking internals', async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error('private backend connection failed');
    });
    const pages = [
      await LotsPage({ searchParams: Promise.resolve({}) }),
      await LotPage({ params: Promise.resolve({ id: lot.id }) }),
    ];
    for (const page of pages) {
      const html = renderToStaticMarkup(page);
      expect(html).toContain('role="alert"');
      expect(html).not.toContain('private backend');
    }
  });

  it('uses Next 404 handling, with a link back to the list', async () => {
    mockApi({ detail: response({}, 404) });
    await expect(LotPage({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(renderToStaticMarkup(createElement(LotNotFound))).toContain('href="/lots"');
  });

  it('only forwards supported scalar filters and known assessment statuses', () => {
    expect(
      lotQuery({ q: ' table ', district: '', other: 'ignored', region: ['a', 'b'] }).toString(),
    ).toBe('q=table');
    expect(lotQuery({ status: ' review ' }).toString()).toBe('status=REVIEW');
    const unknown = lotQuery({ status: 'unknown', q: 'стол' });
    expect(unknown.get('status')).toBeNull();
    expect(unknown.get('q')).toBe('стол');
  });

  it('forwards a known deadline state and drops an unknown one', () => {
    expect(lotQuery({ deadlineStatus: ' closed_by_deadline ', other: 'ignored' }).toString()).toBe(
      'deadlineStatus=CLOSED_BY_DEADLINE',
    );
    const unknown = lotQuery({ deadlineStatus: 'open', q: 'стол' });
    expect(unknown.get('deadlineStatus')).toBeNull();
    expect(unknown.get('q')).toBe('стол');
  });
});

describe('timingLabel', () => {
  it('shows the remaining duration of a future deadline', () => {
    expect(
      timingLabel({
        status: 'OPEN_BY_DEADLINE',
        deadline: '2026-10-15T12:00:00.000Z',
        remainingMinutes: 3000,
      }),
    ).toBe('Срок открыт · 2 дн. 2 ч.');
    expect(
      timingLabel({
        status: 'OPEN_BY_DEADLINE',
        deadline: '2026-10-15T12:00:00.000Z',
        remainingMinutes: 125,
      }),
    ).toBe('Срок открыт · 2 ч. 5 мин.');
    expect(
      timingLabel({
        status: 'OPEN_BY_DEADLINE',
        deadline: '2026-10-15T12:00:00.000Z',
        remainingMinutes: 45,
      }),
    ).toBe('Срок открыт · 45 мин.');
  });

  it('never claims that a tender or an application process is open', () => {
    const label = timingLabel({
      status: 'OPEN_BY_DEADLINE',
      deadline: '2026-10-15T12:00:00.000Z',
      remainingMinutes: 60,
    });
    expect(label).not.toContain('Тендер открыт');
    expect(label).not.toContain('Приём заявок открыт');
  });

  it('states an expired and an unknown deadline without a duration', () => {
    expect(
      timingLabel({
        status: 'CLOSED_BY_DEADLINE',
        deadline: '2026-09-20T12:00:00.000Z',
        remainingMinutes: null,
      }),
    ).toBe('Срок истёк');
    expect(
      timingLabel({ status: 'DEADLINE_UNKNOWN', deadline: null, remainingMinutes: null }),
    ).toBe('Срок не указан');
  });
});
