import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { loadCompletionHistory, type CompletionHistory } from '@/data/completion-storage';

export type CompletionHistoryState =
  | { status: 'loading'; history: null }
  | { status: 'ready'; history: CompletionHistory }
  | { status: 'error'; history: null };

/**
 * All saved completion days, read-only. Reloaded every time the screen gains
 * focus, so check-ins made on Today show up when returning to Goals or Insights.
 * While reloading, the previous history stays visible (no flicker).
 *
 * `reloadKey` (e.g. today's date key) also triggers a reload when it changes
 * while the screen stays focused — so a day that rolls over at midnight is
 * picked up. `pending` hides/defer reads that could see an interim disk value;
 * readIsCurrent guards completion against synchronous writes before a rerender.
 * A changed reload key hides the old date boundary until the new read completes.
 * `reload()` retries on demand (e.g. after an error).
 */
export function useCompletionHistory(reloadKey?: string, pending = false, readIsCurrent?: () => boolean): CompletionHistoryState & { reload: () => void } {
  const [state, setState] = useState<CompletionHistoryState>({ status: 'loading', history: null });
  const [loadedKey, setLoadedKey] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // A pending full-day write can supersede the disk snapshot, even when an
      // earlier interim value succeeded. Do not publish that as finished history.
      if (pending) return () => { cancelled = true; };
      loadCompletionHistory()
        .then((history) => {
          if (!cancelled && (!readIsCurrent || readIsCurrent())) {
            setLoadedKey(reloadKey);
            setState({ status: 'ready', history });
          }
        })
        .catch((error) => {
          if (cancelled) return;
          if (readIsCurrent && !readIsCurrent()) return;
          console.warn('[momentum] Failed to load completion history', error);
          setLoadedKey(reloadKey);
          setState({ status: 'error', history: null });
        });
      return () => {
        cancelled = true;
      };
      // reloadKey / attempt are intentional reload triggers.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadKey, attempt, pending, readIsCurrent]),
  );

  const reload = useCallback(() => {
    setState({ status: 'loading', history: null });
    setAttempt((n) => n + 1);
  }, []);

  return { ...(pending || loadedKey !== reloadKey ? { status: 'loading' as const, history: null } : state), reload } as CompletionHistoryState & { reload: () => void };
}
