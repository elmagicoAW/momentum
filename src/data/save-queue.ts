export type SaveQueueState = 'saving' | 'saved' | 'error';

export type SaveQueue<T> = {
  /** Queues the latest full value for a key and starts saving it. */
  enqueue: (key: string, value: T) => void;
  /** Latest value for a key that is not on disk yet. */
  pendingValue: (key: string) => T | undefined;
  hasPending: () => boolean;
  revision: () => number;
  finishedRevision: (today: string) => number;
  /** Retries now (ends a backoff wait early). */
  retry: () => void;
};

const DEFAULT_RETRY_DELAYS_MS = [1_000, 3_000, 10_000, 30_000];

/**
 * Serialized, coalescing save loop for full-value writes (one value per key).
 *
 * - At most one write is in flight. Values queued meanwhile replace the pending
 *   value for their key, and one follow-up write saves the latest — so rapid taps
 *   cause at most one extra write, and every write contains every earlier change.
 * - A pending value is removed only after a write of that exact value succeeded.
 * - A failed write is never dropped: the loop waits (backoff) and tries again
 *   until it succeeds. `enqueue` or `retry` end the wait early.
 * - `onState('saved')` is reported only when nothing is pending any more.
 *   While a failure is unresolved the state stays 'error' (not 'saving').
 */
export function createSaveQueue<T>(
  save: (key: string, value: T) => Promise<void>,
  onState: (state: SaveQueueState) => void,
  retryDelaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
): SaveQueue<T> {
  const pending = new Map<string, T>();
  let running = false;
  let failing = false;
  let wake: (() => void) | null = null;
  let revision = 0;
  const writtenDates = new Map<string, number>();

  const waitBeforeRetry = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    }).finally(() => {
      wake = null;
    });

  async function run() {
    if (running) {
      wake?.();
      return;
    }
    running = true;
    let failures = 0;
    try {
      while (pending.size > 0) {
        const [key, value] = pending.entries().next().value as [string, T];
        try {
          await save(key, value);
          revision += 1;
          writtenDates.set(key, (writtenDates.get(key) ?? 0) + 1);
          if (pending.get(key) === value) pending.delete(key);
          failures = 0;
        } catch (error) {
          console.warn('[momentum] Save failed; will retry', error);
          failing = true;
          onState('error');
          await waitBeforeRetry(retryDelaysMs[Math.min(failures, retryDelaysMs.length - 1)]);
          failures += 1;
        }
      }
      failing = false;
      onState('saved');
    } finally {
      running = false;
    }
  }

  return {
    enqueue(key, value) {
      revision += 1;
      pending.set(key, value);
      if (!failing) onState('saving');
      void run();
    },
    pendingValue: (key) => pending.get(key),
    hasPending: () => pending.size > 0,
    revision: () => revision,
    finishedRevision: (today) => {
      let total = 0;
      for (const [date, count] of writtenDates) if (date < today) total += count;
      return total;
    },
    retry() {
      if (pending.size === 0) return;
      onState('saving');
      void run();
    },
  };
}
