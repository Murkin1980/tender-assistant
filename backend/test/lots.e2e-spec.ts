import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/app';
import type { AssessedLot, Lot, LotTiming } from '../src/modules/tender/lot';

/**
 * CP-09 needs a known instant to compare deadlines against, so this file fixes the clock to
 * `2026-10-01T00:00:00.000Z`. Only `Date` is faked: every timer stays real, and the fixture
 * deadlines keep their realistic values instead of being anchored to the current date.
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

/** CP-09 timing of every fixture at {@link FIXED_NOW}. */
const FIXTURE_TIMING: Readonly<Record<string, LotTiming>> = {
  'fixture-1': {
    status: 'OPEN_BY_DEADLINE',
    deadline: '2026-10-15T12:00:00.000Z',
    remainingMinutes: 20880,
  },
  'fixture-2': {
    status: 'OPEN_BY_DEADLINE',
    deadline: '2026-10-16T12:00:00.000Z',
    remainingMinutes: 22320,
  },
  'fixture-3': {
    status: 'CLOSED_BY_DEADLINE',
    deadline: '2026-09-20T12:00:00.000Z',
    remainingMinutes: null,
  },
  'fixture-4': {
    status: 'CLOSED_BY_DEADLINE',
    deadline: '2026-09-21T12:00:00.000Z',
    remainingMinutes: null,
  },
  'fixture-5': {
    status: 'OPEN_BY_DEADLINE',
    deadline: '2026-10-19T12:00:00.000Z',
    remainingMinutes: 26640,
  },
  'fixture-6': { status: 'DEADLINE_UNKNOWN', deadline: null, remainingMinutes: null },
};

