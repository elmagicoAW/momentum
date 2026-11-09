import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PeriodNav } from '@/components/insights/period-nav';
import { formatRate, plural } from '@/components/insights/format';
import { Palette, Radius } from '@/constants/theme';
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
        resetLabel={review.isCurrent ? undefined : 'This week'}
        onReset={() => setChosen(bounds.maxStartKey)}
      />

      <Text style={styles.summary} accessibilityLiveRegion="polite">
        {describeWeek(review)}
      </Text>

      {nothingScheduled ? null : (
        <>
          <View style={styles.statsRow}>
            <Stat label="Completed" value={String(counts.done + review.todayDone)} color={Palette.success} />
            <Stat label="Missed" value={String(counts.missed)} color={counts.missed > 0 ? Palette.danger : undefined} />
            <Stat
              label={review.isCurrent ? 'Still to come' : 'Consistency'}
              value={review.isCurrent ? String(review.remaining) : formatRate(counts.rate)}
            />
          </View>

          <View style={styles.lines}>
            {review.isCurrent && review.todayDone > 0 && (
              <Line>
                “Completed” includes {plural(review.todayDone, 'check-in', 'check-ins')} from today (provisional).
              </Line>
            )}
            {counts.partial > 0 && (
              <Line>{plural(counts.partial, 'missed check-in had', 'missed check-ins had')} some progress.</Line>
            )}
            {review.deltaPoints !== null && (
              <Line>
                {review.deltaPoints === 0
                  ? 'Same consistency as the week before.'
                  : `${review.deltaPoints > 0 ? '▲' : '▼'} ${Math.abs(review.deltaPoints)} points vs the week before (${formatRate(review.previousRate)}).`}
              </Line>
            )}
            {review.best && (
              <Line>
                Strongest: <Text style={styles.strong}>{review.best.habit.name}</Text> · {review.best.counts.done} of{' '}
                {review.best.counts.finished}
              </Line>
            )}
            {review.needsAttention && review.needsAttention.habit.id !== review.best?.habit.id && (
              <Line>
                Needs attention: <Text style={styles.strong}>{review.needsAttention.habit.name}</Text> ·{' '}
                {plural(review.needsAttention.counts.missed, 'miss', 'misses')}
              </Line>
            )}
          </View>

          {review.achievements.length > 0 && (
            <View style={styles.achievements}>
              <Text style={styles.label}>Achievements</Text>
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
        <Text style={styles.warning}>
          {plural(review.unreadableDays, 'day', 'days')} this week couldn’t be read and {review.unreadableDays === 1 ? 'is' : 'are'}{' '}
          left out — this review may be incomplete.
        </Text>
      )}
      {review.possibleScheduleChange && (
        <Text style={styles.muted}>
          Some check-ins this week fall on days a habit isn’t scheduled now. They aren’t counted; past weeks use current
          schedules.
        </Text>
      )}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <Text style={styles.line}>{children}</Text>;
}

const styles = StyleSheet.create({
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
