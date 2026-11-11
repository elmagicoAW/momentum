"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import { appLabel, appMessage, withErrorMessage } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { HabitForm } from '@/components/habits/habit-form';
import { Spacing } from '@/constants/theme';
import type { Habit, TrackingType } from '@/data/habit-storage';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useGoals } from '@/hooks/use-goals';
import { useHabits } from '@/hooks/use-habits';
import { useRoutines } from '@/hooks/use-routines';
import { confirmDestructive } from '@/utils/confirm';
import { hasAnyProgress } from '@/utils/habit-progress';
import { habitToDraft } from '@/utils/habit-validation';
import { closeHabitEditor } from '@/utils/navigation';
import { routinesContaining } from '@/utils/routine-progress';

const TYPE_LABEL: Record<TrackingType, string> = { get tick(){return appLabel("habits.detail.tick");}, get count(){return appLabel("habits.detail.count");}, get checklist(){return appLabel("habits.detail.checklist");} };

export default function EditHabitScreen() {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { habits, status, updateHabit, deleteHabit, reload } = useHabits();
  const { goals } = useGoals();
  const { routines } = useRoutines();
  const daily = useDailyProgress();
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
              title={appLabel("habits.detail.couldnTLoadYourHabits")}
              description={appLabel("habits.detail.yourSavedDataHasnTBeenChangedTryAgainOrRestartTheApp")}
              icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              actionLabel={appLabel("habits.detail.tryAgain")}
              onAction={reload}
            />
          ) : (
            <EmptyState
              title={appLabel("habits.detail.habitNotFound")}
              description={appLabel("habits.detail.itMayHaveBeenDeleted")}
              icon={{ ios: 'questionmark.circle.fill', android: 'help', web: 'help' }}
              actionLabel={appLabel("habits.detail.backToHabits")}
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
      title={appLabel("habits.detail.editHabit")}
      submitLabel={appLabel("habits.detail.save")}
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
            throw withErrorMessage(new Error("today's progress hasn't loaded yet, so the tracking type can't be changed right now"), { key: "habits.detail.todaySProgressHasnTLoadedYetSoTheTrackingTypeCanTBeChangedRightNow" });
          }
          if (hasAnyProgress(daily.record, habit.id)) {
            const confirmed = await confirmDestructive({
              get title(){return appLabel("habits.detail.resetTodaySProgress");},
              message:
                appMessage("habits.changeTracking.warning", { name: (habit.name), fromType: (TYPE_LABEL[from]), toType: (TYPE_LABEL[to]) }) +
                appLabel("habits.detail.earlierDaysYourHistoryAndLinkedGoalsAreKept"),
              get confirmLabel(){return appLabel("habits.detail.changeAndReset");},
            });
            if (!confirmed) return false; // form stays open, nothing saved
          }
        }
        await updateHabit(habit.id, input); // throws on failure → form stays open
        closeHabitEditor();
      }}
      onDelete={async () => {
        const linkedGoals = goals.filter((g) => g.habitIds.includes(habit.id)).length;
        const goalNote =
          linkedGoals > 0
            ? appMessage("habits.delete.goalNote", { count: linkedGoals })
            : '';
        // Routines keep the ID until they're next saved; it's ignored everywhere meanwhile.
        const inRoutines = routinesContaining(routines, habit.id).length;
        const routineNote =
          inRoutines > 0
            ? appMessage("habits.delete.routineNote", { count: inRoutines })
            : '';
        const confirmed = await confirmDestructive({
          title: appMessage("habits.delete.title", { name: (habit.name) }),
          message: appMessage("habits.delete.warning", { goalNote: (goalNote), routineNote: (routineNote) }),
          get confirmLabel(){return appLabel("habits.detail.delete");},
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
});
