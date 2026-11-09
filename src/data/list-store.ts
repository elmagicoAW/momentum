/**
 * Save-first, serialized store for a list persisted as ONE value (e.g. routines).
 * Same rules as `useHabits` / `useGoals`, extracted so they can be tested without React:
 *
 * - Nothing is written until a load succeeded (a failed or slow read can never
 *   be overwritten by an empty list).
 * - Each change is computed from the last SAVED list, saved, and only then
 *   committed + reported through `onChange`. The UI never shows unsaved data.
 * - Writes run one at a time, in call order. A failed write rejects the
 *   caller's promise, leaves the list unchanged, and doesn't block later writes.
 * - Only the most recent `load()` can apply its result.
 */
export type ListStore<T> = {
  load: () => Promise<T[]>;
  commit: <R>(change: (current: T[]) => { next: T[]; result: R }) => Promise<R>;
  /** Last loaded/saved list. */
  current: () => T[];
  isLoaded: () => boolean;
};

export function createListStore<T>(options: {
  load: () => Promise<T[]>;
  save: (list: T[]) => Promise<void>;
  onChange: (list: T[]) => void;
  /** Error message when a change is attempted before a successful load. */
  notLoadedMessage?: string;
}): ListStore<T> {
  let current: T[] = [];
  let loaded = false;
  let loadToken = 0;
  let queue: Promise<unknown> = Promise.resolve();

  return {
    async load() {
      const token = ++loadToken;
      loaded = false;
      const list = await options.load();
      if (token !== loadToken) throw new Error('Superseded by a newer load');
      current = list;
      loaded = true;
      return list;
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
      // Keep the queue alive after a failure; the caller still sees the error.
      queue = task.catch(() => undefined);
      return task;
    },
    current: () => current,
    isLoaded: () => loaded,
  };
}
