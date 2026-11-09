import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { plural } from '@/components/insights/format';
import { Palette, Radius, Spacing } from '@/constants/theme';
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
  const [open, setOpen] = useState(false);
  const warnings: string[] = [];
  if (notes.unreadableDays > 0) {
    warnings.push(
      `${plural(notes.unreadableDays, 'day', 'days')} of saved check-ins couldn’t be read. ${
        notes.unreadableDays === 1 ? 'It is' : 'They are'
      } left out of every number, and streaks that touch ${
        notes.unreadableDays === 1 ? 'it' : 'them'
      } are marked “+” (may be longer). Statistics may be incomplete. Nothing was changed.`,
    );
  }
  if (!notes.todayKnown) {
    warnings.push('Today’s progress hasn’t loaded, so today isn’t included yet.');
  }
  if (notes.scheduleChangeHabits.length > 0) {
    const names = notes.scheduleChangeHabits.map((h) => h.name).join(', ');
    warnings.push(
      `${habitName ?? names} ${habitName || notes.scheduleChangeHabits.length === 1 ? 'has' : 'have'} check-ins on days ${
        habitName || notes.scheduleChangeHabits.length === 1 ? 'it isn’t' : 'they aren’t'
      } scheduled now, so the schedule may have changed. Past numbers use the current schedule.`,
    );
  }

  const info: string[] = [];
  if (notes.startFromEntriesHabits.length > 0) {
    const names = habitName ?? notes.startFromEntriesHabits.map((h) => h.name).join(', ');
    info.push(
      `History for ${names} starts at the first saved check-in, which is earlier than the habit’s saved creation date. Days before that first check-in aren’t counted as scheduled or missed.`,
    );
  }
  if (notes.ignoredRecordDays > 0) {
    info.push(`${plural(notes.ignoredRecordDays, 'saved day has', 'saved days have')} a future or invalid date and ${notes.ignoredRecordDays === 1 ? 'is' : 'are'} ignored.`);
  }
  if (!habitName && notes.deletedHabitsWithHistory > 0) {
    info.push(`Check-ins of ${plural(notes.deletedHabitsWithHistory, 'deleted habit', 'deleted habits')} are kept in storage but not shown.`);
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
        <Text style={styles.headerText}>About these numbers</Text>
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
  'Only saved check-ins count. Nothing is estimated, invented or changed.',
  'Each scheduled habit counts once a day: Tick when ticked, Count when the target is reached, Checklist when every required step is done.',
  'Past days use the target and steps saved that day, so editing a habit doesn’t change its history. Today uses the current definition.',
  'Today is provisional: habits not done yet are “in progress”, never missed. Future days are never counted.',
  'Streaks count scheduled check-ins in a row. Days a habit isn’t scheduled are skipped, and a streak only breaks after a scheduled day ends without a check-in.',
  'A scheduled day with progress that didn’t meet the target (partial) counts as missed.',
  'Schedules aren’t stored historically: the current schedule is applied to all past days. If you changed a schedule, past scheduled and missed counts follow the new one.',
  'Days before a habit existed aren’t counted. Deleted habits aren’t shown.',
  'Days follow your phone’s local calendar; changing time zones can shift a day.',
  'A scheduled day without a saved check-in counts as missed, even if you did the habit but didn’t log it.',
];

const styles = StyleSheet.create({
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