describe('Lots API', () => {
  let app: INestApplication;
  const originalLotSource = process.env.TENDER_LOT_SOURCE;

  beforeAll(async () => {
    // No `TENDER_LOT_SOURCE` at all: the application must stay fixture-backed by default.
    delete process.env.TENDER_LOT_SOURCE;
    jest.useFakeTimers({ now: FIXED_NOW, doNotFake: [...REAL_TIMER_APIS] });
    app = await createApp({ logger: false });
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    jest.useRealTimers();
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
      actionability: { status: 'TAKE' },
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
      timing: FIXTURE_TIMING['fixture-1'],
    });
    const detail = await request(app.getHttpServer()).get(`/api/v1/lots/${lot.id}`).expect(200);
    expect(detail.body).toEqual({
      ...lot,
      documents: [
        {
          id: 'doc-fixture-1-1',
          name: 'Техническая спецификация (пример)',
          type: null,
          mimeType: 'application/pdf',
          sizeBytes: null,
          sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
        },
        {
          id: 'doc-fixture-1-2',
          name: 'Проект договора поставки мебели (пример)',
          type: null,
          mimeType: 'application/pdf',
          sizeBytes: null,
          sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
        },
      ],
    });
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

  it('serves additive documents on detail only, never on list, with fixture parity', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/lots').expect(200);
    for (const lot of list.body as Record<string, unknown>[]) {
      expect(lot.documents).toBeUndefined();
    }

    // fixture-1 has multiple documents
    const detail1 = await request(app.getHttpServer()).get('/api/v1/lots/fixture-1').expect(200);
    expect(detail1.body.documents).toHaveLength(2);
    expect(detail1.body.documents[0]).toEqual({
      id: 'doc-fixture-1-1',
      name: 'Техническая спецификация (пример)',
      type: null,
      mimeType: 'application/pdf',
      sizeBytes: null,
      sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
    });

    // fixture-2 has one document with partial metadata (null mimeType)
    const detail2 = await request(app.getHttpServer()).get('/api/v1/lots/fixture-2').expect(200);
    expect(detail2.body.documents).toHaveLength(1);
    expect(detail2.body.documents[0]).toEqual({
      id: 'doc-fixture-2-1',
      name: 'Спецификация стеллажей (пример)',
      type: null,
      mimeType: null,
      sizeBytes: null,
      sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
    });

    // fixture-3 and fixture-6 have no documents (empty array)
    const detail3 = await request(app.getHttpServer()).get('/api/v1/lots/fixture-3').expect(200);
    expect(detail3.body.documents).toEqual([]);

    const detail6 = await request(app.getHttpServer()).get('/api/v1/lots/fixture-6').expect(200);
    expect(detail6.body.documents).toEqual([]);
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

  it('derives the additive timing contract on list and detail from the deadline only', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/lots').expect(200);
    const lots = list.body as AssessedLot[];

    // Every lot of the default list carries timing: future, past and missing deadlines alike.
    for (const lot of lots) {
      expect(Object.keys(lot.timing).sort()).toEqual(['deadline', 'remainingMinutes', 'status']);
      expect(lot.timing).toEqual(FIXTURE_TIMING[lot.id]);
      expect(lot.timing.deadline).toBe(lot.bidDeadline || null);
    }
    expect(lots.map((lot) => lot.timing.status)).toEqual([
      'OPEN_BY_DEADLINE',
      'OPEN_BY_DEADLINE',
      'CLOSED_BY_DEADLINE',
      'CLOSED_BY_DEADLINE',
      'OPEN_BY_DEADLINE',
      'DEADLINE_UNKNOWN',
    ]);

    // Remaining time is exposed only while the deadline is still in the future.
    for (const lot of lots) {
      if (lot.timing.status === 'OPEN_BY_DEADLINE') {
        expect(Number.isInteger(lot.timing.remainingMinutes)).toBe(true);
        expect(lot.timing.remainingMinutes as number).toBeGreaterThan(0);
      } else {
        expect(lot.timing.remainingMinutes).toBeNull();
      }
    }

    // The detail path derives timing with the same evaluator and the same instant.
    for (const id of ['fixture-1', 'fixture-3', 'fixture-6']) {
      const detail = await request(app.getHttpServer()).get(`/api/v1/lots/${id}`).expect(200);
      expect((detail.body as AssessedLot).timing).toEqual(FIXTURE_TIMING[id]);
    }
  });

  it('keeps the deadline state and the CP-07 assessment as separate dimensions', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/lots').expect(200);
    const lots = response.body as AssessedLot[];

    // A past deadline does not mutate the assessment: the CP-07 outcomes stay as approved.
    expect(lots.map((lot) => [lot.id, lot.assessment.status, lot.timing.status])).toEqual([
      ['fixture-1', 'MATCH', 'OPEN_BY_DEADLINE'],
      ['fixture-2', 'MATCH', 'OPEN_BY_DEADLINE'],
      ['fixture-3', 'EXCLUDE', 'CLOSED_BY_DEADLINE'],
      ['fixture-4', 'EXCLUDE', 'CLOSED_BY_DEADLINE'],
      ['fixture-5', 'EXCLUDE', 'OPEN_BY_DEADLINE'],
      ['fixture-6', 'REVIEW', 'DEADLINE_UNKNOWN'],
    ]);

    // The timing object carries no official status: the source record stays authoritative.
    expect(lots.find((lot) => lot.id === 'fixture-1')?.timing).not.toHaveProperty('officialStatus');
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
    // The CP-09 deadline filter is local: it reads the derived timing and combines with AND.
    [{ deadlineStatus: 'OPEN_BY_DEADLINE' }, ['fixture-1', 'fixture-2', 'fixture-5']],
    [{ deadlineStatus: 'open_by_deadline' }, ['fixture-1', 'fixture-2', 'fixture-5']],
    [{ deadlineStatus: 'CLOSED_BY_DEADLINE' }, ['fixture-3', 'fixture-4']],
    [{ deadlineStatus: 'DEADLINE_UNKNOWN' }, ['fixture-6']],
    [{ actionStatus: 'TAKE' }, ['fixture-1', 'fixture-2']],
    [{ actionStatus: 'REVIEW' }, ['fixture-6']],
    [{ actionStatus: 'SKIP' }, ['fixture-3', 'fixture-4', 'fixture-5']],
    [
      { deadlineStatus: 'OPEN_BY_DEADLINE', region: 'Алматы', maxAmount: '500000' },
      ['fixture-1', 'fixture-2', 'fixture-5'],
    ],
    [{ deadlineStatus: 'CLOSED_BY_DEADLINE', q: 'ЛДСП' }, ['fixture-3', 'fixture-4']],
    // Expired lots are never hidden by default: the unfiltered list still contains them.
    [{ status: 'MATCH', deadlineStatus: 'OPEN_BY_DEADLINE' }, ['fixture-1', 'fixture-2']],
    [{ status: 'EXCLUDE', deadlineStatus: 'CLOSED_BY_DEADLINE' }, ['fixture-3', 'fixture-4']],
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
  // The deadline state is a different vocabulary from the assessment status, so a value of the
  // other filter is not silently accepted here.
  it.each(['OPEN', 'CLOSED', 'UNKNOWN', 'MATCH', 'OPEN_BY_DEADLINE CLOSED_BY_DEADLINE'])(
    'rejects invalid deadline status %s',
    async (deadlineStatus) => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/lots')
        .query({ deadlineStatus })
        .expect(400);
      expect(response.body).toEqual({ statusCode: 400, message: 'Invalid deadlineStatus' });
    },
  );
  it('rejects an unknown operator action status', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/lots?actionStatus=UNKNOWN')
      .expect(400);
    expect(response.body).toEqual({ statusCode: 400, message: 'Invalid actionStatus' });
  });

  it('rejects repeated filters', async () => {
    await request(app.getHttpServer()).get('/api/v1/lots?q=a&q=b').expect(400);
    await request(app.getHttpServer()).get('/api/v1/lots?status=MATCH&status=REVIEW').expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/lots?deadlineStatus=OPEN_BY_DEADLINE&deadlineStatus=DEADLINE_UNKNOWN')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/lots?actionStatus=TAKE&actionStatus=SKIP')
      .expect(400);
  });
  it('returns 404 for unknown ids', async () => {
    await request(app.getHttpServer()).get('/api/v1/lots/unknown').expect(404);
  });
});
