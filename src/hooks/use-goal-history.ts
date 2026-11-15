import { useCompletionHistory } from '@/hooks/use-completion-history';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useCallback } from 'react';

/** Historical counts only use a drained saved generation, never an interim
 * snapshot while an undo/failed write remains pending (including yesterday). */
export function useGoalHistory() {
  const daily = useDailyProgress();
  const saved = daily.persistence.snapshot(daily.dateKey);
  const { dateKey, persistence } = daily;
  const isCurrent = useCallback(() => {
    const current = persistence.snapshot(dateKey);
    return !current.pending && current.finishedRevision === saved.finishedRevision;
  }, [dateKey, persistence, saved.finishedRevision]);
  return useCompletionHistory(`${dateKey}:${saved.finishedRevision}`, saved.pending, isCurrent);
}
