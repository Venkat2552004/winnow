import { describe, expect, it } from 'vitest';
import { TaskQueue, withRetry } from '../lib/queue';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('TaskQueue', () => {
  it('limits concurrency', async () => {
    const queue = new TaskQueue(2);
    const gates = Array.from({ length: 4 }, () => deferred());
    let active = 0;
    let maxActive = 0;

    const tasks = gates.map((gate) =>
      queue.run(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await gate.promise;
        active -= 1;
      }),
    );

    await tick();
    expect(maxActive).toBe(2);

    gates[0]?.resolve();
    gates[1]?.resolve();
    await tick();
    gates[2]?.resolve();
    gates[3]?.resolve();
    await Promise.all(tasks);

    expect(maxActive).toBe(2);
  });
});

describe('withRetry', () => {
  it('retries until success', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('transient');
        return 'ok';
      },
      { attempts: 3, baseDelayMs: 1 },
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('fails fast when shouldRetry returns false', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts += 1;
          throw new Error('fatal');
        },
        { attempts: 3, baseDelayMs: 1, shouldRetry: () => false },
      ),
    ).rejects.toThrow('fatal');

    expect(attempts).toBe(1);
  });
});
