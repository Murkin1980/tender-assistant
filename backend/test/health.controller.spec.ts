import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { HealthController } from '../src/modules/health/health.controller';

describe('HealthController', () => {
  const TOKEN = 'readiness-secret-must-not-leak';

  it('returns the service liveness payload', () => {
    const controller = new HealthController({} as ConfigService);
    const response = controller.check();

    expect(response.status).toBe('ok');
    expect(response.service).toBe('tender-assistant-backend');
    expect(new Date(response.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('marks a live deployment ready when its server-side token is configured without returning it', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'lotSourceMode' ? 'goszakup' : key === 'goszakup.token' ? TOKEN : undefined,
      ),
    } as unknown as ConfigService;
    const response = new HealthController(config).ready();

    expect(response.status).toBe('ready');
    expect(response.service).toBe('tender-assistant-backend');
    expect(JSON.stringify(response)).not.toContain(TOKEN);
  });

  it('does not mark a live deployment ready without credentials', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'lotSourceMode' ? 'goszakup' : '')),
    } as unknown as ConfigService;

    expect(() => new HealthController(config).ready()).toThrow(ServiceUnavailableException);
    expect(() => new HealthController(config).ready()).toThrow('Service is not ready');
  });

  it('does not require a Goszakup token while the fixture source is selected', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'lotSourceMode' ? 'fixture' : '')),
    } as unknown as ConfigService;

    expect(new HealthController(config).ready().status).toBe('ready');
  });
});
