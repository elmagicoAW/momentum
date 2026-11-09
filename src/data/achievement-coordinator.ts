import type { CompletionHistory } from '@/data/completion-storage';
import type { Habit } from '@/data/habit-storage';
import {
  acknowledgeAchievements, emptyAchievements, mergeAchievementAwards,
  type AchievementCollection,
} from '@/data/achievement-storage';
import { createValueStore } from '@/data/value-store';
import { evaluateAchievements, type AchievementEvaluation } from '@/utils/achievements';

export type AchievementInputs = {
  today: string;
  habits: readonly Habit[];
  ready: boolean;
  pending: boolean;
  /** Changes synchronously on enqueue AND drain; invalidates a read even before React renders. */
  revision: number;
  /** Changes only when a successfully persisted record belongs to a finished day. */
  finishedRevision: number;
};
export type AchievementState = {
  collection: AchievementCollection;
  storeReady: boolean;
  evaluation: AchievementEvaluation | null;
  status: 'loading' | 'ready' | 'waiting' | 'inputs-error' | 'store-error' | 'history-error' | 'save-error';
  acknowledgementError: boolean;
};
export const initialAchievementState = (): AchievementState => ({ collection: emptyAchievements(), storeReady: false, evaluation: null, status: 'loading', acknowledgementError: false });

/** One operation queue owns load, evaluation, award and acknowledgement writes.
 * Input snapshots are checked immediately before the save starts (the commit point).
 * No await separates that check from invoking persistence. Storage/display cannot be atomic.
 */
export function createAchievementCoordinator(options: {
  inputs: () => AchievementInputs;
  load: () => Promise<AchievementCollection>;
  save: (collection: AchievementCollection) => Promise<void>;
  history: () => Promise<CompletionHistory>;
  now: () => Date;
  onChange: (state: AchievementState) => void;
}) {
  let state = initialAchievementState();
  const publish = (change: Partial<AchievementState>) => { state = { ...state, ...change }; options.onChange(state); };
  const store = createValueStore({ initial: emptyAchievements(), load: options.load, save: options.save,
    onChange: (collection) => publish({ collection, storeReady: true }) });
  let serial: Promise<unknown> = Promise.resolve();
  let generation = 0;
  let cached: AchievementInputs | null = null;
  const enqueue = <T,>(task: () => Promise<T>): Promise<T> => {
    const next = serial.then(task);
    serial = next.catch(() => undefined);
    return next;
  };
  const sameSource = (a: AchievementInputs, b: AchievementInputs) => a.today === b.today && a.habits === b.habits && a.finishedRevision === b.finishedRevision;
  const valid = (input: AchievementInputs, token: number) => {
    const latest = options.inputs();
    return generation === token && latest.ready && !latest.pending && latest.revision === input.revision && sameSource(input, latest);
  };
  return {
    current: () => state,
    /** Coalesced requests. Successful today-only drains reuse finished-day metrics. */
    request(force = false) {
      const token = ++generation;
      return enqueue(async () => {
        if (token !== generation) return;
        if (!store.isLoaded()) {
          publish({ status: 'loading' });
          try { const collection = await store.load(); publish({ collection, storeReady: true }); }
          catch { publish({ status: 'store-error', storeReady: false }); return; }
        }
        if (token !== generation) return;
        const input = options.inputs();
        if (!input.ready) { publish({ status: 'inputs-error', evaluation: null }); return; }
        if (input.pending) { publish({ status: 'waiting' }); return; }
        if (!force && cached && sameSource(input, cached)) { publish({ status: 'ready' }); return; }
        // A canceled refresh must not reuse a cache whose published metrics were cleared.
        cached = null;
        publish({ status: 'loading', evaluation: null });
        let history: CompletionHistory;
        try { history = await options.history(); }
        catch { if (valid(input, token)) publish({ status: 'history-error' }); return; }
        if (!valid(input, token)) return;
        const evaluation = evaluateAchievements(input.habits, history, input.today);
        try {
          let committed = false;
          await store.commit((current) => {
            if (!valid(input, token)) return { next: current, result: undefined };
            committed = true;
            return { next: mergeAchievementAwards(current, evaluation, options.now()), result: undefined };
          });
          if (!committed || !valid(input, token)) return;
          cached = input;
          publish({ status: 'ready', evaluation });
        } catch { if (valid(input, token)) publish({ status: 'save-error', evaluation }); }
      });
    },
    acknowledge(ids: readonly string[]) {
      return enqueue(async () => {
        if (!store.isLoaded()) return;
        try {
          await store.commit((current) => ({ next: acknowledgeAchievements(current, ids), result: undefined }));
          publish({ acknowledgementError: false });
        } catch { publish({ acknowledgementError: true }); }
      });
    },
    /** Cleanup invalidates reads but does not abort an already-started atomic key write. */
    invalidate() { generation += 1; },
  };
}
