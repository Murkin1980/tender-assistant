import type { LotFilters } from '../lot';
import type { GoszakupLotsFilter } from './goszakup-lots.query';

/**
 * Translate only filters whose OWS v3 input and meaning are documented.
 *
 * `q` maps to `nameDescriptionRu`: Goszakup documents Russian name-and-description search
 * with morphology. Other public predicates remain local: `amount: [Float]` has no documented
 * range semantics, and `plnPointKatoList: String` does not document a safe KATO prefix encoding.
 * District is not represented in the lot filter schema.
 */
export function translateGoszakupLotFilters(filters: LotFilters): GoszakupLotsFilter | undefined {
  const filter: GoszakupLotsFilter = {};
  if (filters.q?.trim()) filter.nameDescriptionRu = filters.q.trim();
  return Object.keys(filter).length > 0 ? filter : undefined;
}
