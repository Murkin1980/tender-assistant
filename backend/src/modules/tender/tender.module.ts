import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenderController } from './tender.controller';
import { TenderService } from './tender.service';
import { FixtureLotSource, LOT_SOURCE } from './lot.source';
import { GoszakupLotSource } from './goszakup/goszakup.source';
import { GoszakupClient } from './goszakup/goszakup.client';

@Module({
  controllers: [TenderController],
  providers: [
    TenderService,
    // The public API stays fixture-backed: no live source is bound to `LOT_SOURCE` here.
    { provide: LOT_SOURCE, useClass: FixtureLotSource },
    // Backend-only integration boundary, used by the developer probe; never reached from a browser.
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
