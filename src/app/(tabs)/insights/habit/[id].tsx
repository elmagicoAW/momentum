"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {SymbolView, Text} from '@/components/localized-native';
import { appLabel, appMessage } from '@/i18n/app-copy';
import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useLocalSearchParams } from 'expo-router';

import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { DataNotesCard } from '@/components/insights/data-notes';
import { formatRate, withAlpha } from '@/components/insights/format';
import { HeatmapCalendar } from '@/components/insights/heatmap-calendar';
import { StatTile } from '@/components/insights/stat-tile';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { habitIconSymbol } from '@/data/habit-options';
import { useInsights } from '@/hooks/use-insights';
import { formatShortDate } from '@/i18n/presentation-date';
import { describeTracking } from '@/utils/habit-progress';
import { findHabit, summarizeHabit, type DataNotes } from '@/utils/insights';
import { closeHabitHistory, openHabitEditor } from '@/utils/navigation';
import { describeSchedule } from '@/utils/schedule';

/** Read-only history of one habit. */
export default function HabitHistoryScreen() {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, index, retry } = useInsights();
  const habitIndex = index ? findHabit(index, id) : undefined;
  const summary = useMemo(() => (index && habitIndex ? summarizeHabit(index, habitIndex) : null), [index, habitIndex]);

  let body: ReactNode;
  if (status === 'loading' && !index) {
    body = <ActivityIndicator color={Palette.accent} style={styles.spinner} />;
  } else if (status === 'habits-error' || status === 'history-error') {
    body = (
      <EmptyState
        title={appLabel("insights.habit.detail.couldnTLoadThisHistory")}
        description={appLabel("insights.habit.detail.yourSavedDataHasnTBeenChangedTryAgainOrRestartTheApp")}
        icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
        actionLabel={appLabel("insights.habit.detail.tryAgain")}
        onAction={retry}
      />
    );
  } else if (!index || !habitIndex || !summary) {
    body = (
      <EmptyState
        title={appLabel("insights.habit.detail.habitNotFound")}
        description={appLabel("insights.habit.detail.itMayHaveBeenDeletedItsSavedCheckInsAreKept")}
        icon={{ ios: 'questionmark.circle.fill', android: 'help', web: 'help' }}
        actionLabel={appLabel("insights.habit.detail.backToInsights")}
        onAction={closeHabitHistory}
      />
    );
  } else {
    const { habit, current, longest, allTime, thisMonth } = summary;
    const notes: DataNotes = {
      unreadableDays: habitIndex.unknownDays,
      ignoredRecordDays: 0,
      deletedHabitsWithHistory: 0,
      scheduleChangeHabits: summary.possibleScheduleChange ? [habit] : [],
      startFromEntriesHabits: summary.startFromEntries ? [habit] : [],
      todayKnown: index.todayKnown,
      incomplete: habitIndex.unknownDays > 0 || !index.todayKnown,
    };
    const currentCaption = current.todayDone
      ? appLabel("insights.habit.detail.includesToday")
      : current.todayPending
        ? current.length > 0
          ? appLabel("insights.habit.detail.keepItGoingToday")
          : appLabel("insights.habit.detail.startOneToday")
        : appLabel("insights.habit.detail.scheduledCheckIns");

    body = (
      <>
        <View style={styles.hero}>
          <View style={[styles.iconWrap, { backgroundColor: withAlpha(habit.color, 0.14, Palette.accent) }]}>
            <SymbolView name={habitIconSymbol(habit.icon)} size={28} tintColor={readableAccent(habit.color, Palette)} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
              {habit.name}
            </Text>
            <Text style={styles.meta}>
              {describeSchedule(habit.schedule)} · {describeTracking(habit.tracking)}
            </Text>
            <Text style={styles.metaMuted}>{appMessage("history.habit.start", { date: formatShortDate(summary.startKey) })}</Text>
          </View>
        </View>

        <View style={styles.tiles}>
          <StatTile
            label={appLabel("insights.habit.detail.currentStreak")}
            value={appMessage("display.uncertainCount", { count: current.length, uncertainty: String(current.uncertain ? '+' : '') })}
            caption={currentCaption}
            color={habit.color}
            badge={current.uncertain ? appLabel("insights.habit.detail.mayBeLonger") : current.todayDone ? appLabel("insights.habit.detail.provisional") : undefined}
          />
          <StatTile
            label={appLabel("insights.habit.detail.bestStreak")}
            value={appMessage("display.uncertainCount", { count: longest.length, uncertainty: String(longest.uncertain ? '+' : '') })}
            caption={
              !longest.endKey
                ? appLabel("insights.habit.detail.noStreakYet")
                : longest.ongoing
                  ? longest.includesToday
                    ? appLabel("insights.habit.detail.currentRunIncludesToday")
                    : appLabel("insights.habit.detail.currentRun")
                  : appMessage("history.streak.ended", { date: (formatShortDate(longest.endKey)) })
            }
            badge={longest.uncertain ? appLabel("insights.habit.detail.mayBeLonger") : longest.includesToday ? appLabel("insights.habit.detail.provisional") : undefined}
          />
          <StatTile
            label={appLabel("insights.habit.detail.allTime")}
            value={formatRate(allTime.rate)}
            caption={
              allTime.finished > 0
                ? appMessage("history.allTime.finished", { done: allTime.done, count: allTime.finished })
                : appLabel("insights.habit.detail.noFinishedDaysYetTodayCountsOnceItSOver")
            }
          />
          <StatTile
            label={appLabel("insights.habit.detail.thisMonth")}
            value={formatRate(thisMonth.rate)}
            caption={thisMonth.finished > 0 ? appMessage("history.month.finished", { done: (thisMonth.done), total: (thisMonth.finished) }) : appLabel("insights.habit.detail.noFinishedDaysYet")}
          />
        </View>
        {allTime.partial > 0 && (
          <Text style={styles.footnote}>{appMessage("history.partial.days", { count: allTime.partial })}</Text>
        )}

        <View style={styles.card}>
          <HeatmapCalendar index={index} habitId={habit.id} color={habit.color} />
        </View>

        <DataNotesCard notes={notes} habitName={habit.name} />

        <Pressable
          onPress={() => openHabitEditor(habit.id)}
          accessibilityRole="button"
          android_ripple={{ color: Palette.rippleSubtle }}
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
          <Text style={styles.editText}>{appLabel("insights.habit.detail.editHabit")}</Text>
        </Pressable>
      </>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
        <View style={styles.topBar}>
          <Pressable
            onPress={closeHabitHistory}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={appLabel("insights.habit.detail.back")}
            android_ripple={{ color: Palette.rippleSubtle, borderless: true }}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={20}
              tintColor={Palette.text}
            />
          </Pressable>
          <Text style={styles.topTitle}>{appLabel("insights.habit.detail.habitHistory")}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {body}
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
  topBar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: Spacing.two,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: Palette.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  spinner: {
    marginTop: Spacing.six,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: Palette.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  meta: {
    color: Palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  metaMuted: {
    color: Palette.textMuted,
    fontSize: 12,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  footnote: {
    color: Palette.textMuted,
    fontSize: 12,
    marginTop: -4,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  editButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.controlBorder,
    overflow: 'hidden',
  },
  editText: {
    color: Palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});
