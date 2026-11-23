import {
  DEFAULT_CLEANUP_CATEGORIES,
  DEFAULT_ENABLED_CATEGORIES,
  type EmailCategory,
  type EmailLabelPresetId,
} from './winnow/types';
import {
  LOW_VALUE_POST_TYPES,
  VALUE_POST_TYPES,
  type LinkedInPresetId,
  type PostType,
} from './linkedin/taxonomy';
import { deepMerge, type DeepPartial } from './types';

export interface Settings {
  jev: {
    /** Use the Roar AI gateway from .env instead of the custom fields below. */
    useRoar: boolean;
    baseUrl: string;
    apiKey: string;
    /** Force deterministic mock responses even when a key is configured. */
    mock: boolean;
    /** True once the user has explicitly toggled mock mode. */
    mockExplicit: boolean;
  };
  sarvam: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  gmail: {
    clientId: string;
    enabled: boolean;
    lookbackDays: number;
    maxMessages: number;
    autoLabel: boolean;
    priorityThreshold: number;
    /** Only mail older than this is eligible for bulk cleanup. */
    cleanupOlderThanDays: number;
    /** Archive a sender's existing mail after unsubscribing. */
    unsubscribeArchive: boolean;
    /** Preset used to seed the label selection. */
    labelPreset: EmailLabelPresetId;
    /** Categories Winnow creates and applies. Empty means no category labels. */
    enabledCategories: EmailCategory[];
    /** Optional label prefix, e.g. "Winnow" → Winnow/Security. Empty means flat labels. */
    labelPrefix: string;
    /** Apply the priority label when priority >= priorityThreshold. */
    applyPriorityLabel: boolean;
    /** Categories eligible for bulk cleanup. */
    cleanupCategories: EmailCategory[];
  };
  linkedin: {
    enabled: boolean;
    /** Posts scoring below this are blurred when their type is in neither list. */
    threshold: number;
    paused: boolean;
    /** Show an on-page diagnostic pill and verbose logs. */
    debug: boolean;
    /** Preset used to seed the category selection. */
    preset: LinkedInPresetId;
    /** Post types always blurred, regardless of score. */
    blurCategories: PostType[];
    /** Post types never blurred, regardless of score. */
    keepCategories: PostType[];
  };
  consent: {
    dataSharingAccepted: boolean;
  };
}

const roarBaseUrl = import.meta.env.ROAR_BASE_URL ?? '';
const roarKey = import.meta.env.ROAR_API_KEY ?? '';

export const DEFAULT_SETTINGS: Settings = {
  jev: {
    // The key itself stays in the background bundle; only the public URL is here.
    useRoar: Boolean(roarKey),
    baseUrl: roarBaseUrl || (import.meta.env.WXT_JEV_BASE_URL ?? ''),
    apiKey: import.meta.env.WXT_JEV_API_KEY ?? '',
    mock: !roarKey,
    mockExplicit: false,
  },
  sarvam: {
    baseUrl: 'https://api.sarvam.ai/v2',
    apiKey: import.meta.env.WXT_SARVAM_API_KEY ?? '',
    model: 'deepseekv4.1-flash-1017',
  },
  gmail: {
    clientId: import.meta.env.WXT_GMAIL_CLIENT_ID ?? '',
    enabled: true,
    lookbackDays: 7,
    maxMessages: 200,
    autoLabel: true,
    priorityThreshold: 70,
    cleanupOlderThanDays: 14,
    unsubscribeArchive: true,
    labelPreset: 'everyday',
    enabledCategories: [...DEFAULT_ENABLED_CATEGORIES],
    labelPrefix: '',
    applyPriorityLabel: true,
    cleanupCategories: [...DEFAULT_CLEANUP_CATEGORIES],
  },
  linkedin: {
    enabled: true,
    threshold: 35,
    paused: false,
    debug: false,
    preset: 'balanced',
    blurCategories: [...LOW_VALUE_POST_TYPES],
    keepCategories: [...VALUE_POST_TYPES],
  },
  consent: {
    dataSharingAccepted: false,
  },
};

const SETTINGS_KEY = 'jev.settings.v1';

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = stored[SETTINGS_KEY] as DeepPartial<Settings> | undefined;
  const merged = raw
    ? deepMerge(structuredClone(DEFAULT_SETTINGS), raw)
    : structuredClone(DEFAULT_SETTINGS);

  // A Roar key in .env means live mode unless the user explicitly chose mock.
  // This also migrates older settings that stored `mock: true` by default.
  if (roarKey && merged.jev.useRoar && !merged.jev.mockExplicit) {
    merged.jev.mock = false;
  }

  return merged;
}

export async function updateSettings(patch: DeepPartial<Settings>): Promise<Settings> {
  const next = deepMerge(await getSettings(), patch);
  // Remember an explicit mock choice so the .env key does not override it.
  if (patch.jev?.mock !== undefined) next.jev.mockExplicit = true;
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export function onSettingsChanged(callback: (settings: Settings) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local' || !changes[SETTINGS_KEY]) return;
    void getSettings().then(callback);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
