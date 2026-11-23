import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCleanup, previewCleanup } from '../lib/gmail/cleanup';
import type { OrganizeRow } from '../lib/gmail/types';
import { DEFAULT_SETTINGS, type Settings } from '../lib/storage';
import type { EmailCategory } from '../lib/winnow/types';

const organizer = vi.hoisted(() => ({
  previewRecent: vi.fn(async () => [] as OrganizeRow[]),
}));

const api = vi.hoisted(() => ({
  batchModify: vi.fn(async () => undefined),
}));

vi.mock('../lib/gmail/organizer', () => organizer);
vi.mock('../lib/gmail/api', () => api);

const DAY_MS = 24 * 60 * 60 * 1000;

function settings(): Settings {
  const value = structuredClone(DEFAULT_SETTINGS);
  value.gmail.cleanupOlderThanDays = 14;
  return value;
}

function row(
  category: EmailCategory,
  daysAgo: number,
  labelIds: string[] = [],
): OrganizeRow {
  return {
    message: {
      id: `id-${category}-${daysAgo}-${labelIds.join('-')}`,
      threadId: 'thread',
      from: 'sender@example.com',
      subject: `Subject ${category}`,
      date: new Date(Date.now() - daysAgo * DAY_MS).toISOString(),
      snippet: 'Snippet',
      labelIds,
      hasListUnsubscribe: false,
      listUnsubscribe: null,
      listUnsubscribePost: null,
    },
    classification: {
      category,
      priority: 10,
      confidence: 1,
      reason: 'test',
      source: 'heuristic',
    },
    labelNames: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  organizer.previewRecent.mockResolvedValue([]);
});

describe('previewCleanup', () => {
  it('selects aged cleanup categories and protects important mail', async () => {
    organizer.previewRecent.mockResolvedValue([
      row('offers', 30),
      row('newsletter', 30),
      row('security_alert', 30),
      row('offers', 30, ['STARRED']),
      row('offers', 30, ['IMPORTANT']),
      row('offers', 1),
    ]);

    const preview = await previewCleanup('token', settings());
    expect(preview.total).toBe(2);
    expect(preview.candidates.map((candidate) => candidate.category).sort()).toEqual([
      'newsletter',
      'offers',
    ]);
  });

  it('returns an empty preview when nothing qualifies', async () => {
    organizer.previewRecent.mockResolvedValue([row('offers', 1)]);
    const preview = await previewCleanup('token', settings());
    expect(preview.total).toBe(0);
  });
});

describe('applyCleanup', () => {
  it('archives by removing INBOX', async () => {
    await expect(applyCleanup('token', ['a', 'b'], 'archive')).resolves.toEqual({
      affected: 2,
    });
    expect(api.batchModify).toHaveBeenCalledWith('token', ['a', 'b'], [], ['INBOX']);
  });

  it('trashes by adding TRASH and removing INBOX', async () => {
    await expect(applyCleanup('token', ['a'], 'trash')).resolves.toEqual({ affected: 1 });
    expect(api.batchModify).toHaveBeenCalledWith('token', ['a'], ['TRASH'], ['INBOX']);
  });

  it('does nothing for an empty list', async () => {
    await expect(applyCleanup('token', [], 'archive')).resolves.toEqual({ affected: 0 });
    expect(api.batchModify).not.toHaveBeenCalled();
  });
});
