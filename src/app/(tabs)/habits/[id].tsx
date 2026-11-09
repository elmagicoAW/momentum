import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { HabitForm } from '@/components/habits/habit-form';
import { HabitReminderSection, reportReminderOutcome } from '@/components/reminders/editor-reminders';
import { Palette, Spacing } from '@/constants/theme';
import type { Habit, TrackingType } from '@/data/habit-storage';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useGoals } from '@/hooks/use-goals';
import { useHabits } from '@/hooks/use-habits';
import { useReminderDraft } from '@/hooks/use-reminder-draft';
import { useRoutines } from '@/hooks/use-routines';
import { confirmDestructive } from '@/utils/confirm';
import { hasAnyProgress } from '@/utils/habit-progress';
import { habitToDraft } from '@/utils/habit-validation';
import { closeHabitEditor } from '@/utils/navigation';
import { DEFAULT_HABIT_REMINDER_TIME } from '@/utils/reminder-time';
import { routinesContaining } from '@/utils/routine-progress';

const TYPE_LABEL: Record<TrackingType, string> = { tick: 'Tick', count: 'Count', checklist: 'Checklist' };

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { habits, status, updateHabit, deleteHabit, reload } = useHabits();
  const { goals } = useGoals();
  const { routines } = useRoutines();
  const daily = useDailyProgress();
  const reminder = useReminderDraft('habit', typeof id === 'string' ? id : null);
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
      initialDraft={habitToDraft(habit)}
      onCancel={closeHabitEditor}
      onSubmit={async (input) => {
        const from = habit.tracking.type;
        const to = input.tracking.type;
        if (from !== to) {
          // Changing type resets TODAY's progress for this habit (past days keep
          // their own records). Only allowed once today's progress has loaded, so
          // the reset can actually be saved and we know whether to ask.
          if (daily.status !== 'ready') {
            throw new Error("today's progress hasn't loaded yet, so the tracking type can't be changed right now");
          }
          if (hasAnyProgress(daily.record, habit.id)) {
            const confirmed = await confirmDestructive({
              title: 'Reset today’s progress?',
              message:
                `Changing “${habit.name}” from ${TYPE_LABEL[from]} to ${TYPE_LABEL[to]} resets today’s progress for this habit. ` +
                'Earlier days, your history and linked goals are kept.',
              confirmLabel: 'Change and reset',
            });
            if (!confirmed) return false; // form stays open, nothing saved
          }
        }
        await updateHabit(habit.id, input); // throws on failure → form stays open
        // The habit is saved from here on; a reminder failure is reported, not thrown.
        const outcome = await reminder.saveFor(habit.id);
        closeHabitEditor();
        reportReminderOutcome('habit', outcome);
      }}
      renderReminder={(draft, locked) => (
        <HabitReminderSection
          habitId={habit.id}
          draft={draft}
          value={reminder.valueFor(DEFAULT_HABIT_REMINDER_TIME)}
          onChange={reminder.setDraft}
          locked={locked}
        />
      )}
      onDelete={async () => {
        const linkedGoals = goals.filter((g) => g.habitIds.includes(habit.id)).length;
        const goalNote =
          linkedGoals > 0
            ? ` It’s linked to ${linkedGoals === 1 ? '1 goal' : `${linkedGoals} goals`} and will be unlinked; the goals themselves are kept.`
            : '';
        // Routines keep the ID until they're next saved; it's ignored everywhere meanwhile.
        const inRoutines = routinesContaining(routines, habit.id).length;
        const routineNote =
          inRoutines > 0
            ? ` It’s in ${inRoutines === 1 ? '1 routine' : `${inRoutines} routines`} and will be removed from ${inRoutines === 1 ? 'it' : 'them'}; the routines themselves are kept.`
            : '';
        const confirmed = await confirmDestructive({
          title: `Delete “${habit.name}”?`,
          message: `It will be removed from your habits and from Today.${goalNote}${routineNote} This can’t be undone.`,
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
