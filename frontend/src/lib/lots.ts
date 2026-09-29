/** Status values of the CP-07 assessment filter, as the select offers them. */
export const lotAssessmentStatuses = ['MATCH', 'REVIEW', 'EXCLUDE'] as const;

export type LotAssessmentStatus = (typeof lotAssessmentStatuses)[number];

/** Status values of the CP-09 deadline filter, in the order the select offers them. */
export const lotTimingStatuses = [
  'OPEN_BY_DEADLINE',
  'DEADLINE_UNKNOWN',
  'CLOSED_BY_DEADLINE',
] as const;

export type LotTimingStatus = (typeof lotTimingStatuses)[number];

export const lotActionStatuses = ['TAKE', 'REVIEW', 'SKIP'] as const;
export type LotActionStatus = (typeof lotActionStatuses)[number];

/**
 * Mirrors the backend CP-07 assessment. The status and its reasons are produced server-side
 * from the normalized lot; the frontend only displays them and never re-derives them.
 */
export interface LotAssessment {
  status: LotAssessmentStatus;
  reasons: string[];
}

/**
 * Mirrors the backend CP-09 timing contract. The deadline state is derived server-side from
 * the normalized `bidDeadline` only: it is a separate fact from the official procurement
 * status, and the frontend never recomputes it.
 */
export interface LotTiming {
  status: LotTimingStatus;
  deadline: string | null;
  remainingMinutes: number | null;
}

/**
 * Mirrors the backend CP-08 procurement metadata contract: source-backed fields whose missing
 * values are `null` and never fabricated placeholders.
 */
export interface LotProcurement {
  lotNumber: string | null;
  announcementNumber: string | null;
  customerBin: string | null;
  publishedAt: string | null;
  procurementMethod: string | null;
  officialStatus: string | null;
}

/**
 * CP-11 detail-only official procurement document contract.
 */
export interface LotDocument {
  id: string;
  name: string;
  type: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sourceUrl: string;
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
  procurement: LotProcurement;
  assessment: LotAssessment;
  timing: LotTiming;
  actionability: { status: LotActionStatus };
  documents?: LotDocument[];
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

const isTimingStatus = (value: string): value is LotTimingStatus =>
  (lotTimingStatuses as readonly string[]).includes(value);

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
  // An unknown deadline state is dropped the same way.
  const deadlineStatus = params.deadlineStatus;
  if (typeof deadlineStatus === 'string') {
    const candidate = deadlineStatus.trim().toUpperCase();
    if (isTimingStatus(candidate)) query.set('deadlineStatus', candidate);
  }
  const actionStatus = params.actionStatus;
  if (typeof actionStatus === 'string') {
    const candidate = actionStatus.trim().toUpperCase();
    if ((lotActionStatuses as readonly string[]).includes(candidate))
      query.set('actionStatus', candidate);
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

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/**
 * Concise remaining duration of a future deadline, in whole minutes.
 *
 * The value is server-derived and rendered once: there is no live countdown and no client-side
 * interval, so a page shows the duration that was valid when the server answered.
 */
function remainingLabel(remainingMinutes: number): string {
  const days = Math.floor(remainingMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((remainingMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const minutes = remainingMinutes % MINUTES_PER_HOUR;
  if (days > 0) return `${days} дн. ${hours} ч.`;
  if (hours > 0) return `${hours} ч. ${minutes} мин.`;
  return `${minutes} мин.`;
}

/**
 * Compact time state of one lot.
 *
 * The wording deliberately never claims that the tender or the application process is open:
 * only the deadline is in the future, which is not the official procurement status.
 */
export function timingLabel(timing: LotTiming): string {
  if (timing.status === 'OPEN_BY_DEADLINE') {
    return timing.remainingMinutes === null
      ? 'Срок открыт'
      : `Срок открыт · ${remainingLabel(timing.remainingMinutes)}`;
  }
  return timing.status === 'CLOSED_BY_DEADLINE' ? 'Срок истёк' : 'Срок не указан';
}
