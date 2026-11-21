interface CacheRecord {
  key: string;
  value: unknown;
  expiresAt: number;
}

const DB_NAME = 'jev';
const DB_VERSION = 1;
const STORE = 'cache';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const record = await withStore<CacheRecord | undefined>('readonly', (store) => store.get(key));
  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    await withStore('readwrite', (store) => store.delete(key));
    return null;
  }
  return record.value as T;
}

export async function cacheSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  const record: CacheRecord = { key, value, expiresAt: Date.now() + ttlMs };
  await withStore('readwrite', (store) => store.put(record));
}

export async function cacheClear(): Promise<void> {
  await withStore('readwrite', (store) => store.clear());
}
