import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { TenderModule } from './modules/tender/tender.module';

import configuration from './configuration';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      load: [configuration],
    }),
    HealthModule,
    TenderModule,
  ],
})
export class AppModule {}
