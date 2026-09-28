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

/**
 * CP-07 deterministic triage outcome. `REVIEW` is the explicit "not decided" state: the lot is
 * neither excluded by a hard rule nor supported by positive target evidence.
 */
export type LotAssessmentStatus = 'MATCH' | 'REVIEW' | 'EXCLUDE';

/**
 * Derived, human-readable pre-selection of one normalized lot against the current business
 * profile. Reasons are short, stable statements about the rules that fired — never a regex,
 * an internal code, a raw KATO value or any other implementation detail.
 */
export interface LotAssessment {
  status: LotAssessmentStatus;
  reasons: string[];
}

/** Public lot response: the normalized lot plus its server-derived assessment. */
export interface AssessedLot extends Lot {
  assessment: LotAssessment;
}

export interface LotFilters {
  q?: string;
  maxAmount?: number;
  region?: string;
  district?: string;
  /** Public-only filter: applied after assessment, never pushed to a source. */
  status?: LotAssessmentStatus;
}
