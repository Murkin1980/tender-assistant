import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/app';
import type { Lot } from '../src/modules/tender/lot';

describe('Lots API', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp({ logger: false });
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('lists deterministic records and serves the same full detail contract', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/lots').expect(200);
    expect(list.body).toHaveLength(5);
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
    });
    const detail = await request(app.getHttpServer()).get(`/api/v1/lots/${lot.id}`).expect(200);
    expect(detail.body).toEqual(lot);
  });

  it.each([
    [{ maxAmount: '500000' }, ['fixture-1', 'fixture-2', 'fixture-4', 'fixture-5']],
    [{ maxAmount: '0' }, []],
    [{ region: ' Алматы ' }, ['fixture-1', 'fixture-2', 'fixture-3', 'fixture-5']],
    [{ district: 'алатауский' }, ['fixture-1', 'fixture-3', 'fixture-5']],
    [{ q: '  ламинированной ' }, ['fixture-1']],
    [{ q: 'БИБЛИОТЕКА' }, ['fixture-2']],
    [{ q: 'металлические' }, ['fixture-5']],
    [{ q: 'столы', region: 'Алматы', district: 'Алатауский', maxAmount: '500000' }, ['fixture-1']],
    [{ q: 'несуществующий' }, []],
    [{ region: 'Астана', district: 'Алатауский' }, []],
    [{ maxAmount: '', q: ' ' }, ['fixture-1', 'fixture-2', 'fixture-3', 'fixture-4', 'fixture-5']],
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
  it('rejects repeated filters', async () => {
    await request(app.getHttpServer()).get('/api/v1/lots?q=a&q=b').expect(400);
  });
  it('returns 404 for unknown ids', async () => {
    await request(app.getHttpServer()).get('/api/v1/lots/unknown').expect(404);
  });
});
