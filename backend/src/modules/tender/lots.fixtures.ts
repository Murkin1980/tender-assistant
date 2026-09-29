import type { Lot } from './lot';
import {
  buildImageOnlyPdfBytes,
  buildTextNativeDocxBytes,
  buildTextNativePdfBytes,
} from './lot-requirements';

/**
 * Deterministic in-memory byte payloads for the synthetic CP-11 fixture documents.
 *
 * Kept in memory and used by `FixtureLotSource.fetchDocumentBytes` so the default fixture path
 * exercises the exact same byte-signature detection, PDF/DOCX parser and requirement extraction
 * rules as live documents without network access or disk persistence:
 * - `fixture-1` (`doc-fixture-1-1`, `doc-fixture-1-2`): text-native PDFs -> `AVAILABLE`;
 * - `fixture-2` (`doc-fixture-2-1`, whose metadata has `mimeType: null` and no file extension):
 *   text-native DOCX with a table + a drawing reference -> `PARTIAL` with manual-review warning;
 * - `fixture-5` (`doc-fixture-5-1`): image-only PDF without a text layer -> `UNAVAILABLE` with
 *   manual-review warning (no OCR).
 */
export const FIXTURE_DOCUMENT_BYTES: Readonly<Record<string, Uint8Array>> = {
  'doc-fixture-1-1': buildTextNativePdfBytes([
    [
      '1. Предмет закупки',
      'Наименование товара: Столы письменные из ЛДСП для учебных аудиторий',
      'Количество: 6 комплектов',
      '2. Технические характеристики и материалы',
      'Габаритные размеры: 1200х600х750 мм, толщина столешницы 16 мм',
      'Материал изготовления: ЛДСП класса эмиссии Е1, кромка ПВХ 2 мм',
    ],
    [
      '3. Условия поставки и квалификация',
      'Место и срок поставки: г. Алматы, Алатауский район, доставка и сборка в течение 15 календарных дней',
      'Квалификационные требования: наличие опыта поставки корпусной мебели и отсутствие налоговой задолженности',
    ],
  ]),
  'doc-fixture-1-2': buildTextNativePdfBytes([
    [
      '1. Условия договора и приёмки',
      'Подтверждающие документы: сертификат соответствия ЕАЭС и паспорт изделия при поставке',
      'Гарантийный срок: не менее 12 месяцев со дня подписания акта приёма-передачи',
    ],
  ]),
  'doc-fixture-2-1': buildTextNativeDocxBytes({
    tables: [
      [
        ['Наименование товара', 'Стеллажи библиотечные односторонние из ЛДСП'],
        ['Количество', '10 штук'],
        ['Материал', 'ЛДСП толщиной 16 мм, торцы облицованы кромкой ПВХ 2 мм'],
      ],
    ],
    paragraphs: [
      'Точные габаритные размеры секций и схема расстановки определяются согласно чертежу в графическом приложении (см. рисунок 1).',
    ],
  }),
  'doc-fixture-5-1': buildImageOnlyPdfBytes(),
};

