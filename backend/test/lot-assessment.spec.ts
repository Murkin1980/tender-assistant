import type { Lot } from '../src/modules/tender/lot';
import { assessLot } from '../src/modules/tender/lot-assessment';

/**
 * CP-07 triage contract: pure, offline and deterministic. These tests describe the business
 * rules and the exact reason text, so a silent rule or wording change fails here.
 */
const lot = (overrides: Partial<Lot> = {}): Lot => ({
  id: 'test-1',
  source: 'Goszakup',
  sourceUrl: 'https://goszakup.gov.kz/ru/search/lots',
  title: 'Столы из ЛДСП',
  customer: 'Заказчик (пример)',
  amount: 420000,
  region: 'Алматы',
  district: null,
  bidDeadline: '2026-10-15T12:00:00.000Z',
  description: 'Мебель для офиса.',
  // CP-08 metadata is present but never read by the CP-07 evaluator.
  procurement: {
    lotNumber: null,
    announcementNumber: null,
    customerBin: null,
    publishedAt: null,
    procurementMethod: null,
    officialStatus: null,
  },
  ...overrides,
});

describe('assessLot', () => {
  it('matches an LDSP lot in Almaty within the profile amount', () => {
    expect(assessLot(lot())).toEqual({
      status: 'MATCH',
      reasons: [
        'Amount is within 500,000 KZT',
        'Region is Almaty',
        'LDSP signal found',
        'Furniture signal found',
      ],
    });
  });

  it('matches a furniture keyword with LDSP in the description', () => {
    expect(
      assessLot(lot({ title: 'Поставка корпусной мебели', description: 'Плиты ЛДСП для сборки.' })),
    ).toEqual({
      status: 'MATCH',
      reasons: [
        'Amount is within 500,000 KZT',
        'Region is Almaty',
        'LDSP signal found',
        'Furniture signal found',
      ],
    });
  });

  it.each(['мебели', 'шкаф', 'тумба', 'кухня', 'столы', 'столов'])(
    'matches the approved furniture term %s',
    (term) => {
      expect(assessLot(lot({ title: `Закупка: ${term}`, description: '' }))).toEqual({
        status: 'MATCH',
        reasons: ['Amount is within 500,000 KZT', 'Region is Almaty', 'Furniture signal found'],
      });
    },
  );

  it('accepts the Latin LDSP spelling and mixed case', () => {
    expect(assessLot(lot({ title: 'СТОЛЫ ИЗ ldsp', description: 'мебель' }))).toEqual({
      status: 'MATCH',
      reasons: [
        'Amount is within 500,000 KZT',
        'Region is Almaty',
        'LDSP signal found',
        'Furniture signal found',
      ],
    });
  });

  it('keeps the amount boundary at exactly 500,000 KZT', () => {
    expect(assessLot(lot({ amount: 500000 })).status).toBe('MATCH');
  });

  it('excludes an amount above the profile maximum', () => {
    expect(assessLot(lot({ amount: 500000.01 }))).toEqual({
      status: 'EXCLUDE',
      reasons: ['Amount exceeds 500,000 KZT'],
    });
  });

  it('excludes a known region that is not Almaty', () => {
    expect(assessLot(lot({ region: 'Астана' }))).toEqual({
      status: 'EXCLUDE',
      reasons: ['Region is outside Almaty'],
    });
  });

  it('excludes a resolved non-Almaty region even next to an Almaty delivery point', () => {
    expect(assessLot(lot({ region: 'Алматинская область' }))).toEqual({
      status: 'EXCLUDE',
      reasons: ['Region is outside Almaty'],
    });
  });

  it('reviews a missing region instead of excluding or matching it', () => {
    expect(assessLot(lot({ region: '' }))).toEqual({
      status: 'REVIEW',
      reasons: [
        'Amount is within 500,000 KZT',
        'LDSP signal found',
        'Furniture signal found',
        'Insufficient evidence for automatic match',
      ],
    });
  });

  it('reviews an unresolved raw region code instead of claiming it is outside Almaty', () => {
    expect(assessLot(lot({ region: '999999999' }))).toEqual({
      status: 'REVIEW',
      reasons: [
        'Amount is within 500,000 KZT',
        'LDSP signal found',
        'Furniture signal found',
        'Insufficient evidence for automatic match',
      ],
    });
  });

  it.each(['Алматы, Астана', 'Алматы, 999999999'])(
    'reviews the multi-region value %s that only partly covers Almaty',
    (region) => {
      expect(assessLot(lot({ region })).status).toBe('REVIEW');
    },
  );

  it('does not exclude a lot because district data is missing', () => {
    expect(assessLot(lot({ district: null })).status).toBe('MATCH');
  });

  it('adds the preferred district as a positive reason only', () => {
    expect(assessLot(lot({ district: 'Алатауский' }))).toEqual({
      status: 'MATCH',
      reasons: [
        'Amount is within 500,000 KZT',
        'Region is Almaty',
        'LDSP signal found',
        'Furniture signal found',
        'Preferred district: Alatau',
      ],
    });
  });

  it('reviews a lot that fits the profile but has no product evidence', () => {
    expect(assessLot(lot({ title: 'Поставка канцелярских товаров', description: '' }))).toEqual({
      status: 'REVIEW',
      reasons: [
        'Amount is within 500,000 KZT',
        'Region is Almaty',
        'Insufficient evidence for automatic match',
      ],
    });
  });

  it.each([
    'Шкаф металлический',
    'ШКАФЫ МЕТАЛЛИЧЕСКИЕ',
    'Мебель: металлические шкафы для документов',
    'Поставка: тумба, металлический шкаф',
  ])('excludes the explicit metallic cabinet text %s', (text) => {
    expect(assessLot(lot({ title: text, description: '' }))).toEqual({
      status: 'EXCLUDE',
      reasons: ['Metallic cabinet signal found'],
    });
  });

  it.each([
    'Металлическая дверь',
    'Металл для ремонта',
    'Стеллаж металлический',
    'Шкаф, металлические ручки',
    'Стол металлический',
    'Плита ЛДСП и металлический профиль',
  ])('does not exclude the merely metal-containing text %s', (text) => {
    expect(assessLot(lot({ title: text, description: 'Мебель.' })).status).not.toBe('EXCLUDE');
  });

  it('reports every hard exclusion that applies, in a stable order', () => {
    expect(
      assessLot(
        lot({ title: 'Шкафы металлические', amount: 900000, region: 'Астана', description: '' }),
      ),
    ).toEqual({
      status: 'EXCLUDE',
      reasons: [
        'Amount exceeds 500,000 KZT',
        'Region is outside Almaty',
        'Metallic cabinet signal found',
      ],
    });
  });

  it('is deterministic and never mutates its input', () => {
    const source = Object.freeze(lot({ district: 'Алатауский' }));
    const first = assessLot(source);
    const second = assessLot(source);

    expect(first).toEqual(second);
    expect(source).toEqual(lot({ district: 'Алатауский' }));
    expect(first.reasons).not.toBe(second.reasons);
  });
});
