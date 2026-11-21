export interface DayStats {
  scored: number;
  blurred: number;
  revealed: number;
}

const PREFIX = 'jev.stats.v1.';

function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${PREFIX}${now.getFullYear()}-${month}-${day}`;
}

export async function getTodayStats(): Promise<DayStats> {
  const key = todayKey();
  const stored = await chrome.storage.local.get(key);
  const value = stored[key] as Partial<DayStats> | undefined;
  return {
    scored: value?.scored ?? 0,
    blurred: value?.blurred ?? 0,
    revealed: value?.revealed ?? 0,
  };
}

// Serialize read-modify-write cycles so concurrent bumps don't lose counts.
let writeChain: Promise<void> = Promise.resolve();

export function bumpStats(patch: Partial<DayStats>): Promise<void> {
  writeChain = writeChain.then(async () => {
    const key = todayKey();
    const current = await getTodayStats();
    const next: DayStats = {
      scored: current.scored + (patch.scored ?? 0),
      blurred: current.blurred + (patch.blurred ?? 0),
      revealed: current.revealed + (patch.revealed ?? 0),
    };
    await chrome.storage.local.set({ [key]: next });
  });
  return writeChain;
}
