import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { HabitForm } from '@/components/habits/habit-form';
import { Palette, Spacing } from '@/constants/theme';
import type { Habit } from '@/data/habit-storage';
import { useGoals } from '@/hooks/use-goals';
import { useHabits } from '@/hooks/use-habits';
import { confirmDestructive } from '@/utils/confirm';
import { closeHabitEditor } from '@/utils/navigation';

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { habits, status, updateHabit, deleteHabit, reload } = useHabits();
  const { goals } = useGoals();
  // While a delete is in flight (and after it succeeds, until the screen closes),
  // keep showing the habit so the form stays mounted and can show errors.
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const habit = habits.find((h) => h.id === id) ?? (deleting?.id === id ? deleting : undefined);

  if (status !== 'ready' || !habit) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.message}>
          {status === 'loading' ? (
            <ActivityIndicator color={Palette.accent} />
          ) : status === 'load-error' ? (
            <EmptyState
              title="Couldn't load your habits"
              description="Your saved data hasn't been changed. Try again, or restart the app."
              icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              actionLabel="Try again"
              onAction={reload}
            />
          ) : (
            <EmptyState
              title="Habit not found"
              description="It may have been deleted."
              icon={{ ios: 'questionmark.circle.fill', android: 'help', web: 'help' }}
              actionLabel="Back to habits"
              onAction={closeHabitEditor}
            />
          )}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <HabitForm
      key={habit.id}
      title="Edit habit"
      submitLabel="Save"
      initialDraft={{
        name: habit.name,
        description: habit.description ?? '',
        icon: habit.icon,
        color: habit.color,
        scheduleKind: habit.schedule.kind,
        days: habit.schedule.kind === 'weekdays' ? habit.schedule.days : [1, 2, 3, 4, 5],
      }}
      onCancel={closeHabitEditor}
      onSubmit={async (input) => {
        await updateHabit(habit.id, input); // throws on failure → form stays open
        closeHabitEditor();
      }}
      onDelete={async () => {
        const linkedGoals = goals.filter((g) => g.habitIds.includes(habit.id)).length;
        const goalNote =
          linkedGoals > 0
            ? ` It’s linked to ${linkedGoals === 1 ? '1 goal' : `${linkedGoals} goals`} and will be unlinked; the goals themselves are kept.`
            : '';
        const confirmed = await confirmDestructive({
          title: `Delete “${habit.name}”?`,
          message: `It will be removed from your habits and from Today.${goalNote} This can’t be undone.`,
          confirmLabel: 'Delete',
        });
        if (!confirmed) return false;
        setDeleting(habit);
        try {
          await deleteHabit(habit.id);
        } catch (error) {
          setDeleting(null);
          throw error; // form stays open and shows the error
        }
        closeHabitEditor();
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
});
