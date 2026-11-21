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

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  /** Return false to fail fast (e.g. on 401). Defaults to retrying everything. */
  shouldRetry?: (error: unknown) => boolean;
}

export async function withRetry<T>(
  task: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { attempts = 3, baseDelayMs = 400, shouldRetry = () => true } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      const isLast = attempt >= attempts - 1;
      if (isLast || !shouldRetry(error)) break;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }

  throw lastError;
}
