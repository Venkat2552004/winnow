import { gmailLabelFor, priorityLabelFor } from '../jev/types';
import type { Settings } from '../storage';
import { createLabel, listLabels } from './api';

interface LabelCache {
  signature: string;
  map: Map<string, string>;
}

let cache: LabelCache | null = null;

function signatureOf(settings: Settings): string {
  return [
    settings.gmail.labelPrefix,
    settings.gmail.autoLabel ? 'auto' : 'manual',
    settings.gmail.applyPriorityLabel ? 'priority' : 'no-priority',
    [...settings.gmail.enabledCategories].sort().join(','),
  ].join('|');
}

/** Creates any missing labels for the current selection and returns a name → id map. */
export async function ensureLabels(
  token: string,
  settings: Settings,
): Promise<Map<string, string>> {
  const signature = signatureOf(settings);
  if (cache?.signature === signature) return cache.map;

  const required = settings.gmail.autoLabel
    ? settings.gmail.enabledCategories.map((category) =>
        gmailLabelFor(category, settings.gmail.labelPrefix),
      )
    : [];
  if (settings.gmail.applyPriorityLabel) {
    required.push(priorityLabelFor(settings.gmail.labelPrefix));
  }

  const existing = await listLabels(token);
  const byName = new Map(existing.map((label) => [label.name, label.id]));

  for (const name of required) {
    if (byName.has(name)) continue;
    const created = await createLabel(token, name);
    byName.set(created.name, created.id);
  }

  cache = { signature, map: byName };
  return byName;
}

export function resetLabelCache(): void {
  cache = null;
}
