import { persistence } from '@/data/persistence-coordinator';
/**
 * Save-first, serialized store for ONE persisted value (e.g. the profile).
 * Same rules as `list-store.ts`, for a single object instead of a list:
 *
 * - Nothing is written until a load succeeded (a failed, corrupt or slow read
 *   can never be overwritten by a default value).
 * - Each change is computed from the last SAVED value, saved, and only then
 *   committed + reported through `onChange`. The UI never shows unsaved data.
 * - A change that returns the current value unchanged writes nothing.
 * - Writes run one at a time, in call order. A failed write rejects the
 *   caller's promise, leaves the value unchanged, and doesn't block later writes.
 * - Only the most recent `load()` can apply its result.
 */
export type ValueStore<T> = {
  load: () => Promise<T>;
  commit: <R>(change: (current: T) => { next: T; result: R }) => Promise<R>;
  /** Last loaded/saved value (`initial` before the first successful load). */
  current: () => T;
  isLoaded: () => boolean;
};

export function createValueStore<T>(options: {
  initial: T;
  load: () => Promise<T>;
  save: (value: T) => Promise<void>;
  onChange: (value: T) => void;
  /** Error message when a change is attempted before a successful load. */
  notLoadedMessage?: string;
  /** Outer owner (achievement coordinator) already holds an admission lease. */
  externallyManaged?: boolean;
}): ValueStore<T> {
  let current = options.initial;
  let loaded = false;
  let loadToken = 0;
  let queue: Promise<unknown> = Promise.resolve();

  const epoch = persistence.generation();
  const admitted = <R,>(fn: () => Promise<R>) => options.externallyManaged ? fn() : persistence.run(fn, epoch);
  return {
    load() { return admitted(async () => {
      const token = ++loadToken;
      loaded = false;
      const value = await options.load();
      if (token !== loadToken) throw new Error('Superseded by a newer load');
      current = value;
      loaded = true;
      return value;
    }); },
    commit(change) { return admitted(() => {
      if (!options.externallyManaged) persistence.enableUserChanges();
      const task = queue.then(async () => {
        if (!loaded) throw new Error(options.notLoadedMessage ?? "Data hasn't loaded yet");
        const { next, result } = change(current);
        if (next !== current) {
          await options.save(next);
          current = next;
          options.onChange(next);
        }
        return result;
      });
      // Keep the queue alive after a failure; the caller still sees the error.
      queue = task.catch(() => undefined);
      return task;
    }); },
    current: () => current,
    isLoaded: () => loaded,
  };
}
