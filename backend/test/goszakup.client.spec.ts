import {
  GoszakupClient,
  GoszakupUpstreamError,
} from '../src/modules/tender/goszakup/goszakup.client';
import {
  DEFAULT_GOSZAKUP_GRAPHQL_URL,
  DEFAULT_GOSZAKUP_TIMEOUT_MS,
  GOSZAKUP_MAX_LIMIT,
  GOSZAKUP_MIN_LIMIT,
} from '../src/modules/tender/goszakup/goszakup.config';
import { GOSZAKUP_LOTS_QUERY } from '../src/modules/tender/goszakup/goszakup-lots.query';
import {
  FULL_LOT,
  GRAPHQL_ERROR_RESPONSE,
  MINIMAL_LOT,
  OK_RESPONSE,
} from './fixtures/goszakup-lots.fixture';

const TOKEN = 'test-ows-token-do-not-log';

type FetchCall = { url: string; init: RequestInit };

let fetchCalls: FetchCall[] = [];
const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(implementation: () => Promise<Response>): void {
  const mocked = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestInit = init ?? {};
    fetchCalls.push({ url: String(input), init: requestInit });
    return implementation();
  });
  globalThis.fetch = mocked as unknown as typeof fetch;
}

/** Runs the call and returns the thrown upstream error, asserting its type. */
async function captureUpstreamError(promise: Promise<unknown>): Promise<GoszakupUpstreamError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(GoszakupUpstreamError);
    return error as GoszakupUpstreamError;
  }
  throw new Error('Expected the Goszakup call to fail');
}

