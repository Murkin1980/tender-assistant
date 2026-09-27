import {
  DEFAULT_GOSZAKUP_GRAPHQL_URL,
  DEFAULT_GOSZAKUP_TIMEOUT_MS,
} from './modules/tender/goszakup/goszakup.config';
import {
  DEFAULT_LOT_SOURCE_MODE,
  LOT_SOURCE_MODES,
  type LotSourceMode,
} from './modules/tender/lot.source';

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
   * Optional read-only OWS v3 bearer token. Empty means "no live access"; when the live source is
   * selected such a request fails safely instead of falling back to fixtures. It is read from the
   * environment only and is never part of any API response.
   */
  token: string;
}

/**
 * Source of the public `/lots` data path. Only this backend value decides it: a browser cannot
 * switch the source with a query parameter.
 */
function parseLotSourceMode(value: string | undefined): LotSourceMode {
  const raw = value?.trim();
  if (!raw) return DEFAULT_LOT_SOURCE_MODE;

  const mode = LOT_SOURCE_MODES.find((candidate) => candidate === raw);
  if (!mode) {
    throw new Error(`TENDER_LOT_SOURCE must be one of: ${LOT_SOURCE_MODES.join(' | ')}`);
  }

  return mode;
}

export default function configuration(): {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  lotSourceMode: LotSourceMode;
  goszakup: GoszakupConfig;
} {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parsePort(process.env.PORT),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
    lotSourceMode: parseLotSourceMode(process.env.TENDER_LOT_SOURCE),
    goszakup: {
      graphqlUrl: parseGoszakupGraphqlUrl(process.env.GOSZAKUP_GRAPHQL_URL),
      timeoutMs: parseGoszakupTimeoutMs(process.env.GOSZAKUP_TIMEOUT_MS),
      token: process.env.GOSZAKUP_TOKEN?.trim() ?? '',
    },
  };
}
