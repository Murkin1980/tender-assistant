import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../src/app/api/v1/ready/route';

const configuredBackendUrl = 'http://configured-backend:4000/';
const TOKEN = 'readiness-token-must-not-leak';
const originalBackendInternalUrl = process.env.BACKEND_INTERNAL_URL;
const fetchMock = vi.fn<typeof fetch>();

function restoreBackendUrl(): void {
  if (originalBackendInternalUrl === undefined) {
    delete process.env.BACKEND_INTERNAL_URL;
    return;
  }
  process.env.BACKEND_INTERNAL_URL = originalBackendInternalUrl;
}

describe('GET /api/v1/ready proxy route', () => {
  beforeEach(() => {
    process.env.BACKEND_INTERNAL_URL = configuredBackendUrl;
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    restoreBackendUrl();
    vi.unstubAllGlobals();
  });

  it('returns secret-free readiness JSON from the configured backend', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'ready',
          service: 'tender-assistant-backend',
          timestamp: '2026-10-15T00:00:00.000Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({
      status: 'ready',
      service: 'tender-assistant-backend',
      timestamp: '2026-10-15T00:00:00.000Z',
    });
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://configured-backend:4000/api/v1/ready',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('returns a generic unavailable response when the live backend is not ready', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ statusCode: 503, message: `missing ${TOKEN}` }), {
        status: 503,
      }),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      status: 'unavailable',
      service: 'tender-assistant-frontend-proxy',
    });
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    expect(JSON.stringify(body)).not.toContain('configured-backend');
  });

  it('returns a generic unavailable response when the backend cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new Error(`connection failed ${TOKEN}`));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });
});
