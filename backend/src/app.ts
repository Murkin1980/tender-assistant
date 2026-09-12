import type { NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppModule } from './app.module';

export async function createApp(options?: NestApplicationOptions): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, options);
  const configService = app.get(ConfigService);
  const corsOrigins = configService.get<string[]>('corsOrigins', ['http://localhost:3001']);

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    credentials: false,
    origin: corsOrigins,
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  return app;
}
