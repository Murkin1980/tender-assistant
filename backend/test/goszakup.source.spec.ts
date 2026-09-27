import { FixtureLotSource, LotSourceUnavailableError } from '../src/modules/tender/lot.source';
import { GoszakupLotSource } from '../src/modules/tender/goszakup/goszakup.source';
import { mapGoszakupLot } from '../src/modules/tender/goszakup/goszakup.mapper';
import {
  GoszakupClient,
  GoszakupUpstreamError,
} from '../src/modules/tender/goszakup/goszakup.client';
import { DEFAULT_LIVE_LOTS_LIMIT } from '../src/modules/tender/goszakup/goszakup.config';
import type { GoszakupLotDto } from '../src/modules/tender/goszakup/goszakup-lots.query';
import { translateGoszakupLotFilters } from '../src/modules/tender/goszakup/goszakup-filter.translator';
import { LOT_FIXTURES } from '../src/modules/tender/lots.fixtures';
import { FULL_LOT, MINIMAL_LOT, UNUSABLE_LOTS } from './fixtures/goszakup-lots.fixture';

describe('FixtureLotSource', () => {
  it('is the default source and returns the CP-03 fixtures', async () => {
    await expect(new FixtureLotSource().fetchLots()).resolves.toEqual(LOT_FIXTURES);
  });

  it('returns a deterministic copy and leaves filtering to the shared service path', async () => {
    const source = new FixtureLotSource();

    await expect(source.fetchLots({ maxAmount: 1 })).resolves.toEqual(LOT_FIXTURES);

    const lots = await source.fetchLots();
    lots.pop();
    expect(LOT_FIXTURES).toHaveLength(5);
  });

  it('answers a detail lookup from the same fixtures and nothing else', async () => {
    const source = new FixtureLotSource();

    await expect(source.fetchLot('fixture-1')).resolves.toEqual(LOT_FIXTURES[0]);
    await expect(source.fetchLot('goszakup:900000001')).resolves.toBeNull();
    await expect(source.fetchLot('unknown')).resolves.toBeNull();
  });
});

describe('GoszakupLotSource', () => {
  const clientStub = (
    lots: GoszakupLotDto[],
  ): GoszakupClient & {
    fetchLots: jest.Mock;
  } => {
    const fetchLots = jest.fn(async () => lots);
    return { fetchLots } as unknown as GoszakupClient & { fetchLots: jest.Mock };
  };

  it('normalizes what the client returned, dropping unusable records', async () => {
    const client = clientStub([FULL_LOT, UNUSABLE_LOTS[0] as GoszakupLotDto, MINIMAL_LOT]);
    const source = new GoszakupLotSource(client);

    const lots = await source.fetchLots(undefined, 10);

    expect(client.fetchLots).toHaveBeenCalledWith({ limit: 10, filter: undefined });
    expect(lots.map((lot) => lot.id)).toEqual(['goszakup:900000001', 'goszakup:900000002']);
    expect(lots.every((lot) => lot.source === 'goszakup')).toBe(true);
  });

  it('clamps the requested page to the bounds the registry documents', async () => {
    const client = clientStub([]);
    const source = new GoszakupLotSource(client);

    await source.fetchLots(undefined, 5000);
    await source.fetchLots(undefined, 0);

    expect(client.fetchLots.mock.calls.map(([options]) => options.limit)).toEqual([200, 1]);
  });

  it('translates only documented Russian name/description search', () => {
    expect(translateGoszakupLotFilters({ q: '  ЛДСП ' })).toEqual({
      nameDescriptionRu: 'ЛДСП',
    });
  });

  it.each([
    [{ maxAmount: 500000 }, undefined],
    [{ region: 'Алматы' }, undefined],
    [{ district: 'Алатауский' }, undefined],
    [
      { q: 'ЛДСП', maxAmount: 500000, region: 'Алматы', district: 'Алатауский' },
      { nameDescriptionRu: 'ЛДСП' },
    ],
    [{}, undefined],
  ])('does not invent upstream filters for %j', (filters, expected) => {
    expect(translateGoszakupLotFilters(filters)).toEqual(expected);
  });

  it('passes translated filters to one bounded query', async () => {
    const client = clientStub([]);

    await new GoszakupLotSource(client).fetchLots({ q: 'ЛДСП', maxAmount: 500000 }, 5);

    expect(client.fetchLots).toHaveBeenCalledTimes(1);
    expect(client.fetchLots).toHaveBeenCalledWith({
      limit: 5,
      filter: { nameDescriptionRu: 'ЛДСП' },
    });
  });

  it('propagates upstream failures instead of returning an empty list', async () => {
    const client = {
      fetchLots: jest.fn(async () => {
        throw new Error('Goszakup responded with HTTP 401');
      }),
    } as unknown as GoszakupClient;

    await expect(new GoszakupLotSource(client).fetchLots(undefined, 5)).rejects.toThrow('HTTP 401');
  });
});

