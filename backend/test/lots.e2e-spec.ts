import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/app';
import type { AssessedLot, Lot } from '../src/modules/tender/lot';

describe('Lots API', () => {
  let app: INestApplication;
  const originalLotSource = process.env.TENDER_LOT_SOURCE;

  beforeAll(async () => {
    // No `TENDER_LOT_SOURCE` at all: the application must stay fixture-backed by default.
    delete process.env.TENDER_LOT_SOURCE;
    app = await createApp({ logger: false });
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    if (originalLotSource === undefined) delete process.env.TENDER_LOT_SOURCE;
    else process.env.TENDER_LOT_SOURCE = originalLotSource;
  });

  it('reports the default fixture source and no live access', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/lots/source').expect(200);

    expect(response.body).toEqual({ mode: 'fixture', live: false, label: 'Demo fixtures' });
  });

  it('lists deterministic records and serves the same full detail contract', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/lots').expect(200);
    expect(list.body).toHaveLength(6);
    const lot = list.body[0] as Lot;
    expect(lot).toEqual({
      id: 'fixture-1',
      source: 'Goszakup',
      sourceUrl: expect.stringMatching(/^https:\/\//),
      title: expect.any(String),
      customer: expect.any(String),
      amount: 420000,
      region: 'Алматы',
      district: 'Алатауский',
      bidDeadline: '2026-10-15T12:00:00.000Z',
      description: expect.any(String),
      procurement: {
        lotNumber: '1',
        announcementNumber: 'DEMO-ANN-0001',
        customerBin: '000000000001',
        publishedAt: '2026-09-15T08:00:00.000Z',
        procurementMethod: 'Запрос котировок (пример)',
        officialStatus: 'Приём заявок (пример)',
      },
      assessment: {
        status: 'MATCH',
        reasons: [
          'Amount is within 500,000 KZT',
          'Region is Almaty',
          'LDSP signal found',
          'Furniture signal found',
          'Preferred district: Alatau',
        ],
      },
    });
    const detail = await request(app.getHttpServer()).get(`/api/v1/lots/${lot.id}`).expect(200);
    expect(detail.body).toEqual(lot);
  });

  it('serves the additive procurement metadata on list and detail, never fabricated', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/lots').expect(200);
    const lots = list.body as Array<AssessedLot & { procurement: Record<string, unknown> }>;

    for (const lot of lots) {
      expect(Object.keys(lot.procurement).sort()).toEqual([
        'announcementNumber',
        'customerBin',
        'lotNumber',
        'officialStatus',
        'procurementMethod',
        'publishedAt',
      ]);
      for (const value of Object.values(lot.procurement)) {
        expect(value === null || typeof value === 'string').toBe(true);
      }
    }

    // Fixture parity: fully present, partially missing and fully missing metadata are all served
    // through the same contract without placeholders.
    expect(lots.find((lot) => lot.id === 'fixture-1')?.procurement.lotNumber).toBe('1');
    expect(lots.find((lot) => lot.id === 'fixture-3')?.procurement).toMatchObject({
      procurementMethod: null,
      officialStatus: null,
    });
    expect(
      Object.values(lots.find((lot) => lot.id === 'fixture-6')?.procurement ?? {}).every(
        (value) => value === null,
      ),
    ).toBe(true);

    const detail = await request(app.getHttpServer()).get('/api/v1/lots/fixture-6').expect(200);
    expect((detail.body as AssessedLot & { procurement: unknown }).procurement).toEqual(
      lots.find((lot) => lot.id === 'fixture-6')?.procurement,
    );
  });

  it('assesses every listed lot and keeps excluded lots visible', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/lots').expect(200);

    expect((response.body as AssessedLot[]).map((lot) => [lot.id, lot.assessment.status])).toEqual([
      ['fixture-1', 'MATCH'],
      ['fixture-2', 'MATCH'],
      ['fixture-3', 'EXCLUDE'],
      ['fixture-4', 'EXCLUDE'],
      ['fixture-5', 'EXCLUDE'],
      ['fixture-6', 'REVIEW'],
    ]);
    for (const lot of response.body as AssessedLot[]) {
      expect(lot.assessment.reasons.length).toBeGreaterThan(0);
      expect(lot.assessment.reasons.every((reason) => typeof reason === 'string')).toBe(true);
    }
  });

  it.each([
    [
      'fixture-2',
      'MATCH',
      [
        'Amount is within 500,000 KZT',
        'Region is Almaty',
        'LDSP signal found',
        'Furniture signal found',
      ],
    ],
    ['fixture-3', 'EXCLUDE', ['Amount exceeds 500,000 KZT']],
    ['fixture-4', 'EXCLUDE', ['Region is outside Almaty']],
    ['fixture-5', 'EXCLUDE', ['Metallic cabinet signal found']],
    [
      'fixture-6',
      'REVIEW',
      [
        'Amount is within 500,000 KZT',
        'Region is Almaty',
        'Insufficient evidence for automatic match',
      ],
    ],
  ])('assesses %s as %s with stable reasons', async (id, status, reasons) => {
    const detail = await request(app.getHttpServer()).get(`/api/v1/lots/${id}`).expect(200);

    expect((detail.body as AssessedLot).assessment).toEqual({ status, reasons });
  });

  it.each([
    [{ maxAmount: '500000' }, ['fixture-1', 'fixture-2', 'fixture-4', 'fixture-5', 'fixture-6']],
    [{ maxAmount: '0' }, []],
    [{ region: ' Алматы ' }, ['fixture-1', 'fixture-2', 'fixture-3', 'fixture-5', 'fixture-6']],
    [{ district: 'алатауский' }, ['fixture-1', 'fixture-3', 'fixture-5']],
    [{ q: '  ламинированной ' }, ['fixture-1']],
    [{ q: 'БИБЛИОТЕКА' }, ['fixture-2']],
    [{ q: 'металлические' }, ['fixture-5']],
    [{ q: 'столы', region: 'Алматы', district: 'Алатауский', maxAmount: '500000' }, ['fixture-1']],
    [{ q: 'несуществующий' }, []],
    [{ region: 'Астана', district: 'Алатауский' }, []],
    [
      { maxAmount: '', q: ' ' },
      ['fixture-1', 'fixture-2', 'fixture-3', 'fixture-4', 'fixture-5', 'fixture-6'],
    ],
    // The CP-07 status filter is applied after assessment and keeps the other filters working.
    [{ status: 'MATCH' }, ['fixture-1', 'fixture-2']],
    [{ status: 'match' }, ['fixture-1', 'fixture-2']],
    [{ status: 'REVIEW' }, ['fixture-6']],
    [{ status: 'EXCLUDE' }, ['fixture-3', 'fixture-4', 'fixture-5']],
    [{ status: 'EXCLUDE', region: 'Алматы' }, ['fixture-3', 'fixture-5']],
    [{ status: 'MATCH', maxAmount: '500000', q: 'ЛДСП' }, ['fixture-1', 'fixture-2']],
    [{ status: 'MATCH', district: 'Бостандыкский' }, ['fixture-2']],
    [{ status: 'REVIEW', region: 'Астана' }, []],
  ])('filters %j', async (query, ids) => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/lots')
      .query(query)
      .expect(200);
    expect((response.body as Lot[]).map((lot) => lot.id)).toEqual(ids);
  });

  it.each(['-1', 'NaN', 'Infinity', '1e6', 'abc', '1.234'])(
    'rejects invalid amount %s',
    async (maxAmount) => {
      await request(app.getHttpServer()).get('/api/v1/lots').query({ maxAmount }).expect(400);
    },
  );
  it.each(['UNKNOWN', 'МАТЧ', 'true', '1', 'MATCH REVIEW'])(
    'rejects invalid assessment status %s',
    async (status) => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/lots')
        .query({ status })
        .expect(400);
      expect(response.body).toEqual({ statusCode: 400, message: 'Invalid status' });
    },
  );
  it('rejects repeated filters', async () => {
    await request(app.getHttpServer()).get('/api/v1/lots?q=a&q=b').expect(400);
    await request(app.getHttpServer()).get('/api/v1/lots?status=MATCH&status=REVIEW').expect(400);
  });
  it('returns 404 for unknown ids', async () => {
    await request(app.getHttpServer()).get('/api/v1/lots/unknown').expect(404);
  });
});
