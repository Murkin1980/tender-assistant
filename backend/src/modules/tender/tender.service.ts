import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AssessedLot, LotFilters } from './lot';
import { assessLot } from './lot-assessment';
import {
  DEFAULT_LOT_SOURCE_MODE,
  LOT_SOURCE,
  LOT_SOURCE_STATUS,
  LotSourceUnavailableError,
  type LotSource,
  type LotSourceMode,
  type LotSourceStatus,
} from './lot.source';

const normalize = (value: string): string => value.trim().toLocaleLowerCase('ru');

/** The single list/detail data path; the injected source defaults to the CP-03 fixtures. */
@Injectable()
export class TenderService {
  constructor(
    @Inject(LOT_SOURCE) private readonly source: LotSource,
    private readonly config: ConfigService,
  ) {}

  /** Secret-free description of the active source, for `GET /api/v1/lots/source`. */
  sourceStatus(): LotSourceStatus {
    const mode = this.config.get<LotSourceMode>('lotSourceMode', DEFAULT_LOT_SOURCE_MODE);
    return LOT_SOURCE_STATUS[mode];
  }

  async list(filters: LotFilters): Promise<AssessedLot[]> {
    const lots = await this.fromSource(() => this.source.fetchLots(filters));
    return (
      lots
        .filter(
          (lot) =>
            (filters.maxAmount === undefined || lot.amount <= filters.maxAmount) &&
            (!filters.region || normalize(lot.region) === normalize(filters.region)) &&
            (!filters.district || normalize(lot.district ?? '') === normalize(filters.district)) &&
            (!filters.q ||
              normalize([lot.title, lot.customer, lot.description].join(' ')).includes(
                normalize(filters.q),
              )),
        )
        // The assessment is derived here, once, for every lot of every source.
        .map((lot): AssessedLot => ({ ...lot, assessment: assessLot(lot) }))
        // The status filter is local by design and is never part of what a source was asked for.
        .filter((lot) => !filters.status || lot.assessment.status === filters.status)
    );
  }

  async get(id: string): Promise<AssessedLot> {
    const lot = await this.fromSource(() => this.source.fetchLot(id));
    if (!lot) throw new NotFoundException('Lot not found');
    return { ...lot, assessment: assessLot(lot) };
  }

  /** An unavailable live source is a safe temporary failure — never a fixture fallback. */
  private async fromSource<T>(load: () => Promise<T>): Promise<T> {
    try {
      return await load();
    } catch (error) {
      if (error instanceof LotSourceUnavailableError) {
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    }
  }
}
