import { IMPORTANT_CATEGORIES } from '../winnow/types';
import type { Settings } from '../storage';
import { batchModify } from './api';
import { previewRecent } from './organizer';
import type { CleanupCandidate, CleanupMode, CleanupPreview } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const PROTECTED_CATEGORIES = new Set(IMPORTANT_CATEGORIES);

function isProtected(labelIds: string[]): boolean {
  return labelIds.includes('STARRED') || labelIds.includes('IMPORTANT');
}

function olderThan(date: string, cutoff: number): boolean {
  const parsed = Date.parse(date);
  // Unknown dates are treated as old enough; the category filter still applies.
  return Number.isNaN(parsed) || parsed < cutoff;
}

/** Finds aged low-value mail without changing anything. */
export async function previewCleanup(
  token: string,
  settings: Settings,
): Promise<CleanupPreview> {
  const rows = await previewRecent(token, settings);
  const olderThanDays = settings.gmail.cleanupOlderThanDays;
  const cutoff = Date.now() - olderThanDays * DAY_MS;
  const cleanupCategories = new Set(settings.gmail.cleanupCategories);

  const candidates: CleanupCandidate[] = [];
  for (const row of rows) {
    if (PROTECTED_CATEGORIES.has(row.classification.category)) continue;
    if (!cleanupCategories.has(row.classification.category)) continue;
    if (isProtected(row.message.labelIds)) continue;
    if (!olderThan(row.message.date, cutoff)) continue;

    candidates.push({
      id: row.message.id,
      subject: row.message.subject,
      from: row.message.from,
      date: row.message.date,
      category: row.classification.category,
      priority: row.classification.priority,
    });
  }

  candidates.sort((a, b) => a.priority - b.priority || a.subject.localeCompare(b.subject));
  return { candidates, total: candidates.length, olderThanDays };
}

/** Archives (removes INBOX) or trashes the given messages. */
export async function applyCleanup(
  token: string,
  ids: string[],
  mode: CleanupMode,
): Promise<{ affected: number }> {
  if (ids.length === 0) return { affected: 0 };

  if (mode === 'trash') {
    await batchModify(token, ids, ['TRASH'], ['INBOX']);
  } else {
    await batchModify(token, ids, [], ['INBOX']);
  }

  return { affected: ids.length };
}
