import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { GoszakupLotSource } from '../modules/tender/goszakup/goszakup.source';
import type { Lot } from '../modules/tender/lot';

/** Bounded sample size for the probe; the OWS v3 `Lots` query allows up to 200 per page. */
export const GOSZAKUP_PROBE_LIMIT = 5;

export const GOSZAKUP_TOKEN_ENV_NAME = 'GOSZAKUP_TOKEN';

export interface GoszakupProbeResult {
  status: 'PASS' | 'SKIPPED' | 'FAILED';
  /** Non-secret evidence lines. Never contains the bearer token. */
  lines: string[];
  exitCode: number;
}

/**
 * Backend-side failure chain. Upstream detail is deliberately kept out of the public API but is
 * exactly what a developer probe needs, and it is already redacted by the client.
 */
function describeFailure(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  while (current instanceof Error && messages.length < 5) {
    if (current.message) messages.push(current.message);
    current = (current as Error & { cause?: unknown }).cause;
  }
  return messages.length > 0 ? messages.join(' → ') : String(error);
}

const summarizeLot = (lot: Lot): string =>
  [
    lot.id,
    lot.title || '(без наименования)',
    `${lot.amount} KZT`,
    lot.customer || '(заказчик не указан)',
    lot.region || '(регион не указан)',
    lot.bidDeadline || '(срок не указан)',
    lot.sourceUrl,
  ].join(' | ');

/**
 * Developer-only, read-only check that the official OWS v3 registry can be read with the token
 * from the backend environment and normalized into the existing lot contract.
 *
 * It performs one bounded request, prints a non-secret summary and persists nothing. Without
 * `GOSZAKUP_TOKEN` it reports SKIPPED instead of failing: a missing token is not a defect.
 */
export async function runGoszakupProbe(
  limit: number = GOSZAKUP_PROBE_LIMIT,
): Promise<GoszakupProbeResult> {
  const lines: string[] = [];

  if (!process.env[GOSZAKUP_TOKEN_ENV_NAME]?.trim()) {
    lines.push(
      `${GOSZAKUP_TOKEN_ENV_NAME} is not set: live Goszakup probe NOT RUN (deterministic contract tests still apply).`,
    );
    return { status: 'SKIPPED', lines, exitCode: 2 };
  }

  const context = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const source = context.get(GoszakupLotSource);
    const lots = await source.fetchLots(undefined, limit);
    lines.push(`Goszakup OWS v3 returned ${lots.length} normalized lot(s) for limit=${limit}.`);
    const [first] = lots;
    if (first) lines.push(`First normalized lot: ${summarizeLot(first)}`);
    lines.push('Read-only probe: nothing was persisted, no token was printed.');
    return { status: 'PASS', lines, exitCode: 0 };
  } catch (error) {
    lines.push(`Goszakup probe failed: ${describeFailure(error)}`);
    return { status: 'FAILED', lines, exitCode: 1 };
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  // The token comes from the backend environment (for example `backend/.env`, which the
  // ConfigModule already loads, or an exported variable). It is never an argument.
  const result = await runGoszakupProbe();
  for (const line of result.lines) console.log(`[goszakup-probe] ${line}`);
  process.exitCode = result.exitCode;
}

if (require.main === module) {
  void main();
}
