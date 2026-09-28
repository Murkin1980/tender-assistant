/**
 * Raw shapes of the official Goszakup OWS v3 GraphQL registry.
 * Contract: https://ows.goszakup.gov.kz/help/v3/schema/ (objects `Lots`, `TrdBuy`, `Subject`,
 * `RefTradeMethods`, `RefBuyStatus`).
 *
 * These types exist only at the integration boundary: everything upstream returns is
 * nullable for us because the registry omits optional fields, and nothing below may
 * leak into the public API.
 */

/**
 * Human-readable label of an official OWS v3 reference directory (`nameRu`/`nameKz`).
 * Only these documented labels may reach the public contract — raw directory codes never do.
 */
export interface GoszakupRefLabelDto {
  nameRu?: string | null;
  nameKz?: string | null;
}

export interface GoszakupTrdBuyDto {
  /** Дата окончания приема заявок. */
  endDate?: string | null;
  /** Дата и время публикации. */
  publishDate?: string | null;
  numberAnno?: string | null;
  /** Способ закупки — справочник методов закупок. */
  RefTradeMethods?: GoszakupRefLabelDto | null;
  /** Статус объявления — справочник статусов. */
  RefBuyStatus?: GoszakupRefLabelDto | null;
}

export interface GoszakupSubjectDto {
  bin?: string | null;
  nameRu?: string | null;
  nameKz?: string | null;
}

export interface GoszakupLotDto {
  /** Идентификатор лота в реестре. */
  id?: number | null;
  lotNumber?: string | null;
  /** Общая сумма лота. */
  amount?: number | null;
  nameRu?: string | null;
  nameKz?: string | null;
  descriptionRu?: string | null;
  descriptionKz?: string | null;
  customerBin?: string | null;
  customerNameRu?: string | null;
  customerNameKz?: string | null;
  trdBuyId?: number | null;
  trdBuyNumberAnno?: string | null;
  /** Коды КАТО мест поставки. */
  plnPointKatoList?: readonly string[] | null;
  Customer?: GoszakupSubjectDto | null;
  TrdBuy?: GoszakupTrdBuyDto | null;
}

export interface GoszakupGraphqlError {
  message?: unknown;
}

export interface GoszakupGraphqlResponse {
  data?: { Lots?: GoszakupLotDto[] | null } | null;
  errors?: GoszakupGraphqlError[] | null;
}

/**
 * `input LotsFiltersInput` — a deliberately narrow subset. Only filters that the
 * bounded probe/adapter actually needs are declared; the rest of the input object
 * stays untouched.
 */
export interface GoszakupLotsFilter {
  /** `id: [Int]` — documented official lookup of specific lots by their registry id. */
  id?: number[];
  /** Search Russian lot name and description with morphology, per the official schema. */
  nameDescriptionRu?: string;
}

/**
 * The single bounded read path: `Query.Lots(filter, limit)` from the official v3 schema.
 * Read-only by construction — the schema exposes no mutations and none are referenced here.
 */
export const GOSZAKUP_LOTS_QUERY = `query Lots($filter: LotsFiltersInput, $limit: Int) {
  Lots(filter: $filter, limit: $limit) {
    id
    lotNumber
    amount
    nameRu
    nameKz
    descriptionRu
    descriptionKz
    customerBin
    customerNameRu
    customerNameKz
    trdBuyId
    trdBuyNumberAnno
    plnPointKatoList
    Customer {
      bin
      nameRu
      nameKz
    }
    TrdBuy {
      endDate
      publishDate
      numberAnno
      RefTradeMethods {
        nameRu
        nameKz
      }
      RefBuyStatus {
        nameRu
        nameKz
      }
    }
  }
}`;
