import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsistencySummary } from '@/components/goals/consistency-summary';
import { GoalForm } from '@/components/goals/goal-form';
import { EmptyState } from '@/components/habits/empty-state';
import { Palette, Radius, Spacing } from '@/constants/theme';
import type { Goal } from '@/data/goal-storage';
import { useCompletionHistory } from '@/hooks/use-completion-history';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useGoals } from '@/hooks/use-goals';
import { useHabits } from '@/hooks/use-habits';
import { confirmDestructive } from '@/utils/confirm';
import { formatShortDate } from '@/utils/date';
import { computeHabitConsistency } from '@/utils/goal-progress';
import { closeGoalEditor } from '@/utils/navigation';

export default function EditGoalScreen() {
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
              title="Couldn't load your goals"
              description="Your saved data hasn't been changed. Try again, or restart the app."
              icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              actionLabel="Try again"
              onAction={reload}
            />
          ) : (
            <EmptyState
              title="Goal not found"
              description="It may have been deleted."
              icon={{ ios: 'questionmark.circle.fill', android: 'help', web: 'help' }}
              actionLabel="Back to goals"
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
      title="Edit goal"
      submitLabel="Save"
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
          <Text style={styles.note}>
            Counted from {formatShortDate(goal.startDate)}, using saved check-ins for this goal’s current linked
            habits. Past days use each habit’s current schedule — earlier schedules aren’t recorded, so if you changed
            a schedule, past counts may differ from what was actually planned. Today stays provisional until the day
            ends.
          </Text>
        </View>
      }
      onCancel={closeGoalEditor}
      onSubmit={async (input) => {
        await updateGoal(goal.id, input); // throws on failure → form stays open
        closeGoalEditor();
      }}
      onDelete={async () => {
        const confirmed = await confirmDestructive({
          title: `Delete “${goal.title}”?`,
          message: 'Your habits and their check-in history are not affected. This can’t be undone.',
          confirmLabel: 'Delete',
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

const styles = StyleSheet.create({
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
