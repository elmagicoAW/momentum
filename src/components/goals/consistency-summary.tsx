import { StyleSheet, Text, View } from 'react-native';

import { Palette, Radius } from '@/constants/theme';
import type { HabitConsistency } from '@/utils/goal-progress';

type Props = {
  /** null when completion history couldn't be loaded. */
  consistency: HabitConsistency | null;
  /** True while history is still loading for the first time. */
  loading?: boolean;
  color: string;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Habit Consistency for one goal. Finished days are the headline number;
 * today is shown separately and marked provisional, so habits not done yet
 * today are never presented as missed.
 */
export function ConsistencySummary({ consistency, loading, color }: Props) {
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Habit Consistency</Text>
        <Text style={styles.muted}>Loading check-ins…</Text>
      </View>
    );
  }

  if (!consistency) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Habit Consistency</Text>
        <Text style={styles.muted}>Unavailable right now — your saved check-ins couldn’t be read. Nothing was changed.</Text>
      </View>
    );
  }

  if (consistency.linkedHabits.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Habit Consistency</Text>
        <Text style={styles.muted}>Link habits to see how consistently you show up for this goal.</Text>
      </View>
    );
  }

  const { finished, today, unreadableDays } = consistency;
  const percent = finished.rate === null ? null : Math.round(finished.rate * 100);

  return (
    <View style={styles.container}>
      <View style={styles.headline}>
        <Text style={styles.label}>Habit Consistency</Text>
        {percent !== null && (
          <Text style={[styles.percent, { color }]} accessibilityLabel={`Habit consistency ${percent} percent`}>
            {percent}%
          </Text>
        )}
      </View>

      {percent !== null ? (
        <>
          <View
            style={styles.track}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Habit consistency on completed days"
            accessibilityValue={{ min: 0, max: 100, now: percent }}>
            <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.detail}>
            {finished.completed} of {plural(finished.scheduled, 'scheduled check-in', 'scheduled check-ins')} completed
            on past days
          </Text>
        </>
      ) : (
        <Text style={styles.muted}>No completed days yet — the first full day counts from tomorrow.</Text>
      )}

      {today && (
        <View style={styles.todayRow}>
          <View style={styles.provisional}>
            <Text style={styles.provisionalText}>Today · in progress</Text>
          </View>
          <Text style={styles.todayText}>
            {today.scheduled === 0
              ? 'Nothing linked is scheduled today'
              : `${today.completed} of ${today.scheduled} checked in so far`}
          </Text>
        </View>
      )}

      {unreadableDays > 0 && (
        <Text style={styles.warning}>
          {plural(unreadableDays, 'day', 'days')} of saved check-ins couldn’t be read and may show as not completed.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  label: {
    color: Palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  percent: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  track: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Palette.ringTrack,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  detail: {
    color: Palette.textSecondary,
    fontSize: 13,
  },
  muted: {
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  provisional: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Palette.textMuted,
  },
  provisionalText: {
    color: Palette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  todayText: {
    color: Palette.textSecondary,
    fontSize: 13,
  },
  warning: {
    color: Palette.danger,
    fontSize: 12,
    lineHeight: 17,
  },
});
