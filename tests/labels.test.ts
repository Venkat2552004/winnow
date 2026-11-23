import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureLabels, resetLabelCache } from '../lib/gmail/labels';
import { DEFAULT_SETTINGS, type Settings } from '../lib/storage';

const api = vi.hoisted(() => ({
  listLabels: vi.fn(async () => [{ id: 'security-id', name: 'Security' }]),
  createLabel: vi.fn(async (_token: string, name: string) => ({ id: `id-${name}`, name })),
}));

vi.mock('../lib/gmail/api', () => api);

function settings(): Settings {
  const value = structuredClone(DEFAULT_SETTINGS);
  value.gmail.autoLabel = true;
  value.gmail.applyPriorityLabel = true;
  value.gmail.labelPrefix = '';
  value.gmail.enabledCategories = ['security_alert', 'offers'];
  return value;
}

beforeEach(() => {
  resetLabelCache();
  api.listLabels.mockResolvedValue([{ id: 'security-id', name: 'Security' }]);
  api.createLabel.mockImplementation(async (_token: string, name: string) => ({
    id: `id-${name}`,
    name,
  }));
});

describe('ensureLabels', () => {
  it('reuses existing labels and creates missing ones', async () => {
    const map = await ensureLabels('token', settings());

    expect(map.get('Security')).toBe('security-id');
    expect(map.get('Offers')).toBe('id-Offers');
    expect(map.get('Priority')).toBe('id-Priority');
    expect(api.listLabels).toHaveBeenCalledTimes(1);
    expect(api.createLabel).toHaveBeenCalledTimes(2);
  });

  it('caches by settings signature', async () => {
    const value = settings();
    await ensureLabels('token', value);
    await ensureLabels('token', value);
    expect(api.listLabels).toHaveBeenCalledTimes(1);

    value.gmail.labelPrefix = 'Winnow';
    await ensureLabels('token', value);
    expect(api.listLabels).toHaveBeenCalledTimes(2);
  });

  it('supports a label prefix', async () => {
    const value = settings();
    value.gmail.labelPrefix = 'Winnow';
    const map = await ensureLabels('token', value);

    expect(map.has('Winnow/Security')).toBe(true);
    expect(map.has('Winnow/Offers')).toBe(true);
    expect(map.has('Winnow/Priority')).toBe(true);
  });

  it('only creates the priority label when auto-label is off', async () => {
    api.listLabels.mockResolvedValueOnce([]);
    const value = settings();
    value.gmail.autoLabel = false;
    const map = await ensureLabels('token', value);

    expect(map.has('Security')).toBe(false);
    expect(map.has('Offers')).toBe(false);
    expect(map.get('Priority')).toBe('id-Priority');
    expect(api.createLabel).toHaveBeenCalledTimes(1);
  });
});
