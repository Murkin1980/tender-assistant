import { HealthController } from '../src/modules/health/health.controller';

describe('HealthController', () => {
  it('returns the service health payload', () => {
    const controller = new HealthController();
    const response = controller.check();

    expect(response.status).toBe('ok');
    expect(response.service).toBe('tender-assistant-backend');
    expect(new Date(response.timestamp).toString()).not.toBe('Invalid Date');
  });
});
