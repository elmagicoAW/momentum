import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { RoutineCard } from '@/components/routines/routine-card';
import { BottomTabInset, MaxContentWidth, Palette, Radius, Spacing } from '@/constants/theme';
import { MAX_ROUTINES } from '@/data/routine-storage';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useHabits } from '@/hooks/use-habits';
import { useRoutines } from '@/hooks/use-routines';
import { parseLocalDateKey } from '@/utils/date';
import { closeRoutineList, openNewRoutine, openRoutine } from '@/utils/navigation';
import { indexHabits, routineDay } from '@/utils/routine-progress';

/** Habits › Routines: the user's routines in their order, with reordering. */
export default function RoutinesScreen() {
  const { routines, status, reload, moveRoutine } = useRoutines();
  const { habits, status: habitsStatus } = useHabits();
  const daily = useDailyProgress();
  const [reordering, setReordering] = useState(false);
  const [moving, setMoving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const ready = status === 'ready';
  const atLimit = routines.length >= MAX_ROUTINES;
  const today = parseLocalDateKey(daily.dateKey);
  const byId = indexHabits(habits);
  // Until habits load, every routine would look empty — show progress only once they're ready.
  const habitsReady = habitsStatus === 'ready';

  const move = async (id: string, delta: -1 | 1) => {
    if (moving) return;
    setMoving(true);
    setFailure(null);
    try {
      await moveRoutine(id, delta); // saved before the list re-orders
    } catch (error) {
      console.warn('[momentum] Failed to reorder routines', error);
      setFailure('Couldn’t save the new order. Your routines are unchanged — try again.');
    } finally {
      setMoving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
        <View style={styles.headerWrap}>
          <View style={styles.header}>
            <Pressable
              onPress={closeRoutineList}
              accessibilityRole="button"
              accessibilityLabel="Back to habits"
              hitSlop={8}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                size={20}
                tintColor={Palette.textSecondary}
              />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.title} accessibilityRole="header">
                Routines
              </Text>
            </View>
            {ready && routines.length > 1 && (
              <Pressable
                onPress={() => setReordering((r) => !r)}
                disabled={moving}
                accessibilityRole="button"
                accessibilityState={{ selected: reordering }}
                accessibilityLabel={reordering ? 'Done reordering' : 'Reorder routines'}
                android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
                style={({ pressed }) => [styles.secondaryButton, reordering && styles.secondaryActive, pressed && styles.pressed]}>
                <Text style={[styles.secondaryText, reordering && styles.secondaryActiveText]}>
                  {reordering ? 'Done' : 'Reorder'}
                </Text>
              </Pressable>
            )}
            {!reordering && (
              <Pressable
                onPress={openNewRoutine}
                disabled={!ready || atLimit}
                accessibilityRole="button"
                accessibilityLabel="New routine"
                accessibilityState={{ disabled: !ready || atLimit }}
                hitSlop={4}
                android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
                style={({ pressed }) => [
                  styles.addButton,
                  (!ready || atLimit) && styles.addDisabled,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.addText}>+ New</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.subtitle}>
            Group habits you already track. Progress stays with each habit, so nothing is counted twice.
          </Text>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {failure && (
            <View style={styles.failure} accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Text style={styles.failureText}>{failure}</Text>
            </View>
          )}

          {(status === 'loading' || (ready && routines.length > 0 && habitsStatus === 'loading')) && (
            <View style={styles.centered}>
              <ActivityIndicator color={Palette.accent} />
            </View>
          )}

          {status === 'load-error' && (
            <EmptyState
              title="Couldn't load your routines"
              description="Your saved data hasn't been changed. Try again, or restart the app."
              icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              actionLabel="Try again"
              onAction={reload}
            />
          )}

          {ready && routines.length === 0 && (
            <EmptyState
              title="Build your first routine"
              description="Group habits into a Morning or Evening Routine and work through them in order. Your habits and their history stay exactly as they are."
              icon={{ ios: 'list.bullet.rectangle.fill', android: 'view_list', web: 'view_list' }}
              actionLabel="Create a routine"
              onAction={openNewRoutine}
            />
          )}

          {ready && habitsReady && routines.length > 0 && (
            <View style={styles.list}>
              {routines.map((routine, index) => (
                <RoutineCard
                  key={routine.id}
                  day={routineDay(routine, byId, today, daily.record)}
                  onPress={openRoutine}
                  reorder={
                    reordering
                      ? { canUp: index > 0, canDown: index < routines.length - 1, disabled: moving, onMove: move }
                      : undefined
                  }
                />
              ))}
            </View>
          )}

          {ready && habitsStatus === 'load-error' && routines.length > 0 && (
            <Text style={styles.note}>Couldn’t load your habits, so routine progress can’t be shown right now.</Text>
          )}

          {ready && atLimit && (
            <Text style={styles.note}>You’ve reached {MAX_ROUTINES} routines. Delete one to add another.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  flex: {
    flex: 1,
  },
  headerWrap: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: Palette.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  secondaryActive: {
    backgroundColor: Palette.accentSoft,
    borderColor: Palette.accent,
  },
  secondaryText: {
    color: Palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActiveText: {
    color: Palette.accent,
  },
  addButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  addDisabled: {
    opacity: 0.5,
  },
  addText: {
    color: Palette.background,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: Spacing.one,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  centered: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  list: {
    gap: 12,
  },
  note: {
    color: Palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  failure: {
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Palette.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  failureText: {
    color: Palette.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
