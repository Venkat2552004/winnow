import type { Settings } from '../storage';
import { previewRecent } from './organizer';
import type { UnsubscribeSender } from './types';
import { parseListUnsubscribe, parseSender } from './unsubscribe';

/**
 * Groups recent mail by sender, keeping only senders that advertise a
 * List-Unsubscribe mechanism. Sorted by message count, highest first.
 */
export async function scanUnsubscribes(
  token: string,
  settings: Settings,
): Promise<UnsubscribeSender[]> {
  const rows = await previewRecent(token, settings);
  const bySender = new Map<string, UnsubscribeSender>();

  for (const row of rows) {
    const target = parseListUnsubscribe(
      row.message.listUnsubscribe,
      row.message.listUnsubscribePost,
    );
    if (!target) continue;

    const { email, name } = parseSender(row.message.from);
    if (!email) continue;

    const existing = bySender.get(email);
    if (existing) {
      existing.count += 1;
      existing.messageIds.push(row.message.id);
      // Prefer a one-click target if any message from this sender offers one.
      if (!existing.oneClick && target.oneClick) {
        existing.oneClick = true;
        existing.https = target.https ?? existing.https;
      }
      existing.https ??= target.https;
      existing.mailto ??= target.mailto;
      continue;
    }

    bySender.set(email, {
      email,
      name,
      count: 1,
      sampleSubject: row.message.subject,
      https: target.https,
      mailto: target.mailto,
      oneClick: target.oneClick,
      messageIds: [row.message.id],
    });
  }

  return [...bySender.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}
