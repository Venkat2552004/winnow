import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  getSettings,
  onSettingsChanged,
  updateSettings,
  type Settings,
} from '../lib/storage';
import { deepMerge } from '../lib/types';

describe('deepMerge', () => {
  it('merges nested objects and ignores undefined', () => {
    const base = { a: 1, nested: { b: 2, c: 3 }, list: [1, 2] };
    const merged = deepMerge(base, {
      a: 4,
      nested: { b: 5 },
      list: [9],
    });

    expect(merged).toEqual({ a: 4, nested: { b: 5, c: 3 }, list: [9] });
  });

  it('does not overwrite with undefined', () => {
    const base = { a: 1, nested: { b: 2 } };
    const merged = deepMerge(base, { a: undefined, nested: { b: undefined } });
    expect(merged).toEqual(base);
  });
});

describe('settings', () => {
  it('returns defaults when storage is empty', async () => {
    const settings = await getSettings();
    expect(settings.gmail.priorityThreshold).toBe(DEFAULT_SETTINGS.gmail.priorityThreshold);
    expect(settings.gmail.enabledCategories).toEqual(DEFAULT_SETTINGS.gmail.enabledCategories);
    expect(settings.jev.mock).toBe(true);
  });

  it('persists updates', async () => {
    const updated = await updateSettings({ gmail: { priorityThreshold: 80 } });
    expect(updated.gmail.priorityThreshold).toBe(80);

    const reloaded = await getSettings();
    expect(reloaded.gmail.priorityThreshold).toBe(80);
  });

  it('remembers an explicit mock choice', async () => {
    const updated = await updateSettings({ jev: { mock: false } });
    expect(updated.jev.mock).toBe(false);
    expect(updated.jev.mockExplicit).toBe(true);
  });

  it('notifies settings listeners', async () => {
    const changed = new Promise<Settings>((resolve) => {
      const unsubscribe = onSettingsChanged((next) => {
        unsubscribe();
        resolve(next);
      });
    });

    await updateSettings({ gmail: { priorityThreshold: 75 } });
    await expect(changed).resolves.toMatchObject({
      gmail: { priorityThreshold: 75 },
    });
  });
});
