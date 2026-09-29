import type { LotAssessmentStatus, LotTimingStatus } from './lot';

export type LotActionStatus = 'TAKE' | 'REVIEW' | 'SKIP';
export const LOT_ACTION_STATUSES: readonly LotActionStatus[] = ['TAKE', 'REVIEW', 'SKIP'];

export interface LotActionabilityInput {
  assessment: { status: LotAssessmentStatus | string };
  timing: { status: LotTimingStatus | string };
}

/** One pure, fail-safe composition of the approved assessment and deadline states. */
export function evaluateLotActionability(input: LotActionabilityInput): LotActionStatus {
  if (input.assessment.status === 'EXCLUDE') return 'SKIP';
  if (input.timing.status === 'CLOSED_BY_DEADLINE') return 'SKIP';
  if (input.assessment.status === 'REVIEW') return 'REVIEW';
  if (input.timing.status === 'DEADLINE_UNKNOWN') return 'REVIEW';
  if (input.assessment.status === 'MATCH' && input.timing.status === 'OPEN_BY_DEADLINE') {
    return 'TAKE';
  }
  return 'REVIEW';
}
