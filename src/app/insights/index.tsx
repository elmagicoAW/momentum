import { router } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { DataNotesCard } from '@/components/insights/data-notes';
import { formatRate, plural } from '@/components/insights/format';
import { HabitInsightRow } from '@/components/insights/habit-insight-row';
import { HeatmapCalendar } from '@/components/insights/heatmap-calendar';
import { StatTile } from '@/components/insights/stat-tile';
import { TrendBars } from '@/components/insights/trend-bars';
import { WeeklyReviewCard } from '@/components/insights/weekly-review-card';
import { BottomTabInset, MaxContentWidth, Palette, Radius, Spacing } from '@/constants/theme';
import { useInsights } from '@/hooks/use-insights';
import { dataNotes, hasFinishedHistory, overview, OVERVIEW_DAYS, summarizeHabit } from '@/utils/insights';
import { HABITS_HREF, openHabitHistory } from '@/utils/navigation';

/** Insights tab — strictly read-only. */
export default function InsightsScreen() {
  const { status, index, todayKey, retry } = useInsights();

  const derived = useMemo(() => {
    if (!index) return null;
    return {
      overview: overview(index),
      notes: dataNotes(index),
      summaries: index.habits.map((h) => summarizeHabit(index, h)),
      hasHistory: hasFinishedHistory(index),
    };
  }, [index]);

  let content: ReactNode;
  if (status === 'loading' && !index) {
    content = <ActivityIndicator color={Palette.accent} style={styles.spinner} />;
  } else if (status === 'habits-error' || status === 'history-error') {
    content = (
      <EmptyState
        title={status === 'habits-error' ? 'Couldn’t load your habits' : 'Couldn’t read your history'}
        description="Your saved data hasn’t been changed. Try again, or restart the app."
        icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
        actionLabel="Try again"
        onAction={retry}
      />
    );
  } else if (!index || !derived) {
    content = (
      <EmptyState
        title="No habits yet"
        description="Add a habit and check in on Today — your streaks and trends will appear here."
        icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'insights', web: 'insights' }}
        actionLabel="Go to Habits"
        onAction={() => router.navigate(HABITS_HREF)}
      />
    );
  } else {
    const { overview: ov, notes, summaries, hasHistory } = derived;
    const today = ov.today;
    content = (
      <>
        {!hasHistory && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Insights fill in after your first full day. Today counts once it’s over.
            </Text>
          </View>
        )}

        <View style={styles.tiles}>
          <StatTile
            label="Consistency"
            value={formatRate(ov.counts.rate)}
            caption={ov.counts.finished > 0 ? `Last ${OVERVIEW_DAYS} finished days` : 'Starts after your first full day'}
            color={Palette.accent}
            badge={ov.unreadableDays > 0 ? 'May be incomplete' : undefined}
          />
          <StatTile
            label="Finished check-ins"
            value={ov.counts.finished > 0 ? `${ov.counts.done}/${ov.counts.finished}` : '—'}
            caption={
              ov.counts.finished === 0
                ? 'No finished days yet'
                : ov.counts.missed > 0
                  ? `${ov.counts.missed} not checked in`
                  : 'None missed'
            }
          />
          <StatTile
            label="Best streak now"
            value={ov.bestCurrent ? `${ov.bestCurrent.streak.length}${ov.bestCurrent.streak.uncertain ? '+' : ''}` : '0'}
            caption={ov.bestCurrent ? `${ov.bestCurrent.habit.name} · in a row` : 'Complete a scheduled habit to start one'}
            color={Palette.accentBlue}
            badge={ov.bestCurrent?.streak.todayDone ? 'Includes today' : undefined}
          />
          <StatTile
            label="Today"
            value={today.known ? `${today.done}/${today.due}` : '—'}
            caption={today.known ? (today.due === 0 ? 'Nothing scheduled' : 'Checked in so far') : 'Not loaded yet'}
            badge="Provisional"
          />
        </View>
        <Text style={styles.footnote}>
          {plural(ov.perfectDays, 'perfect day', 'perfect days')} in the last {OVERVIEW_DAYS} days
          {ov.unreadableDays > 0 ? ` · ${plural(ov.unreadableDays, 'day', 'days')} couldn’t be read` : ''}
        </Text>

        <Section title="Calendar">
          <HeatmapCalendar index={index} />
        </Section>

        <Section title="Weekly review">
          <WeeklyReviewCard index={index} />
        </Section>

        <Section title="Trends">
          <TrendBars index={index} />
        </Section>

        <Text style={styles.sectionTitle}>Habits</Text>
        <View style={styles.list}>
          {summaries.map((s) => (
            <HabitInsightRow key={s.habit.id} summary={s} todayKey={todayKey} onPress={openHabitHistory} />
          ))}
        </View>

        <DataNotesCard notes={notes} />
      </>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Insights
            </Text>
            <Text style={styles.subtitle}>Based only on your saved check-ins</Text>
          </View>
          {content}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
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
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
  },
  header: {
    gap: 4,
    marginBottom: Spacing.two,
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
  spinner: {
    marginTop: Spacing.six,
  },
  banner: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Palette.accentBlueSoft,
  },
  bannerText: {
    color: Palette.text,
    fontSize: 13,
    lineHeight: 18,
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
  sectionWrap: {
    gap: 8,
    marginTop: Spacing.two,
  },
  sectionTitle: {
    color: Palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  list: {
    gap: 10,
  },
});
