import { Injectable, NotFoundException } from '@nestjs/common';
import type { Lot, LotFilters } from './lot';
import { LOT_FIXTURES } from './lots.fixtures';

const normalize = (value: string): string => value.trim().toLocaleLowerCase('ru');

/** The single list/detail data path; fixtures can later be replaced by ingested data. */
@Injectable()
export class TenderService {
  list(filters: LotFilters): Lot[] {
    return LOT_FIXTURES.filter(
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

  get(id: string): Lot {
    const lot = LOT_FIXTURES.find((item) => item.id === id);
    if (!lot) throw new NotFoundException('Lot not found');
    return lot;
  }
}
