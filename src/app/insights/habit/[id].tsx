import { useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { DataNotesCard } from '@/components/insights/data-notes';
import { formatRate, plural, withAlpha } from '@/components/insights/format';
import { HeatmapCalendar } from '@/components/insights/heatmap-calendar';
import { StatTile } from '@/components/insights/stat-tile';
import { MaxContentWidth, Palette, Radius, Spacing } from '@/constants/theme';
import { habitIconSymbol } from '@/data/habit-options';
import { useInsights } from '@/hooks/use-insights';
import { formatShortDate } from '@/utils/date';
import { describeTracking } from '@/utils/habit-progress';
import { findHabit, summarizeHabit, type DataNotes } from '@/utils/insights';
import { closeHabitHistory, openHabitEditor } from '@/utils/navigation';
import { describeSchedule } from '@/utils/schedule';

/** Read-only history of one habit. */
export default function HabitHistoryScreen() {
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
        title="Couldn’t load this history"
        description="Your saved data hasn’t been changed. Try again, or restart the app."
        icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
        actionLabel="Try again"
        onAction={retry}
      />
    );
  } else if (!index || !habitIndex || !summary) {
    body = (
      <EmptyState
        title="Habit not found"
        description="It may have been deleted. Its saved check-ins are kept."
        icon={{ ios: 'questionmark.circle.fill', android: 'help', web: 'help' }}
        actionLabel="Back to Insights"
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
      ? 'Includes today'
      : current.todayPending
        ? current.length > 0
          ? 'Keep it going today'
          : 'Start one today'
        : 'Scheduled check-ins';

    body = (
      <>
        <View style={styles.hero}>
          <View style={[styles.iconWrap, { backgroundColor: withAlpha(habit.color, 0.14) }]}>
            <SymbolView name={habitIconSymbol(habit.icon)} size={28} tintColor={habit.color} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
              {habit.name}
            </Text>
            <Text style={styles.meta}>
              {describeSchedule(habit.schedule)} · {describeTracking(habit.tracking)}
            </Text>
            <Text style={styles.metaMuted}>History from {formatShortDate(summary.startKey)}</Text>
          </View>
        </View>

        <View style={styles.tiles}>
          <StatTile
            label="Current streak"
            value={`${current.length}${current.uncertain ? '+' : ''}`}
            caption={currentCaption}
            color={habit.color}
            badge={current.uncertain ? 'May be longer' : current.todayDone ? 'Provisional' : undefined}
          />
          <StatTile
            label="Best streak"
            value={`${longest.length}${longest.uncertain ? '+' : ''}`}
            caption={
              !longest.endKey
                ? 'No streak yet'
                : longest.ongoing
                  ? longest.includesToday
                    ? 'Current run · includes today'
                    : 'Current run'
                  : `Ended ${formatShortDate(longest.endKey)}`
            }
            badge={longest.uncertain ? 'May be longer' : longest.includesToday ? 'Provisional' : undefined}
          />
          <StatTile
            label="All time"
            value={formatRate(allTime.rate)}
            caption={
              allTime.finished > 0
                ? `${allTime.done} of ${plural(allTime.finished, 'scheduled check-in', 'scheduled check-ins')} · finished days`
                : 'No finished days yet — today counts once it’s over'
            }
          />
          <StatTile
            label="This month"
            value={formatRate(thisMonth.rate)}
            caption={thisMonth.finished > 0 ? `${thisMonth.done} of ${thisMonth.finished} · finished days` : 'No finished days yet'}
          />
        </View>
        {allTime.partial > 0 && (
          <Text style={styles.footnote}>
            {plural(allTime.partial, 'missed day had', 'missed days had')} some progress that didn’t meet the target.
          </Text>
        )}

        <View style={styles.card}>
          <HeatmapCalendar index={index} habitId={habit.id} color={habit.color} />
        </View>

        <DataNotesCard notes={notes} habitName={habit.name} />

        <Pressable
          onPress={() => openHabitEditor(habit.id)}
          accessibilityRole="button"
          android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
          <Text style={styles.editText}>Edit habit</Text>
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
            accessibilityLabel="Back"
            android_ripple={{ color: 'rgba(255,255,255,0.08)', borderless: true }}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={20}
              tintColor={Palette.text}
            />
          </Pressable>
          <Text style={styles.topTitle}>Habit history</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {body}
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
    borderColor: Palette.border,
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
