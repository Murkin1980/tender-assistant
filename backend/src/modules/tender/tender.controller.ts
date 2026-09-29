import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import type { AssessedLot, LotAssessmentStatus, LotFilters, LotTimingStatus } from './lot';
import { LOT_ACTION_STATUSES, type LotActionStatus } from './lot-actionability';
import { LOT_ASSESSMENT_STATUSES } from './lot-assessment';
import { LOT_TIMING_STATUSES } from './lot-timing';
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
  async list(@Query() query: Record<string, unknown>): Promise<AssessedLot[]> {
    const filters: LotFilters = {};
    for (const key of [
      'q',
      'region',
      'district',
      'maxAmount',
      'status',
      'deadlineStatus',
      'actionStatus',
    ] as const) {
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
      } else if (key === 'status') {
        const status = text.toUpperCase() as LotAssessmentStatus;
        if (!LOT_ASSESSMENT_STATUSES.includes(status)) {
          throw new BadRequestException('Invalid status');
        }
        filters.status = status;
      } else if (key === 'deadlineStatus') {
        const deadlineStatus = text.toUpperCase() as LotTimingStatus;
        if (!LOT_TIMING_STATUSES.includes(deadlineStatus)) {
          throw new BadRequestException('Invalid deadlineStatus');
        }
        filters.deadlineStatus = deadlineStatus;
      } else if (key === 'actionStatus') {
        const actionStatus = text.toUpperCase() as LotActionStatus;
        if (!LOT_ACTION_STATUSES.includes(actionStatus)) {
          throw new BadRequestException('Invalid actionStatus');
        }
        filters.actionStatus = actionStatus;
      } else {
        filters[key] = text;
      }
    }
    return this.service.list(filters);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AssessedLot> {
    return this.service.get(id);
  }
}
