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
 * picked up. `reload()` retries on demand (e.g. after an error).
 */
export function useCompletionHistory(reloadKey?: string): CompletionHistoryState & { reload: () => void } {
  const [state, setState] = useState<CompletionHistoryState>({ status: 'loading', history: null });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadCompletionHistory()
        .then((history) => {
          if (!cancelled) setState({ status: 'ready', history });
        })
        .catch((error) => {
          if (cancelled) return;
          console.warn('[momentum] Failed to load completion history', error);
          setState({ status: 'error', history: null });
        });
      return () => {
        cancelled = true;
      };
      // reloadKey / attempt are intentional reload triggers.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadKey, attempt]),
  );

  const reload = useCallback(() => {
    setState({ status: 'loading', history: null });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload } as CompletionHistoryState & { reload: () => void };
}
