import type { ReactElement } from 'react';
import type { LotSourceStatus } from '../lib/lots';

const FIXTURE_TEXT =
  'Это синтетические тестовые данные, придуманные для разработки, — не реальные объявления Goszakup.';
const LIVE_TEXT =
  'Данные получены онлайн из официального реестра Goszakup (только чтение, ограниченная выборка).';
const UNKNOWN_TEXT = 'Источник данных не определён: показанные записи нельзя считать проверенными.';

/**
 * The single trust indicator of the lot pages.
 *
 * It states LIVE data only when the backend reports a live source, so a fixture mode can
 * never be presented as live and a live failure can never be presented as demo data.
 */
export function SourceNotice({ status }: { status: LotSourceStatus | null }): ReactElement {
  if (!status) {
    return (
      <p className="source-notice" data-source="unknown">
        {UNKNOWN_TEXT}
      </p>
    );
  }

  return (
    <p className="source-notice" data-source={status.mode}>
      <strong className="source-badge">{status.live ? 'LIVE' : 'DEMO'}</strong>{' '}
      <span className="source-label">{status.label}</span>
      {' — '}
      {status.live ? LIVE_TEXT : FIXTURE_TEXT}
    </p>
  );
}
