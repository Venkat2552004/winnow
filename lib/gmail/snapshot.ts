import type { OrganizeRow } from './types';

const KEY = 'jev.gmail.preview.v1';

/** Snapshots older than this are ignored so stale classifications are not applied. */
export const PREVIEW_SNAPSHOT_TTL_MS = 30 * 60 * 1000;

export interface PreviewScope {
  lookbackDays: number;
  maxMessages: number;
}

export interface PreviewSnapshot {
  rows: OrganizeRow[];
  at: number;
  scope: PreviewScope;
}

export async function savePreviewSnapshot(
  rows: OrganizeRow[],
  scope: PreviewScope,
): Promise<void> {
  const snapshot: PreviewSnapshot = { rows, at: Date.now(), scope };
  await chrome.storage.local.set({ [KEY]: snapshot });
}

export async function readPreviewSnapshot(): Promise<PreviewSnapshot | null> {
  const stored = await chrome.storage.local.get(KEY);
  const snapshot = stored[KEY] as PreviewSnapshot | undefined;
  if (!snapshot || !Array.isArray(snapshot.rows)) return null;
  if (!Number.isFinite(snapshot.at) || Date.now() - snapshot.at > PREVIEW_SNAPSHOT_TTL_MS) {
    return null;
  }
  return snapshot;
}

export async function clearPreviewSnapshot(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}
