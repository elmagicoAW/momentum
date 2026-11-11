"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {Text, NumericText} from '@/components/localized-native';
import { appLabel, appMessage, appNumber, appRich } from '@/i18n/app-copy';
import { LocalizedInline } from '@/components/localized-inline';
import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PeriodNav } from '@/components/insights/period-nav';
import { formatRate } from '@/components/insights/format';
import { Radius } from '@/constants/theme';
import {
  clampWeek,
  describeWeek,
  stepWeek,
  weekBounds,
  weekCaption,
  weeklyReview,
  type InsightsIndex,
} from '@/utils/insights';

/**
 * Weekly Review, Monday–Sunday. Missed check-ins count finished days only;
 * today's habits are "still to come", never missed.
 */
export function WeeklyReviewCard({ index }: { index: InsightsIndex }) {
  const { palette: Palette, styles, language } = useAppStyles(createStyles);
  const bounds = weekBounds(index);
  const [chosen, setChosen] = useState(bounds.maxStartKey);
  // Clamp (e.g. after midnight rolls into a new week).
  const startKey = clampWeek(chosen, bounds);
  const review = useMemo(() => weeklyReview(index, startKey), [index, startKey]);

  const { counts } = review;
  const nothingScheduled =
    review.empty || (counts.finished === 0 && counts.unknown === 0 && review.todayDone === 0 && review.remaining === 0);

  return (
    <View style={styles.container}>
      <PeriodNav
        label={review.label}
        caption={weekCaption(review)}
        unit="week"
        canPrev={startKey > bounds.minStartKey}
        canNext={startKey < bounds.maxStartKey}
        onPrev={() => setChosen(stepWeek(startKey, -1, bounds))}
        onNext={() => setChosen(stepWeek(startKey, 1, bounds))}
        resetLabel={review.isCurrent ? undefined : appLabel("insights.weekly-review-card.thisWeek")}
        onReset={() => setChosen(bounds.maxStartKey)}
      />

      <Text style={styles.summary} accessibilityLiveRegion="polite">
        {describeWeek(review)}
      </Text>

      {nothingScheduled ? null : (
        <>
          <View style={[styles.statsRow,language === 'ar' && {flexWrap:'wrap'}]}>
            <Stat label={appLabel("insights.weekly-review-card.completed")} value={appNumber(counts.done + review.todayDone)} color={Palette.success} />
            <Stat label={appLabel("insights.weekly-review-card.missed")} value={appNumber(counts.missed)} color={counts.missed > 0 ? Palette.danger : undefined} />
            <Stat
              label={review.isCurrent ? appLabel("insights.weekly-review-card.stillToCome") : appLabel("insights.weekly-review-card.consistency")}
              value={review.isCurrent ? appNumber(review.remaining) : formatRate(counts.rate)}
            />
          </View>

          <View style={styles.lines}>
            {review.isCurrent && review.todayDone > 0 && (
              <Line>{appMessage("insights.week.todayIncluded", { count: review.todayDone })}</Line>
            )}
            {counts.partial > 0 && (
              <Line>{appMessage("insights.week.partial", { count: counts.partial })}</Line>
            )}
            {review.deltaPoints !== null && (
              <Line>
                {review.deltaPoints === 0
                  ? appLabel("insights.weekly-review-card.sameConsistencyAsTheWeekBefore")
                  : appMessage("insights.week.delta", { arrow: (review.deltaPoints > 0 ? '▲' : '▼'), value: (Math.abs(review.deltaPoints)), rate: (formatRate(review.previousRate)) })}
              </Line>
            )}
            {review.best && (
              <Line><LocalizedInline message={appRich('insights.week.best', { name: review.best.habit.name, done: review.best.counts.done, total: review.best.counts.finished }, 'name')} slotStyle={styles.strong} /></Line>
            )}
            {review.needsAttention && review.needsAttention.habit.id !== review.best?.habit.id && (
              <Line><LocalizedInline message={appRich('insights.week.attention', { name: review.needsAttention.habit.name, count: review.needsAttention.counts.missed }, 'name')} slotStyle={styles.strong} /></Line>
            )}
          </View>

          {review.achievements.length > 0 && (
            <View style={styles.achievements}>
              <Text style={styles.label}>{appLabel("insights.weekly-review-card.achievements")}</Text>
              {review.achievements.map((a) => (
                <View key={a} style={styles.achievement}>
                  <Text style={styles.achievementIcon}>★</Text>
                  <Text style={styles.achievementText}>{a}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {review.unreadableDays > 0 && (
        <Text style={styles.warning}>{appMessage("insights.week.unreadable", { count: review.unreadableDays })}</Text>
      )}
      {review.possibleScheduleChange && (
        <Text style={styles.muted}>
          {appLabel("insights.weekly-review-card.someCheckInsThisWeekFallOnDaysAHabitIsnTScheduledNowTheyArenTCountedPastWeeksUseCurrentSchedules")}</Text>
      )}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const { palette: Palette, styles, language } = useAppStyles(createStyles);
  return (
    <View style={[styles.stat,language === 'ar' && {flexBasis:'100%',minWidth:0}]} accessible accessibilityLabel={appMessage("display.labelColon", { label: String(label), textValue: value })}>
      <NumericText style={[styles.statValue, color ? { color: readableAccent(color, Palette) } : null]}>{value}</NumericText>
      <Text style={[styles.statLabel,language === 'ar' && {textAlign:'center'}]}>{label}</Text>
    </View>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  const { styles } = useAppStyles(createStyles);
  return <Text style={styles.line}>{children}</Text>;
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  container: {
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceRaised,
  },
  statValue: {
    color: Palette.text,
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    color: Palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summary: {
    color: Palette.text,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
  lines: {
    gap: 6,
  },
  line: {
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  strong: {
    color: Palette.text,
    fontWeight: '700',
  },
  label: {
    color: Palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  achievements: {
    gap: 6,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Palette.accentSoft,
  },
  achievement: {
    flexDirection: 'row',
    gap: 8,
  },
  achievementIcon: {
    color: Palette.accent,
    fontSize: 13,
  },
  achievementText: {
    flex: 1,
    color: Palette.text,
    fontSize: 13,
    lineHeight: 18,
  },
  muted: {
    color: Palette.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  warning: {
    color: Palette.danger,
    fontSize: 12,
    lineHeight: 17,
  },
});
