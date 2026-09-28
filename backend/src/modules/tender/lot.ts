/**
 * CP-08 additive, source-backed procurement metadata of one lot. Every value comes from a
 * documented official field of the upstream registry (or its documented reference directories);
 * anything the source does not provide stays `null` and is never fabricated.
 */
export interface LotProcurement {
  /** Official lot number inside the announcement. */
  lotNumber: string | null;
  /** Official announcement/procurement number. */
  announcementNumber: string | null;
  /** Customer BIN as a dedicated structured field. */
  customerBin: string | null;
  /** Publication date/time, ISO-8601. */
  publishedAt: string | null;
  /** Procurement method label from the official methods directory. */
  procurementMethod: string | null;
  /** Official announcement status label from the official statuses directory. */
  officialStatus: string | null;
}

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
  /** CP-08 decision metadata; always present as an object, missing values are `null`. */
  procurement: LotProcurement;
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

/**
 * CP-09 deadline-derived state of one lot. The names are intentionally explicit: a deadline in
 * the future never means the tender is officially open, so this is never called `OPEN`.
 */
export type LotTimingStatus = 'OPEN_BY_DEADLINE' | 'CLOSED_BY_DEADLINE' | 'DEADLINE_UNKNOWN';

/**
 * Additive CP-09 timing contract. It is derived from the normalized `bidDeadline` only — never
 * from an official status — and carries no human-readable phrase of its own.
 */
export interface LotTiming {
  status: LotTimingStatus;
  /** The valid normalized ISO-8601 deadline, otherwise `null`. */
  deadline: string | null;
  /** Whole minutes left, and only for `OPEN_BY_DEADLINE`; closed and unknown stay `null`. */
  remainingMinutes: number | null;
}

/** Public lot response: the normalized lot plus its server-derived assessment and timing. */
export interface AssessedLot extends Lot {
  assessment: LotAssessment;
  /** CP-09 deadline state, derived next to the assessment for every lot of every source. */
  timing: LotTiming;
}

export interface LotFilters {
  q?: string;
  maxAmount?: number;
  region?: string;
  district?: string;
  /** Public-only filter: applied after assessment, never pushed to a source. */
  status?: LotAssessmentStatus;
  /** Public-only filter: applied after timing derivation, never pushed to a source. */
  deadlineStatus?: LotTimingStatus;
}
