import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { RoutineForm } from '@/components/routines/routine-form';
import { Palette, Spacing } from '@/constants/theme';
import type { Routine } from '@/data/routine-storage';
import { useRoutines } from '@/hooks/use-routines';
import { confirmDestructive } from '@/utils/confirm';
import { closeAfterRoutineDeleted, closeRoutineEditor } from '@/utils/navigation';

export default function EditRoutineScreen() {
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
              title="Couldn't load your routines"
              description="Your saved data hasn't been changed. Try again, or restart the app."
              icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              actionLabel="Try again"
              onAction={reload}
            />
          ) : (
            <EmptyState
              title="Routine not found"
              description="It may have been deleted."
              icon={{ ios: 'questionmark.circle.fill', android: 'help', web: 'help' }}
              actionLabel="Go back"
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
      title="Edit routine"
      submitLabel="Save"
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
          title: `Delete “${routine.title}”?`,
          message:
            'Only the routine is removed. Your habits, today’s progress, history, goals and insights are not affected.',
          confirmLabel: 'Delete',
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