describe('GoszakupLotSource bounded reads', () => {
  const clientStub = (
    lots: GoszakupLotDto[],
  ): GoszakupClient & {
    fetchLots: jest.Mock;
  } => {
    const fetchLots = jest.fn(async () => lots);
    return { fetchLots } as unknown as GoszakupClient & { fetchLots: jest.Mock };
  };

  const failingClient = (error: Error): GoszakupClient =>
    ({
      fetchLots: jest.fn(async () => {
        throw error;
      }),
    }) as unknown as GoszakupClient;

  it('uses the documented bounded default when the caller asks for no limit', async () => {
    const client = clientStub([]);

    await expect(new GoszakupLotSource(client).fetchLots()).resolves.toEqual([]);

    expect(client.fetchLots).toHaveBeenCalledWith({
      limit: DEFAULT_LIVE_LOTS_LIMIT,
      filter: undefined,
    });
    expect(DEFAULT_LIVE_LOTS_LIMIT).toBeGreaterThanOrEqual(20);
  });

  it('resolves one normalized id through the documented id filter, not through a page scan', async () => {
    const client = clientStub([FULL_LOT]);

    const lot = await new GoszakupLotSource(client).fetchLot('goszakup:900000001');

    expect(client.fetchLots).toHaveBeenCalledTimes(1);
    expect(client.fetchLots).toHaveBeenCalledWith({
      limit: 1,
      filter: { id: [900000001] },
    });
    expect(lot).toEqual(mapGoszakupLot(FULL_LOT));
  });

  it('answers a missing registry record with null', async () => {
    const client = clientStub([]);

    await expect(new GoszakupLotSource(client).fetchLot('goszakup:900000404')).resolves.toBeNull();
    expect(client.fetchLots).toHaveBeenCalledWith({
      limit: 1,
      filter: { id: [900000404] },
    });
  });

  it('answers a record the public contract cannot represent with null', async () => {
    const client = clientStub([{ id: 900000405 } as GoszakupLotDto]);

    await expect(new GoszakupLotSource(client).fetchLot('goszakup:900000405')).resolves.toBeNull();
  });

  it.each([
    ['fixture-1'],
    ['900000001'],
    ['goszakup:'],
    ['goszakup:not-a-number'],
    ['goszakup:2147483648'],
  ])('answers the unusable id %s without calling the registry', async (id) => {
    const client = clientStub([FULL_LOT]);

    await expect(new GoszakupLotSource(client).fetchLot(id)).resolves.toBeNull();
    expect(client.fetchLots).not.toHaveBeenCalled();
  });

  it.each([
    [new GoszakupUpstreamError('Goszakup responded with HTTP 401', 401, 'http')],
    [new GoszakupUpstreamError('Goszakup request timed out after 15000ms', null, 'timeout')],
  ])(
    'reports upstream trouble as an unavailable source, never as an empty result',
    async (error) => {
      const source = new GoszakupLotSource(failingClient(error));

      await expect(source.fetchLots()).rejects.toBeInstanceOf(LotSourceUnavailableError);
      await expect(source.fetchLot('goszakup:900000001')).rejects.toBeInstanceOf(
        LotSourceUnavailableError,
      );
      await expect(source.fetchLots()).rejects.toThrow('Lot source is temporarily unavailable');
    },
  );

  it('does not translate an unexpected programming error into an upstream failure', async () => {
    const source = new GoszakupLotSource(failingClient(new TypeError('boom')));

    await expect(source.fetchLots()).rejects.toBeInstanceOf(TypeError);
  });
});
