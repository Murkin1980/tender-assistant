import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Lot, LotFilters } from './lot';
import { LOT_SOURCE, type LotSource } from './lot.source';

const normalize = (value: string): string => value.trim().toLocaleLowerCase('ru');

/** The single list/detail data path; the injected source defaults to the CP-03 fixtures. */
@Injectable()
export class TenderService {
  constructor(@Inject(LOT_SOURCE) private readonly source: LotSource) {}

  async list(filters: LotFilters): Promise<Lot[]> {
    const lots = await this.source.fetchLots();
    return lots.filter(
      (lot) =>
        (filters.maxAmount === undefined || lot.amount <= filters.maxAmount) &&
        (!filters.region || normalize(lot.region) === normalize(filters.region)) &&
        (!filters.district || normalize(lot.district ?? '') === normalize(filters.district)) &&
        (!filters.q ||
          normalize([lot.title, lot.customer, lot.description].join(' ')).includes(
            normalize(filters.q),
          )),
    );
  }

  async get(id: string): Promise<Lot> {
    const lot = (await this.source.fetchLots()).find((item) => item.id === id);
    if (!lot) throw new NotFoundException('Lot not found');
    return lot;
  }
}
