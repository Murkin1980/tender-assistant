import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/app';
import { LOT_FIXTURES } from '../src/modules/tender/lots.fixtures';

/**
 * CP-04 guards for the source-adapter boundary:
 * the public API stays fixture-backed even when a live token is configured, and the
 * backend-only token can never reach a response.
 */
const TOKEN = 'e2e-secret-token-must-not-leak';

describe('Lots API with a configured Goszakup token', () => {
  let app: INestApplication;
  const originalToken = process.env.GOSZAKUP_TOKEN;
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    process.env.GOSZAKUP_TOKEN = TOKEN;
    // Any attempt to reach the registry from the request path would fail loudly.
    globalThis.fetch = jest.fn(async () => {
      throw new Error('The public API must not call Goszakup');
    }) as unknown as typeof fetch;

    app = await createApp({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GOSZAKUP_TOKEN;
    else process.env.GOSZAKUP_TOKEN = originalToken;
  });

  it('keeps /lots fixture-backed and free of the token', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/lots').expect(200);

    expect(response.body).toHaveLength(LOT_FIXTURES.length);
    expect(response.text).not.toContain(TOKEN);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('keeps /lots/:id fixture-backed and free of the token', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/lots/fixture-1').expect(200);

    expect(response.body.id).toBe('fixture-1');
    expect(response.text).not.toContain(TOKEN);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('does not expose the token through the health endpoint or response headers', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.text).not.toContain(TOKEN);
    expect(JSON.stringify(response.headers)).not.toContain(TOKEN);
  });
});
