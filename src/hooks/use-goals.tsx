import { persistence } from '@/data/persistence-coordinator';
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

import { createGoalId, loadGoals, saveGoals, type Goal, type GoalInput } from '@/data/goal-storage';
import { toLocalDateKey } from '@/utils/date';

export type GoalsStatus = 'loading' | 'ready' | 'load-error';

type GoalsContextValue = {
  goals: Goal[];
  status: GoalsStatus;
  /** Retry loading after a failure. */
  reload: () => void;
  /** Each mutation resolves only after the change is saved, and throws if saving fails. */
  createGoal: (input: GoalInput) => Promise<Goal>;
  updateGoal: (id: string, input: GoalInput) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
};

const GoalsContext = createContext<GoalsContextValue | null>(null);

/** Keeps `completedAt` in step with the manually chosen status. */
function withCompletion(input: GoalInput, previous?: Goal): Pick<Goal, 'completedAt'> {
  if (input.status !== 'completed') return {};
  if (previous?.status === 'completed' && previous.completedAt) return { completedAt: previous.completedAt };
  return { completedAt: toLocalDateKey(new Date()) };
}

/** Removes empty optional fields so saved goals stay minimal. */
function cleanInput(input: GoalInput): GoalInput {
  const { description, ...rest } = input;
  return { ...rest, habitIds: [...new Set(input.habitIds)], ...(description ? { description } : {}) };
}

/**
 * Shared goal list, persisted with AsyncStorage. Same safety rules as `useHabits`:
 * - Nothing is written until saved goals have loaded successfully.
 * - Changes are saved first; state updates only after the save succeeds.
 * - Writes run one at a time, each building on the last saved list.
 */
export function GoalsProvider({ children }: { children: ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [status, setStatus] = useState<GoalsStatus>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);

  const goalsRef = useRef<Goal[]>([]);
  const loadedRef = useRef(false);
  const [epoch] = useState(() => persistence.generation());
  const writeQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    loadedRef.current = false;

    persistence.run(() => loadGoals(), epoch)
      .then((loaded) => {
        if (cancelled) return;
        goalsRef.current = loaded;
        loadedRef.current = true;
        setGoals(loaded);
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[momentum] Failed to load goals', error);
        setStatus('load-error');
      });

    return () => {
      cancelled = true;
    };
  }, [loadAttempt, epoch]);

  const reload = useCallback(() => {
    setStatus('loading');
    setLoadAttempt((n) => n + 1);
  }, []);

  const commit = useCallback(<T,>(change: (current: Goal[]) => { next: Goal[]; result: T }) => persistence.run(() => {
    persistence.enableUserChanges();
    const task = writeQueueRef.current.then(async () => {
      if (!loadedRef.current) {
        throw new Error("Goals haven't loaded yet");
      }
      const { next, result } = change(goalsRef.current);
      await saveGoals(next);
      goalsRef.current = next;
      setGoals(next);
      return result;
    });
    // Keep the queue alive after a failure; the caller still sees the error.
    writeQueueRef.current = task.catch(() => undefined);
    return task;
  }, epoch), [epoch]);

  const createGoal = useCallback(
    (input: GoalInput) =>
      commit((current) => {
        const now = new Date();
        const goal: Goal = {
          ...cleanInput(input),
          id: createGoalId(current.map((g) => g.id)),
          startDate: toLocalDateKey(now),
          ...withCompletion(input),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        return { next: [...current, goal], result: goal };
      }),
    [commit],
  );

  const updateGoal = useCallback(
    (id: string, input: GoalInput) =>
      commit((current) => {
        const existing = current.find((g) => g.id === id);
        if (!existing) throw new Error('This goal no longer exists');
        const updated: Goal = {
          ...cleanInput(input),
          id: existing.id,
          startDate: existing.startDate,
          ...withCompletion(input, existing),
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        };
        return { next: current.map((g) => (g.id === id ? updated : g)), result: undefined };
      }),
    [commit],
  );

  const deleteGoal = useCallback(
    (id: string) =>
      commit((current) => {
        if (!current.some((g) => g.id === id)) throw new Error('This goal no longer exists');
        // Habits and their completion history are not affected.
        return { next: current.filter((g) => g.id !== id), result: undefined };
      }),
    [commit],
  );

  const value = useMemo(
    () => ({ goals, status, reload, createGoal, updateGoal, deleteGoal }),
    [goals, status, reload, createGoal, updateGoal, deleteGoal],
  );

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoals(): GoalsContextValue {
  const context = useContext(GoalsContext);
  if (!context) throw new Error('useGoals must be used inside <GoalsProvider>');
  return context;
}
