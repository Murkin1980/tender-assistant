/** Status values of the CP-07 assessment filter, as the select offers them. */
export const lotAssessmentStatuses = ['MATCH', 'REVIEW', 'EXCLUDE'] as const;

export type LotAssessmentStatus = (typeof lotAssessmentStatuses)[number];

/**
 * Mirrors the backend CP-07 assessment. The status and its reasons are produced server-side
 * from the normalized lot; the frontend only displays them and never re-derives them.
 */
export interface LotAssessment {
  status: LotAssessmentStatus;
  reasons: string[];
}

/** Mirrors the backend public JSON contract; no fixture data is shipped to the frontend. */
export interface Lot {
  id: string;
  source: string;
  sourceUrl: string;
  title: string;
  customer: string;
  amount: number;
  region: string;
  district: string | null;
  bidDeadline: string;
  description: string;
  assessment: LotAssessment;
}

export type SearchParams = Record<string, string | string[] | undefined>;

/** Mirrors `GET /api/v1/lots/source`; it carries no token and no backend configuration. */
export interface LotSourceStatus {
  mode: string;
  live: boolean;
  label: string;
}

function isLotSourceStatus(value: unknown): value is LotSourceStatus {
  return (
    typeof value === 'object' &&
    value !== null &&
    'mode' in value &&
    typeof value.mode === 'string' &&
    'live' in value &&
    typeof value.live === 'boolean' &&
    'label' in value &&
    typeof value.label === 'string'
  );
}

const isAssessmentStatus = (value: string): value is LotAssessmentStatus =>
  (lotAssessmentStatuses as readonly string[]).includes(value);

export function lotQuery(params: SearchParams): URLSearchParams {
  const query = new URLSearchParams();
  for (const key of ['q', 'maxAmount', 'region', 'district']) {
    const value = params[key];
    if (typeof value === 'string' && value.trim()) query.set(key, value.trim());
  }
  // An unknown status is dropped rather than forwarded as a filter the backend would reject.
  const status = params.status;
  if (typeof status === 'string') {
    const candidate = status.trim().toUpperCase();
    if (isAssessmentStatus(candidate)) query.set('status', candidate);
  }
  return query;
}

/** Only called by server pages: the internal backend URL never reaches the browser. */
export async function fetchLotsApi(path: string): Promise<Response> {
  const base = (process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return fetch(`${base}/api/v1/lots${path}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(3000),
  });
}

/**
 * Active source of the list/detail pages.
 *
 * @returns the status, or `null` when it cannot be read — the pages then make no claim about the
 *          origin of the data instead of guessing.
 */
export async function fetchLotSourceStatus(): Promise<LotSourceStatus | null> {
  try {
    const response = await fetchLotsApi('/source');
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return isLotSourceStatus(payload) ? payload : null;
  } catch {
    return null;
  }
}

export const amountLabel = (amount: number): string =>
  `${new Intl.NumberFormat('ru-RU').format(amount)} KZT`;

export const deadlineLabel = (deadline: string): string =>
  new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Almaty',
  }).format(new Date(deadline));
