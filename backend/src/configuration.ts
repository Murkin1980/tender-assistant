import {
  DEFAULT_GOSZAKUP_GRAPHQL_URL,
  DEFAULT_GOSZAKUP_TIMEOUT_MS,
} from './modules/tender/goszakup/goszakup.config';

const DEFAULT_PORT = 3000;
const DEFAULT_CORS_ORIGIN = 'http://localhost:3001';

function parsePort(value: string | undefined): number {
  const port = Number(value ?? DEFAULT_PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

function parseCorsOrigins(value: string | undefined): string[] {
  const origins = (value ?? DEFAULT_CORS_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    throw new Error('CORS_ORIGIN must contain at least one origin');
  }

  return origins;
}

function parseGoszakupGraphqlUrl(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) return DEFAULT_GOSZAKUP_GRAPHQL_URL;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('GOSZAKUP_GRAPHQL_URL must be a valid absolute URL');
  }

  if (url.protocol !== 'https:') {
    throw new Error('GOSZAKUP_GRAPHQL_URL must use https');
  }

  return url.toString();
}

function parseGoszakupTimeoutMs(value: string | undefined): number {
  const raw = value?.trim();
  if (!raw) return DEFAULT_GOSZAKUP_TIMEOUT_MS;

  const timeoutMs = Number(raw);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('GOSZAKUP_TIMEOUT_MS must be a positive integer of milliseconds');
  }

  return timeoutMs;
}

export interface GoszakupConfig {
  graphqlUrl: string;
  timeoutMs: number;
  /**
   * Optional read-only OWS v3 bearer token. Empty means "no live access"; the backend still
   * starts and serves fixture lots. It is read from the environment only and is never part of
   * any API response.
   */
  token: string;
}

export default function configuration(): {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  goszakup: GoszakupConfig;
} {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parsePort(process.env.PORT),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
    goszakup: {
      graphqlUrl: parseGoszakupGraphqlUrl(process.env.GOSZAKUP_GRAPHQL_URL),
      timeoutMs: parseGoszakupTimeoutMs(process.env.GOSZAKUP_TIMEOUT_MS),
      token: process.env.GOSZAKUP_TOKEN?.trim() ?? '',
    },
  };
}
