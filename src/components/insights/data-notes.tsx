"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {SymbolView, Text} from '@/components/localized-native';
import { appLabel, appMessage } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import type { DataNotes } from '@/utils/insights';

type Props = {
  notes: DataNotes;
  /** Habit history screen: only notes relevant to that habit. */
  habitName?: string;
};

/**
 * Live data warnings (always visible) plus the fixed "About these numbers"
 * explanation (collapsible). Wording never claims more accuracy than the data has.
 */
export function DataNotesCard({ notes, habitName }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const [open, setOpen] = useState(false);
  const warnings: string[] = [];
  if (notes.unreadableDays > 0) {
    warnings.push(
      appMessage("insights.notes.unreadable", { count: notes.unreadableDays }),
    );
  }
  if (!notes.todayKnown) {
    warnings.push(appLabel("insights.data-notes.todaySProgressHasnTLoadedSoTodayIsnTIncludedYet"));
  }
  if (notes.scheduleChangeHabits.length > 0) {
    const names = notes.scheduleChangeHabits.map((h) => h.name).join(', ');
    warnings.push(
      appMessage("insights.notes.scheduleChange", { count: habitName ? 1 : notes.scheduleChangeHabits.length, names: habitName ?? names }),
    );
  }

  const info: string[] = [];
  if (notes.startFromEntriesHabits.length > 0) {
    const names = habitName ?? notes.startFromEntriesHabits.map((h) => h.name).join(', ');
    info.push(
      appMessage("insights.history.inferredStart", { names: (names) }),
    );
  }
  if (notes.ignoredRecordDays > 0) {
    info.push(appMessage("insights.notes.ignored", { count: notes.ignoredRecordDays }));
  }
  if (!habitName && notes.deletedHabitsWithHistory > 0) {
    info.push(appMessage("insights.notes.deleted", { count: notes.deletedHabitsWithHistory }));
  }

  return (
    <View style={styles.container}>
      {warnings.map((w) => (
        <View key={w} style={styles.warning}>
          <SymbolView
            name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
            size={16}
            tintColor={Palette.danger}
          />
          <Text style={styles.warningText}>{w}</Text>
        </View>
      ))}

      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <SymbolView
          name={{ ios: 'info.circle', android: 'info', web: 'info' }}
          size={16}
          tintColor={Palette.textSecondary}
        />
        <Text style={styles.headerText}>{appLabel("insights.data-notes.aboutTheseNumbers")}</Text>
        <SymbolView
          name={
            open
              ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
              : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
          }
          size={16}
          tintColor={Palette.textMuted}
        />
      </Pressable>

      {open && (
        <View style={styles.body}>
          {[...info, ...ABOUT].map((line) => (
            <Text key={line} style={styles.bodyText}>
              • {line}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const ABOUT = [
  appLabel("insights.data-notes.onlySavedCheckInsCountNothingIsEstimatedInventedOrChanged"),
  appLabel("insights.data-notes.eachScheduledHabitCountsOnceADayTickWhenTickedCountWhenTheTargetIsReachedChecklistWhenEveryRequiredStepIsDone"),
  appLabel("insights.data-notes.pastDaysUseTheTargetAndStepsSavedThatDaySoEditingAHabitDoesnTChangeItsHistoryTodayUsesTheCurrentDefinition"),
  appLabel("insights.data-notes.todayIsProvisionalHabitsNotDoneYetAreInProgressNeverMissedFutureDaysAreNeverCounted"),
  appLabel("insights.data-notes.streaksCountScheduledCheckInsInARowDaysAHabitIsnTScheduledAreSkippedAndAStreakOnlyBreaksAfterAScheduledDayEndsWithoutACheckIn"),
  appLabel("insights.data-notes.aScheduledDayWithProgressThatDidnTMeetTheTargetPartialCountsAsMissed"),
  appLabel("insights.data-notes.schedulesArenTStoredHistoricallyTheCurrentScheduleIsAppliedToAllPastDaysIfYouChangedASchedulePastScheduledAndMissedCountsFollowTheNewOne"),
  appLabel("insights.data-notes.daysBeforeAHabitExistedArenTCountedDeletedHabitsArenTShown"),
  appLabel("insights.data-notes.daysFollowYourPhoneSLocalCalendarChangingTimeZonesCanShiftADay"),
  appLabel("insights.data-notes.aScheduledDayWithoutASavedCheckInCountsAsMissedEvenIfYouDidTheHabitButDidnTLogIt"),
];

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  container: {
    gap: 10,
  },
  warning: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Palette.dangerSoft,
  },
  warningText: {
    flex: 1,
    color: Palette.text,
    fontSize: 13,
    lineHeight: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  headerText: {
    flex: 1,
    color: Palette.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
  body: {
    gap: 6,
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
  },
  bodyText: {
    color: Palette.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
});
