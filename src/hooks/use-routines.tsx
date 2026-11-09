import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { createListStore } from '@/data/list-store';
import { loadRoutines, saveRoutines, type Routine, type RoutineInput } from '@/data/routine-storage';
import { addRoutine, deleteRoutineFrom, moveRoutineIn, updateRoutineIn } from '@/utils/routine-list';

export type RoutinesStatus = 'loading' | 'ready' | 'load-error';

type RoutinesContextValue = {
  /** In the user's order. */
  routines: Routine[];
  status: RoutinesStatus;
  /** Retry loading after a failure. */
  reload: () => void;
  /** Each mutation resolves only after the change is saved, and throws if saving fails. */
  createRoutine: (input: RoutineInput) => Promise<Routine>;
  updateRoutine: (id: string, input: RoutineInput) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;
  /** Resolves false when the routine is already at that edge (nothing saved). */
  moveRoutine: (id: string, delta: -1 | 1) => Promise<boolean>;
};

const RoutinesContext = createContext<RoutinesContextValue | null>(null);

/**
 * Shared routine list, persisted under its own AsyncStorage key. Same safety
 * rules as `useHabits` / `useGoals` (see `data/list-store.ts`):
 * - Nothing is written until saved routines have loaded successfully.
 * - Changes are saved first; state updates only after the save succeeds.
 * - Writes run one at a time, each building on the last saved list.
 * Routines never write habits, goals or daily progress.
 */
export function RoutinesProvider({ children }: { children: ReactNode }) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [status, setStatus] = useState<RoutinesStatus>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [store] = useState(() =>
    createListStore<Routine>({
      load: loadRoutines,
      save: saveRoutines,
      onChange: setRoutines,
      notLoadedMessage: "Routines haven't loaded yet",
    }),
  );

  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((loaded) => {
        if (cancelled) return;
        setRoutines(loaded);
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[momentum] Failed to load routines', error);
        setStatus('load-error');
      });
    return () => {
      cancelled = true;
    };
  }, [store, loadAttempt]);

  const reload = useCallback(() => {
    setStatus('loading');
    setLoadAttempt((n) => n + 1);
  }, []);

  const createRoutine = useCallback(
    (input: RoutineInput) => store.commit((list) => addRoutine(list, input, new Date())),
    [store],
  );
  const updateRoutine = useCallback(
    (id: string, input: RoutineInput) => store.commit((list) => updateRoutineIn(list, id, input, new Date())),
    [store],
  );
  const deleteRoutine = useCallback((id: string) => store.commit((list) => deleteRoutineFrom(list, id)), [store]);
  const moveRoutine = useCallback(
    (id: string, delta: -1 | 1) => store.commit((list) => moveRoutineIn(list, id, delta)),
    [store],
  );

  const value = useMemo(
    () => ({ routines, status, reload, createRoutine, updateRoutine, deleteRoutine, moveRoutine }),
    [routines, status, reload, createRoutine, updateRoutine, deleteRoutine, moveRoutine],
  );

  return <RoutinesContext.Provider value={value}>{children}</RoutinesContext.Provider>;
}

export function useRoutines(): RoutinesContextValue {
  const context = useContext(RoutinesContext);
  if (!context) throw new Error('useRoutines must be used inside <RoutinesProvider>');
  return context;
}
