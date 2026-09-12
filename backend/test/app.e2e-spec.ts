import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createApp } from '../src/app';

describe('Health endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns a safe health payload', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'tender-assistant-backend',
      timestamp: expect.any(String),
    });
  });
});
