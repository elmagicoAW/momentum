"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {Text, NumericText} from '@/components/localized-native';
import { appLabel, appMessage } from '@/i18n/app-copy';
import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import type { HabitConsistency } from '@/utils/goal-progress';

type Props = {
  /** null when completion history couldn't be loaded. */
  consistency: HabitConsistency | null;
  /** True while history is still loading for the first time. */
  loading?: boolean;
  color: string;
};


/**
 * Habit Consistency for one goal. Finished days are the headline number;
 * today is shown separately and marked provisional, so habits not done yet
 * today are never presented as missed.
 */
export function ConsistencySummary({ consistency, loading, color }: Props) {
  const { palette: Palette, styles, language } = useAppStyles(createStyles);
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{appLabel("goals.consistency-summary.habitConsistency")}</Text>
        <Text style={styles.muted}>{appLabel("goals.consistency-summary.loadingCheckInsPending")}</Text>
      </View>
    );
  }

  if (!consistency) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{appLabel("goals.consistency-summary.habitConsistency")}</Text>
        <Text style={styles.muted}>{appLabel("goals.consistency-summary.unavailableRightNowYourSavedCheckInsCouldnTBeReadNothingWasChanged")}</Text>
      </View>
    );
  }

  if (consistency.linkedHabits.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{appLabel("goals.consistency-summary.habitConsistency")}</Text>
        <Text style={styles.muted}>{appLabel("goals.consistency-summary.linkHabitsToSeeHowConsistentlyYouShowUpForThisGoal")}</Text>
      </View>
    );
  }

  const { finished, today, unreadableDays } = consistency;
  const percent = finished.rate === null ? null : Math.round(finished.rate * 100);

  return (
    <View style={styles.container}>
      <View style={[styles.headline,language === 'ar' && {flexWrap:'wrap',gap:8}]}>
        <Text style={styles.label}>{appLabel("goals.consistency-summary.habitConsistency")}</Text>
        {percent !== null && (
          <NumericText style={[styles.percent, { color: readableAccent(color, Palette) }]} accessibilityLabel={appMessage("goals.consistency.accessibility", { percent: (percent) })}>
            {appMessage('display.percent',{percent})}
          </NumericText>
        )}
      </View>

      {percent !== null ? (
        <>
          <View
            style={styles.track}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={appLabel("goals.consistency-summary.habitConsistencyOnCompletedDays")}
            accessibilityValue={{ min: 0, max: 100, now: percent }}>
            <View style={[styles.fill, { width: `${percent}%`, backgroundColor: readableAccent(color, Palette) }]} />
          </View>
          <Text style={styles.detail}>{appMessage("goals.consistency.finished", { done: finished.completed, count: finished.scheduled })}</Text>
        </>
      ) : (
        <Text style={styles.muted}>{appLabel("goals.consistency-summary.noCompletedDaysYetTheFirstFullDayCountsFromTomorrow")}</Text>
      )}

      {today && (
        <View style={styles.todayRow}>
          <View style={styles.provisional}>
            <Text style={styles.provisionalText}>{appLabel("goals.consistency-summary.todayInProgress")}</Text>
          </View>
          <Text style={styles.todayText}>
            {today.scheduled === 0
              ? appLabel("goals.consistency-summary.nothingLinkedIsScheduledToday")
              : appMessage("goals.consistency.today", { done: (today.completed), total: (today.scheduled) })}
          </Text>
        </View>
      )}

      {unreadableDays > 0 && (
        <Text style={styles.warning}>{appMessage("goals.consistency.unreadable", { count: unreadableDays })}</Text>
      )}
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
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
