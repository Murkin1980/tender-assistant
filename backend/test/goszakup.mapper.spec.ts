import {
  mapGoszakupLot,
  mapGoszakupLots,
  parseGoszakupLotId,
} from '../src/modules/tender/goszakup/goszakup.mapper';
import type { Lot } from '../src/modules/tender/lot';
import type { GoszakupLotDto } from '../src/modules/tender/goszakup/goszakup-lots.query';
import { FULL_LOT, MINIMAL_LOT, UNUSABLE_LOTS } from './fixtures/goszakup-lots.fixture';

describe('mapGoszakupLot', () => {
  it('normalizes a full OWS v3 record into the existing lot contract', () => {
    expect(mapGoszakupLot(FULL_LOT)).toEqual({
      id: 'goszakup:900000001',
      source: 'goszakup',
      sourceUrl: 'https://goszakup.gov.kz/ru/view/lots/index/id/900000001',
      title: 'Столы из ЛДСП (пример)',
      customer: 'Учебный центр (пример)',
      amount: 420000,
      region: 'Алматы',
      district: null,
      bidDeadline: '2026-10-20T12:00:00.000Z',
      description: 'Шесть столов из ЛДСП с доставкой. БИН заказчика: 000740000001',
      procurement: {
        lotNumber: '1',
        announcementNumber: '0001-1',
        customerBin: '000740000001',
        publishedAt: '2026-09-20T08:00:00.000Z',
        procurementMethod: 'Запрос котировок (пример)',
        officialStatus: 'Приём заявок (пример)',
      },
    });
  });

  it('falls back to the state-language fields and the nested customer object', () => {
    const lot = mapGoszakupLot({
      id: 900000010,
      amount: 120000,
      nameKz: 'Үстелдер',
      customerNameKz: 'Кітапхана',
      Customer: { bin: '000740000002' },
    });

    expect(lot).toMatchObject({
      title: 'Үстелдер',
      customer: 'Кітапхана',
      description: 'БИН заказчика: 000740000002',
    });
  });

  it('keeps fields the registry did not supply empty instead of inventing them', () => {
    const lot = mapGoszakupLot(MINIMAL_LOT);

    expect(lot).toEqual({
      id: 'goszakup:900000002',
      source: 'goszakup',
      sourceUrl: 'https://goszakup.gov.kz/ru/view/lots/index/id/900000002',
      title: '',
      customer: '',
      amount: 500000,
      region: '',
      district: null,
      bidDeadline: '',
      description: '',
      procurement: {
        lotNumber: null,
        announcementNumber: null,
        customerBin: null,
        publishedAt: null,
        procurementMethod: null,
        officialStatus: null,
      },
    });
  });

  it('maps lot number and announcement number from their documented fields', () => {
    expect(mapGoszakupLot({ id: 1, amount: 1, lotNumber: ' 3 ' })?.procurement.lotNumber).toBe('3');
    // Both documented «Номер объявления» fields; the denormalized lot copy wins.
    expect(
      mapGoszakupLot({ id: 1, amount: 1, trdBuyNumberAnno: '0002-1' })?.procurement
        .announcementNumber,
    ).toBe('0002-1');
    expect(
      mapGoszakupLot({ id: 1, amount: 1, trdBuyNumberAnno: ' ', TrdBuy: { numberAnno: '0002-2' } })
        ?.procurement.announcementNumber,
    ).toBe('0002-2');
    expect(mapGoszakupLot({ id: 1, amount: 1 })?.procurement.announcementNumber).toBeNull();
  });

  it('exposes the customer BIN as dedicated structured metadata', () => {
    expect(
      mapGoszakupLot({ id: 1, amount: 1, customerBin: '000740000010' })?.procurement.customerBin,
    ).toBe('000740000010');
    expect(
      mapGoszakupLot({ id: 1, amount: 1, Customer: { bin: '000740000011' } })?.procurement
        .customerBin,
    ).toBe('000740000011');
    expect(mapGoszakupLot({ id: 1, amount: 1 })?.procurement.customerBin).toBeNull();
  });

  it('maps the publication timestamp and never fabricates an invalid one', () => {
    const publishedAt = (publishDate?: string | null): string | null =>
      mapGoszakupLot({ id: 1, amount: 1, TrdBuy: { publishDate } })?.procurement.publishedAt ??
      null;

    expect(publishedAt('2026-09-20T08:00:00Z')).toBe('2026-09-20T08:00:00.000Z');
    expect(publishedAt('2026-09-20T13:00:00+05:00')).toBe('2026-09-20T08:00:00.000Z');
    // An unparsable or missing date stays missing instead of becoming a timestamp.
    expect(publishedAt('not-a-date')).toBeNull();
    expect(publishedAt(undefined)).toBeNull();
    expect(publishedAt('')).toBeNull();
  });

  it('maps the procurement method and official status from their reference directories', () => {
    // id and amount are usable, so this record always normalizes into a lot.
    const labels = (TrdBuy: GoszakupLotDto['TrdBuy']): Lot['procurement'] =>
      (mapGoszakupLot({ id: 1, amount: 1, TrdBuy }) as Lot).procurement;

    expect(
      labels({
        RefTradeMethods: { nameRu: 'Запрос котировок', nameKz: 'Ұсыныстар сұрау' },
        RefBuyStatus: { nameRu: 'Приём заявок', nameKz: 'Өтінімдер қабылдау' },
      }),
    ).toMatchObject({ procurementMethod: 'Запрос котировок', officialStatus: 'Приём заявок' });
    // State-language fallback mirrors title/customer handling.
    expect(
      labels({ RefTradeMethods: { nameRu: null, nameKz: 'Ұсыныстар сұрау' }, RefBuyStatus: {} })
        .procurementMethod,
    ).toBe('Ұсыныстар сұрау');
    // Raw directory codes are never mapped; a missing entry stays null, not a placeholder.
    expect(labels({ RefTradeMethods: { nameRu: '  ' }, RefBuyStatus: null })).toMatchObject({
      procurementMethod: null,
      officialStatus: null,
    });
    expect(labels(undefined)).toMatchObject({ procurementMethod: null, officialStatus: null });
  });

  it('resolves КАТО delivery codes to region names and keeps unknown codes verbatim', () => {
    const regionFor = (plnPointKatoList: string[]): string =>
      mapGoszakupLot({ id: 1, amount: 1, plnPointKatoList })?.region ?? '';

    expect(regionFor(['751030000'])).toBe('Алматы');
    expect(regionFor(['710000000'])).toBe('Астана');
    expect(regionFor(['190000000', '751030000'])).toBe('Алматинская область, Алматы');
    // Two codes of the same region collapse into one region name.
    expect(regionFor(['751030000', '750000000'])).toBe('Алматы');
    expect(regionFor(['999999999'])).toBe('999999999');
    expect(regionFor([])).toBe('');
  });

  it('accepts the documented timestamp formats and drops unparsable dates', () => {
    const deadlineFor = (endDate: string): string =>
      mapGoszakupLot({ id: 1, amount: 1, TrdBuy: { endDate } })?.bidDeadline ?? '';

    expect(deadlineFor('2026-10-20T12:00:00Z')).toBe('2026-10-20T12:00:00.000Z');
    expect(deadlineFor('2026-10-20T12:00:00+05:00')).toBe('2026-10-20T07:00:00.000Z');
    expect(deadlineFor('not-a-date')).toBe('');
  });

  it('skips records without a usable id or amount', () => {
    for (const lot of UNUSABLE_LOTS) {
      expect(mapGoszakupLot(lot)).toBeNull();
    }
    expect(mapGoszakupLot(null)).toBeNull();
    expect(mapGoszakupLot(undefined)).toBeNull();
    // A non-numeric amount is malformed upstream data, not a zero-price lot.
    expect(mapGoszakupLot({ id: 5, amount: '420000' as unknown as number })).toBeNull();
  });

  it('trims surrounding whitespace of upstream text', () => {
    const lot = mapGoszakupLot({
      id: 900000011,
      amount: 10,
      nameRu: '  Стеллажи  ',
      customerNameRu: ' Библиотека ',
      customerBin: ' 000740000003 ',
    }) as Lot;

    expect(lot.title).toBe('Стеллажи');
    expect(lot.customer).toBe('Библиотека');
    expect(lot.description).toBe('БИН заказчика: 000740000003');
  });
});

