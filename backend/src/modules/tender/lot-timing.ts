import type { Lot, LotTiming, LotTimingStatus } from './lot';

/**
 * CP-09 deterministic tender window: one pure function from a normalized lot and an explicit
 * instant to `OPEN_BY_DEADLINE` / `CLOSED_BY_DEADLINE` / `DEADLINE_UNKNOWN`.
 *
 * Deadline arithmetic only. Nothing here reads the official procurement status, so a future
 * deadline is never reported as an officially open tender — the source record stays
 * authoritative. There is no network access, no scoring and no AI: the same lot and the same
 * `now` always yield the same timing, and the input is never mutated.
 */

/** Public timing values of the CP-09 deadline contract. */
export const LOT_TIMING_STATUSES: readonly LotTimingStatus[] = [
  'OPEN_BY_DEADLINE',
  'CLOSED_BY_DEADLINE',
  'DEADLINE_UNKNOWN',
];

const MS_PER_MINUTE = 60_000;

/** A deadline the normalized contract cannot express as a moment in time is unknown, not zero. */
const parseDeadline = (lot: Lot): Date | null => {
  const text = typeof lot.bidDeadline === 'string' ? lot.bidDeadline.trim() : '';
  if (!text) return null;
  const deadline = new Date(text);
  return Number.isNaN(deadline.getTime()) ? null : deadline;
};

/**
 * Derives the deadline state of one normalized lot.
 *
 * @param now the explicit instant the deadline is compared against. The service boundary passes
 *            the current server time; tests always pass a fixed instant, so no clock is read
 *            inside this evaluator.
 *
 * Stable rules:
 *
 * - `deadline > now` => `OPEN_BY_DEADLINE`;
 * - `deadline <= now` (exactly now included) => `CLOSED_BY_DEADLINE`;
 * - missing or unparsable deadline => `DEADLINE_UNKNOWN`.
 *
 * Remaining minutes are rounded **up** (`Math.ceil`) and documented here as the single
 * convention: a deadline that is still in the future must never be reported as
 * `0 minutes remaining`.
 */
export function deriveLotTiming(lot: Lot, now: Date): LotTiming {
  const deadline = parseDeadline(lot);
  if (!deadline) return { status: 'DEADLINE_UNKNOWN', deadline: null, remainingMinutes: null };

  // `deadline` mirrors the valid normalized ISO deadline of the lot contract.
  const iso = deadline.toISOString();
  const remainingMs = deadline.getTime() - now.getTime();
  if (remainingMs <= 0)
    return { status: 'CLOSED_BY_DEADLINE', deadline: iso, remainingMinutes: null };

  return {
    status: 'OPEN_BY_DEADLINE',
    deadline: iso,
    remainingMinutes: Math.ceil(remainingMs / MS_PER_MINUTE),
  };
}