// Synthetic records, not real procurement notices. URLs lead to the source registry.
// Together they cover all three CP-07 triage outcomes: MATCH, REVIEW and EXCLUDE, and — per
// CP-08 — the full range of procurement metadata: fully present, partially missing and absent.
// Per CP-09 they also cover every deadline state: a valid future deadline (fixture-1, -2, -5),
// a valid past deadline (fixture-3, -4) and a missing deadline (fixture-6). The expired records
// stay in the default list on purpose — a past deadline is never hidden by default.
export const LOT_FIXTURES: readonly Lot[] = [
  {
    id: 'fixture-1',
    source: 'Goszakup',
    sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
    title: 'Столы письменные из ЛДСП',
    customer: 'Учебный центр (пример)',
    amount: 420000,
    region: 'Алматы',
    district: 'Алатауский',
    bidDeadline: '2026-10-15T12:00:00.000Z',
    description:
      'Мебель: 6 столов из ламинированной древесно-стружечной плиты (ЛДСП / LDSP), доставка и сборка.',
    procurement: {
      lotNumber: '1',
      announcementNumber: 'DEMO-ANN-0001',
      customerBin: '000000000001',
      publishedAt: '2026-09-15T08:00:00.000Z',
      procurementMethod: 'Запрос котировок (пример)',
      officialStatus: 'Приём заявок (пример)',
    },
    documents: [
      {
        id: 'doc-fixture-1-1',
        name: 'Техническая спецификация (пример)',
        type: null,
        mimeType: 'application/pdf',
        sizeBytes: null,
        sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
      },
      {
        id: 'doc-fixture-1-2',
        name: 'Проект договора поставки мебели (пример)',
        type: null,
        mimeType: 'application/pdf',
        sizeBytes: null,
        sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
      },
    ],
  },
  {
    id: 'fixture-2',
    source: 'Goszakup',
    sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
    title: 'Стеллажи из ЛДСП',
    customer: 'Библиотека (пример)',
    amount: 500000,
    region: 'Алматы',
    district: 'Бостандыкский',
    bidDeadline: '2026-10-16T12:00:00.000Z',
    description: 'Мебель для книг, ЛДСП, кромка ПВХ.',
    procurement: {
      lotNumber: '1',
      announcementNumber: 'DEMO-ANN-0002',
      customerBin: '000000000002',
      publishedAt: '2026-09-16T08:00:00.000Z',
      procurementMethod: 'Запрос предложений (пример)',
      officialStatus: 'Приём заявок (пример)',
    },
    documents: [
      {
        id: 'doc-fixture-2-1',
        name: 'Спецификация стеллажей (пример)',
        type: null,
        mimeType: null,
        sizeBytes: null,
        sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
      },
    ],
  },
  {
    id: 'fixture-3',
    source: 'Goszakup',
    sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
    title: 'Комплект офисной мебели из ЛДСП',
    customer: 'Администрация (пример)',
    amount: 780000,
    region: 'Алматы',
    district: 'Алатауский',
    bidDeadline: '2026-09-20T12:00:00.000Z',
    description: 'Столы и тумбы из ЛДСП. Сумма выше начального целевого бюджета.',
    procurement: {
      lotNumber: '2',
      announcementNumber: 'DEMO-ANN-0003',
      customerBin: '000000000003',
      publishedAt: '2026-09-17T08:00:00.000Z',
      procurementMethod: null,
      officialStatus: null,
    },
    documents: [],
  },
  {
    id: 'fixture-4',
    source: 'Goszakup',
    sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
    title: 'Тумбы из ЛДСП',
    customer: 'Колледж (пример)',
    amount: 280000,
    region: 'Астана',
    district: null,
    bidDeadline: '2026-09-21T12:00:00.000Z',
    description: 'Мебель из ЛДСП с доставкой в Астану.',
    procurement: {
      lotNumber: null,
      announcementNumber: 'DEMO-ANN-0004',
      customerBin: '000000000004',
      publishedAt: null,
      procurementMethod: 'Единый источник (пример)',
      officialStatus: 'Приём заявок (пример)',
    },
    documents: [],
  },
  {
    id: 'fixture-5',
    source: 'Goszakup',
    sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
    title: 'Шкафы металлические',
    customer: 'Спортивный центр (пример)',
    amount: 350000,
    region: 'Алматы',
    district: 'Алатауский',
    bidDeadline: '2026-10-19T12:00:00.000Z',
    description:
      'Сварные шкафы из стали. Не ЛДСП; нецелевой пример для текущего мебельного профиля.',
    procurement: {
      lotNumber: '1',
      announcementNumber: 'DEMO-ANN-0005',
      customerBin: '000000000005',
      publishedAt: '2026-09-18T08:00:00.000Z',
      procurementMethod: 'Запрос котировок (пример)',
      officialStatus: 'Приём заявок (пример)',
    },
    documents: [
      {
        id: 'doc-fixture-5-1',
        name: 'Техническая спецификация шкафов (пример)',
        type: null,
        mimeType: 'application/pdf',
        sizeBytes: null,
        sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
      },
    ],
  },
  {
    id: 'fixture-6',
    source: 'Goszakup',
    sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
    title: 'Поставка хозяйственных товаров',
    customer: 'Детский сад (пример)',
    amount: 180000,
    region: 'Алматы',
    district: null,
    bidDeadline: '',
    description: 'Инвентарь и расходные материалы для учреждения. Состав уточняется приложением.',
    procurement: {
      lotNumber: null,
      announcementNumber: null,
      customerBin: null,
      publishedAt: null,
      procurementMethod: null,
      officialStatus: null,
    },
    documents: [],
  },
];
