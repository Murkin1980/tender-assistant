import {
  GOSZAKUP_PROBE_LIMIT,
  GOSZAKUP_TOKEN_ENV_NAME,
  runGoszakupProbe,
} from '../src/probe/goszakup.probe';
import { OK_RESPONSE } from './fixtures/goszakup-lots.fixture';

const TOKEN = 'probe-test-token-do-not-print';

interface FetchCall {
  url: string;
  init: RequestInit;
}

let logged: string[] = [];
let fetchCalls: FetchCall[] = [];
const originalFetch = globalThis.fetch;
const originalToken = process.env[GOSZAKUP_TOKEN_ENV_NAME];
const originalExitCode = process.exitCode;

function captureLogs(): void {
  logged = [];
  jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logged.push(args.map((arg) => String(arg)).join(' '));
  });
}

function stubFetch(respond: () => Response): void {
  fetchCalls = [];
  const mocked = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(input), init: init ?? {} });
    return respond();
  });
  globalThis.fetch = mocked as unknown as typeof fetch;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

describe('runGoszakupProbe', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
    if (originalToken === undefined) delete process.env[GOSZAKUP_TOKEN_ENV_NAME];
    else process.env[GOSZAKUP_TOKEN_ENV_NAME] = originalToken;
    process.exitCode = originalExitCode;
  });

  it('reports NOT RUN without a token and never calls the registry', async () => {
    delete process.env[GOSZAKUP_TOKEN_ENV_NAME];
    stubFetch(() => json({}));
    captureLogs();

    const result = await runGoszakupProbe();

    expect(result.status).toBe('SKIPPED');
    expect(result.exitCode).toBe(2);
    expect(result.lines.join('\n')).toContain('NOT RUN');
    expect(fetchCalls).toHaveLength(0);
    expect(logged.join('\n')).not.toContain(TOKEN);
  });

  it('reads a bounded page, proves normalization and prints no secret', async () => {
    process.env[GOSZAKUP_TOKEN_ENV_NAME] = TOKEN;
    stubFetch(() => json(OK_RESPONSE));
    captureLogs();

    const result = await runGoszakupProbe();

    expect(result.status).toBe('PASS');
    expect(result.exitCode).toBe(0);
    expect(fetchCalls).toHaveLength(1);

    const request = JSON.parse(String(fetchCalls[0]?.init.body)) as {
      variables: { limit: number };
    };
    expect(request.variables.limit).toBe(GOSZAKUP_PROBE_LIMIT);

    const output = [...result.lines, ...logged].join('\n');
    expect(output).toContain('2 normalized lot(s)');
    expect(output).toContain('goszakup:900000001');
    expect(output).toContain('Read-only probe');
    expect(output).not.toContain(TOKEN);
    expect(output).not.toContain('Authorization');
  });

  it('accepts an empty page as a successful read', async () => {
    process.env[GOSZAKUP_TOKEN_ENV_NAME] = TOKEN;
    stubFetch(() => json({ data: { Lots: [] } }));
    captureLogs();

    const result = await runGoszakupProbe();

    expect(result.status).toBe('PASS');
    expect(result.lines.join('\n')).toContain('0 normalized lot(s)');
    expect(result.lines.join('\n')).not.toContain('First normalized lot');
  });

  it('reports an upstream failure without leaking the token', async () => {
    process.env[GOSZAKUP_TOKEN_ENV_NAME] = TOKEN;
    stubFetch(() => json({ errors: [{ message: TOKEN }] }, 401));
    captureLogs();

    const result = await runGoszakupProbe();

    expect(result.status).toBe('FAILED');
    expect(result.exitCode).toBe(1);

    const output = [...result.lines, ...logged].join('\n');
    expect(output).toContain('Goszakup probe failed');
    expect(output).toContain('HTTP 401');
    expect(output).not.toContain(TOKEN);
  });
});
