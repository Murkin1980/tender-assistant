import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import type { Lot, LotFilters } from './lot';
import type { LotSourceStatus } from './lot.source';
import { TenderService } from './tender.service';

/** Validates the public query contract without silently accepting malformed filters. */
@Controller('lots')
export class TenderController {
  constructor(private readonly service: TenderService) {}

  /**
   * Declared before `:id` so `/lots/source` is read as the source status and not as a lot id.
   */
  @Get('source')
  source(): LotSourceStatus {
    return this.service.sourceStatus();
  }

  @Get()
  async list(@Query() query: Record<string, unknown>): Promise<Lot[]> {
    const filters: LotFilters = {};
    for (const key of ['q', 'region', 'district', 'maxAmount'] as const) {
      const value = query[key];
      if (value === undefined) continue;
      if (typeof value !== 'string') throw new BadRequestException(`Invalid ${key}`);
      const text = value.trim();
      if (!text) continue;
      if (key === 'maxAmount') {
        if (!/^\d+(\.\d{1,2})?$/.test(text) || !Number.isFinite(Number(text))) {
          throw new BadRequestException('Invalid maxAmount');
        }
        filters.maxAmount = Number(text);
      } else {
        filters[key] = text;
      }
    }
    return this.service.list(filters);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<Lot> {
    return this.service.get(id);
  }
}
