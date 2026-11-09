import { foregroundOnColor, readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { StyleSheet, Text, View } from 'react-native';

import { plural, withAlpha } from '@/components/insights/format';
import { Radius } from '@/constants/theme';
import { formatLongDateKey, parseLocalDateKey } from '@/utils/date';
import { DayStatus, describeProgress, type DayDetail, type HabitDayDetail } from '@/utils/insights';

type Props = {
  detail: DayDetail;
  /** Single-habit mode (Habit History): show schedule / status / progress rows. */
  single?: boolean;
};

function scheduleText(d: HabitDayDetail): string {
  if (d.scheduled === null) return 'Not started — the habit didn’t exist yet';
  return d.scheduled ? 'Scheduled' : 'Not scheduled';
}

function statusColor(status: HabitDayDetail['status'], color: string, Palette: AppPalette): string {
  switch (status) {
    case DayStatus.DONE:
      return Palette.success;
    case DayStatus.PARTIAL:
      return readableAccent(color, Palette);
    case DayStatus.MISSED:
      return Palette.danger;
    case DayStatus.UNKNOWN:
      return Palette.danger;
    default:
      return Palette.textSecondary;
  }
}

/**
 * Details for the selected calendar date. Shows only what was saved — progress
 * is never estimated. Announced politely to screen readers when it changes.
 */
export function DayDetailPanel({ detail, single }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const date = parseLocalDateKey(detail.dateKey);
  const title = `${formatLongDateKey(detail.dateKey)}, ${date.getFullYear()}`;
  const habit = single ? detail.habits[0] : undefined;

  return (
    <View style={styles.panel} accessibilityLiveRegion="polite" accessible={single} accessibilityLabel={single ? panelLabel(title, detail, habit) : undefined}>
      <View style={styles.header}>
        <Text style={styles.date} accessibilityRole="header">
          {title}
        </Text>
        {detail.isToday ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>Today · provisional</Text>
          </View>
        ) : null}
      </View>

      {single ? (
        habit ? (
          <View style={styles.rows}>
            <Row label="Schedule" value={scheduleText(habit)} />
            <Row label="Status" value={habit.label} color={statusColor(habit.status, habit.habit.color, Palette)} />
            {habit.progress ? (
              <Row label="Saved progress" value={describeProgress(habit.progress)} />
            ) : habit.status !== null && habit.status !== DayStatus.UNKNOWN && habit.scheduled ? (
              <Row label="Saved progress" value="Nothing saved" />
            ) : null}
            {habit.progress?.kind === 'checklist' ? <Steps detail={habit} /> : null}
          </View>
        ) : (
          <Text style={styles.summary}>Not started — this habit didn’t exist yet. Nothing is counted.</Text>
        )
      ) : (
        <>
          <Text style={styles.summary}>{detail.summary}</Text>
          {detail.habits.length > 0 ? (
            <View style={styles.list}>
              {detail.habits.map((d) => (
                <View
                  key={d.habit.id}
                  style={styles.habitRow}
                  accessible
                  accessibilityLabel={`${d.habit.name}: ${d.label}${d.progress ? `, ${describeProgress(d.progress)}` : ''}`}>
                  <View style={[styles.dot, { backgroundColor: d.habit.color }]} />
                  <Text style={styles.habitName} numberOfLines={1}>
                    {d.habit.name}
                  </Text>
                  <Text style={[styles.habitStatus, { color: statusColor(d.status, d.habit.color, Palette) }]} numberOfLines={2}>
                    {d.label}
                    {d.progress && d.progress.kind !== 'tick' ? ` · ${describeProgress(d.progress)}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {detail.notStarted > 0 && detail.habits.length > 0 ? (
            <Text style={styles.muted}>
              {plural(detail.notStarted, 'habit hadn’t', 'habits hadn’t')} started yet — not counted.
            </Text>
          ) : null}
        </>
      )}

      {detail.unreadable ? (
        <Text style={styles.warning}>This day’s saved record couldn’t be read. It’s left out of all numbers; nothing was changed.</Text>
      ) : null}
    </View>
  );
}

function panelLabel(title: string, detail: DayDetail, habit: HabitDayDetail | undefined): string {
  if (!habit) return `${title}. Not started.`;
  const parts = [title, detail.isToday ? 'Today, provisional' : '', scheduleText(habit), habit.label];
  if (habit.progress) parts.push(`Saved progress: ${describeProgress(habit.progress)}`);
  if (habit.progress?.kind === 'checklist') {
    parts.push(
      habit.progress.steps.map((s) => `${s.label}${s.optional ? ' (optional)' : ''} ${s.done ? 'done' : 'not done'}`).join(', '),
    );
  }
  if (detail.unreadable) parts.push('Saved record could not be read');
  return parts.filter(Boolean).join('. ');
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, color ? { color: readableAccent(color, Palette) } : null]}>{value}</Text>
    </View>
  );
}

function Steps({ detail }: { detail: HabitDayDetail }) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  if (detail.progress?.kind !== 'checklist') return null;
  return (
    <View style={styles.steps}>
      {detail.progress.steps.map((s) => (
        <View key={s.id} style={styles.step}>
          <View
            style={[
              styles.check,
              s.done
                ? { backgroundColor: detail.habit.color, borderColor: detail.habit.color }
                : { borderColor: withAlpha(detail.habit.color, 0.6, Palette.accent) },
            ]}>
            {s.done ? <Text style={[styles.checkMark, { color: foregroundOnColor(detail.habit.color) }]}>✓</Text> : null}
          </View>
          <Text style={styles.stepText} numberOfLines={2}>
            {s.label}
            {s.optional ? <Text style={styles.muted}> · optional</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  panel: {
    gap: 10,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  date: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Palette.textMuted,
  },
  pillText: {
    color: Palette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  rows: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowLabel: {
    width: 108,
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingTop: 1,
  },
  rowValue: {
    flex: 1,
    color: Palette.text,
    fontSize: 14,
    lineHeight: 19,
  },
  summary: {
    color: Palette.text,
    fontSize: 14,
    lineHeight: 19,
  },
  list: {
    gap: 8,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  habitName: {
    flexShrink: 1,
    maxWidth: '45%',
    color: Palette.text,
    fontSize: 13,
    fontWeight: '600',
  },
  habitStatus: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
  },
  steps: {
    gap: 6,
    paddingLeft: 4,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: Palette.onAccent,
    fontSize: 12,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    color: Palette.textSecondary,
    fontSize: 13,
  },
  muted: {
    color: Palette.textMuted,
    fontSize: 12,
  },
  warning: {
    color: Palette.danger,
    fontSize: 12,
    lineHeight: 17,
  },
});
