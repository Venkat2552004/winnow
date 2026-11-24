import { describe, expect, it } from 'vitest';
import { getPriorityItems, recordPriority } from '../lib/gmail/organizer';
import { PRIORITY_KEY, onPriorityChanged } from '../lib/gmail/priority';
import type { OrganizeRow } from '../lib/gmail/types';
import type { EmailCategory } from '../lib/winnow/types';

function row(id: string, category: EmailCategory, priority: number): OrganizeRow {
  return {
    message: {
      id,
      threadId: id,
      from: 'sender@example.com',
      subject: `Subject ${id}`,
      date: '2026-11-20T10:00:00.000Z',
      snippet: '',
      labelIds: [],
      hasListUnsubscribe: false,
      listUnsubscribe: null,
      listUnsubscribePost: null,
    },
    classification: {
      category,
      priority,
      confidence: 0.9,
      reason: 'test',
      source: 'heuristic',
    },
    labelNames: [],
  };
}

describe('priority store', () => {
  it('records rows and returns them in priority order', async () => {
    await recordPriority([row('low', 'offers', 10), row('high', 'security_alert', 95)]);

    const items = await getPriorityItems(50);

    expect(items.map((item) => item.id)).toEqual(['high', 'low']);
    expect(items[0]).toMatchObject({ subject: 'Subject high', category: 'security_alert' });
  });

  it('keeps the newest entry when the same message is recorded twice', async () => {
    await recordPriority([row('1', 'offers', 10)]);
    await recordPriority([row('1', 'invoice', 80)]);

    const items = await getPriorityItems(50);

    expect(items).toHaveLength(1);
    expect(items[0]?.category).toBe('invoice');
  });

  it('notifies subscribers when the store is rewritten', async () => {
    let calls = 0;
    const stop = onPriorityChanged(() => {
      calls += 1;
    });

    await chrome.storage.local.set({ [PRIORITY_KEY]: {} });
    await recordPriority([row('1', 'offers', 10)]);
    stop();
    await recordPriority([row('2', 'offers', 10)]);

    expect(calls).toBe(2);
  });
});
