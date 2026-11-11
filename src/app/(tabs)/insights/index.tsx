"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {Text} from '@/components/localized-native';
import { appLabel, appMessage } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { router } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { DataNotesCard } from '@/components/insights/data-notes';
import { formatRate } from '@/components/insights/format';
import { HabitInsightRow } from '@/components/insights/habit-insight-row';
import { HeatmapCalendar } from '@/components/insights/heatmap-calendar';
import { StatTile } from '@/components/insights/stat-tile';
import { TrendBars } from '@/components/insights/trend-bars';
import { WeeklyReviewCard } from '@/components/insights/weekly-review-card';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useInsights } from '@/hooks/use-insights';
import { dataNotes, hasFinishedHistory, overview, OVERVIEW_DAYS, summarizeHabit } from '@/utils/insights';
import { HABITS_HREF, openHabitHistory } from '@/utils/navigation';

/** Insights tab — strictly read-only. */
export default function InsightsScreen() {
  const { palette: Palette, styles } = useAppStyles(createStyles);
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
        title={status === 'habits-error' ? appLabel("insights.index.couldnTLoadYourHabits") : appLabel("insights.index.couldnTReadYourHistory")}
        description={appLabel("insights.index.yourSavedDataHasnTBeenChangedTryAgainOrRestartTheApp")}
        icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
        actionLabel={appLabel("insights.index.tryAgain")}
        onAction={retry}
      />
    );
  } else if (!index || !derived) {
    content = (
      <EmptyState
        title={appLabel("insights.index.noHabitsYet")}
        description={appLabel("insights.index.addAHabitAndCheckInOnTodayYourStreaksAndTrendsWillAppearHere")}
        icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'insights', web: 'insights' }}
        actionLabel={appLabel("insights.index.goToHabits")}
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
              {appLabel("insights.index.insightsFillInAfterYourFirstFullDayTodayCountsOnceItSOver")}</Text>
          </View>
        )}

        <View style={styles.tiles}>
          <StatTile
            label={appLabel("insights.index.consistency")}
            value={formatRate(ov.counts.rate)}
            caption={ov.counts.finished > 0 ? appMessage("insights.overview.window", { count: (OVERVIEW_DAYS) }) : appLabel("insights.index.startsAfterYourFirstFullDay")}
            color={Palette.accent}
            badge={ov.unreadableDays > 0 ? appLabel("insights.index.mayBeIncomplete") : undefined}
          />
          <StatTile
            label={appLabel("insights.index.finishedCheckIns")}
            value={ov.counts.finished > 0 ? appMessage("display.ratio", { value: ov.counts.done, maximum: ov.counts.finished }) : '—'}
            caption={
              ov.counts.finished === 0
                ? appLabel("insights.index.noFinishedDaysYet")
                : ov.counts.missed > 0
                  ? appMessage("insights.overview.missed", { count: (ov.counts.missed) })
                  : appLabel("insights.index.noneMissed")
            }
          />
          <StatTile
            label={appLabel("insights.index.bestStreakNow")}
            value={ov.bestCurrent ? appMessage("display.uncertainCount", { count: ov.bestCurrent.streak.length, uncertainty: String(ov.bestCurrent.streak.uncertain ? '+' : '') }) : '0'}
            caption={ov.bestCurrent ? appMessage("insights.streak.habit", { name: (ov.bestCurrent.habit.name) }) : appLabel("insights.index.completeAScheduledHabitToStartOne")}
            color={Palette.accentBlue}
            badge={ov.bestCurrent?.streak.todayDone ? appLabel("insights.index.includesToday") : undefined}
          />
          <StatTile
            label={appLabel("insights.index.today")}
            value={today.known ? appMessage("display.ratio", { value: today.done, maximum: today.due }) : '—'}
            caption={today.known ? (today.due === 0 ? appLabel("insights.index.nothingScheduled") : appLabel("insights.index.checkedInSoFar")) : appLabel("insights.index.notLoadedYet")}
            badge={appLabel("insights.index.provisional")}
          />
        </View>
        <Text style={styles.footnote}>{appMessage("insights.overview.perfect", { count: ov.perfectDays, total: OVERVIEW_DAYS, unreadable: ov.unreadableDays > 0 ? appMessage("insights.overview.unreadable", { count: ov.unreadableDays }) : "" })}</Text>

        <Section title={appLabel("insights.index.calendar")}>
          <HeatmapCalendar index={index} />
        </Section>

        <Section title={appLabel("insights.index.weeklyReview")}>
          <WeeklyReviewCard index={index} />
        </Section>

        <Section title={appLabel("insights.index.trends")}>
          <TrendBars index={index} />
        </Section>

        <Text style={styles.sectionTitle}>{appLabel("insights.index.habits")}</Text>
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
              {appLabel("insights.index.insights")}</Text>
            <Text style={styles.subtitle}>{appLabel("insights.index.basedOnlyOnYourSavedCheckIns")}</Text>
          </View>
          {content}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { styles } = useAppStyles(createStyles);
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
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