describe('GoszakupClient', () => {
  beforeEach(() => {
    fetchCalls = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const buildClient = (
    overrides: Partial<ConstructorParameters<typeof GoszakupClient>[0]> = {},
  ): GoszakupClient => new GoszakupClient({ token: TOKEN, ...overrides });

  it('posts one bounded read-only Lots query to the official v3 endpoint with the bearer token', async () => {
    stubFetch(async () => jsonResponse(OK_RESPONSE));

    const lots = await buildClient().fetchLots({
      limit: 5,
      filter: { nameDescriptionRu: 'ЛДСП' },
    });

    expect(lots).toEqual([FULL_LOT, MINIMAL_LOT]);
    expect(fetchCalls).toHaveLength(1);

    const call = fetchCalls[0];
    expect(call?.url).toBe(DEFAULT_GOSZAKUP_GRAPHQL_URL);
    expect(call?.init.method).toBe('POST');
    expect(call?.init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    });
    expect(JSON.parse(String(call?.init.body))).toEqual({
      query: GOSZAKUP_LOTS_QUERY,
      variables: { filter: { nameDescriptionRu: 'ЛДСП' }, limit: 5 },
    });
    // A hard bound is attached to every request so a slow registry cannot hang the process.
    expect(call?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('defaults the filter to null and never sends a write operation', async () => {
    stubFetch(async () => jsonResponse({ data: { Lots: [] } }));

    await buildClient().fetchLots({ limit: 10 });

    const body = JSON.parse(String(fetchCalls[0]?.init.body)) as {
      query: string;
      variables: { filter: unknown; limit: number };
    };
    expect(body.variables).toEqual({ filter: null, limit: 10 });
    expect(body.query).not.toMatch(/mutation|subscription/i);
  });

  it('rejects a limit outside the documented 1..200 page bound', async () => {
    stubFetch(async () => jsonResponse(OK_RESPONSE));
    const client = buildClient();

    for (const limit of [0, -1, 1.5, GOSZAKUP_MAX_LIMIT + 1, Number.NaN]) {
      const error = await captureUpstreamError(client.fetchLots({ limit }));
      expect(error.message).toContain(`between ${GOSZAKUP_MIN_LIMIT} and ${GOSZAKUP_MAX_LIMIT}`);
      expect(error.reason).toBe('protocol');
    }
    expect(fetchCalls).toHaveLength(0);
  });

  it('refuses a non-https endpoint or a non-positive timeout before any request', () => {
    stubFetch(async () => jsonResponse(OK_RESPONSE));

    const cases: Array<[ConstructorParameters<typeof GoszakupClient>[0], string]> = [
      [{ token: TOKEN, graphqlUrl: 'ows.goszakup.gov.kz' }, 'not a valid URL'],
      [{ token: TOKEN, graphqlUrl: 'http://ows.goszakup.gov.kz/v3/graphql' }, 'must use https'],
      [{ token: TOKEN, timeoutMs: 0 }, 'positive integer of milliseconds'],
    ];

    for (const [options, expected] of cases) {
      expect(() => new GoszakupClient(options)).toThrow(expected);
    }
    expect(fetchCalls).toHaveLength(0);
  });

  it('rejects a call without a token instead of calling the registry anonymously', async () => {
    stubFetch(async () => jsonResponse(OK_RESPONSE));
    const client = new GoszakupClient({ token: '   ' });

    const error = await captureUpstreamError(client.fetchLots({ limit: 5 }));

    expect(error.message).toBe(
      'GOSZAKUP_TOKEN is not configured; set it in the backend environment',
    );
    expect(fetchCalls).toHaveLength(0);
  });

  it('constructs without a token so the API can boot and keep serving fixture lots', () => {
    expect(() => new GoszakupClient({ token: '' })).not.toThrow();
  });

  it('treats a GraphQL errors payload as a failure even with HTTP 200', async () => {
    stubFetch(async () => jsonResponse(GRAPHQL_ERROR_RESPONSE));

    const error = await captureUpstreamError(buildClient().fetchLots({ limit: 5 }));

    expect(error.reason).toBe('graphql');
    expect(error.status).toBe(200);
    expect(error.message).toContain('Cannot query field "totalSum" on type "Lots".');
    expect(error.message).not.toContain(TOKEN);
  });

  it('reports a non-2xx upstream response with its status', async () => {
    // 401 is the documented OWS response for a missing or unauthorized token.
    stubFetch(async () => jsonResponse({ errors: [{ message: TOKEN }] }, 401));

    const error = await captureUpstreamError(buildClient().fetchLots({ limit: 5 }));

    expect(error.reason).toBe('http');
    expect(error.status).toBe(401);
    expect(error.message).toBe('Goszakup responded with HTTP 401');
    expect(error.message).not.toContain(TOKEN);
  });

  it('reports a transport failure without echoing the token from the error text', async () => {
    stubFetch(async () => {
      throw new Error(`connect ECONNREFUSED while calling with ${TOKEN}`);
    });

    const error = await captureUpstreamError(buildClient().fetchLots({ limit: 5 }));

    expect(error.reason).toBe('network');
    expect(error.status).toBeNull();
    expect(error.message).toBe(
      'Goszakup request failed: connect ECONNREFUSED while calling with [REDACTED]',
    );
    expect(error.message).not.toContain(TOKEN);
    expect(error.stack ?? '').not.toContain(TOKEN);
  });

  it('reports an aborted (timed out) request as a timeout', async () => {
    stubFetch(async () => {
      const timeout = new Error('The operation was aborted due to timeout');
      timeout.name = 'TimeoutError';
      throw timeout;
    });

    const error = await captureUpstreamError(buildClient().fetchLots({ limit: 5 }));

    expect(error.reason).toBe('timeout');
    expect(error.message).toBe(`Goszakup request timed out after ${DEFAULT_GOSZAKUP_TIMEOUT_MS}ms`);
    expect(error.message).not.toContain(TOKEN);
  });

  it('rejects a payload without a Lots list', async () => {
    stubFetch(async () => jsonResponse({ data: {} }));

    const error = await captureUpstreamError(buildClient().fetchLots({ limit: 5 }));

    expect(error.reason).toBe('protocol');
    expect(error.message).toBe('Goszakup response does not contain a Lots list');
  });

  it('rejects a body that is not a JSON object', async () => {
    stubFetch(async () => new Response('<html>gateway</html>', { status: 200 }));

    const error = await captureUpstreamError(buildClient().fetchLots({ limit: 5 }));

    expect(error.reason).toBe('protocol');
    expect(error.message).toBe('Goszakup response is not a JSON object');
  });
});
