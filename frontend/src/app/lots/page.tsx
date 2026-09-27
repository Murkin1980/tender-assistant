import Link from 'next/link';
import { SourceNotice } from '../../components/source-notice';
import {
  amountLabel,
  fetchLotSourceStatus,
  fetchLotsApi,
  lotQuery,
  type Lot,
  type SearchParams,
} from '../../lib/lots';

export const dynamic = 'force-dynamic';

type ListResult = { status: number | 'unreachable'; lots: Lot[] };

/** A failed list is a failure, never an empty or fixture-filled page. */
async function loadLots(query: URLSearchParams): Promise<ListResult> {
  try {
    const response = await fetchLotsApi(`?${query}`);
    if (!response.ok) return { status: response.status, lots: [] };
    try {
      return { status: 200, lots: (await response.json()) as Lot[] };
    } catch {
      return { status: 'unreachable', lots: [] };
    }
  } catch {
    return { status: 'unreachable', lots: [] };
  }
}

export default async function LotsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = lotQuery(await searchParams);
  const [source, { status, lots }] = await Promise.all([fetchLotSourceStatus(), loadLots(query)]);

  let error = '';
  if (status === 400) {
    error = 'Проверьте фильтры: сумма должна быть неотрицательным числом.';
  } else if (status === 503 && source?.live) {
    // The live source failed: say so instead of showing demo records as if they were real.
    error =
      'Источник Goszakup временно недоступен. Демо-примеры не подставляются вместо реальных данных — повторите попытку позже.';
  } else if (status !== 200) {
    error = 'Не удалось загрузить тендеры. Попробуйте ещё раз.';
  }

  return (
    <main className="lots-shell">
      <Link href="/">Tender Assistant</Link>
      <h1>Тендеры</h1>
      <SourceNotice status={source} />
      <p>
        Профиль участия: мебель из ЛДСП, Алматы, до 500 000 KZT. Алатауский район — предпочтение;
        металлические шкафы нецелевые.
      </p>
      <form action="/lots" method="get" className="lot-filters">
        <label>
          Поиск
          <input name="q" defaultValue={query.get('q') ?? ''} placeholder="Например, ЛДСП" />
        </label>
        <label>
          Максимальная сумма, KZT
          <input
            name="maxAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={query.get('maxAmount') ?? ''}
          />
        </label>
        <label>
          Город
          <select name="region" defaultValue={query.get('region') ?? ''}>
            <option value="">Все города</option>
            <option>Алматы</option>
            <option>Астана</option>
          </select>
        </label>
        <label>
          Район
          <input
            name="district"
            list="districts"
            defaultValue={query.get('district') ?? ''}
            placeholder="Все районы"
          />
        </label>
        <datalist id="districts">
          <option value="Алатауский" />
          <option value="Бостандыкский" />
        </datalist>
        <button type="submit">Применить</button>
        <Link href="/lots">Сбросить</Link>
      </form>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <p role="status">
            {source?.live
              ? `Показано: ${lots.length} — ограниченная выборка из реестра Goszakup, а не полный список подходящих закупок.`
              : `Найдено: ${lots.length}`}
          </p>
          {lots.length === 0 && <p>Ничего не найдено. Измените фильтры.</p>}
          <ul className="lot-list">
            {lots.map((lot) => (
              <li key={lot.id} className="lot-card">
                <h2>
                  <Link href={`/lots/${encodeURIComponent(lot.id)}`}>{lot.title}</Link>
                </h2>
                <strong>{amountLabel(lot.amount)}</strong>
                <p>
                  {lot.customer} · {lot.region} · {lot.district ?? 'Район не указан'}
                </p>
                <p>{lot.description}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
