import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  createHabitId,
  loadHabits,
  saveHabits,
  type Habit,
  type HabitInput,
} from '@/data/habit-storage';

export type HabitsStatus = 'loading' | 'ready' | 'load-error';

type HabitsContextValue = {
  habits: Habit[];
  status: HabitsStatus;
  /** Retry loading after a failure. */
  reload: () => void;
  /** Each mutation resolves only after the change is saved, and throws if saving fails. */
  createHabit: (input: HabitInput) => Promise<Habit>;
  updateHabit: (id: string, input: HabitInput) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
};

const HabitsContext = createContext<HabitsContextValue | null>(null);

/**
 * Shared habit list for every screen, persisted with AsyncStorage.
 *
 * Safety rules (same spirit as `useDailyCompletions`):
 * - Nothing is written until saved habits have loaded successfully.
 * - Changes are saved first; state updates only after the save succeeds, so
 *   the UI never shows a change that isn't on disk.
 * - Writes run one at a time, each building on the last saved list.
 */
export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [status, setStatus] = useState<HabitsStatus>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Last successfully saved/loaded list, readable synchronously inside the write queue.
  const habitsRef = useRef<Habit[]>([]);
  const loadedRef = useRef(false);
  const writeQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    loadedRef.current = false;

    loadHabits()
      .then((loaded) => {
        if (cancelled) return;
        habitsRef.current = loaded;
        loadedRef.current = true;
        setHabits(loaded);
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[momentum] Failed to load habits', error);
        setStatus('load-error');
      });

    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const reload = useCallback(() => {
    setStatus('loading');
    setLoadAttempt((n) => n + 1);
  }, []);

  /** Queues a change: computes the next list from the last saved one, saves it, then commits it. */
  const commit = useCallback(<T,>(change: (current: Habit[]) => { next: Habit[]; result: T }) => {
    const task = writeQueueRef.current.then(async () => {
      if (!loadedRef.current) {
        throw new Error("Habits haven't loaded yet");
      }
      const { next, result } = change(habitsRef.current);
      await saveHabits(next);
      habitsRef.current = next;
      setHabits(next);
      return result;
    });
    // Keep the queue alive after a failure; the caller still sees the error.
    writeQueueRef.current = task.catch(() => undefined);
    return task;
  }, []);

  const createHabit = useCallback(
    (input: HabitInput) =>
      commit((current) => {
        const habit: Habit = {
          ...input,
          id: createHabitId(current.map((h) => h.id)),
          createdAt: new Date().toISOString(),
        };
        return { next: [...current, habit], result: habit };
      }),
    [commit],
  );

  const updateHabit = useCallback(
    (id: string, input: HabitInput) =>
      commit((current) => {
        const existing = current.find((h) => h.id === id);
        if (!existing) throw new Error('This habit no longer exists');
        // id and createdAt are preserved, so completions stay linked.
        const updated: Habit = { ...input, id: existing.id, createdAt: existing.createdAt };
        return { next: current.map((h) => (h.id === id ? updated : h)), result: undefined };
      }),
    [commit],
  );

  const deleteHabit = useCallback(
    (id: string) =>
      commit((current) => {
        if (!current.some((h) => h.id === id)) throw new Error('This habit no longer exists');
        // Past completion records are intentionally left untouched.
        return { next: current.filter((h) => h.id !== id), result: undefined };
      }),
    [commit],
  );

  const value = useMemo(
    () => ({ habits, status, reload, createHabit, updateHabit, deleteHabit }),
    [habits, status, reload, createHabit, updateHabit, deleteHabit],
  );

  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
}

export function useHabits(): HabitsContextValue {
  const context = useContext(HabitsContext);
  if (!context) throw new Error('useHabits must be used inside <HabitsProvider>');
  return context;
}
