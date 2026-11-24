import {
  gmailLabelFor,
  priorityLabelFor,
  type EmailClassification,
  type EmailInput,
} from '../winnow/types';
import { classifyEmail } from '../pipeline';
import { TaskQueue } from '../queue';
import type { Settings } from '../storage';
import { batchModify, getMessageMeta, listMessageIds } from './api';
import { ensureLabels } from './labels';
import { PRIORITY_KEY } from './priority';
import type {
  GmailMessageMeta,
  OrganizeRow,
  OrganizeSummary,
  PriorityEntry,
} from './types';

const LABELED_KEY = 'jev.gmail.labeled.v1';
const MAX_LABELED_ENTRIES = 3000;
const MAX_PRIORITY_ENTRIES = 1000;

interface LabeledEntry {
  labelIds: string[];
  at: number;
}

type LabeledState = Record<string, LabeledEntry>;
type PriorityState = Record<string, PriorityEntry>;

function searchQuery(settings: Settings): string {
  return `newer_than:${settings.gmail.lookbackDays}d -in:chats`;
}

function toIso(date: string): string {
  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString();
}

function toInput(message: GmailMessageMeta): EmailInput {
  return {
    id: message.id,
    from: message.from,
    subject: message.subject,
    snippet: message.snippet,
    hasListUnsubscribe: message.hasListUnsubscribe,
    receivedAt: toIso(message.date),
  };
}

function labelsFor(classification: EmailClassification, settings: Settings): string[] {
  const labels: string[] = [];
  if (
    settings.gmail.autoLabel &&
    settings.gmail.enabledCategories.includes(classification.category)
  ) {
    labels.push(gmailLabelFor(classification.category, settings.gmail.labelPrefix));
  }
  if (
    settings.gmail.applyPriorityLabel &&
    classification.priority >= settings.gmail.priorityThreshold
  ) {
    labels.push(priorityLabelFor(settings.gmail.labelPrefix));
  }
  return labels;
}

async function readLabeledState(): Promise<LabeledState> {
  const stored = await chrome.storage.local.get(LABELED_KEY);
  return (stored[LABELED_KEY] as LabeledState | undefined) ?? {};
}

async function readPriorityState(): Promise<PriorityState> {
  const stored = await chrome.storage.local.get(PRIORITY_KEY);
  return (stored[PRIORITY_KEY] as PriorityState | undefined) ?? {};
}

function pruneLabeled(state: LabeledState): LabeledState {
  const entries = Object.entries(state)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, MAX_LABELED_ENTRIES);
  return Object.fromEntries(entries);
}

/** Classifies recent mail without writing anything. */
export async function previewRecent(token: string, settings: Settings): Promise<OrganizeRow[]> {
  const ids = await listMessageIds(token, searchQuery(settings), settings.gmail.maxMessages);

  const metaQueue = new TaskQueue(5);
  const messages = await Promise.all(
    ids.map((id) => metaQueue.run(() => getMessageMeta(token, id))),
  );

  const classifyQueue = new TaskQueue(3);
  const rows: OrganizeRow[] = [];
  for (const message of messages) {
    const classification = await classifyQueue.run(() =>
      classifyEmail(toInput(message), settings),
    );
    rows.push({
      message,
      classification,
      labelNames: labelsFor(classification, settings),
    });
  }

  rows.sort((a, b) => b.classification.priority - a.classification.priority);
  return rows;
}

/** Applies labels for the given rows, removing stale Winnow labels we added before. */
export async function applyLabels(
  token: string,
  rows: OrganizeRow[],
  settings: Settings,
): Promise<OrganizeSummary> {
  const labelIds = await ensureLabels(token, settings);
  const previous = await readLabeledState();
  const next: LabeledState = { ...previous };

  // batchModify applies the same add/remove set to every id, so group by set.
  const groups = new Map<string, { add: string[]; remove: string[]; ids: string[] }>();
  let labeled = 0;
  let skipped = 0;

  for (const row of rows) {
    const targetIds = labelsFor(row.classification, settings)
      .map((name) => labelIds.get(name))
      .filter((id): id is string => Boolean(id));
    const previousIds = previous[row.message.id]?.labelIds ?? [];

    const add = targetIds.filter((id) => !previousIds.includes(id));
    const remove = previousIds.filter((id) => !targetIds.includes(id));

    if (add.length === 0 && remove.length === 0) {
      skipped += 1;
      continue;
    }

    const key = `${[...add].sort().join(',')}|${[...remove].sort().join(',')}`;
    const group = groups.get(key) ?? { add, remove, ids: [] };
    group.ids.push(row.message.id);
    groups.set(key, group);

    next[row.message.id] = { labelIds: targetIds, at: Date.now() };
    labeled += 1;
  }

  for (const group of groups.values()) {
    await batchModify(token, group.ids, group.add, group.remove);
  }

  await chrome.storage.local.set({ [LABELED_KEY]: pruneLabeled(next) });
  await recordPriority(rows);

  return { labeled, skipped, total: rows.length };
}

/** Records the priority view for an already-classified batch. */
export async function recordPriority(rows: OrganizeRow[]): Promise<void> {
  const state = await readPriorityState();
  const now = Date.now();

  for (const row of rows) {
    state[row.message.id] = {
      id: row.message.id,
      subject: row.message.subject,
      from: row.message.from,
      date: row.message.date,
      category: row.classification.category,
      priority: row.classification.priority,
      reason: row.classification.reason,
      at: now,
    };
  }

  const entries = Object.values(state)
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_PRIORITY_ENTRIES);
  const pruned: PriorityState = {};
  for (const entry of entries) pruned[entry.id] = entry;

  await chrome.storage.local.set({ [PRIORITY_KEY]: pruned });
}

export async function getPriorityItems(limit: number): Promise<PriorityEntry[]> {
  const state = await readPriorityState();
  return Object.values(state)
    .sort((a, b) => b.priority - a.priority || b.at - a.at)
    .slice(0, limit);
}

export async function clearOrganizerState(): Promise<void> {
  await chrome.storage.local.remove([LABELED_KEY, PRIORITY_KEY]);
}
