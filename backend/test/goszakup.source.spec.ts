import { FixtureLotSource } from '../src/modules/tender/lot.source';
import { GoszakupLotSource } from '../src/modules/tender/goszakup/goszakup.source';
import { GoszakupClient } from '../src/modules/tender/goszakup/goszakup.client';
import type { GoszakupLotDto } from '../src/modules/tender/goszakup/goszakup-lots.query';
import { LOT_FIXTURES } from '../src/modules/tender/lots.fixtures';
import { FULL_LOT, MINIMAL_LOT, UNUSABLE_LOTS } from './fixtures/goszakup-lots.fixture';

describe('FixtureLotSource', () => {
  it('is the default source and returns the CP-03 fixtures', async () => {
    await expect(new FixtureLotSource().fetchLots()).resolves.toEqual(LOT_FIXTURES);
  });

  it('honours the limit and never exposes the fixture array itself', async () => {
    const source = new FixtureLotSource();

    await expect(source.fetchLots(2)).resolves.toEqual(LOT_FIXTURES.slice(0, 2));
    await expect(source.fetchLots(0)).resolves.toEqual([]);

    const lots = await source.fetchLots();
    lots.pop();
    expect(LOT_FIXTURES).toHaveLength(5);
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

    const lots = await source.fetchLots(10);

    expect(client.fetchLots).toHaveBeenCalledWith({ limit: 10, filter: undefined });
    expect(lots.map((lot) => lot.id)).toEqual(['goszakup:900000001', 'goszakup:900000002']);
    expect(lots.every((lot) => lot.source === 'goszakup')).toBe(true);
  });

  it('clamps the requested page to the bounds the registry documents', async () => {
    const client = clientStub([]);
    const source = new GoszakupLotSource(client);

    await source.fetchLots(5000);
    await source.fetchLots(0);

    expect(client.fetchLots.mock.calls.map(([options]) => options.limit)).toEqual([200, 1]);
  });

  it('passes an optional filter through to the bounded query', async () => {
    const client = clientStub([]);

    await new GoszakupLotSource(client).fetchLots(5, { nameDescriptionRu: 'ЛДСП' });

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

    await expect(new GoszakupLotSource(client).fetchLots(5)).rejects.toThrow('HTTP 401');
  });
});
