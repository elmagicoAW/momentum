import { persistence as persistenceBarrier } from '@/data/persistence-coordinator';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { createAchievementCoordinator, initialAchievementState, type AchievementState } from '@/data/achievement-coordinator';
import { loadAchievements, saveAchievements } from '@/data/achievement-storage';
import { loadCompletionHistory } from '@/data/completion-storage';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useHabits } from '@/hooks/use-habits';
import { toLocalDateKey } from '@/utils/date';

type AchievementsValue = AchievementState & { retry: () => void; acknowledge: (ids: readonly string[]) => void };
const AchievementsContext = createContext<AchievementsValue | null>(null);

export function AchievementsProvider({ children }: { children: ReactNode }) {
  const { habits, status: habitsStatus, savedSnapshot, reload: reloadHabits } = useHabits();
  const { dateKey, persistence, drainRevision, saveState, retrySave } = useDailyProgress();
  const [state, setState] = useState(initialAchievementState);
  const [coordinator] = useState(() => createAchievementCoordinator({
    inputs: () => {
      const today = toLocalDateKey(new Date());
      const saved = savedSnapshot();
      return { today, ...saved, ...persistence.snapshot(today) };
    },
    load: loadAchievements, save: saveAchievements, history: loadCompletionHistory,
    now: () => new Date(), onChange: setState,
  }));

  useEffect(() => {
    void coordinator.request();
    return () => coordinator.invalidate();
    // No live record dependency: a tap does not cause a history scan.
  }, [coordinator, dateKey, habits, habitsStatus, drainRevision, saveState]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && persistenceBarrier.available()) { persistenceBarrier.enableAwards(); void coordinator.request(true); }
    });
    return () => subscription.remove();
  }, [coordinator]);

  const retry = useCallback(() => {
    persistenceBarrier.enableAwards();
    if (habitsStatus === 'load-error') reloadHabits();
    retrySave();
    void coordinator.request(true);
  }, [coordinator, habitsStatus, reloadHabits, retrySave]);
  const acknowledge = useCallback((ids: readonly string[]) => { void coordinator.acknowledge(ids); }, [coordinator]);
  const value = useMemo(() => ({ ...state, retry, acknowledge }), [state, retry, acknowledge]);
  return <AchievementsContext.Provider value={value}>{children}</AchievementsContext.Provider>;
}

export function useAchievements(): AchievementsValue {
  const value = useContext(AchievementsContext);
  if (!value) throw new Error('useAchievements must be used inside AchievementsProvider');
  return value;
}
