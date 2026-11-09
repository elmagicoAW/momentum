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
import { AppState } from 'react-native';

import { loadDay, saveDay, type DayRecord } from '@/data/completion-storage';
import { createSaveQueue } from '@/data/save-queue';
import type { Habit } from '@/data/habit-storage';
import { useCurrentDate } from '@/hooks/use-current-date';
import { useHabits } from '@/hooks/use-habits';
import { toLocalDateKey } from '@/utils/date';
import { applyCount, applyStep, applyTick, normalizeTodayRecord } from '@/utils/habit-progress';

export type DayLoadStatus = 'loading' | 'ready' | 'load-error';
/**
 * - idle:   nothing changed this session
 * - saving: at least one change is not on disk yet
 * - saved:  every change made so far is on disk
 * - error:  the last save failed; it is retried automatically and on demand
 */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type DailyProgressValue = {
  /** Today's local date key. */
  dateKey: string;
  /** Today's progress (empty while loading or after a failed load). */
  record: DayRecord;
  status: DayLoadStatus;
  saveState: SaveState;
  /** Stable synchronous persistence guard; includes every queued local date. */
  persistence: { snapshot: (today: string) => { pending: boolean; revision: number; finishedRevision: number } };
  drainRevision: number;
  /** False while loading or after a failed load — taps are ignored then. */
  canEdit: boolean;
  toggleTick: (habit: Habit) => void;
  adjustCount: (habit: Habit, delta: number) => void;
  toggleStep: (habit: Habit, stepId: string) => void;
  /** Retry a failed save now. */
  retrySave: () => void;
  /** Retry loading today after a failed load. */
  reloadDay: () => void;
};

const DailyProgressContext = createContext<DailyProgressValue | null>(null);

const EMPTY: DayRecord = { entries: {} };

type DayState = { dateKey: string | null; record: DayRecord; status: DayLoadStatus };

/**
 * Today's habit progress — the ONLY writer of daily progress records.
 *
 * Safety rules:
 * - Nothing is written for a date until that date's saved data has loaded
 *   successfully, so a slow or failed read can never overwrite existing data.
 * - Every write saves the FULL latest record for its date in one `setItem`.
 * - Writes are serialized: at most one is in flight. Taps made meanwhile only
 *   replace the pending record, and one follow-up write saves the latest state.
 *   Nothing is dropped — each write contains every change made before it.
 * - A failed write keeps the pending record and keeps retrying with backoff
 *   (1 s → 30 s) while the app runs; a new change, the app going to the
 *   background, or `retrySave` retries immediately.
 * - Pending records are kept per date, so a save that is still pending at
 *   midnight is still written to the right day.
 * - `saveState` reports 'saved' only after the data is on disk.
 */
export function DailyProgressProvider({ children }: { children: ReactNode }) {
  const dateKey = toLocalDateKey(useCurrentDate());
  const { habits, status: habitsStatus } = useHabits();

  // State is tagged with its date; a different date is shown as "loading"
  // until that date's data arrives (so nothing is reset synchronously in an effect).
  const [day, setDay] = useState<DayState>({ dateKey: null, record: EMPTY, status: 'loading' });
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [drainRevision, setDrainRevision] = useState(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const current = day.dateKey === dateKey ? day : { dateKey, record: EMPTY, status: 'loading' as const };
  const { record, status } = current;

  const recordRef = useRef<DayRecord>(EMPTY);
  // Date whose data is loaded and safe to write; null while loading or after an error.
  const loadedDateRef = useRef<string | null>(null);
  // Serialized, coalescing, retrying writer (see save-queue.ts). One per provider.
  const [queue] = useState(() => createSaveQueue<DayRecord>(saveDay, (state) => {
    setSaveState(state);
    if (state === 'saved') setDrainRevision((n) => n + 1);
  }));
  const persistence = useMemo(() => ({ snapshot: (today: string) => ({
    pending: queue.hasPending(), revision: queue.revision(), finishedRevision: queue.finishedRevision(today),
  }) }), [queue]);

  /** Applies a change to today's record, shows it, and queues it for saving. */
  const mutate = useCallback(
    (change: (current: DayRecord) => DayRecord) => {
      if (loadedDateRef.current !== dateKey || toLocalDateKey(new Date()) !== dateKey) return;
      const next = change(recordRef.current);
      if (next === recordRef.current) return;
      recordRef.current = next;
      setDay({ dateKey, record: next, status: 'ready' });
      queue.enqueue(dateKey, next);
    },
    [dateKey, queue],
  );

  // Load the current date (again after midnight or a retry).
  useEffect(() => {
    let cancelled = false;
    loadedDateRef.current = null;
    recordRef.current = EMPTY;

    // An unsaved record for this date is newer than what's on disk.
    const pending = queue.pendingValue(dateKey);
    const load = pending ? Promise.resolve(pending) : loadDay(dateKey);
    load
      .then((loaded) => {
        if (cancelled) return;
        recordRef.current = loaded;
        loadedDateRef.current = dateKey;
        setDay({ dateKey, record: loaded, status: 'ready' });
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[momentum] Failed to load daily progress', error);
        setDay({ dateKey, record: EMPTY, status: 'load-error' });
      });

    return () => {
      cancelled = true;
    };
  }, [dateKey, loadAttempt, queue]);

  // Keep today's snapshots in line with edited habit definitions (see habit-progress.ts).
  useEffect(() => {
    if (habitsStatus !== 'ready' || status !== 'ready') return;
    mutate((r) => normalizeTodayRecord(r, habits));
  }, [habits, habitsStatus, status, record, mutate]);

  // Push pending saves out as soon as the app leaves the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') queue.retry();
    });
    return () => sub.remove();
  }, [queue]);

  const toggleTick = useCallback((habit: Habit) => mutate((r) => applyTick(r, habit)), [mutate]);
  const adjustCount = useCallback(
    (habit: Habit, delta: number) => mutate((r) => applyCount(r, habit, delta)),
    [mutate],
  );
  const toggleStep = useCallback(
    (habit: Habit, stepId: string) => mutate((r) => applyStep(r, habit, stepId)),
    [mutate],
  );
  const retrySave = useCallback(() => queue.retry(), [queue]);
  const reloadDay = useCallback(() => {
    setDay((d) => ({ ...d, status: 'loading' }));
    setLoadAttempt((n) => n + 1);
  }, []);

  const value = useMemo<DailyProgressValue>(
    () => ({
      dateKey,
      record,
      status,
      saveState,
      persistence,
      drainRevision,
      canEdit: status === 'ready',
      toggleTick,
      adjustCount,
      toggleStep,
      retrySave,
      reloadDay,
    }),
    [dateKey, record, status, saveState, persistence, drainRevision, toggleTick, adjustCount, toggleStep, retrySave, reloadDay],
  );

  return <DailyProgressContext.Provider value={value}>{children}</DailyProgressContext.Provider>;
}

export function useDailyProgress(): DailyProgressValue {
  const context = useContext(DailyProgressContext);
  if (!context) throw new Error('useDailyProgress must be used inside <DailyProgressProvider>');
  return context;
}
