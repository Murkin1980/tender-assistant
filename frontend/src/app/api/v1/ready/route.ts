import { NextResponse } from 'next/server';

import { fetchBackend } from '../../../../lib/backend';

const UPSTREAM_TIMEOUT_MS = 3_000;
const UPSTREAM_READY_PATH = '/api/v1/ready';
const UPSTREAM_SERVICE = 'tender-assistant-backend';
const PROXY_SERVICE = 'tender-assistant-frontend-proxy';
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

type UpstreamReadinessResponse = {
  status: 'ready';
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
  if (typeof value !== 'string') return false;
  const parsedTimestamp = Date.parse(value);
  return Number.isFinite(parsedTimestamp) && new Date(parsedTimestamp).toISOString() === value;
}

function isUpstreamReadinessResponse(value: unknown): value is UpstreamReadinessResponse {
  return (
    isRecord(value) &&
    value.status === 'ready' &&
    value.service === UPSTREAM_SERVICE &&
    isIsoTimestamp(value.timestamp)
  );
}

function unavailableResponse(): NextResponse<ProxyUnavailableResponse> {
  return NextResponse.json(
    {
      status: 'unavailable',
      service: PROXY_SERVICE,
      timestamp: new Date().toISOString(),
    },
    { headers: NO_STORE_HEADERS, status: 503 },
  );
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<
  NextResponse<UpstreamReadinessResponse | ProxyUnavailableResponse>
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetchBackend(UPSTREAM_READY_PATH, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!upstreamResponse.ok) return unavailableResponse();

    let payload: unknown;
    try {
      payload = await upstreamResponse.json();
    } catch {
      return unavailableResponse();
    }
    if (!isUpstreamReadinessResponse(payload)) return unavailableResponse();

    return NextResponse.json(payload, { headers: NO_STORE_HEADERS, status: 200 });
  } catch {
    return unavailableResponse();
  } finally {
    clearTimeout(timeout);
  }
}
