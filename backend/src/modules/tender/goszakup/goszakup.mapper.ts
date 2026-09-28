import type { Lot, LotProcurement } from '../lot';
import {
  GOSZAKUP_ID_PREFIX,
  GOSZAKUP_LOT_URL_BASE,
  GOSZAKUP_MAX_LOT_ID,
  GOSZAKUP_SOURCE,
} from './goszakup.config';
import type { GoszakupLotDto, GoszakupRefLabelDto } from './goszakup-lots.query';

/**
 * КАТО (Классификатор административно-территориальных объектов) — the first two digits of a
 * delivery-place code identify the region. Upstream sends codes only, so `region` is the region
 * name for a code we can resolve and the raw code otherwise. Nothing is invented: an absent code
 * stays absent.
 */
const KATO_REGIONS: Readonly<Record<string, string>> = {
  '10': 'Абайская область',
  '11': 'Акмолинская область',
  '15': 'Актюбинская область',
  '19': 'Алматинская область',
  '23': 'Атырауская область',
  '27': 'Западно-Казахстанская область',
  '31': 'Жамбылская область',
  '33': 'Жетысуская область',
  '35': 'Карагандинская область',
  '39': 'Костанайская область',
  '43': 'Кызылординская область',
  '47': 'Мангистауская область',
  '55': 'Павлодарская область',
  '59': 'Северо-Казахстанская область',
  '61': 'Туркестанская область',
  '62': 'Улытауская область',
  '63': 'Восточно-Казахстанская область',
  '71': 'Астана',
  '75': 'Алматы',
  '79': 'Шымкент',
};

const pickText = (...values: Array<string | null | undefined>): string => {
  for (const value of values) {
    const text = value?.trim();
    if (text) return text;
  }
  return '';
};

/** CP-08 metadata distinguishes "not provided" (`null`) from an actual value; `''` never leaks. */
const orNull = (value: string): string | null => (value ? value : null);

/**
 * Upstream timestamps are strings; they stay ISO-8601 exactly once. An unparsable or missing
 * value yields `null` so a caller can keep it missing instead of guessing a moment in time.
 */
const toIsoOrNull = (value: string | null | undefined): string | null => {
  const text = value?.trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** The flat CP-03 `bidDeadline` keeps its canonical "missing is empty" convention. */
const toIsoDate = (value: string | null | undefined): string => toIsoOrNull(value) ?? '';

/** Reference-directory label (ru, otherwise kk); an absent directory entry stays `null`. */
const refLabel = (ref: GoszakupRefLabelDto | null | undefined): string | null =>
  orNull(pickText(ref?.nameRu, ref?.nameKz));

const toRegion = (katoList: readonly string[] | null | undefined): string => {
  if (!katoList || katoList.length === 0) return '';
  const regions = new Set<string>();
  for (const code of katoList) {
    const kato = code?.trim();
    if (!kato) continue;
    regions.add(KATO_REGIONS[kato.slice(0, 2)] ?? kato);
  }
  return [...regions].join(', ');
};

function buildDescription(lot: GoszakupLotDto, customerBin: string): string {
  const parts = [
    pickText(lot.descriptionRu, lot.descriptionKz),
    customerBin ? `БИН заказчика: ${customerBin}` : '',
  ].filter((part) => part.length > 0);
  return parts.join('. ');
}

/**
 * CP-08 decision metadata, mapped only from documented OWS v3 fields:
 *
 * - `lotNumber` ← `Lots.lotNumber` («Номер лота»);
 * - `announcementNumber` ← `Lots.trdBuyNumberAnno`, falling back to `TrdBuy.numberAnno`
 *   (both documented as «Номер объявления»);
 * - `customerBin` ← `Lots.customerBin` / `Subject.bin` («БИН заказчика»);
 * - `publishedAt` ← `TrdBuy.publishDate` («Дата и время публикации»);
 * - `procurementMethod` ← `TrdBuy.RefTradeMethods.nameRu|nameKz` («Способ закупки» from the
 *   official methods directory);
 * - `officialStatus` ← `TrdBuy.RefBuyStatus.nameRu|nameKz` («Статус объявления» from the
 *   official statuses directory).
 *
 * Numeric codes (`refTradeMethodsId`, `refBuyStatusId`, `refLotStatusId`) are deliberately not
 * mapped: their value sets are not documented, so only the directory labels are exposed. A field
 * the registry omits (or an unparsable date) stays `null` — never a placeholder.
 */
function buildProcurement(lot: GoszakupLotDto, customerBin: string): LotProcurement {
  return {
    lotNumber: orNull(pickText(lot.lotNumber)),
    announcementNumber: orNull(pickText(lot.trdBuyNumberAnno, lot.TrdBuy?.numberAnno)),
    customerBin: orNull(customerBin),
    publishedAt: toIsoOrNull(lot.TrdBuy?.publishDate),
    procurementMethod: refLabel(lot.TrdBuy?.RefTradeMethods),
    officialStatus: refLabel(lot.TrdBuy?.RefBuyStatus),
  };
}

/**
 * Maps one registry record onto the existing CP-03 lot contract.
 *
 * Fields the OWS v3 `Lots` query does not carry are left empty instead of being fabricated:
 * `district` is always `null` (the registry exposes only КАТО delivery codes), and
 * `bidDeadline` is empty when the parent announcement has no `endDate`.
 *
 * @returns `null` when the record has no usable id or amount — such a record is skipped
 *          rather than padded with placeholder values.
 */
export function mapGoszakupLot(lot: GoszakupLotDto | null | undefined): Lot | null {
  if (!lot || typeof lot.id !== 'number' || !Number.isInteger(lot.id)) return null;
  if (typeof lot.amount !== 'number' || !Number.isFinite(lot.amount)) return null;

  const customerBin = pickText(lot.customerBin, lot.Customer?.bin);

  return {
    id: `${GOSZAKUP_ID_PREFIX}${lot.id}`,
    source: GOSZAKUP_SOURCE,
    sourceUrl: `${GOSZAKUP_LOT_URL_BASE}/id/${lot.id}`,
    title: pickText(lot.nameRu, lot.nameKz),
    customer: pickText(lot.customerNameRu, lot.customerNameKz, lot.Customer?.nameRu),
    amount: lot.amount,
    region: toRegion(lot.plnPointKatoList),
    district: null,
    bidDeadline: toIsoDate(lot.TrdBuy?.endDate),
    description: buildDescription(lot, customerBin),
    procurement: buildProcurement(lot, customerBin),
  };
}

/** Deterministic normalization of one bounded page; unusable records are dropped in order. */
export function mapGoszakupLots(lots: readonly GoszakupLotDto[]): Lot[] {
  const mapped: Lot[] = [];
  for (const lot of lots) {
    const normalized = mapGoszakupLot(lot);
    if (normalized) mapped.push(normalized);
  }
  return mapped;
}

/**
 * Inverse of the id mapping above: the registry id behind a normalized public id.
 *
 * @returns `null` for anything that is not exactly `goszakup:<positive registry id>` — an id of
 *          another source, a malformed id or a value the upstream `Int` cannot carry. Such an id
 *          cannot exist in the registry and must not be turned into an upstream query.
 */
export function parseGoszakupLotId(id: string): number | null {
  if (typeof id !== 'string' || !id.startsWith(GOSZAKUP_ID_PREFIX)) return null;

  const registryId = id.slice(GOSZAKUP_ID_PREFIX.length);
  if (!/^\d+$/.test(registryId)) return null;

  const numeric = Number(registryId);
  return numeric > 0 && numeric <= GOSZAKUP_MAX_LOT_ID ? numeric : null;
}
