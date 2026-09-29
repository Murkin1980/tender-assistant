import {
  mapGoszakupDocuments,
  mapGoszakupLot,
  mapGoszakupLots,
  parseGoszakupLotId,
} from '../src/modules/tender/goszakup/goszakup.mapper';
import type { Lot } from '../src/modules/tender/lot';
import type {
  GoszakupFileDto,
  GoszakupLotDto,
} from '../src/modules/tender/goszakup/goszakup-lots.query';
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

  it('attaches normalized documents only when explicitly requested for detail', () => {
    const listLot = mapGoszakupLot(FULL_LOT);
    expect(listLot?.documents).toBeUndefined();

    const detailLot = mapGoszakupLot(FULL_LOT, { includeDocuments: true });
    expect(detailLot?.documents).toEqual(mapGoszakupDocuments(FULL_LOT));
    expect(detailLot?.documents).toHaveLength(2);
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

describe('mapGoszakupDocuments', () => {
  it('normalizes lot and announcement files with stable ordering and deduced MIME', () => {
    const docs = mapGoszakupDocuments(FULL_LOT);
    expect(docs).toEqual([
      {
        id: '500001',
        name: 'Техническая спецификация',
        type: null,
        mimeType: 'application/pdf',
        sizeBytes: null,
        sourceUrl: 'https://goszakup.gov.kz/files/download_file/500001/tech-spec.pdf',
      },
      {
        id: '500002',
        name: 'Проект договора',
        type: null,
        mimeType: 'application/pdf',
        sizeBytes: null,
        sourceUrl: 'https://goszakup.gov.kz/files/download_file/500002/contract-draft.pdf',
      },
    ]);
  });

  it('keeps optional metadata null when not derivable', () => {
    const lot: GoszakupLotDto = {
      id: 900000001,
      Files: [
        {
          id: 500003,
          originalName: 'untyped-doc',
          nameRu: 'Документ без расширения',
        },
      ],
    };
    const docs = mapGoszakupDocuments(lot);
    expect(docs).toEqual([
      {
        id: '500003',
        name: 'Документ без расширения',
        type: null,
        mimeType: null,
        sizeBytes: null,
        sourceUrl: 'https://goszakup.gov.kz/ru/view/lots/index/id/900000001',
      },
    ]);
  });

  it('safely handles malformed file records and drops unusable items', () => {
    const lot: GoszakupLotDto = {
      id: 900000001,
      Files: [
        null as unknown as GoszakupFileDto,
        { id: 1 } as unknown as GoszakupFileDto, // no name
        { id: 'not-a-number' as unknown as number, originalName: 'bad-id.pdf' },
        { id: 500004, originalName: 'valid.docx' },
      ],
    };
    const docs = mapGoszakupDocuments(lot);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.id).toBe('500004');
    expect(docs[0]?.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  it('deduplicates identical file IDs across lot and announcement files', () => {
    const lot: GoszakupLotDto = {
      id: 900000001,
      Files: [{ id: 500001, originalName: 'lot-file.pdf' }],
      TrdBuy: {
        Files: [
          { id: 500001, originalName: 'duplicate-announcement-file.pdf' },
          { id: 500005, originalName: 'ann-file.pdf' },
        ],
      },
    };
    const docs = mapGoszakupDocuments(lot);
    expect(docs.map((d) => d.id)).toEqual(['500001', '500005']);
  });

  it('returns empty array when no files are provided', () => {
    expect(mapGoszakupDocuments(MINIMAL_LOT)).toEqual([]);
    expect(mapGoszakupDocuments({ id: 900000001, Files: [] })).toEqual([]);
  });

  it('safely resolves absolute URLs on official domain and rejects foreign hosts', () => {
    const lot: GoszakupLotDto = {
      id: 900000001,
      Files: [
        {
          id: 500010,
          originalName: 'portal.pdf',
          filePath: 'https://v3bl.goszakup.gov.kz/files/download_file/500010/portal.pdf',
        },
        {
          id: 500011,
          originalName: 'foreign.pdf',
          filePath: 'https://evil.example.com/steal.pdf',
        },
      ],
    };
    const docs = mapGoszakupDocuments(lot);
    expect(docs[0]?.sourceUrl).toBe(
      'https://v3bl.goszakup.gov.kz/files/download_file/500010/portal.pdf',
    );
    expect(docs[1]?.sourceUrl).toBe('https://goszakup.gov.kz/ru/view/lots/index/id/900000001');
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
