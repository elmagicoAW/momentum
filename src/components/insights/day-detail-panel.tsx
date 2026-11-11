"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {Text} from '@/components/localized-native';
import { appLabel, appMessage, appNumber } from '@/i18n/app-copy';
import { foregroundOnColor, readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { StyleSheet, View } from 'react-native';

import { withAlpha } from '@/components/insights/format';
import { Radius } from '@/constants/theme';
import { formatLongDateKey, parseLocalDateKey } from '@/i18n/presentation-date';
import { DayStatus, describeProgress, type DayDetail, type HabitDayDetail } from '@/utils/insights';

type Props = {
  detail: DayDetail;
  /** Single-habit mode (Habit History): show schedule / status / progress rows. */
  single?: boolean;
};

function scheduleText(d: HabitDayDetail): string {
  if (d.scheduled === null) return appLabel("insights.day-detail-panel.notStartedTheHabitDidnTExistYet");
  return d.scheduled ? appLabel("insights.day-detail-panel.scheduled") : appLabel("insights.day-detail-panel.notScheduled");
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
  const title = appMessage("display.labelValue", { label: String(formatLongDateKey(detail.dateKey)), textValue: appNumber(date.getFullYear()) });
  const habit = single ? detail.habits[0] : undefined;

  return (
    <View style={styles.panel} accessibilityLiveRegion="polite" accessible={single} accessibilityLabel={single ? panelLabel(title, detail, habit) : undefined}>
      <View style={styles.header}>
        <Text style={styles.date} accessibilityRole="header">
          {title}
        </Text>
        {detail.isToday ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{appLabel("insights.day-detail-panel.todayProvisional")}</Text>
          </View>
        ) : null}
      </View>

      {single ? (
        habit ? (
          <View style={styles.rows}>
            <Row label={appLabel("insights.day-detail-panel.schedule")} value={scheduleText(habit)} />
            <Row label={appLabel("insights.day-detail-panel.status")} value={habit.label} color={statusColor(habit.status, habit.habit.color, Palette)} />
            {habit.progress ? (
              <Row label={appLabel("insights.day-detail-panel.savedProgress")} value={describeProgress(habit.progress)} />
            ) : habit.status !== null && habit.status !== DayStatus.UNKNOWN && habit.scheduled ? (
              <Row label={appLabel("insights.day-detail-panel.savedProgress")} value={appLabel("insights.day-detail-panel.nothingSaved")} />
            ) : null}
            {habit.progress?.kind === 'checklist' ? <Steps detail={habit} /> : null}
          </View>
        ) : (
          <Text style={styles.summary}>{appLabel("insights.day-detail-panel.notStartedThisHabitDidnTExistYetNothingIsCounted")}</Text>
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
                  accessibilityLabel={d.progress ? appMessage("history.habit.progress", { name: d.habit.name, status: d.label, progress: describeProgress(d.progress) }) : appMessage("history.habit.status", { name: d.habit.name, status: d.label })}>
                  <View style={[styles.dot, { backgroundColor: d.habit.color }]} />
                  <Text style={styles.habitName} numberOfLines={1}>
                    {d.habit.name}
                  </Text>
                  <Text style={[styles.habitStatus, { color: statusColor(d.status, d.habit.color, Palette) }]} numberOfLines={2}>{d.progress && d.progress.kind !== 'tick' ? appMessage("history.habit.statusProgress", { status: d.label, progress: describeProgress(d.progress) }) : d.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {detail.notStarted > 0 && detail.habits.length > 0 ? (
            <Text style={styles.muted}>{appMessage("history.notStarted.habits", { count: detail.notStarted })}</Text>
          ) : null}
        </>
      )}

      {detail.unreadable ? (
        <Text style={styles.warning}>{appLabel("insights.day-detail-panel.thisDaySSavedRecordCouldnTBeReadItSLeftOutOfAllNumbersNothingWasChanged")}</Text>
      ) : null}
    </View>
  );
}

function panelLabel(title: string, detail: DayDetail, habit: HabitDayDetail | undefined): string {
  if (!habit) return appMessage("history.day.notStartedAccessibility", { title: (title) });
  const parts = [title, detail.isToday ? appLabel("insights.day-detail-panel.todayProvisionalVariant") : '', scheduleText(habit), habit.label];
  if (habit.progress) parts.push(appMessage("history.day.savedProgress", { progress: (describeProgress(habit.progress)) }));
  if (habit.progress?.kind === 'checklist') {
    parts.push(
      habit.progress.steps.map((s) => appMessage("history.step.accessibility", { name: s.label, optional: s.optional ? appLabel('insights.day-detail-panel.optional') : '', state: s.done ? appLabel('history.step.done') : appLabel('insights.day-detail-panel.notDone') })).join(', '),
    );
  }
  if (detail.unreadable) parts.push(appLabel("insights.day-detail-panel.savedRecordCouldNotBeRead"));
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
            {s.optional ? <Text style={styles.muted}> {appLabel("insights.day-detail-panel.optionalVariant")}</Text> : null}
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
