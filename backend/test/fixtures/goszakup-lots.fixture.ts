import type {
  GoszakupGraphqlResponse,
  GoszakupLotDto,
} from '../../src/modules/tender/goszakup/goszakup-lots.query';

/**
 * Synthetic OWS v3 GraphQL payloads used by deterministic tests only.
 *
 * Every value here is invented test data — no real announcement, customer or BIN. The field
 * names follow the official v3 schema (https://ows.goszakup.gov.kz/help/v3/schema/).
 */

/** A record with every field the bounded query asks for. */
export const FULL_LOT: GoszakupLotDto = {
  id: 900000001,
  lotNumber: '1',
  amount: 420000,
  nameRu: 'Столы из ЛДСП (пример)',
  nameKz: 'ЖСҚ үстелдері (мысал)',
  descriptionRu: 'Шесть столов из ЛДСП с доставкой',
  descriptionKz: 'ЖСҚ алты үстел',
  customerBin: '000740000001',
  customerNameRu: 'Учебный центр (пример)',
  customerNameKz: 'Оқу орталығы (мысал)',
  trdBuyId: 800000001,
  trdBuyNumberAnno: '0001-1',
  plnPointKatoList: ['751030000'],
  Customer: { bin: '000740000001', nameRu: 'Учебный центр (пример)', nameKz: null },
  TrdBuy: {
    endDate: '2026-10-20T12:00:00Z',
    publishDate: '2026-09-20T08:00:00Z',
    numberAnno: '0001-1',
    RefTradeMethods: { nameRu: 'Запрос котировок (пример)', nameKz: 'Ұсыныстар сұрау (мысал)' },
    RefBuyStatus: { nameRu: 'Приём заявок (пример)', nameKz: 'Өтінімдер қабылдау (мысал)' },
  },
};

/** A record that only carries the fields Goszakup guarantees: id and amount. */
export const MINIMAL_LOT: GoszakupLotDto = {
  id: 900000002,
  amount: 500000,
};

/** Records without a usable id/amount must be skipped instead of padded with placeholders. */
export const UNUSABLE_LOTS: GoszakupLotDto[] = [
  // Malformed upstream records: the casts keep the intent explicit without weakening the DTO.
  { amount: 100 } as GoszakupLotDto,
  { id: 900000003 } as GoszakupLotDto,
  { id: 900000004, amount: Number.NaN },
];

export const OK_RESPONSE: GoszakupGraphqlResponse = {
  data: { Lots: [FULL_LOT, MINIMAL_LOT] },
};

/** HTTP 200 with a GraphQL error payload is still a failure. */
export const GRAPHQL_ERROR_RESPONSE: GoszakupGraphqlResponse = {
  errors: [{ message: 'Cannot query field "totalSum" on type "Lots".' }],
};
