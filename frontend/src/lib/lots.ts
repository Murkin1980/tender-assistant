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
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function lotQuery(params: SearchParams): URLSearchParams {
  const query = new URLSearchParams();
  for (const key of ['q', 'maxAmount', 'region', 'district']) {
    const value = params[key];
    if (typeof value === 'string' && value.trim()) query.set(key, value.trim());
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

export const amountLabel = (amount: number): string =>
  `${new Intl.NumberFormat('ru-RU').format(amount)} KZT`;

export const deadlineLabel = (deadline: string): string =>
  new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Almaty',
  }).format(new Date(deadline));
