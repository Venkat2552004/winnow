import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

type StorageListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) => void;

const storage = new Map<string, unknown>();
const storageListeners = new Set<StorageListener>();

function keysOf(keys?: string | string[] | Record<string, unknown> | null): string[] {
  if (keys == null) return [...storage.keys()];
  if (typeof keys === 'string') return [keys];
  if (Array.isArray(keys)) return keys;
  return Object.keys(keys);
}

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
        const result: Record<string, unknown> = {};
        for (const key of keysOf(keys)) {
          if (storage.has(key)) {
            result[key] = storage.get(key);
          } else if (keys && typeof keys === 'object' && !Array.isArray(keys)) {
            const fallback = keys[key];
            if (fallback !== undefined) result[key] = fallback;
          }
        }
        return result;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        const changes: Record<string, chrome.storage.StorageChange> = {};
        for (const [key, value] of Object.entries(items)) {
          changes[key] = { oldValue: storage.get(key), newValue: value };
          storage.set(key, value);
        }
        for (const listener of storageListeners) listener(changes, 'local');
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) storage.delete(key);
      }),
      clear: vi.fn(async () => {
        storage.clear();
      }),
    },
    onChanged: {
      addListener: vi.fn((listener: StorageListener) => {
        storageListeners.add(listener);
      }),
      removeListener: vi.fn((listener: StorageListener) => {
        storageListeners.delete(listener);
      }),
    },
  },
  runtime: {
    getManifest: vi.fn(() => ({ version: '0.1.0' }) as chrome.runtime.Manifest),
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    openOptionsPage: vi.fn(),
  },
  identity: {
    getRedirectURL: vi.fn(() => 'https://test.chromiumapp.org/'),
    launchWebAuthFlow: vi.fn(),
  },
  tabs: {
    create: vi.fn(async () => ({}) as chrome.tabs.Tab),
    query: vi.fn(async () => [] as chrome.tabs.Tab[]),
    sendMessage: vi.fn(async () => undefined),
  },
  declarativeNetRequest: {
    getEnabledRulesets: vi.fn(async () => ['roar-headers']),
  },
};

vi.stubGlobal('chrome', chromeMock as unknown as typeof chrome);

beforeEach(() => {
  storage.clear();
  storageListeners.clear();
  vi.clearAllMocks();
});

export { chromeMock };
