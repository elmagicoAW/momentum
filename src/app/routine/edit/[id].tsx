"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import { appLabel, appMessage } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { RoutineForm } from '@/components/routines/routine-form';
import { Spacing } from '@/constants/theme';
import type { Routine } from '@/data/routine-storage';
import { useRoutines } from '@/hooks/use-routines';
import { confirmDestructive } from '@/utils/confirm';
import { closeAfterRoutineDeleted, closeRoutineEditor } from '@/utils/navigation';

export default function EditRoutineScreen() {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, status, updateRoutine, deleteRoutine, reload } = useRoutines();
  // Keep showing the routine while a delete is in flight so the form can show errors.
  const [deleting, setDeleting] = useState<Routine | null>(null);
  const routine = routines.find((r) => r.id === id) ?? (deleting?.id === id ? deleting : undefined);

  if (status !== 'ready' || !routine) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.message}>
          {status === 'loading' ? (
            <ActivityIndicator color={Palette.accent} />
          ) : status === 'load-error' ? (
            <EmptyState
              title={appLabel("routine.edit.detail.couldnTLoadYourRoutines")}
              description={appLabel("routine.edit.detail.yourSavedDataHasnTBeenChangedTryAgainOrRestartTheApp")}
              icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              actionLabel={appLabel("routine.edit.detail.tryAgain")}
              onAction={reload}
            />
          ) : (
            <EmptyState
              title={appLabel("routine.edit.detail.routineNotFound")}
              description={appLabel("routine.edit.detail.itMayHaveBeenDeleted")}
              icon={{ ios: 'questionmark.circle.fill', android: 'help', web: 'help' }}
              actionLabel={appLabel("routine.edit.detail.goBack")}
              onAction={closeRoutineEditor}
            />
          )}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <RoutineForm
      key={routine.id}
      title={appLabel("routine.edit.detail.editRoutine")}
      submitLabel={appLabel("routine.edit.detail.save")}
      initialDraft={{
        title: routine.title,
        description: routine.description ?? '',
        icon: routine.icon,
        color: routine.color,
        timeOfDay: routine.timeOfDay,
        habitIds: routine.habitIds,
      }}
      onCancel={closeRoutineEditor}
      onSubmit={async (input) => {
        await updateRoutine(routine.id, input); // throws on failure → form stays open
        closeRoutineEditor();
      }}
      onDelete={async () => {
        const confirmed = await confirmDestructive({
          title: appMessage("routines.delete.title", { name: (routine.title) }),
          get message(){return appLabel("routine.edit.detail.onlyTheRoutineIsRemovedYourHabitsTodaySProgressHistoryGoalsAndInsightsAreNotAffected");},
          get confirmLabel(){return appLabel("routine.edit.detail.delete");},
        });
        if (!confirmed) return false;
        setDeleting(routine);
        try {
          await deleteRoutine(routine.id);
        } catch (error) {
          setDeleting(null);
          throw error; // form stays open and shows the error
        }
        closeAfterRoutineDeleted();
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
