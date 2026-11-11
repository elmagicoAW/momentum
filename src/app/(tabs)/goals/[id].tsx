"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {Text} from '@/components/localized-native';
import { appLabel, appMessage } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsistencySummary } from '@/components/goals/consistency-summary';
import { GoalForm } from '@/components/goals/goal-form';
import { EmptyState } from '@/components/habits/empty-state';
import { Radius, Spacing } from '@/constants/theme';
import type { Goal } from '@/data/goal-storage';
import { useCompletionHistory } from '@/hooks/use-completion-history';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useGoals } from '@/hooks/use-goals';
import { useHabits } from '@/hooks/use-habits';
import { confirmDestructive } from '@/utils/confirm';
import { formatShortDate } from '@/i18n/presentation-date';
import { computeHabitConsistency } from '@/utils/goal-progress';
import { closeGoalEditor } from '@/utils/navigation';

export default function EditGoalScreen() {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { goals, status, updateGoal, deleteGoal, reload } = useGoals();
  const { habits, status: habitsStatus } = useHabits();
  const history = useCompletionHistory();
  const daily = useDailyProgress();
  const todayKey = daily.dateKey;
  const todayRecord = daily.status === 'ready' ? daily.record : undefined;
  // Keep showing the goal while a delete is in flight so the form can show errors.
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const goal = goals.find((g) => g.id === id) ?? (deleting?.id === id ? deleting : undefined);

  if (status !== 'ready' || !goal) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.message}>
          {status === 'loading' ? (
            <ActivityIndicator color={Palette.accent} />
          ) : status === 'load-error' ? (
            <EmptyState
              title={appLabel("goals.detail.couldnTLoadYourGoals")}
              description={appLabel("goals.detail.yourSavedDataHasnTBeenChangedTryAgainOrRestartTheApp")}
              icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              actionLabel={appLabel("goals.detail.tryAgain")}
              onAction={reload}
            />
          ) : (
            <EmptyState
              title={appLabel("goals.detail.goalNotFound")}
              description={appLabel("goals.detail.itMayHaveBeenDeleted")}
              icon={{ ios: 'questionmark.circle.fill', android: 'help', web: 'help' }}
              actionLabel={appLabel("goals.detail.backToGoals")}
              onAction={closeGoalEditor}
            />
          )}
        </SafeAreaView>
      </View>
    );
  }

  const consistency =
    history.status === 'ready' && habitsStatus === 'ready'
      ? computeHabitConsistency(goal, habits, history.history, todayKey, todayRecord)
      : null;
  const historyLoading = history.status === 'loading' || habitsStatus === 'loading';

  return (
    <GoalForm
      key={goal.id}
      title={appLabel("goals.detail.editGoal")}
      submitLabel={appLabel("goals.detail.save")}
      todayKey={todayKey}
      startDate={goal.startDate}
      initialDraft={{
        title: goal.title,
        description: goal.description ?? '',
        targetDate: goal.targetDate,
        status: goal.status,
        habitIds: goal.habitIds,
      }}
      footer={
        <View style={styles.footer}>
          <ConsistencySummary
            consistency={consistency}
            loading={historyLoading}
            color={consistency?.linkedHabits[0]?.color ?? Palette.accent}
          />
          <Text style={styles.note}>{appMessage("goals.consistency.explanation", { date: formatShortDate(goal.startDate) })}</Text>
        </View>
      }
      onCancel={closeGoalEditor}
      onSubmit={async (input) => {
        await updateGoal(goal.id, input); // throws on failure → form stays open
        closeGoalEditor();
      }}
      onDelete={async () => {
        const confirmed = await confirmDestructive({
          title: appMessage("goals.delete.title", { name: (goal.title) }),
          get message(){return appLabel("goals.detail.yourHabitsAndTheirCheckInHistoryAreNotAffectedThisCanTBeUndone");},
          get confirmLabel(){return appLabel("goals.detail.delete");},
        });
        if (!confirmed) return false;
        setDeleting(goal);
        try {
          await deleteGoal(goal.id);
        } catch (error) {
          setDeleting(null);
          throw error; // form stays open and shows the error
        }
        closeGoalEditor();
        return true;
      }}
    />
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  message: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: Spacing.four,
  },
  footer: {
    gap: 12,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  note: {
    color: Palette.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
});
