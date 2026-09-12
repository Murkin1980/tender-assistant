import { NextResponse } from 'next/server';

const UPSTREAM_TIMEOUT_MS = 3_000;
const UPSTREAM_HEALTH_PATH = '/api/v1/health';
const UPSTREAM_SERVICE = 'tender-assistant-backend';
const PROXY_SERVICE = 'tender-assistant-frontend-proxy';
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

type UpstreamHealthResponse = {
  status: 'ok';
  service: typeof UPSTREAM_SERVICE;
  timestamp: string;
};

type ProxyUnavailableResponse = {
  status: 'unavailable';
  service: typeof PROXY_SERVICE;
  timestamp: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const parsedTimestamp = Date.parse(value);

  return Number.isFinite(parsedTimestamp) && new Date(parsedTimestamp).toISOString() === value;
}

function isUpstreamHealthResponse(value: unknown): value is UpstreamHealthResponse {
  return (
    isRecord(value) &&
    value.status === 'ok' &&
    value.service === UPSTREAM_SERVICE &&
    isIsoTimestamp(value.timestamp)
  );
}

function unavailableResponse(status: 502 | 503): NextResponse<ProxyUnavailableResponse> {
  return NextResponse.json(
    {
      status: 'unavailable',
      service: PROXY_SERVICE,
      timestamp: new Date().toISOString(),
    },
    { headers: NO_STORE_HEADERS, status },
  );
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<
  NextResponse<UpstreamHealthResponse | ProxyUnavailableResponse>
> {
  const backendInternalUrl = (process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(`${backendInternalUrl}${UPSTREAM_HEALTH_PATH}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!upstreamResponse.ok) {
      return unavailableResponse(502);
    }

    let payload: unknown;

    try {
      payload = await upstreamResponse.json();
    } catch {
      return unavailableResponse(502);
    }

    if (!isUpstreamHealthResponse(payload)) {
      return unavailableResponse(502);
    }

    return NextResponse.json(payload, { headers: NO_STORE_HEADERS, status: 200 });
  } catch {
    return unavailableResponse(503);
  } finally {
    clearTimeout(timeout);
  }
}
