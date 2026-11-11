"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {SymbolView, Text} from '@/components/localized-native';
import { appLabel, appMessage, appRich } from '@/i18n/app-copy';
import { LocalizedInline } from '@/components/localized-inline';
import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useLocalSearchParams } from 'expo-router';

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { RoutineIcon, TimeChip } from '@/components/routines/routine-badges';
import { HabitCard } from '@/components/today/habit-card';
import { ProgressNotices, saveLabel } from '@/components/today/progress-notices';
import { ProgressRing } from '@/components/today/progress-ring';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { habitIconSymbol } from '@/data/habit-options';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useHabits } from '@/hooks/use-habits';
import { useRoutines } from '@/hooks/use-routines';
import { parseLocalDateKey } from '@/utils/date';
import { closeRoutine, openRoutineEditor } from '@/utils/navigation';
import { indexHabits, routineDay, TIME_OF_DAY_HINTS, type RoutineDay } from '@/utils/routine-progress';
import { describeSchedule, WEEKDAY_LONG } from '@/utils/schedule';

function progressMessage(day: RoutineDay, weekday: string): string {
  switch (day.state) {
    case 'empty':
      return appLabel("routine.detail.addHabitsToStartThisRoutine");
    case 'rest':
      return appMessage("routines.rest.weekday", { weekday: (weekday) });
    case 'complete':
      return appLabel("routine.detail.routineCompleteNicelyDone");
    case 'partial':
      return appMessage("routines.progress.remaining", { count: (day.total - day.done) });
    default:
      return appLabel("routine.detail.readyWhenYouAre");
  }
}

/**
 * Routine detail — live tracking for today.
 *
 * Tracking goes ONLY through `useDailyProgress()` (the single progress writer)
 * via the same `HabitCard` as Today, so a tap here is the same tap as on Today:
 * Today, Goals and Insights see it immediately and count the habit once, no
 * matter how many routines contain it.
 */
