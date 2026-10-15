import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    GOSZAKUP_GRAPHQL_URL: process.env.GOSZAKUP_GRAPHQL_URL,
    GOSZAKUP_TIMEOUT_MS: process.env.GOSZAKUP_TIMEOUT_MS,
    GOSZAKUP_TOKEN: process.env.GOSZAKUP_TOKEN,
    GOSZAKUP_TOKEN_FILE: process.env.GOSZAKUP_TOKEN_FILE,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    TENDER_LOT_SOURCE: process.env.TENDER_LOT_SOURCE,
  };

  afterEach(() => {
    restoreEnvironmentVariable('CORS_ORIGIN', originalEnvironment.CORS_ORIGIN);
    restoreEnvironmentVariable('GOSZAKUP_GRAPHQL_URL', originalEnvironment.GOSZAKUP_GRAPHQL_URL);
    restoreEnvironmentVariable('GOSZAKUP_TIMEOUT_MS', originalEnvironment.GOSZAKUP_TIMEOUT_MS);
    restoreEnvironmentVariable('GOSZAKUP_TOKEN', originalEnvironment.GOSZAKUP_TOKEN);
    restoreEnvironmentVariable('GOSZAKUP_TOKEN_FILE', originalEnvironment.GOSZAKUP_TOKEN_FILE);
    restoreEnvironmentVariable('NODE_ENV', originalEnvironment.NODE_ENV);
    restoreEnvironmentVariable('PORT', originalEnvironment.PORT);
    restoreEnvironmentVariable('TENDER_LOT_SOURCE', originalEnvironment.TENDER_LOT_SOURCE);
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
  it('defaults the Goszakup settings to the official v3 endpoint with no token', () => {
    delete process.env.GOSZAKUP_GRAPHQL_URL;
    delete process.env.GOSZAKUP_TIMEOUT_MS;
    delete process.env.GOSZAKUP_TOKEN;
    delete process.env.GOSZAKUP_TOKEN_FILE;

    expect(configuration().goszakup).toEqual({
      graphqlUrl: 'https://ows.goszakup.gov.kz/v3/graphql',
      timeoutMs: 15000,
      token: '',
    });
  });

  it('reads the Goszakup token and overrides from the environment', () => {
    process.env.GOSZAKUP_GRAPHQL_URL = 'https://ows.example.com/v3/graphql';
    process.env.GOSZAKUP_TIMEOUT_MS = '4000';
    process.env.GOSZAKUP_TOKEN = '  example-token  ';

    expect(configuration().goszakup).toEqual({
      graphqlUrl: 'https://ows.example.com/v3/graphql',
      timeoutMs: 4000,
      token: 'example-token',
    });
  });

  it('reads the production token from a secret file, preferring it over a plain environment value', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tender-assistant-secret-'));
    const tokenPath = join(directory, 'goszakup-token');
    const token = 'file-backed-production-token';

    try {
      writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 });
      process.env.GOSZAKUP_TOKEN_FILE = tokenPath;
      process.env.GOSZAKUP_TOKEN = 'must-not-win-over-file-secret';

      expect(configuration().goszakup.token).toBe(token);
      expect(readFileSync(tokenPath, 'utf8')).toContain(token);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('fails closed when a configured token file cannot be read without echoing its path', () => {
    process.env.GOSZAKUP_TOKEN_FILE = '/tmp/private/goszakup-token-must-not-be-reported';

    expect(() => configuration()).toThrow('GOSZAKUP_TOKEN_FILE could not be read');
    expect(() => configuration()).toThrow('GOSZAKUP_TOKEN_FILE could not be read');
  });

  it('rejects a Goszakup endpoint that is not an https URL', () => {
    process.env.GOSZAKUP_GRAPHQL_URL = 'http://ows.goszakup.gov.kz/v3/graphql';
    expect(() => configuration()).toThrow('GOSZAKUP_GRAPHQL_URL must use https');

    process.env.GOSZAKUP_GRAPHQL_URL = 'ows.goszakup.gov.kz/v3/graphql';
    expect(() => configuration()).toThrow('GOSZAKUP_GRAPHQL_URL must be a valid absolute URL');
  });

  it('defaults the public lot source to fixtures when TENDER_LOT_SOURCE is unset', () => {
    delete process.env.TENDER_LOT_SOURCE;

    expect(configuration().lotSourceMode).toBe('fixture');
  });

  it('treats an empty TENDER_LOT_SOURCE as unset', () => {
    process.env.TENDER_LOT_SOURCE = '  ';

    expect(configuration().lotSourceMode).toBe('fixture');
  });

  it.each(['fixture', 'goszakup'])('accepts the explicit lot source %s', (mode) => {
    process.env.TENDER_LOT_SOURCE = ` ${mode} `;

    expect(configuration().lotSourceMode).toBe(mode);
  });

  it.each(['GOSZAKUP', 'Fixtures', 'live', 'fixture,goszakup'])(
    'rejects the unknown TENDER_LOT_SOURCE value %s',
    (mode) => {
      process.env.TENDER_LOT_SOURCE = mode;

      expect(() => configuration()).toThrow('TENDER_LOT_SOURCE must be one of: fixture | goszakup');
    },
  );

  it.each(['0', '-5', '1.5', 'abc'])('rejects invalid GOSZAKUP_TIMEOUT_MS value %s', (timeout) => {
    process.env.GOSZAKUP_TIMEOUT_MS = timeout;

    expect(() => configuration()).toThrow(
      'GOSZAKUP_TIMEOUT_MS must be a positive integer of milliseconds',
    );
  });
});
