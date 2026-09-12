import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createApp } from '../src/app';

const allowedOrigin = 'http://localhost:3001';
const secondAllowedOrigin = 'https://admin.example.com';
const originalCorsOrigin = process.env.CORS_ORIGIN;

describe('Health endpoint and CORS', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.CORS_ORIGIN = `${allowedOrigin}, ${secondAllowedOrigin}`;
    app = await createApp({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();

    if (originalCorsOrigin === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = originalCorsOrigin;
    }
  });

  it('GET /api/v1/health returns a safe health payload', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'tender-assistant-backend',
      timestamp: expect.any(String),
    });
  });

  it('returns Access-Control-Allow-Origin for an origin in the allowlist', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', allowedOrigin)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
  });

  it('does not return an allow CORS header for an unapproved origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://untrusted.example.com')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('supports multiple configured origins', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', secondAllowedOrigin)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(secondAllowedOrigin);
  });
});
