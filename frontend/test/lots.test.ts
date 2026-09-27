import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LotsPage from '../src/app/lots/page';
import LotPage from '../src/app/lots/[id]/page';
import LotNotFound from '../src/app/lots/[id]/not-found';
import { lotQuery, type Lot, type LotSourceStatus } from '../src/lib/lots';

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
};

const liveLot: Lot = {
  ...lot,
  id: 'goszakup:900000001',
  source: 'goszakup',
  sourceUrl: 'https://goszakup.gov.kz/ru/view/lots/index/id/900000001',
  district: null,
  bidDeadline: '',
  description: '',
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
      'value="500000"',
      'value="ЛДСП"',
      'value="Алатауский"',
      'Сбросить',
    ])
      expect(html).toContain(text);
    expect(html).not.toContain('http://backend');
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
    expect(html).toContain('Срок не указан');
    expect(html).toContain('Описание не указано.');
    expect(html).not.toContain('вымышленный пример');
    expect(html).not.toContain('Тестовые данные');
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

  it('only forwards supported scalar filters', () => {
    expect(
      lotQuery({ q: ' table ', district: '', other: 'ignored', region: ['a', 'b'] }).toString(),
    ).toBe('q=table');
  });
});
