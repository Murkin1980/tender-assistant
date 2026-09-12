const DEFAULT_PORT = 3000;
const DEFAULT_CORS_ORIGIN = 'http://localhost:3001';

function parsePort(value: string | undefined): number {
  const port = Number(value ?? DEFAULT_PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

function parseCorsOrigins(value: string | undefined): string[] {
  const origins = (value ?? DEFAULT_CORS_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    throw new Error('CORS_ORIGIN must contain at least one origin');
  }

  return origins;
}

export default function configuration(): {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
} {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parsePort(process.env.PORT),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  };
}