describe('mapGoszakupLots', () => {
  it('normalizes a page in upstream order and drops unusable records', () => {
    const [unusable] = UNUSABLE_LOTS;
    const page: GoszakupLotDto[] = [FULL_LOT, unusable as GoszakupLotDto, MINIMAL_LOT];

    expect(mapGoszakupLots(page).map((lot) => lot.id)).toEqual([
      'goszakup:900000001',
      'goszakup:900000002',
    ]);
  });

  it('returns an empty list for an empty page', () => {
    expect(mapGoszakupLots([])).toEqual([]);
  });
});

describe('parseGoszakupLotId', () => {
  it('reads the registry id back from a normalized public id', () => {
    expect(parseGoszakupLotId('goszakup:900000001')).toBe(900000001);
    expect(parseGoszakupLotId('goszakup:1')).toBe(1);
    expect(parseGoszakupLotId('goszakup:2147483647')).toBe(2147483647);
  });

  it.each([
    ['fixture-1'],
    ['900000001'],
    ['goszakup:'],
    ['goszakup:abc'],
    ['goszakup:1.5'],
    ['goszakup:-5'],
    ['goszakup:0'],
    ['goszakup: 1'],
    ['gOSzakup:1'],
    ['goszakup:1 '],
    // Beyond the signed 32-bit range the official `Int` filter cannot carry the id.
    ['goszakup:2147483648'],
    ['goszakup:9007199254740993'],
    [''],
  ])('rejects the unusable id %s', (id) => {
    expect(parseGoszakupLotId(id)).toBeNull();
  });
});
