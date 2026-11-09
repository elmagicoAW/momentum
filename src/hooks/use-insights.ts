import { useMemo } from 'react';

import { useCompletionHistory } from '@/hooks/use-completion-history';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useHabits } from '@/hooks/use-habits';
import { buildInsightsIndex, type InsightsIndex } from '@/utils/insights';

export type InsightsStatus = 'loading' | 'ready' | 'habits-error' | 'history-error';

export type InsightsState = {
  status: InsightsStatus;
  /** null while loading, on error, or when there are no habits. */
  index: InsightsIndex | null;
  todayKey: string;
  retry: () => void;
};

/**
 * Read-only source for Insights. Combines saved habits, saved history (read on
 * focus and when the date changes) and today's LIVE progress, and builds the
 * day-status index once per change. Nothing here writes to storage.
 */
export function useInsights(): InsightsState {
  const { habits, status: habitsStatus, reload: reloadHabits } = useHabits();
  const daily = useDailyProgress();
  const todayKey = daily.dateKey;
  const history = useCompletionHistory(todayKey);
  // Today is judged only from the live record; until it has loaded, today is unknown (never missed).
  const todayRecord = daily.status === 'ready' ? daily.record : undefined;

  const index = useMemo(
    () =>
      habitsStatus === 'ready' && history.status === 'ready'
        ? buildInsightsIndex(habits, history.history, todayKey, todayRecord)
        : null,
    [habits, habitsStatus, history.status, history.history, todayKey, todayRecord],
  );

  let status: InsightsStatus = 'ready';
  if (habitsStatus === 'load-error') status = 'habits-error';
  else if (history.status === 'error') status = 'history-error';
  else if (habitsStatus === 'loading' || history.status === 'loading') status = 'loading';

  const retry = habitsStatus === 'load-error' ? reloadHabits : history.reload;
  return { status, index, todayKey, retry };
}
