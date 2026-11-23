import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PREVIEW_SNAPSHOT_TTL_MS,
  clearPreviewSnapshot,
  readPreviewSnapshot,
  savePreviewSnapshot,
} from '../lib/gmail/snapshot';
import type { OrganizeRow } from '../lib/gmail/types';

function row(id: string): OrganizeRow {
  return {
    message: {
      id,
      threadId: id,
      from: 'billing@example.com',
      subject: 'Invoice ready',
      date: '2026-11-20T10:00:00.000Z',
      snippet: 'Invoice #1 is due',
      labelIds: [],
      hasListUnsubscribe: false,
      listUnsubscribe: null,
      listUnsubscribePost: null,
    },
    classification: {
      category: 'invoice',
      priority: 82,
      confidence: 0.9,
      reason: 'Billing mail',
      source: 'heuristic',
    },
    labelNames: ['Finance/Invoices'],
  };
}

const scope = { lookbackDays: 7, maxMessages: 200 };

afterEach(() => {
  vi.useRealTimers();
});

describe('preview snapshot', () => {
  it('round-trips rows and scope', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T09:00:00.000Z'));

    await savePreviewSnapshot([row('a'), row('b')], scope);
    const snapshot = await readPreviewSnapshot();

    expect(snapshot?.rows.map((item) => item.message.id)).toEqual(['a', 'b']);
    expect(snapshot?.scope).toEqual(scope);
    expect(snapshot?.at).toBe(Date.now());
  });

  it('ignores snapshots older than the TTL', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T09:00:00.000Z'));
    await savePreviewSnapshot([row('a')], scope);

    vi.setSystemTime(new Date(Date.now() + PREVIEW_SNAPSHOT_TTL_MS + 1));
    await expect(readPreviewSnapshot()).resolves.toBeNull();
  });

  it('returns null when nothing has been saved', async () => {
    await expect(readPreviewSnapshot()).resolves.toBeNull();
  });

  it('clears the snapshot', async () => {
    await savePreviewSnapshot([row('a')], scope);
    await clearPreviewSnapshot();
    await expect(readPreviewSnapshot()).resolves.toBeNull();
  });
});
