import type { Lot, LotTimingStatus } from '../src/modules/tender/lot';
import { deriveLotTiming, LOT_TIMING_STATUSES } from '../src/modules/tender/lot-timing';

/** Fixed clocks: every case states the instant the deadline is compared against. */
const NOW = new Date('2026-10-01T00:00:00.000Z');
const MINUTE = 60_000;

const lotWithDeadline = (bidDeadline: string): Lot =>
  ({
    id: 'timing-lot',
    bidDeadline,
  }) as Lot;

const statusOf = (bidDeadline: string, now: Date = NOW): LotTimingStatus =>
  deriveLotTiming(lotWithDeadline(bidDeadline), now).status;

describe('LOT_TIMING_STATUSES', () => {
  it('offers the three public states in their documented order', () => {
    expect(LOT_TIMING_STATUSES).toEqual([
      'OPEN_BY_DEADLINE',
      'CLOSED_BY_DEADLINE',
      'DEADLINE_UNKNOWN',
    ]);
  });
});

describe('deriveLotTiming', () => {
  it('reports OPEN_BY_DEADLINE for a valid deadline in the future', () => {
    expect(deriveLotTiming(lotWithDeadline('2026-10-15T12:00:00.000Z'), NOW)).toEqual({
      status: 'OPEN_BY_DEADLINE',
      deadline: '2026-10-15T12:00:00.000Z',
      // 14 days 12 hours after the fixed instant.
      remainingMinutes: 20_880,
    });
  });

  it('treats a deadline that is exactly now as CLOSED_BY_DEADLINE', () => {
    expect(deriveLotTiming(lotWithDeadline('2026-10-01T00:00:00.000Z'), NOW)).toEqual({
      status: 'CLOSED_BY_DEADLINE',
      deadline: '2026-10-01T00:00:00.000Z',
      remainingMinutes: null,
    });
  });

  it('reports CLOSED_BY_DEADLINE for a deadline in the past', () => {
    expect(deriveLotTiming(lotWithDeadline('2026-09-20T12:00:00.000Z'), NOW)).toEqual({
      status: 'CLOSED_BY_DEADLINE',
      deadline: '2026-09-20T12:00:00.000Z',
      remainingMinutes: null,
    });
  });

  it('reports DEADLINE_UNKNOWN for a missing deadline', () => {
    for (const bidDeadline of ['', '   ']) {
      expect(deriveLotTiming(lotWithDeadline(bidDeadline), NOW)).toEqual({
        status: 'DEADLINE_UNKNOWN',
        deadline: null,
        remainingMinutes: null,
      });
    }
  });

  it('reports DEADLINE_UNKNOWN for an unparsable deadline instead of guessing a moment', () => {
    for (const bidDeadline of ['не дата', '2026-13-45T99:99:99Z', '15.10.2026']) {
      expect(statusOf(bidDeadline)).toBe('DEADLINE_UNKNOWN');
      expect(deriveLotTiming(lotWithDeadline(bidDeadline), NOW).deadline).toBeNull();
    }
  });

  it('uses the injected instant, never the real clock', () => {
    const deadline = '2026-10-15T12:00:00.000Z';
    // The same lot is open before the deadline and closed after it.
    expect(statusOf(deadline, new Date('2026-10-15T11:59:59.999Z'))).toBe('OPEN_BY_DEADLINE');
    expect(statusOf(deadline, new Date('2026-10-15T12:00:00.000Z'))).toBe('CLOSED_BY_DEADLINE');
    expect(statusOf(deadline, new Date('2027-01-01T00:00:00.000Z'))).toBe('CLOSED_BY_DEADLINE');
  });

  it('rounds remaining minutes up, so a future deadline never shows zero minutes left', () => {
    const remaining = (offsetMs: number): number | null =>
      deriveLotTiming(lotWithDeadline(new Date(NOW.getTime() + offsetMs).toISOString()), NOW)
        .remainingMinutes;

    expect(remaining(1)).toBe(1);
    expect(remaining(MINUTE - 1)).toBe(1);
    expect(remaining(MINUTE)).toBe(1);
    expect(remaining(MINUTE + 1)).toBe(2);
    expect(remaining(90 * MINUTE)).toBe(90);
  });

  it('exposes remaining minutes only for an open deadline', () => {
    expect(
      deriveLotTiming(lotWithDeadline('2026-09-01T00:00:00.000Z'), NOW).remainingMinutes,
    ).toBeNull();
    expect(deriveLotTiming(lotWithDeadline(''), NOW).remainingMinutes).toBeNull();
  });

  it('normalizes the deadline to ISO-8601 and keeps it identical to the source value', () => {
    // The mapper already normalizes upstream timestamps; an offset form stays the same instant.
    expect(deriveLotTiming(lotWithDeadline('2026-10-15T12:00:00.000Z'), NOW).deadline).toBe(
      '2026-10-15T12:00:00.000Z',
    );
    expect(deriveLotTiming(lotWithDeadline('2026-10-15T17:00:00+05:00'), NOW).deadline).toBe(
      '2026-10-15T12:00:00.000Z',
    );
  });

  it('does not mutate the input lot', () => {
    const lot = lotWithDeadline('2026-10-15T12:00:00.000Z');
    const snapshot = { ...lot };
    deriveLotTiming(lot, NOW);
    expect(lot).toEqual(snapshot);
  });
});
