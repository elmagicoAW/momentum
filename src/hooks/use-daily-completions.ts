import { useCallback, useEffect, useRef, useState } from 'react';

import { loadCompletions, saveCompletions } from '@/data/completion-storage';

export type CompletionStatus = 'loading' | 'ready' | 'load-error' | 'save-error';

/**
 * Habit completion state for one local date, persisted with AsyncStorage.
 *
 * Safety rules:
 * - Nothing is written until that date's saved data has loaded successfully,
 *   so a slow or failed read can never overwrite existing data.
 * - Toggles are ignored while loading or after a failed load.
 * - Writes are queued so they land in the order the user made them.
 */
export function useDailyCompletions(dateKey: string) {
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<CompletionStatus>('loading');

  // Latest set, readable synchronously so rapid taps build on each other.
  const completedRef = useRef(completed);
  // Date whose data is loaded and safe to write; null while loading or after an error.
  const loadedDateRef = useRef<string | null>(null);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    loadedDateRef.current = null;
    completedRef.current = new Set();
    setCompleted(completedRef.current);
    setStatus('loading');

    loadCompletions(dateKey)
      .then((ids) => {
        if (cancelled) return;
        completedRef.current = new Set(ids);
        setCompleted(completedRef.current);
        loadedDateRef.current = dateKey;
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[momentum] Failed to load habit completions', error);
        setStatus('load-error');
      });

    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  const toggle = useCallback(
    (habitId: string) => {
      if (loadedDateRef.current !== dateKey) return;

      const next = new Set(completedRef.current);
      if (next.has(habitId)) next.delete(habitId);
      else next.add(habitId);
      completedRef.current = next;
      setCompleted(next);

      writeQueueRef.current = writeQueueRef.current
        .then(() => saveCompletions(dateKey, next))
        .then(
          () => setStatus((s) => (s === 'save-error' ? 'ready' : s)),
          (error) => {
            console.warn('[momentum] Failed to save habit completions', error);
            setStatus('save-error');
          },
        );
    },
    [dateKey],
  );

  return { completed, status, toggle };
}
