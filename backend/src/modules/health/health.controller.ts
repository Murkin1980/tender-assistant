import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { LotSourceMode } from '../tender/lot.source';

const SERVICE = 'tender-assistant-backend' as const;

type HealthResponse = {
  status: 'ok';
  service: typeof SERVICE;
  timestamp: string;
};

type ReadinessResponse = {
  status: 'ready';
  service: typeof SERVICE;
  timestamp: string;
};

@Controller()
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  /** Liveness only: the process is up and can answer HTTP requests. */
  @Get('health')
  check(): HealthResponse {
    return {
      status: 'ok',
      service: SERVICE,
      timestamp: new Date().toISOString(),
    };
  }

  /** Configuration readiness; live-source credentials are never included in the response. */
  @Get('ready')
  ready(): ReadinessResponse {
    const source = this.config.get<LotSourceMode>('lotSourceMode', 'fixture');
    const token = this.config.get<string>('goszakup.token', '');
    if (source === 'goszakup' && !token) {
      throw new ServiceUnavailableException('Service is not ready');
    }

    return {
      status: 'ready',
      service: SERVICE,
      timestamp: new Date().toISOString(),
    };
  }
}
