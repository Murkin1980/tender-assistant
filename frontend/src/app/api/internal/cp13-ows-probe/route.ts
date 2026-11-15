import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';

import { fetchBackend } from '../../../../lib/backend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ProbeEnv = { DIAGNOSTIC_PROBE_KEY?: string };

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { env } = await getCloudflareContext({ async: true });
  const expected = (env as ProbeEnv).DIAGNOSTIC_PROBE_KEY;
  const supplied = request.headers.get('x-cp13-probe-key');
  if (!expected || !supplied || supplied !== expected) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const response = await fetchBackend('/api/v1/lots/__diagnostic/ows', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(50_000),
  });
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
