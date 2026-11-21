import { deepMerge, type DeepPartial } from './types';

export interface Settings {
  jev: {
    baseUrl: string;
    apiKey: string;
    /** Force deterministic mock responses even when a key is configured. */
    mock: boolean;
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
  };
  linkedin: {
    enabled: boolean;
    /** Posts scoring below this are blurred. */
    threshold: number;
    paused: boolean;
    /** Show an on-page diagnostic pill and verbose logs. */
    debug: boolean;
  };
  consent: {
    dataSharingAccepted: boolean;
  };
}

const roarBaseUrl = import.meta.env.ROAR_BASE_URL ?? '';

export const DEFAULT_SETTINGS: Settings = {
  jev: {
    // The key itself stays in the background bundle; only the public URL is here.
    baseUrl: roarBaseUrl || (import.meta.env.WXT_JEV_BASE_URL ?? ''),
    apiKey: import.meta.env.WXT_JEV_API_KEY ?? '',
    mock: !roarBaseUrl,
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
  },
  linkedin: {
    enabled: true,
    threshold: 35,
    paused: false,
    debug: false,
  },
  consent: {
    dataSharingAccepted: false,
  },
};

const SETTINGS_KEY = 'jev.settings.v1';

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = stored[SETTINGS_KEY] as DeepPartial<Settings> | undefined;
  return raw ? deepMerge(structuredClone(DEFAULT_SETTINGS), raw) : structuredClone(DEFAULT_SETTINGS);
}

export async function updateSettings(patch: DeepPartial<Settings>): Promise<Settings> {
  const next = deepMerge(await getSettings(), patch);
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
