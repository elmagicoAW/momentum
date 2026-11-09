import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { loadCompletionHistory, type CompletionHistory } from '@/data/completion-storage';

export type CompletionHistoryState =
  | { status: 'loading'; history: null }
  | { status: 'ready'; history: CompletionHistory }
  | { status: 'error'; history: null };

/**
 * All saved completion days, read-only. Reloaded every time the screen gains
 * focus, so check-ins made on Today show up when returning to Goals.
 * While reloading, the previous history stays visible (no flicker).
 */
export function useCompletionHistory(): CompletionHistoryState {
  const [state, setState] = useState<CompletionHistoryState>({ status: 'loading', history: null });

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
    }, []),
  );

  return state;
}
