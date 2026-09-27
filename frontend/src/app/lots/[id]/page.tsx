import Link from 'next/link';
import { notFound } from 'next/navigation';
import { amountLabel, deadlineLabel, fetchLotsApi, type Lot } from '../../../lib/lots';

export const dynamic = 'force-dynamic';

export default async function LotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let response: Response | undefined;
  try {
    response = await fetchLotsApi(`/${encodeURIComponent(id)}`);
  } catch {
    /* Render a safe retry message below. */
  }
  if (response?.status === 404) notFound();
  let lot: Lot | undefined;
  if (response?.ok) {
    try {
      lot = (await response.json()) as Lot;
    } catch {
      /* Invalid upstream response. */
    }
  }
  return (
    <main className="lots-shell">
      <Link href="/lots">← К списку тендеров</Link>
      {!lot ? (
        <p role="alert">Не удалось загрузить тендер. Обновите страницу, чтобы повторить.</p>
      ) : (
        <article className="lot-card">
          <p className="eyebrow">Тестовые данные</p>
          <h1>{lot.title}</h1>
          <dl className="lot-details">
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
            <dt>Приём заявок до</dt>
            <dd>
              <time dateTime={lot.bidDeadline}>
                {deadlineLabel(lot.bidDeadline)} (Алматы, UTC+5)
              </time>
            </dd>
          </dl>
          <h2>Предмет закупки</h2>
          <p>{lot.description}</p>
          <a href={lot.sourceUrl} target="_blank" rel="noopener noreferrer">
            Открыть источник
          </a>
          <p>Это вымышленный пример. Ссылка ведёт в реестр источника, а не на реальный лот.</p>
        </article>
      )}
    </main>
  );
}
