/**
 * Concurrency-limited task queue. Used to keep AI calls from stampeding the
 * API while the user scrolls.
 */
export class TaskQueue {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly concurrency = 2) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }
}

export async function withRetry<T>(
  task: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 400,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}
