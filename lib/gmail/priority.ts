/** Where the organizer stores the priority results it applied. */
export const PRIORITY_KEY = 'jev.gmail.priority.v1';

/** Subscribes to rewrites of the priority inbox store. Returns an unsubscribe function. */
export function onPriorityChanged(callback: () => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local' || !changes[PRIORITY_KEY]) return;
    callback();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
