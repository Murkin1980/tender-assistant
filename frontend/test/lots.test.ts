import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LotsPage from '../src/app/lots/page';
import LotPage from '../src/app/lots/[id]/page';
import LotNotFound from '../src/app/lots/[id]/not-found';
import { lotQuery, type Lot } from '../src/lib/lots';

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
const fetchMock = vi.fn<typeof fetch>();
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

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
    fetchMock.mockResolvedValue(response([lot]));
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
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
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

  it('renders detail fields, source link and explicit fixture notice', async () => {
    fetchMock.mockResolvedValue(response(lot));
    const html = renderToStaticMarkup(await LotPage({ params: Promise.resolve({ id: lot.id }) }));
    expect(fetchMock.mock.calls[0]![0]).toBe('http://backend:4000/api/v1/lots/api-record');
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
      'вымышленный пример',
      'rel="noopener noreferrer"',
    ])
      expect(html).toContain(text);
  });

  it('handles missing district', async () => {
    fetchMock.mockResolvedValue(response({ ...lot, district: null }));
    expect(
      renderToStaticMarkup(await LotPage({ params: Promise.resolve({ id: lot.id }) })),
    ).toContain('Не указан');
  });

  it('renders empty results', async () => {
    fetchMock.mockResolvedValue(response([]));
    expect(renderToStaticMarkup(await LotsPage({ searchParams: Promise.resolve({}) }))).toContain(
      'Ничего не найдено',
    );
  });

  it.each([400, 500])('shows safe list errors for HTTP %s', async (status) => {
    fetchMock.mockResolvedValue(response({}, status));
    const html = renderToStaticMarkup(await LotsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('Ничего не найдено');
  });

  it('handles backend failure in list and detail without leaking internals', async () => {
    fetchMock.mockRejectedValue(new Error('private backend connection failed'));
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
    fetchMock.mockResolvedValue(response({}, 404));
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
