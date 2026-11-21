import { CATEGORY_GMAIL_LABEL, PRIORITY_LABEL } from '../jev/types';
import { createLabel, listLabels } from './api';

const REQUIRED_LABELS = [
  ...new Set([...Object.values(CATEGORY_GMAIL_LABEL), PRIORITY_LABEL]),
];

let cache: Map<string, string> | null = null;

/** Creates any missing Jev labels and returns a name → id map. */
export async function ensureLabels(token: string): Promise<Map<string, string>> {
  if (cache) return cache;

  const existing = await listLabels(token);
  const byName = new Map(existing.map((label) => [label.name, label.id]));

  for (const name of REQUIRED_LABELS) {
    if (byName.has(name)) continue;
    const created = await createLabel(token, name);
    byName.set(created.name, created.id);
  }

  cache = byName;
  return byName;
}

export function resetLabelCache(): void {
  cache = null;
}
