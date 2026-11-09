/**
 * Save-first, serialized store for ONE persisted value (e.g. reminder settings).
 * Same rules as `list-store.ts`, for a single object instead of a list:
 *
 * - Nothing is written until a load succeeded (a failed or slow read can never
 *   be overwritten by defaults).
 * - Each change is computed from the last SAVED value, saved, and only then
 *   committed + reported through `onChange`. The UI never shows unsaved data.
 * - Writes run one at a time, in call order. A failed write rejects the
 *   caller's promise, leaves the value unchanged, and doesn't block later writes.
 * - Only the most recent `load()` can apply its result.
 */
export type ValueStore<T> = {
  load: () => Promise<T>;
  commit: <R>(change: (current: T) => { next: T; result: R }) => Promise<R>;
  current: () => T;
  isLoaded: () => boolean;
};

export function createValueStore<T>(options: {
  initial: T;
  load: () => Promise<T>;
  save: (value: T) => Promise<void>;
  onChange: (value: T) => void;
  notLoadedMessage?: string;
}): ValueStore<T> {
  let current = options.initial;
  let loaded = false;
  let loadToken = 0;
  let queue: Promise<unknown> = Promise.resolve();

  return {
    async load() {
      const token = ++loadToken;
      loaded = false;
      const value = await options.load();
      if (token !== loadToken) throw new Error('Superseded by a newer load');
      current = value;
      loaded = true;
      return value;
    },
    commit(change) {
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
      queue = task.catch(() => undefined);
      return task;
    },
    current: () => current,
    isLoaded: () => loaded,
  };
}
