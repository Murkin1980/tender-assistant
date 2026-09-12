import configuration from '../src/configuration';

function restoreEnvironmentVariable(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

describe('configuration', () => {
  const originalEnvironment = {
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
  };

  afterEach(() => {
    restoreEnvironmentVariable('CORS_ORIGIN', originalEnvironment.CORS_ORIGIN);
    restoreEnvironmentVariable('NODE_ENV', originalEnvironment.NODE_ENV);
    restoreEnvironmentVariable('PORT', originalEnvironment.PORT);
  });

  it.each(['not-a-number', '0', '65536'])('rejects invalid PORT value %s', (port) => {
    process.env.PORT = port;

    expect(() => configuration()).toThrow('PORT must be an integer between 1 and 65535');
  });

  it('rejects an empty CORS_ORIGIN', () => {
    process.env.CORS_ORIGIN = '';

    expect(() => configuration()).toThrow('CORS_ORIGIN must contain at least one origin');
  });

  it('trims multiple CORS origins', () => {
    process.env.CORS_ORIGIN = ' https://app.example.com , https://admin.example.com  ';

    expect(configuration().corsOrigins).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);
  });
});
