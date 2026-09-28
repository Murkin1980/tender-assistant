import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SourceNotice } from '../../../components/source-notice';
import {
  amountLabel,
  deadlineLabel,
  fetchLotSourceStatus,
  fetchLotsApi,
  type Lot,
  type LotSourceStatus,
} from '../../../lib/lots';

export const dynamic = 'force-dynamic';

type DetailResult = { status: number | 'unreachable'; lot?: Lot };

/**
 * Next hands the dynamic segment over exactly as it appears in the URL, so an id such as
 * `goszakup:900000001` arrives percent-encoded. Without this step the id would be encoded twice
 * and the backend would never see the real one. A malformed sequence is left as it is.
 */
function normalizedId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

async function loadLot(id: string): Promise<DetailResult> {
  try {
    const response = await fetchLotsApi(`/${encodeURIComponent(id)}`);
    if (!response.ok) return { status: response.status };
    try {
      return { status: 200, lot: (await response.json()) as Lot };
    } catch {
      return { status: 'unreachable' };
    }
  } catch {
    return { status: 'unreachable' };
  }
}

/** No claim is made about the origin when the backend did not report the source. */
function originText(source: LotSourceStatus | null): string {
  if (!source) return 'Ссылка ведёт в реестр источника.';
  return source.live
    ? 'Ссылка ведёт в реестр Goszakup: карточка показана в режиме чтения.'
    : 'Это вымышленный пример. Ссылка ведёт в реестр источника, а не на реальный лот.';
}

function failureText(status: number | 'unreachable', source: LotSourceStatus | null): string {
  if (status === 503 && source?.live) {
    return 'Источник Goszakup временно недоступен. Демо-примеры не подставляются вместо реальных данных — попробуйте открыть карточку позже.';
  }
  return 'Не удалось загрузить тендер. Обновите страницу, чтобы повторить.';
}

export default async function LotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [source, { status, lot }] = await Promise.all([
    fetchLotSourceStatus(),
    loadLot(normalizedId(id)),
  ]);
  if (status === 404) notFound();

  return (
    <main className="lots-shell">
      <Link href="/lots">← К списку тендеров</Link>
      {!lot ? (
        <p role="alert">{failureText(status, source)}</p>
      ) : (
        <article className="lot-card">
          <SourceNotice status={source} />
          <h1>{lot.title}</h1>
          <dl className="lot-details">
            <dt>Статус</dt>
            <dd>
              <span className="triage-badge" data-status={lot.assessment.status}>
                {lot.assessment.status}
              </span>
              <ul className="triage-reasons">
                {lot.assessment.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </dd>
            <dt>ID</dt>
            <dd>{lot.id}</dd>
            <dt>Источник</dt>
            <dd>{lot.source}</dd>
            <dt>Заказчик</dt>
            <dd>{lot.customer}</dd>
            <dt>Сумма</dt>
            <dd>{amountLabel(lot.amount)}</dd>
            <dt>Город</dt>
            <dd>{lot.region}</dd>
            <dt>Район</dt>
            <dd>{lot.district ?? 'Не указан'}</dd>
          </dl>
          <h2>Данные закупки</h2>
          <dl className="lot-details">
            <dt>Номер лота</dt>
            <dd>{lot.procurement.lotNumber ?? 'Не указано'}</dd>
            <dt>Номер объявления</dt>
            <dd>{lot.procurement.announcementNumber ?? 'Не указано'}</dd>
            <dt>БИН заказчика</dt>
            <dd>{lot.procurement.customerBin ?? 'Не указано'}</dd>
            <dt>Опубликовано</dt>
            <dd>
              {lot.procurement.publishedAt ? (
                <time dateTime={lot.procurement.publishedAt}>
                  {deadlineLabel(lot.procurement.publishedAt)} (Алматы, UTC+5)
                </time>
              ) : (
                'Не указано'
              )}
            </dd>
            <dt>Приём заявок до</dt>
            <dd>
              {lot.bidDeadline ? (
                <time dateTime={lot.bidDeadline}>
                  {deadlineLabel(lot.bidDeadline)} (Алматы, UTC+5)
                </time>
              ) : (
                // The registry does not publish a deadline for every selected lot.
                'Срок не указан'
              )}
            </dd>
            <dt>Способ закупки</dt>
            <dd>{lot.procurement.procurementMethod ?? 'Не указано'}</dd>
            <dt>Официальный статус</dt>
            <dd>{lot.procurement.officialStatus ?? 'Не указано'}</dd>
          </dl>
          <h2>Предмет закупки</h2>
          <p>{lot.description || 'Описание не указано.'}</p>
          <a href={lot.sourceUrl} target="_blank" rel="noopener noreferrer">
            Открыть источник
          </a>
          <p>{originText(source)}</p>
        </article>
      )}
    </main>
  );
}
