import { beforeEach, describe, expect, it } from 'vitest';
import { cacheClear, cacheGet, cachePrune, cacheSet } from '../lib/cache';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(async () => {
  await cacheClear();
});

describe('cache', () => {
  it('stores and retrieves values', async () => {
    await cacheSet('key', { value: 1 }, 1_000);
    await expect(cacheGet<{ value: number }>('key')).resolves.toEqual({ value: 1 });
  });

  it('returns null for expired values', async () => {
    await cacheSet('key', { value: 1 }, 1);
    await sleep(10);
    await expect(cacheGet('key')).resolves.toBeNull();
  });

  it('prunes expired entries', async () => {
    await cacheSet('short', { value: 1 }, 1);
    await cacheSet('long', { value: 2 }, 10_000);
    await sleep(10);

    await expect(cachePrune(10)).resolves.toBe(1);
    await expect(cacheGet('short')).resolves.toBeNull();
    await expect(cacheGet('long')).resolves.toEqual({ value: 2 });
  });

  it('trims the soonest-to-expire entries when over capacity', async () => {
    await cacheSet('first', { value: 1 }, 1_000);
    await cacheSet('second', { value: 2 }, 2_000);
    await cacheSet('third', { value: 3 }, 3_000);

    await expect(cachePrune(2)).resolves.toBe(1);
    await expect(cacheGet('first')).resolves.toBeNull();
    await expect(cacheGet('second')).resolves.toEqual({ value: 2 });
    await expect(cacheGet('third')).resolves.toEqual({ value: 3 });
  });
});
