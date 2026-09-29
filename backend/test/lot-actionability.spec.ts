import { evaluateLotActionability } from '../src/modules/tender/lot-actionability';

describe('evaluateLotActionability', () => {
  it.each([
    ['EXCLUDE', 'OPEN_BY_DEADLINE', 'SKIP'],
    ['EXCLUDE', 'DEADLINE_UNKNOWN', 'SKIP'],
    ['EXCLUDE', 'CLOSED_BY_DEADLINE', 'SKIP'],
    ['MATCH', 'CLOSED_BY_DEADLINE', 'SKIP'],
    ['REVIEW', 'CLOSED_BY_DEADLINE', 'SKIP'],
    ['REVIEW', 'OPEN_BY_DEADLINE', 'REVIEW'],
    ['REVIEW', 'DEADLINE_UNKNOWN', 'REVIEW'],
    ['MATCH', 'DEADLINE_UNKNOWN', 'REVIEW'],
    ['MATCH', 'OPEN_BY_DEADLINE', 'TAKE'],
    ['UNKNOWN', 'UNKNOWN', 'REVIEW'],
  ])('%s + %s => %s', (assessment, timing, expected) => {
    const input = { assessment: { status: assessment }, timing: { status: timing } };
    const before = structuredClone(input);
    expect(evaluateLotActionability(input)).toBe(expected);
    expect(input).toEqual(before);
  });
});
