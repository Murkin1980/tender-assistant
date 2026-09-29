import Link from 'next/link';
import { SourceNotice } from '../../components/source-notice';
import {
  amountLabel,
  fetchLotSourceStatus,
  fetchLotsApi,
  lotAssessmentStatuses,
  lotQuery,
  lotTimingStatuses,
  timingLabel,
  type Lot,
  type LotTimingStatus,
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

const TIMING_OPTIONS: Readonly<Record<LotTimingStatus, string>> = {
  OPEN_BY_DEADLINE: 'Срок открыт',
  DEADLINE_UNKNOWN: 'Срок не указан',
  CLOSED_BY_DEADLINE: 'Срок истёк',
};

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
      <p>
        <Link href="/lots?maxAmount=500000&region=Алматы&deadlineStatus=OPEN_BY_DEADLINE">
          Наш профиль
        </Link>
      </p>
      <p className="triage-note">
        Статус — автоматический предварительный отбор по простым правилам. Финальное решение
        принимает оператор.
      </p>
      <p className="triage-note">
        Срок — расчётное состояние по дате окончания приёма заявок, а не официальный статус закупки.
        Тендеры с истёкшим сроком остаются в списке, пока не выбран фильтр по сроку.
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
        <label>
          Статус
          <select name="status" defaultValue={query.get('status') ?? ''}>
            <option value="">Все статусы</option>
            {lotAssessmentStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Срок
          <select name="deadlineStatus" defaultValue={query.get('deadlineStatus') ?? ''}>
            <option value="">Все сроки</option>
            {lotTimingStatuses.map((timing) => (
              <option key={timing} value={timing}>
                {TIMING_OPTIONS[timing]}
              </option>
            ))}
          </select>
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
                <p className="lot-heading">
                  <span className="triage-badge" data-status={lot.assessment.status}>
                    {lot.assessment.status}
                  </span>
                  <span className="timing-badge" data-timing={lot.timing.status}>
                    {timingLabel(lot.timing)}
                  </span>
                  <strong>{amountLabel(lot.amount)}</strong>
                </p>
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
