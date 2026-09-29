import { Injectable } from '@nestjs/common';
import type { Lot, LotFilters } from '../lot';
import { LotSourceUnavailableError, type LotSource } from '../lot.source';
import { mapGoszakupLot, mapGoszakupLots, parseGoszakupLotId } from './goszakup.mapper';
import { DEFAULT_LIVE_LOTS_LIMIT, GOSZAKUP_MAX_LIMIT, GOSZAKUP_MIN_LIMIT } from './goszakup.config';
import { GoszakupClient, GoszakupUpstreamError } from './goszakup.client';
import { translateGoszakupLotFilters } from './goszakup-filter.translator';
import { GOSZAKUP_LOT_DETAIL_QUERY } from './goszakup-lots.query';

const bound = (limit: number): number =>
  Math.min(Math.max(limit, GOSZAKUP_MIN_LIMIT), GOSZAKUP_MAX_LIMIT);

/**
 * Live source adapter: official Goszakup OWS v3 registry → the existing lot contract.
 *
 * Bound to `LOT_SOURCE` only when `TENDER_LOT_SOURCE=goszakup`. Both reads stay bounded and
 * read-only: the list is one page (`DEFAULT_LIVE_LOTS_LIMIT` records by default) and the detail
 * is one documented `Lots(filter: { id: [...] }, limit: 1)` lookup — never a page scan.
 * List filters are translated only by the documented subset in `goszakup-filter.translator.ts`
 * (`https://ows.goszakup.gov.kz/help/v3/schema/lotsfiltersinput.doc.html`).
 */
@Injectable()
export class GoszakupLotSource implements LotSource {
  constructor(private readonly client: GoszakupClient) {}

  async fetchLots(filters?: LotFilters, limit?: number): Promise<Lot[]> {
    const bounded = bound(limit ?? DEFAULT_LIVE_LOTS_LIMIT);
    const filter = filters ? translateGoszakupLotFilters(filters) : undefined;
    return this.fromUpstream(async () =>
      mapGoszakupLots(await this.client.fetchLots({ limit: bounded, filter })),
    );
  }

  async fetchLot(id: string): Promise<Lot | null> {
    const registryId = parseGoszakupLotId(id);
    // A malformed or foreign id cannot exist in the registry: public 404 without any upstream call.
    if (registryId === null) return null;

    return this.fromUpstream(async () => {
      const [record] = await this.client.fetchLots({
        limit: 1,
        filter: { id: [registryId] },
        query: GOSZAKUP_LOT_DETAIL_QUERY,
      });
      // A record the public contract cannot represent (no usable amount) also has no page to
      // show; it is reported as not found rather than padded with invented values.
      return mapGoszakupLot(record, { includeDocuments: true });
    });
  }

  /** Upstream trouble is a source failure, not an empty or fixture-backed answer. */
  private async fromUpstream<T>(load: () => Promise<T>): Promise<T> {
    try {
      return await load();
    } catch (error) {
      if (error instanceof GoszakupUpstreamError) throw new LotSourceUnavailableError(error);
      throw error;
    }
  }
}
