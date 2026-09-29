import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AssessedLot, AssessedLotDetail, LotFilters } from './lot';
import { assessLot } from './lot-assessment';
import { deriveLotTiming } from './lot-timing';
import { evaluateLotActionability } from './lot-actionability';
import { extractLotRequirements } from './lot-requirements';
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
    // The single place the current server time enters the timing derivation.
    const now = new Date();
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
        // The deadline state is derived the same way, by the same evaluator for fixtures and
        // live records alike, so no source, adapter or controller repeats timing logic.
        .map((lot): AssessedLot => {
          const assessment = assessLot(lot);
          const timing = deriveLotTiming(lot, now);
          const assessed: AssessedLot = {
            ...lot,
            assessment,
            timing,
            actionability: { status: evaluateLotActionability({ assessment, timing }) },
          };
          delete assessed.documents;
          return assessed;
        })
        // Both status filters are local by design and are never part of what a source was asked
        // for. The deadline filter runs after the timing it filters on exists.
        .filter((lot) => !filters.status || lot.assessment.status === filters.status)
        .filter((lot) => !filters.deadlineStatus || lot.timing.status === filters.deadlineStatus)
        .filter((lot) => !filters.actionStatus || lot.actionability.status === filters.actionStatus)
    );
  }

  async get(id: string): Promise<AssessedLotDetail> {
    const lot = await this.fromSource(() => this.source.fetchLot(id));
    if (!lot) throw new NotFoundException('Lot not found');
    const assessment = assessLot(lot);
    const timing = deriveLotTiming(lot, new Date());
    const documents = lot.documents ?? [];
    const requirements = await extractLotRequirements(documents, (doc) =>
      this.source.fetchDocumentBytes
        ? this.source.fetchDocumentBytes(doc)
        : Promise.resolve({
            status: 'UNAVAILABLE',
            reason: 'не удалось безопасно получить байты файла из источника',
          }),
    );
    return {
      ...lot,
      assessment,
      timing,
      actionability: { status: evaluateLotActionability({ assessment, timing }) },
      documents,
      requirements,
    };
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
