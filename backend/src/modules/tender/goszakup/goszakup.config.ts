/** Official OWS v3 GraphQL endpoint (https://ows.goszakup.gov.kz/help/v3/schema/). */
export const DEFAULT_GOSZAKUP_GRAPHQL_URL = 'https://ows.goszakup.gov.kz/v3/graphql';

/** Public lot registry URL used for `sourceUrl`. */
export const GOSZAKUP_LOT_URL_BASE = 'https://goszakup.gov.kz/ru/view/lots/index';

/** One bounded upstream request. */
export const DEFAULT_GOSZAKUP_TIMEOUT_MS = 15_000;

/** `Query.Lots(limit)` accepts 0..200 records per page; the adapter stays bounded. */
export const GOSZAKUP_MIN_LIMIT = 1;
export const GOSZAKUP_MAX_LIMIT = 200;

/** Value written to `Lot.source` for every normalized Goszakup lot. */
export const GOSZAKUP_SOURCE = 'goszakup';

/** Prefix that keeps upstream ids stable and unique next to other sources. */
export const GOSZAKUP_ID_PREFIX = 'goszakup:';
