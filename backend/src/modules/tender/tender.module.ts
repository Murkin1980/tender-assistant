import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenderController } from './tender.controller';
import { TenderService } from './tender.service';
import {
  DEFAULT_LOT_SOURCE_MODE,
  FixtureLotSource,
  LOT_SOURCE,
  type LotSource,
  type LotSourceMode,
} from './lot.source';
import { GoszakupLotSource } from './goszakup/goszakup.source';
import { GoszakupClient } from './goszakup/goszakup.client';

@Module({
  controllers: [TenderController],
  providers: [
    TenderService,
    FixtureLotSource,
    // The only place configuration selects the public data path; the default is `fixture`.
    {
      provide: LOT_SOURCE,
      useFactory: (
        config: ConfigService,
        fixtures: FixtureLotSource,
        goszakup: GoszakupLotSource,
      ): LotSource =>
        config.get<LotSourceMode>('lotSourceMode', DEFAULT_LOT_SOURCE_MODE) === 'goszakup'
          ? goszakup
          : fixtures,
      inject: [ConfigService, FixtureLotSource, GoszakupLotSource],
    },
    // Backend-only integration boundary; never reached from a browser.
    {
      provide: GoszakupClient,
      useFactory: (config: ConfigService): GoszakupClient =>
        new GoszakupClient({
          graphqlUrl: config.get<string>('goszakup.graphqlUrl'),
          token: config.get<string>('goszakup.token') ?? '',
          timeoutMs: config.get<number>('goszakup.timeoutMs'),
        }),
      inject: [ConfigService],
    },
    GoszakupLotSource,
  ],
})
export class TenderModule {}
