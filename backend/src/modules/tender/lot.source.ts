import { Injectable } from '@nestjs/common';
import type { Lot, LotDocument, LotFilters } from './lot';
import type { DocumentBytesResult } from './lot-requirements';
import { FIXTURE_DOCUMENT_BYTES, LOT_FIXTURES } from './lots.fixtures';

/** `TENDER_LOT_SOURCE` values the backend accepts. */
export type LotSourceMode = 'fixture' | 'goszakup';

export const LOT_SOURCE_MODES: readonly LotSourceMode[] = ['fixture', 'goszakup'];

/** An unset `TENDER_LOT_SOURCE` keeps the application fixture-backed. */
export const DEFAULT_LOT_SOURCE_MODE: LotSourceMode = 'fixture';

/** Public, secret-free description of the active source. Shared with `GET /api/v1/lots/source`. */
export interface LotSourceStatus {
  mode: LotSourceMode;
  live: boolean;
  label: string;
}

export const LOT_SOURCE_STATUS: Readonly<Record<LotSourceMode, LotSourceStatus>> = {
  fixture: { mode: 'fixture', live: false, label: 'Demo fixtures' },
  goszakup: { mode: 'goszakup', live: true, label: 'Goszakup' },
};

/**
 * Raised when the selected source cannot answer right now: upstream unreachable, upstream
 * rejecting the request or no credentials configured for it.
 *
 * The message is safe for a public response — it never carries a token, an upstream URL,
 * an upstream id or any other configuration detail. A live failure must never degrade into
 * fixture data, so it surfaces as an error instead of an empty or fake result.
 */
export class LotSourceUnavailableError extends Error {
  /**
   * Redacted upstream reason, kept for backend-side diagnostics (logs, developer probe) only.
   * A public response uses {@link LotSourceUnavailableError.message} and never the cause.
   */
  readonly cause: unknown;

  constructor(cause?: unknown) {
    super('Lot source is temporarily unavailable');
    this.name = 'LotSourceUnavailableError';
    this.cause = cause;
  }
}

/**
 * The only place lots enter the application. Every implementation returns the same normalized
 * CP-03 contract, so downstream code never learns where a lot came from and raw upstream DTOs
 * stay inside the source that produced them.
 */
export interface LotSource {
  /** Fetch one bounded source result set, allowing the source to push supported filters upstream. */
  fetchLots(filters?: LotFilters): Promise<Lot[]>;

  /**
   * One lot by its normalized public id.
   *
   * @returns the lot, or `null` when the source genuinely does not have it (public 404).
   *          Upstream trouble raises {@link LotSourceUnavailableError} instead.
   */
  fetchLot(id: string): Promise<Lot | null>;

  /**
   * Bounded detail-only byte retrieval for one official procurement document.
   * Never called on list endpoints and never persists bytes to disk.
   */
  fetchDocumentBytes?(document: LotDocument): Promise<DocumentBytesResult>;
}

export const LOT_SOURCE = Symbol('LOT_SOURCE');

/** Default source: the deterministic CP-03 fixtures served by `/lots`. */
@Injectable()
export class FixtureLotSource implements LotSource {
  fetchLots(filters?: LotFilters): Promise<Lot[]> {
    // Filtering stays in TenderService so fixtures and live records share one implementation.
    void filters;
    return Promise.resolve([...LOT_FIXTURES]);
  }

  fetchLot(id: string): Promise<Lot | null> {
    const lot = LOT_FIXTURES.find((item) => item.id === id);
    return Promise.resolve(lot ? { ...lot } : null);
  }

  fetchDocumentBytes(document: LotDocument): Promise<DocumentBytesResult> {
    const bytes = FIXTURE_DOCUMENT_BYTES[document.id];
    if (!bytes) {
      return Promise.resolve({
        status: 'UNAVAILABLE',
        reason: 'не удалось безопасно получить байты файла из источника',
      });
    }
    return Promise.resolve({ status: 'OK', bytes });
  }
}
