/** Public list/detail contract. Amounts are in KZT, deadlines are ISO-8601. */
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

export interface LotFilters {
  q?: string;
  maxAmount?: number;
  region?: string;
  district?: string;
}
