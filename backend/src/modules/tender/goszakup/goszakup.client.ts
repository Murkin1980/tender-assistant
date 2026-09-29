import {
  DEFAULT_GOSZAKUP_GRAPHQL_URL,
  DEFAULT_GOSZAKUP_TIMEOUT_MS,
  GOSZAKUP_MAX_LIMIT,
  GOSZAKUP_MIN_LIMIT,
} from './goszakup.config';
import {
  GOSZAKUP_LOTS_QUERY,
  type GoszakupLotDto,
  type GoszakupLotsFilter,
} from './goszakup-lots.query';

export interface GoszakupClientOptions {
  /** Official OWS v3 GraphQL endpoint unless a deployment overrides it. */
  graphqlUrl?: string;
  /** Bearer token. Backend environment only — never logged, never sent to a browser. */
  token: string;
  /** Hard bound for one upstream request. */
  timeoutMs?: number;
}

/**
 * Any failure of one upstream call: transport error, timeout, non-2xx status,
 * unparsable body or a GraphQL `errors` payload returned with HTTP 200.
 *
 * Messages are pre-redacted: the bearer token is replaced before it can reach a log,
 * an HTTP response or a stack trace.
 */
export class GoszakupUpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly reason: 'network' | 'timeout' | 'http' | 'protocol' | 'graphql',
  ) {
    super(message);
    this.name = 'GoszakupUpstreamError';
  }
}

function redact(text: string, token: string): string {
  return token ? text.split(token).join('[REDACTED]') : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Read-only OWS v3 client. Uses the Node 22 built-in fetch; no extra dependency, no retries. */
export class GoszakupClient {
  private readonly graphqlUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(options: GoszakupClientOptions) {
    let url: URL;
    try {
      url = new URL(options.graphqlUrl?.trim() || DEFAULT_GOSZAKUP_GRAPHQL_URL);
    } catch {
      throw new GoszakupUpstreamError('GOSZAKUP_GRAPHQL_URL is not a valid URL', null, 'protocol');
    }
    if (url.protocol !== 'https:') {
      throw new GoszakupUpstreamError(
        'GOSZAKUP_GRAPHQL_URL must use https so the bearer token is not sent in clear text',
        null,
        'protocol',
      );
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_GOSZAKUP_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new GoszakupUpstreamError(
        'Goszakup request timeout must be a positive integer of milliseconds',
        null,
        'protocol',
      );
    }

    this.graphqlUrl = url.toString();
    this.token = options.token.trim();
    this.timeoutMs = timeoutMs;
  }

  /**
   * One bounded page of the lot registry (`Query.Lots`).
   *
   * @throws {GoszakupUpstreamError} on transport, timeout, HTTP or GraphQL failure.
   */
  async fetchLots(options: {
    limit: number;
    filter?: GoszakupLotsFilter;
    query?: string;
  }): Promise<GoszakupLotDto[]> {
    // The token is validated per call, not at construction: the backend must boot and keep serving
    // fixture lots when no OWS token is configured.
    if (!this.token) {
      throw new GoszakupUpstreamError(
        'GOSZAKUP_TOKEN is not configured; set it in the backend environment',
        null,
        'protocol',
      );
    }

    const limit = options.limit;
    if (!Number.isInteger(limit) || limit < GOSZAKUP_MIN_LIMIT || limit > GOSZAKUP_MAX_LIMIT) {
      throw new GoszakupUpstreamError(
        `Goszakup lot limit must be an integer between ${GOSZAKUP_MIN_LIMIT} and ${GOSZAKUP_MAX_LIMIT}`,
        null,
        'protocol',
      );
    }

    const body = JSON.stringify({
      query: options.query ?? GOSZAKUP_LOTS_QUERY,
      variables: { filter: options.filter ?? null, limit },
    });

    let response: Response;
    try {
      response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new GoszakupUpstreamError(
          `Goszakup request timed out after ${this.timeoutMs}ms`,
          null,
          'timeout',
        );
      }
      throw new GoszakupUpstreamError(
        redact(`Goszakup request failed: ${describeError(error)}`, this.token),
        null,
        'network',
      );
    }

    if (!response.ok) {
      // 401 is the documented response for a missing/unauthorized OWS token.
      throw new GoszakupUpstreamError(
        `Goszakup responded with HTTP ${response.status}`,
        response.status,
        'http',
      );
    }

    const payload: unknown = await response.json().catch(() => null);
    if (!isRecord(payload)) {
      throw new GoszakupUpstreamError(
        'Goszakup response is not a JSON object',
        response.status,
        'protocol',
      );
    }

    const graphQlErrors = payload.errors;
    if (Array.isArray(graphQlErrors) && graphQlErrors.length > 0) {
      const details = graphQlErrors
        .map((item) => (isRecord(item) && typeof item.message === 'string' ? item.message : ''))
        .filter((message) => message.length > 0)
        .join('; ');
      throw new GoszakupUpstreamError(
        redact(`Goszakup returned GraphQL errors${details ? `: ${details}` : ''}`, this.token),
        response.status,
        'graphql',
      );
    }

    const data = payload.data;
    if (!isRecord(data) || !Array.isArray(data.Lots)) {
      throw new GoszakupUpstreamError(
        'Goszakup response does not contain a Lots list',
        response.status,
        'protocol',
      );
    }

    return data.Lots as GoszakupLotDto[];
  }
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
