import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../src/app/api/v1/health/route';

const configuredBackendUrl = 'http://configured-backend:4000/';
const originalBackendInternalUrl = process.env.BACKEND_INTERNAL_URL;
const fetchMock = vi.fn<typeof fetch>();

function restoreBackendUrl(): void {
  if (originalBackendInternalUrl === undefined) {
    delete process.env.BACKEND_INTERNAL_URL;
    return;
  }

  process.env.BACKEND_INTERNAL_URL = originalBackendInternalUrl;
}

describe('GET /api/v1/health proxy route', () => {
  beforeEach(() => {
    process.env.BACKEND_INTERNAL_URL = configuredBackendUrl;
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    restoreBackendUrl();
    vi.unstubAllGlobals();
  });

  it('returns the configured upstream health JSON when upstream is available', async () => {
    const upstreamPayload = {
      status: 'ok',
      service: 'tender-assistant-backend',
      timestamp: '2026-09-13T00:00:00.000Z',
    } as const;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(upstreamPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(upstreamPayload);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://configured-backend:4000/api/v1/health',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('returns a safe 503 response when upstream is unavailable', async () => {
    fetchMock.mockRejectedValueOnce(
      new Error('connect ECONNREFUSED http://configured-backend:4000'),
    );

    const response = await GET();
    const responseBody = await response.json();

    expect(response.status).toBe(503);
    expect(responseBody).toMatchObject({
      status: 'unavailable',
      service: 'tender-assistant-frontend-proxy',
    });
    expect(JSON.stringify(responseBody)).not.toContain('configured-backend');
    expect(JSON.stringify(responseBody)).not.toContain('ECONNREFUSED');
  });

  it('returns a safe 502 response for an invalid health payload and timestamp', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'ok',
          service: 'tender-assistant-backend',
          timestamp: 'not-an-iso-timestamp',
        }),
        { status: 200 },
      ),
    );

    const response = await GET();
    const responseBody = await response.json();

    expect(response.status).toBe(502);
    expect(responseBody).toMatchObject({
      status: 'unavailable',
      service: 'tender-assistant-frontend-proxy',
    });
    expect(JSON.stringify(responseBody)).not.toContain('not-an-iso-timestamp');
  });
});
