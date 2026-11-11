"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import { useArabicComposition } from '@/hooks/use-arabic-composition';
import {Text, NumericText} from '@/components/localized-native';
import { appLabel, appMessage, appNumber } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalCard } from '@/components/goals/goal-card';
import { goalStatusMeta } from '@/components/goals/status-picker';
import { EmptyState } from '@/components/habits/empty-state';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import type { Goal, GoalStatus } from '@/data/goal-storage';
import { useCompletionHistory } from '@/hooks/use-completion-history';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useGoals } from '@/hooks/use-goals';
import { useHabits } from '@/hooks/use-habits';
import { computeHabitConsistency } from '@/utils/goal-progress';

type Filter = 'all' | GoalStatus;
const FILTERS: Filter[] = ['all', 'active', 'paused', 'completed'];
const STATUS_ORDER: Record<GoalStatus, number> = { active: 0, paused: 1, completed: 2 };

/** Active by nearest target date, then paused, then completed (most recent first). */
function sortGoals(goals: readonly Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (a.status === 'completed') return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
    return a.targetDate.localeCompare(b.targetDate) || a.createdAt.localeCompare(b.createdAt);
  });
}

export default function GoalsScreen() {
  const arabic = useArabicComposition();
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const GOAL_STATUS_META = goalStatusMeta(Palette);
  const { goals, status, reload } = useGoals();
  const { habits, status: habitsStatus } = useHabits();
  const history = useCompletionHistory();
  const daily = useDailyProgress();
  const todayKey = daily.dateKey;
  // Today's live progress, so the provisional count matches the Today ring even mid-save.
  const todayRecord = daily.status === 'ready' ? daily.record : undefined;
  const [filter, setFilter] = useState<Filter>('all');
  const ready = status === 'ready';

  const openNew = () => router.push('/goals/new');
  const openEdit = (id: string) => router.push({ pathname: '/goals/[id]', params: { id } });

  const visible = sortGoals(filter === 'all' ? goals : goals.filter((g) => g.status === filter));
  const activeCount = goals.filter((g) => g.status === 'active').length;
  const historyLoading = history.status === 'loading' || habitsStatus === 'loading';
  const completionHistory = history.status === 'ready' && habitsStatus === 'ready' ? history.history : null;

  return (
    <View style={[styles.screen,arabic.active && arabic.surface]}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
        <View style={styles.headerWrap}>
          <View style={[styles.header,arabic.active && arabic.heading]}>
            <View style={[styles.headerText,arabic.active && arabic.textColumn]}>
              <Text style={[styles.title,arabic.active && arabic.title]} accessibilityRole="header">
                {appLabel("goals.index.goals")}</Text>
              {ready && goals.length > 0 && (
                <Text style={styles.subtitle}>{appMessage("goals.list.activeCount", { count: activeCount })}</Text>
              )}
            </View>
            <Pressable
              onPress={openNew}
              disabled={!ready}
              accessibilityRole="button"
              accessibilityLabel={appLabel("goals.index.newGoal")}
              accessibilityHint={appLabel("goals.index.opensTheFormToCreateANewGoal")}
              accessibilityState={{ disabled: !ready }}
              hitSlop={8}
              android_ripple={{ color: Palette.rippleOnAccent }}
              style={({ pressed }) => [styles.addButton, !ready && styles.addButtonDisabled, pressed && styles.pressed]}>
              <Text style={styles.addButtonText}>{appLabel("goals.index.addnewGoal")}</Text>
            </Pressable>
          </View>

          {ready && goals.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filters,arabic.active && arabic.filters]}>
              {FILTERS.map((f) => {
                const selected = f === filter;
                const count = f === 'all' ? goals.length : goals.filter((g) => g.status === f).length;
                const label = f === 'all' ? appLabel("goals.index.all") : GOAL_STATUS_META[f].label;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={appMessage("display.labelValue", { label: String(label), textValue: appNumber(count) })}
                    style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
                    {arabic.active ? <View style={[arabic.row,{gap:6}]}><Text style={[styles.chipText,selected && styles.chipTextSelected]}>{label}</Text><NumericText style={styles.chipCount}>{appNumber(count)}</NumericText></View> : <Text style={[styles.chipText,selected && styles.chipTextSelected]}>{label} <Text style={styles.chipCount}>{appNumber(count)}</Text></Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {status === 'loading' && (
            <View style={styles.centered}>
              <ActivityIndicator color={Palette.accent} />
            </View>
          )}

          {status === 'load-error' && (
            <EmptyState
              title={appLabel("goals.index.couldnTLoadYourGoals")}
              description={appLabel("goals.index.yourSavedDataHasnTBeenChangedTryAgainOrRestartTheApp")}
              icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              actionLabel={appLabel("goals.index.tryAgain")}
              onAction={reload}
            />
          )}

          {ready && goals.length === 0 && (
            <EmptyState
              title={appLabel("goals.index.setYourFirstGoal")}
              description={appLabel("goals.index.chooseSomethingYouReWorkingTowardGiveItATargetDateAndLinkTheDailyHabitsThatMoveYouCloser")}
              icon={{ ios: 'flag.fill', android: 'flag', web: 'flag' }}
              actionLabel={appLabel("goals.index.createAGoal")}
              onAction={openNew}
            />
          )}

          {ready && goals.length > 0 && visible.length === 0 && (
            <Text style={styles.filterEmpty}>{appMessage("goals.list.emptyFilter", { status: GOAL_STATUS_META[filter as GoalStatus].label.toLowerCase() })}</Text>
          )}

          {ready && visible.length > 0 && (
            <>
              {history.status === 'error' && (
                <View style={styles.notice} accessibilityRole="alert">
                  <Text style={styles.noticeText}>
                    {appLabel("goals.index.couldnTReadYourSavedCheckInsSoHabitConsistencyIsUnavailableNothingWasChangedLeaveAndReturnToThisTabToTryAgain")}</Text>
                </View>
              )}
              <View style={styles.list}>
                {visible.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    todayKey={todayKey}
                    consistency={
                      completionHistory
                        ? computeHabitConsistency(goal, habits, completionHistory, todayKey, todayRecord)
                        : null
                    }
                    historyLoading={historyLoading}
                    onPress={openEdit}
                  />
                ))}
              </View>
              <Text style={styles.footnote}>
                {appLabel("goals.index.habitConsistencyIsTheShareOfScheduledCheckInsForAGoalSLinkedHabitsThatYouCompletedOnPastDaysTodayIsShownSeparatelyUntilItEndsItDoesnTMeasureHowMuchOfAGoalIsAchievedYouMarkThatWithTheGoalSStatus")}</Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
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
  headerWrap: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: 20,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: Palette.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: Palette.textSecondary,
    fontSize: 14,
  },
  addButton: {
    minHeight: 48,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: Palette.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: Palette.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  filters: {
    gap: 8,
    paddingHorizontal: 20,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: Palette.accent,
    backgroundColor: Palette.accentSoft,
  },
  chipText: {
    color: Palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: Palette.text,
  },
  chipCount: {
    color: Palette.textMuted,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: Spacing.one,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  centered: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  list: {
    gap: 12,
  },
  filterEmpty: {
    color: Palette.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
  notice: {
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Palette.dangerSoft,
    borderWidth: 1,
    borderColor: Palette.dangerBorder,
  },
  noticeText: {
    color: Palette.text,
    fontSize: 13,
    lineHeight: 18,
  },
  footnote: {
    color: Palette.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
  },
});
