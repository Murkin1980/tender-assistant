import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SourceNotice } from '../../../components/source-notice';
import {
  amountLabel,
  deadlineLabel,
  fetchLotSourceStatus,
  fetchLotsApi,
  lotRequirementCategories,
  requirementCategoryLabel,
  requirementsStatusLabel,
  timingLabel,
  type Lot,
  type LotDocument,
  type LotRequirements,
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

function resolveDocumentName(
  sourceDocumentId: string,
  documents: readonly LotDocument[] | undefined,
): string {
  const matched = documents?.find((doc) => doc.id === sourceDocumentId);
  return matched?.name || sourceDocumentId;
}

const DEFAULT_UNAVAILABLE_REQUIREMENTS: LotRequirements = {
  status: 'UNAVAILABLE',
  items: [],
  warnings: ['Официальные документы закупки отсутствуют — нужно проверить вручную в источнике.'],
};

export default async function LotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [source, { status, lot }] = await Promise.all([
    fetchLotSourceStatus(),
    loadLot(normalizedId(id)),
  ]);
  if (status === 404) notFound();

  const requirements = lot?.requirements ?? DEFAULT_UNAVAILABLE_REQUIREMENTS;
  const groupedRequirements = lotRequirementCategories
    .map((category) => ({
      category,
      label: requirementCategoryLabel(category),
      items: requirements.items.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);

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
            <dt>Рекомендация оператору</dt>
            <dd>
              <span className="action-badge" data-action={lot.actionability.status}>
                {lot.actionability.status === 'TAKE'
                  ? 'Брать в работу'
                  : lot.actionability.status === 'REVIEW'
                    ? 'Проверить'
                    : 'Не брать'}
              </span>
            </dd>
            <dt>Статус оценки профиля</dt>
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
          <p className="triage-note">
            Внутренняя операционная рекомендация по настроенным правилам; не является официальным
            статусом закупки или юридическим заключением о соответствии.
          </p>
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
              {lot.timing.deadline ? (
                <>
                  <time dateTime={lot.timing.deadline}>
                    {deadlineLabel(lot.timing.deadline)} (Алматы, UTC+5)
                  </time>{' '}
                  <span className="timing-badge" data-timing={lot.timing.status}>
                    {timingLabel(lot.timing)}
                  </span>
                </>
              ) : (
                // The registry does not publish a deadline for every selected lot.
                <span className="timing-badge" data-timing={lot.timing.status}>
                  {timingLabel(lot.timing)}
                </span>
              )}
            </dd>
            <dt>Способ закупки</dt>
            <dd>{lot.procurement.procurementMethod ?? 'Не указано'}</dd>
            <dt>Официальный статус</dt>
            <dd>{lot.procurement.officialStatus ?? 'Не указано'}</dd>
          </dl>
          <p className="triage-note">
            Состояние срока рассчитано только из даты окончания приёма заявок и не является
            официальным статусом закупки: официальный статус указан отдельным полем выше, а
            первоисточником остаётся запись источника.
          </p>
          <h2>Документы закупки</h2>
          {!lot.documents || lot.documents.length === 0 ? (
            <p>Документы не указаны источником.</p>
          ) : (
            <ul className="documents-list">
              {lot.documents.map((doc) => {
                const metaParts = [
                  doc.type ? `Тип: ${doc.type}` : null,
                  doc.mimeType,
                  doc.sizeBytes !== null ? `${doc.sizeBytes} байт` : null,
                ].filter(Boolean);
                return (
                  <li key={doc.id} className="document-item">
                    <span className="document-name">{doc.name}</span>
                    {metaParts.length > 0 && (
                      <span className="document-meta"> ({metaParts.join(', ')})</span>
                    )}
                    {' · '}
                    <a
                      href={doc.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="document-link"
                    >
                      Открыть документ
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          <h2>Требования</h2>
          <p>
            <span className="requirements-badge" data-requirements={requirements.status}>
              {requirements.status} · {requirementsStatusLabel(requirements.status)}
            </span>
          </p>
          <p className="triage-note">
            Извлечённые факты из официальных документов закупки приводятся отдельно от внутренней
            операционной рекомендации и не заменяют проверку первоисточника.
          </p>
          {groupedRequirements.length > 0 && (
            <div className="requirements-groups">
              {groupedRequirements.map((group) => (
                <section
                  key={group.category}
                  className="requirements-group"
                  data-category={group.category}
                >
                  <h3>{group.label}</h3>
                  <ul className="requirements-list">
                    {group.items.map((item, idx) => {
                      const docName = resolveDocumentName(item.sourceDocumentId, lot.documents);
                      return (
                        <li
                          key={`${item.sourceDocumentId}-${item.category}-${idx}`}
                          className="requirement-item"
                        >
                          <span className="requirement-text">{item.text}</span>{' '}
                          <span className="requirement-source">
                            (Документ: {docName}
                            {item.sourceLocator ? ` · ${item.sourceLocator}` : ''})
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {requirements.warnings.length > 0 && (
            <div className="requirements-warnings">
              <p className="requirements-warnings-title">Нужно проверить вручную:</p>
              <ul>
                {requirements.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
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
