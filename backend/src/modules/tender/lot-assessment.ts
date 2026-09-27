import type { Lot, LotAssessment, LotAssessmentStatus } from './lot';

/**
 * CP-07 deterministic tender triage: one pure function from a normalized lot to
 * `MATCH` / `REVIEW` / `EXCLUDE` plus human-readable reasons.
 *
 * Only already-approved business rules are applied here (maximum amount, Almaty, furniture with
 * an LDSP signal, metallic cabinets as non-target). Nothing is inferred from a source, there is
 * no network access, no scoring and no AI: the same lot always yields the same assessment, and
 * the input is never mutated.
 */

/** Public status values, in the order they are offered by the list filter. */
export const LOT_ASSESSMENT_STATUSES: readonly LotAssessmentStatus[] = [
  'MATCH',
  'REVIEW',
  'EXCLUDE',
];

/** Current v1 business profile: the only limits this triage knows about. */
const MAX_AMOUNT = 500_000;
const TARGET_REGION = 'Алматы';
const PREFERRED_DISTRICT = 'Алатауский';

/** Stable reason strings of the assessment contract. */
const REASONS = {
  amountWithin: 'Amount is within 500,000 KZT',
  amountExceeds: 'Amount exceeds 500,000 KZT',
  regionAlmaty: 'Region is Almaty',
  regionOutside: 'Region is outside Almaty',
  ldsp: 'LDSP signal found',
  furniture: 'Furniture signal found',
  metallicCabinet: 'Metallic cabinet signal found',
  preferredDistrict: 'Preferred district: Alatau',
  insufficient: 'Insufficient evidence for automatic match',
} as const;

const normalize = (value: string): string => value.toLocaleLowerCase('ru');

/**
 * Delivery places may name several regions (the mapper joins the distinct names it resolved).
 * Each name is compared as a whole, never by prefix, so an unknown or mixed list cannot be
 * silently read as Almaty.
 */
const regionNames = (region: string): string[] =>
  region
    .split(',')
    .map((name) => normalize(name).trim())
    .filter((name) => name.length > 0);

/**
 * The mapper resolves every documented КАТО prefix to a region name and leaves an unrecognized
 * code as it is. Only a resolved name can be judged: a raw code is ambiguous data, so it is
 * neither an Almaty confirmation nor a reason to exclude. Region names never contain digits.
 */
const isRegionName = (name: string): boolean => !/^\d+$/.test(name);

/**
 * Intentionally narrow metallic-cabinet signal: an explicit "metallic" word directly attached to
 * a "cabinet" word, in either order. `metal` alone, other metal items (doors, shelving, tables)
 * and a mere mention of "металл" in another word never trigger the exclusion.
 */
const METALLIC_CABINET =
  /(?<![\p{L}\p{N}])(?:металлическ\p{L}*\s+шкаф\p{L}*|шкаф\p{L}*\s+металлическ\p{L}*)(?![\p{L}\p{N}])/u;

/** LDSP / ЛДСП, matched as a whole word so unrelated text cannot produce the signal. */
const LDSP = /(?<![\p{L}\p{N}])(?:лдсп|ldsp)(?![\p{L}\p{N}])/u;

/**
 * The approved v1 furniture vocabulary with its ordinary Russian word forms. A stem alone would
 * over-match (for example `стол` inside `столовая`), so the `стол` family is listed explicitly.
 */
const FURNITURE =
  /(?<![\p{L}\p{N}])(?:мебел\p{L}*|шкаф\p{L}*|тумб\p{L}*|кухн\p{L}*|стол(?:ы|а|у|ом|е|ов|ам|ах|ик|ика|ики|иков)?)(?![\p{L}\p{N}])/u;

/**
 * Assesses one normalized lot against the current profile.
 *
 * Hard exclusions are conservative: a missing region or district never excludes a lot, and an
 * unknown region can never be read as a confirmed match.
 */
export function assessLot(lot: Lot): LotAssessment {
  // Only the procurement text carries product evidence; the customer is never scanned.
  const text = normalize(`${lot.title} ${lot.description}`);
  const regions = regionNames(lot.region);
  const resolved = regions.filter(isRegionName);

  const exclusions: string[] = [];
  if (lot.amount > MAX_AMOUNT) exclusions.push(REASONS.amountExceeds);
  // A known region that is definitely not Almaty: an unresolved code or a missing region is not.
  if (resolved.length > 0 && !resolved.includes(normalize(TARGET_REGION))) {
    exclusions.push(REASONS.regionOutside);
  }
  if (METALLIC_CABINET.test(text)) exclusions.push(REASONS.metallicCabinet);
  if (exclusions.length > 0) return { status: 'EXCLUDE', reasons: exclusions };

  const ldsp = LDSP.test(text);
  const furniture = FURNITURE.test(text);
  // Exactly one delivery region, and it is the target city: anything else stays a review.
  const isAlmaty = regions.length === 1 && resolved[0] === normalize(TARGET_REGION);
  const isPreferredDistrict =
    lot.district !== null && normalize(lot.district.trim()) === normalize(PREFERRED_DISTRICT);

  // Amount is at or below the profile maximum here, so it is always a supporting fact.
  const reasons: string[] = [REASONS.amountWithin];
  if (isAlmaty) reasons.push(REASONS.regionAlmaty);
  if (ldsp) reasons.push(REASONS.ldsp);
  if (furniture) reasons.push(REASONS.furniture);
  if (isPreferredDistrict) reasons.push(REASONS.preferredDistrict);

  // A match needs a confirmed city and positive product evidence; everything else stays REVIEW.
  if (!isAlmaty || !(ldsp || furniture)) {
    return { status: 'REVIEW', reasons: [...reasons, REASONS.insufficient] };
  }
  return { status: 'MATCH', reasons };
}
