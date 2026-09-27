import { Injectable } from '@nestjs/common';
import type { Lot } from '../lot';
import type { LotSource } from '../lot.source';
import { mapGoszakupLots } from './goszakup.mapper';
import { GOSZAKUP_MAX_LIMIT, GOSZAKUP_MIN_LIMIT } from './goszakup.config';
import { GoszakupClient } from './goszakup.client';
import type { GoszakupLotsFilter } from './goszakup-lots.query';

/**
 * Live source adapter: official Goszakup OWS v3 registry → the existing lot contract.
 *
 * Not bound to `LOT_SOURCE` in this checkpoint: `/lots` stays fixture-backed. The adapter is
 * exercised by the developer-only read-only probe (`pnpm --filter @tender-assistant/backend probe:goszakup`).
 */
@Injectable()
export class GoszakupLotSource implements LotSource {
  constructor(private readonly client: GoszakupClient) {}

  async fetchLots(limit: number, filter?: GoszakupLotsFilter): Promise<Lot[]> {
    const bounded = Math.min(Math.max(limit, GOSZAKUP_MIN_LIMIT), GOSZAKUP_MAX_LIMIT);
    return mapGoszakupLots(await this.client.fetchLots({ limit: bounded, filter }));
  }
}
