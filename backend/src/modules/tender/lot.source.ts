import { Injectable } from '@nestjs/common';
import type { Lot } from './lot';
import { LOT_FIXTURES } from './lots.fixtures';

/**
 * The only place lots enter the application. Every implementation returns the same normalized
 * CP-03 contract, so downstream code never learns where a lot came from and raw upstream DTOs
 * stay inside the source that produced them.
 */
export interface LotSource {
  /**
   * @param limit Upper bound on the number of returned records. Omit it to ask for everything
   *              the source holds; live sources keep their own documented bound.
   */
  fetchLots(limit?: number): Promise<Lot[]>;
}

export const LOT_SOURCE = Symbol('LOT_SOURCE');

/** Default source: the deterministic CP-03 fixtures served by `/lots`. */
@Injectable()
export class FixtureLotSource implements LotSource {
  fetchLots(limit?: number): Promise<Lot[]> {
    const lots = limit === undefined ? LOT_FIXTURES : LOT_FIXTURES.slice(0, Math.max(0, limit));
    return Promise.resolve([...lots]);
  }
}