export default function RoutineDetailScreen() {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routines, status: routinesStatus, reload: reloadRoutines } = useRoutines();
  const { habits, status: habitsStatus, reload: reloadHabits } = useHabits();
  const daily = useDailyProgress();
  const [showNotDue, setShowNotDue] = useState(false);

  const routine = routines.find((r) => r.id === id);
  // The provider's date decides "today", so cards and saves always agree (also across midnight).
  const today = parseLocalDateKey(daily.dateKey);

  const blocking =
    routinesStatus === 'loading' || habitsStatus === 'loading' ? (
      <ActivityIndicator color={Palette.accent} />
    ) : routinesStatus === 'load-error' ? (
      <EmptyState
        title={appLabel("routine.detail.couldnTLoadYourRoutines")}
        description={appLabel("routine.detail.yourSavedDataHasnTBeenChangedTryAgainOrRestartTheApp")}
        icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
        actionLabel={appLabel("routine.detail.tryAgain")}
        onAction={reloadRoutines}
      />
    ) : habitsStatus === 'load-error' ? (
      <EmptyState
        title={appLabel("routine.detail.couldnTLoadYourHabits")}
        description={appLabel("routine.detail.yourSavedDataHasnTBeenChangedTryAgainOrRestartTheApp")}
        icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
        actionLabel={appLabel("routine.detail.tryAgain")}
        onAction={reloadHabits}
      />
    ) : !routine ? (
      <EmptyState
        title={appLabel("routine.detail.thisRoutineNoLongerExists")}
        description={appLabel("routine.detail.itMayHaveBeenDeletedYourHabitsAndProgressAreNotAffected")}
        icon={{ ios: 'questionmark.circle.fill', android: 'help', web: 'help' }}
        actionLabel={appLabel("routine.detail.goBack")}
        onAction={closeRoutine}
      />
    ) : null;

  if (blocking || !routine) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.flex}>
          <Header onBack={closeRoutine} />
          <View style={styles.message}>{blocking}</View>
        </SafeAreaView>
      </View>
    );
  }

  const day = routineDay(routine, indexHabits(habits), today, daily.record);
  const weekday = WEEKDAY_LONG[today.getDay()];
  const savingText = saveLabel(daily.saveState);
  const notDueOpen = showNotDue || day.state === 'rest';

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.flex}>
        <Header onBack={closeRoutine} onEdit={() => openRoutineEditor(routine.id)} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <View style={styles.titleBlock}>
            <RoutineIcon routine={routine} size={52} />
            <View style={styles.titleText}>
              <Text style={styles.title} accessibilityRole="header">
                {routine.title}
              </Text>
              <View style={styles.metaRow}>
                <TimeChip timeOfDay={routine.timeOfDay} />
                {routine.timeOfDay !== 'anytime' && (
                  <Text style={styles.metaText}>{TIME_OF_DAY_HINTS[routine.timeOfDay]}</Text>
                )}
              </View>
            </View>
          </View>
          {routine.description ? <Text style={styles.description}>{routine.description}</Text> : null}

          {/* Progress */}
          {day.state !== 'empty' && (
            <View style={[styles.progressCard, day.state === 'complete' && styles.progressCardDone]}>
              <ProgressRing completed={day.done} total={day.total} size={120} strokeWidth={10} />
              <View style={styles.progressText}>
                <Text style={styles.cardLabel}>{appLabel("routine.detail.today")}</Text>
                <Text style={styles.progressTitle}>
                  {day.total === 0 ? appLabel("routine.detail.nothingDue") : appMessage("routines.progress.habits", { done: (day.done), total: (day.total) })}
                </Text>
                <Text style={styles.progressSubtitle}>{progressMessage(day, weekday)}</Text>
              </View>
            </View>
          )}

          {day.missingCount > 0 && (
            <View style={styles.infoNote}>
              <Text style={styles.infoText}>
                {appMessage("routines.deletedHabits.notice", { count: day.missingCount })}</Text>
            </View>
          )}

          {day.state === 'empty' && (
            <EmptyState
              title={appLabel("routine.detail.noHabitsInThisRoutine")}
              description={appLabel("routine.detail.addHabitsYouAlreadyTrackTheyStayTheSameHabitsTheRoutineJustGroupsThem")}
              actionLabel={appLabel("routine.detail.addHabits")}
              onAction={() => openRoutineEditor(routine.id)}
            />
          )}

          {/* Due today — tracked through the shared daily progress */}
          {day.total > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{appLabel("routine.detail.dueToday")}</Text>
                <Text style={styles.sectionMeta} accessibilityLiveRegion="polite"><LocalizedInline message={appRich('routines.remaining.withSave', { remaining: appMessage("routines.remaining.short", { count: day.total - day.done }), saving: savingText ? ' · ' + savingText : '' }, 'saving')} slotStyle={styles.saveMeta} /></Text>
              </View>
              <View style={styles.list}>
                {day.due.map((habit) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    record={daily.record}
                    disabled={!daily.canEdit}
                    onToggleTick={daily.toggleTick}
                    onAdjustCount={daily.adjustCount}
                    onToggleStep={daily.toggleStep}
                  />
                ))}
              </View>
            </>
          )}

          <ProgressNotices
            loadError={day.total > 0 && daily.status === 'load-error'}
            saveError={daily.saveState === 'error'}
            onReload={daily.reloadDay}
            onRetry={daily.retrySave}
          />

          {/* Not due today — shown for context, never trackable */}
          {day.notDue.length > 0 && (
            <View style={styles.notDueCard}>
              <Pressable
                onPress={() => setShowNotDue((v) => !v)}
                disabled={day.state === 'rest'}
                accessibilityRole="button"
                accessibilityState={{ expanded: notDueOpen }}
                style={({ pressed }) => [styles.notDueHeader, pressed && styles.pressed]}>
                <Text style={styles.notDueTitle}>{appMessage("routines.rest.notDue", { total: day.notDue.length })}</Text>
                {day.state !== 'rest' && (
                  <SymbolView
                    name={
                      notDueOpen
                        ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
                        : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
                    }
                    size={20}
                    tintColor={Palette.textMuted}
                  />
                )}
              </Pressable>
              {notDueOpen && (
                <View style={styles.notDueList}>
                  <Text style={styles.notDueHint}>{appMessage("routines.rest.explanation", { weekday })}</Text>
                  {day.notDue.map((habit) => (
                    <View
                      key={habit.id}
                      style={styles.notDueRow}
                      accessible
                      accessibilityLabel={appMessage("routines.habit.notScheduled", { name: (habit.name), schedule: (describeSchedule(habit.schedule)) })}>
                      <View style={[styles.notDueIcon, { backgroundColor: `${habit.color}18` }]}>
                        <SymbolView name={habitIconSymbol(habit.icon)} size={18} tintColor={readableAccent(habit.color, Palette)} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.notDueName} numberOfLines={1}>
                          {habit.name}
                        </Text>
                        <Text style={styles.notDueSchedule} numberOfLines={1}>
                          {describeSchedule(habit.schedule)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Header({ onBack, onEdit }: { onBack: () => void; onEdit?: () => void }) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={appLabel("routine.detail.back")}
        hitSlop={8}
        style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
        <SymbolView
          name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
          size={20}
          tintColor={Palette.textSecondary}
        />
      </Pressable>
      <View style={styles.flex} />
      {onEdit && (
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={appLabel("routine.detail.editRoutine")}
          android_ripple={{ color: Palette.rippleMedium }}
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
          <Text style={styles.editText}>{appLabel("routine.detail.edit")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: Spacing.three,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  editText: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
  message: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  titleText: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: Palette.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: Palette.textMuted,
    fontSize: 13,
  },
  description: {
    marginTop: -Spacing.two,
    color: Palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    padding: 20,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  progressCardDone: {
    borderColor: Palette.accentBorder,
  },
  progressText: {
    flex: 1,
    gap: 6,
  },
  cardLabel: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  progressTitle: {
    color: Palette.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  progressSubtitle: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  infoNote: {
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Palette.accentBlueSoft,
    borderWidth: 1,
    borderColor: Palette.blueBorder,
  },
  infoText: {
    color: Palette.text,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: -Spacing.two,
  },
  sectionTitle: {
    color: Palette.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionMeta: {
    color: Palette.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  saveMeta: {
    color: Palette.textMuted,
    fontWeight: '500',
  },
  list: {
    gap: 12,
  },
  notDueCard: {
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  notDueHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  notDueTitle: {
    color: Palette.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  notDueList: {
    gap: 10,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  notDueHint: {
    color: Palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  notDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    opacity: 0.7,
  },
  notDueIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notDueName: {
    color: Palette.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  notDueSchedule: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
