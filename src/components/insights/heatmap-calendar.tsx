"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {Text} from '@/components/localized-native';
import { appLabel, appMessage, appNumber } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { heatmapForeground, readableAccent } from '@/utils/theme-color';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DayDetailPanel } from '@/components/insights/day-detail-panel';
import { PeriodNav } from '@/components/insights/period-nav';
import { withAlpha } from '@/components/insights/format';
import { Radius } from '@/constants/theme';
import { formatLongDateKey, formatMonthYear, monthGrid, parseLocalDateKey } from '@/i18n/presentation-date';
import {
  canStepMonth,
  clampMonth,
  DayStatus,
  dayDetail,
  dayStatusLabel,
  heatmapCells,
  monthBounds,
  monthNumber,
  stepMonth,
  type HeatCell,
  type InsightsIndex,
  type MonthRef,
} from '@/utils/insights';

type Props = {
  index: InsightsIndex;
  /** Only this habit (habit history screen); otherwise all habits. */
  habitId?: string;
  color?: string;
};

const weekdayInitials = () => ([1, 2, 3, 4, 5, 6, 0] as const).map(day => appLabel(`calendar.weekday.${day}`));
const LEVEL_ALPHA = [0, 0.3, 0.6, 1];

/**
 * Month heatmap with a details panel for the selected day.
 * - Months: from up to 12 months before the first saved history to the current
 *   month (see `monthBounds`). Months before any habit existed show
 *   "Not started" / "No habits yet" days — never missed.
 * - Overall mode shades days by completed / scheduled check-ins; habit mode
 *   shows that habit's status. Future days are never shaded; today is outlined
 *   and provisional; unreadable days get a red dot.
 */
export function HeatmapCalendar({ index, habitId, color: suppliedColor }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const color = readableAccent(suppliedColor ?? Palette.accent, Palette);
  const habitMode = habitId !== undefined;
  const bounds = monthBounds(index);
  const [chosen, setChosen] = useState<MonthRef>(bounds.max);
  const [selection, setSelection] = useState<string | null>(index.todayKey);

  // Keep the month inside the range (e.g. after midnight rolls into a new month).
  const shown = clampMonth(chosen, bounds);
  const isCurrentMonth = monthNumber(shown) === monthNumber(bounds.max);

  // React Compiler (enabled in app.json) memoizes these derived values.
  const cells = heatmapCells(index, monthGrid(shown.year, shown.month), habitId);
  // The selection only applies to a day of the visible month.
  const selectedKey = cells.some((c) => c.inMonth && c.dateKey === selection) ? selection : null;
  const detail = selectedKey ? dayDetail(index, selectedKey, habitId) : null;

  const step = (delta: -1 | 1) => {
    setChosen(stepMonth(shown, delta, bounds));
    setSelection(null);
  };

  const first = parseLocalDateKey(index.startKey);
  const beforeHistory =
    monthNumber(shown) < monthNumber({ year: first.getFullYear(), month: first.getMonth() });

  const rows: HeatCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={styles.container}>
      <PeriodNav
        label={formatMonthYear(new Date(shown.year, shown.month, 1))}
        caption={
          beforeHistory
            ? habitMode
              ? appLabel("insights.heatmap-calendar.beforeThisHabitStarted")
              : appLabel("insights.heatmap-calendar.beforeYourHabitsStarted")
            : isCurrentMonth
              ? appLabel("insights.heatmap-calendar.thisMonthTodayIsProvisional")
              : undefined
        }
        unit="month"
        canPrev={canStepMonth(shown, -1, bounds)}
        canNext={canStepMonth(shown, 1, bounds)}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        resetLabel={isCurrentMonth ? undefined : appLabel("insights.heatmap-calendar.thisMonth")}
        onReset={() => {
          setChosen(bounds.max);
          setSelection(index.todayKey);
        }}
      />

      <View>
        <View style={styles.row}>
          {weekdayInitials().map((d, i) => (
            <Text key={i} style={styles.weekday} importantForAccessibility="no">
              {d}
            </Text>
          ))}
        </View>
        {rows.map((row) => (
          <View key={row[0].dateKey} style={styles.row}>
            {row.map((cell) => (
              <DayCell
                key={cell.dateKey}
                cell={cell}
                color={color}
                habitMode={habitMode}
                selected={cell.dateKey === selectedKey}
                onPress={() => setSelection((k) => (k === cell.dateKey ? null : cell.dateKey))}
              />
            ))}
          </View>
        ))}
      </View>

      <Legend color={color} habitMode={habitMode} />

      {detail ? (
        <DayDetailPanel detail={detail} single={habitMode} />
      ) : (
        <Text style={styles.hint}>{appLabel("insights.heatmap-calendar.tapADayToSeeWhatHappened")}</Text>
      )}
    </View>
  );
}

/** Short description used for each cell's accessibility label. */
function cellDescription(cell: HeatCell, habitMode: boolean): string {
  let text: string;
  if (cell.kind === 'future') text = appLabel("insights.heatmap-calendar.upcoming");
  else if (cell.kind === 'before') text = habitMode ? appLabel("insights.heatmap-calendar.notStarted") : appLabel("insights.heatmap-calendar.noHabitsYet");
  else if (habitMode && cell.status !== undefined) text = dayStatusLabel(cell.status, cell.isToday);
  else if (cell.kind === 'rest') text = appLabel("insights.heatmap-calendar.nothingScheduled");
  else {
    text = cell.isToday ? (cell.unknown > 0 ? appMessage("insights.complete.calendar.today.unreadable", { done: cell.done, count: cell.due, total: cell.unknown }) : appMessage("insights.complete.calendar.today.readable", { done: cell.done, count: cell.due })) : (cell.unknown > 0 ? appMessage("insights.complete.calendar.finished.unreadable", { done: cell.done, count: cell.due, total: cell.unknown }) : appMessage("insights.complete.calendar.finished.readable", { done: cell.done, count: cell.due }));
  }
  if (cell.unreadable) text = appMessage("history.calendar.unreadableRecord", { summary: text });
  return appMessage("history.calendar.accessibility", { date: formatLongDateKey(cell.dateKey), today: cell.isToday ? appLabel('insights.heatmap-calendar.today') : '', summary: text });
}

function DayCell({
  cell,
  color,
  habitMode,
  selected,
  onPress,
}: {
  cell: HeatCell;
  color: string;
  habitMode: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  if (!cell.inMonth) return <View style={styles.cellWrap} />;

  let backgroundColor: string = 'transparent';
  let borderColor: string = 'transparent';
  let borderStyle: 'solid' | 'dashed' = 'solid';
  let textColor: string = Palette.textSecondary;
  let notStarted = false;

  if (cell.kind === 'future') {
    textColor = Palette.textMuted;
  } else if (cell.kind === 'before') {
    textColor = Palette.textMuted;
    notStarted = true;
  } else if (cell.kind === 'rest') {
    borderColor = Palette.border;
  } else if (habitMode) {
    if (cell.status === DayStatus.DONE) {
      backgroundColor = color;
      textColor = heatmapForeground(color, 1, Palette, Palette.background);
    } else if (cell.status === DayStatus.PARTIAL) {
      backgroundColor = withAlpha(color, 0.25, Palette.accent);
      borderColor = withAlpha(color, 0.7, Palette.accent);
      borderStyle = 'dashed';
      textColor = heatmapForeground(color, 0.25, Palette, Palette.text);
    } else if (cell.status === DayStatus.MISSED) {
      backgroundColor = Palette.ringTrack;
    } else {
      borderColor = Palette.border; // pending / unknown
    }
  } else if (cell.level === 0) {
    backgroundColor = Palette.ringTrack;
  } else {
    backgroundColor = withAlpha(color, LEVEL_ALPHA[cell.level], Palette.accent);
    textColor = heatmapForeground(color, LEVEL_ALPHA[cell.level], Palette, cell.level === 3 ? Palette.background : Palette.text);
  }
  if (cell.isToday) {
    borderColor = Palette.text;
    borderStyle = 'dashed';
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={cellDescription(cell, habitMode)}
      accessibilityHint={appLabel("insights.heatmap-calendar.showsDetailsBelowTheCalendar")}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.cellWrap, pressed && styles.pressed]}>
      <View
        style={[
          styles.cell,
          { backgroundColor, borderColor, borderStyle },
          selected && styles.cellSelected,
        ]}>
        <Text style={[styles.cellText, { color: textColor }, cell.isToday && styles.todayText]}>{appNumber(cell.day)}</Text>
        {notStarted ? <View style={styles.notStartedBar} /> : null}
        {cell.unreadable ? <View style={styles.unreadableDot} /> : null}
      </View>
    </Pressable>
  );
}

function Legend({ color, habitMode }: { color: string; habitMode: boolean }) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const items: { label: string; style: object }[] = habitMode
    ? [
        { get label(){return appLabel("insights.heatmap-calendar.done");}, style: { backgroundColor: color } },
        {
          get label(){return appLabel("insights.heatmap-calendar.partial");},
          style: { backgroundColor: withAlpha(color, 0.25, Palette.accent), borderColor: withAlpha(color, 0.7, Palette.accent), borderStyle: 'dashed' },
        },
        { get label(){return appLabel("insights.heatmap-calendar.notCheckedIn");}, style: { backgroundColor: Palette.ringTrack } },
        { get label(){return appLabel("insights.heatmap-calendar.notScheduled");}, style: { borderColor: Palette.border } },
      ]
    : [
        { get label(){return appLabel("insights.heatmap-calendar.none");}, style: { backgroundColor: Palette.ringTrack } },
        { get label(){return appLabel("insights.heatmap-calendar.some");}, style: { backgroundColor: withAlpha(color, 0.3, Palette.accent) } },
        { get label(){return appLabel("insights.heatmap-calendar.most");}, style: { backgroundColor: withAlpha(color, 0.6, Palette.accent) } },
        { get label(){return appLabel("insights.heatmap-calendar.all");}, style: { backgroundColor: color } },
        { get label(){return appLabel("insights.heatmap-calendar.restDay");}, style: { borderColor: Palette.border } },
      ];
  return (
    <View style={styles.legend} importantForAccessibility="no-hide-descendants">
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendSwatch, item.style]} />
          <Text style={styles.legendText}>{item.label}</Text>
        </View>
      ))}
      <View style={styles.legendItem}>
        <View style={[styles.legendSwatch, styles.legendNotStarted]}>
          <View style={styles.legendBar} />
        </View>
        <Text style={styles.legendText}>{habitMode ? appLabel("insights.heatmap-calendar.notStarted") : appLabel("insights.heatmap-calendar.noHabitsYet")}</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendSwatch, styles.legendToday]} />
        <Text style={styles.legendText}>{appLabel("insights.heatmap-calendar.todayVariant")}</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.unreadableDot, styles.legendDot]} />
        <Text style={styles.legendText}>{appLabel("insights.heatmap-calendar.unreadable")}</Text>
      </View>
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  container: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: Palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    paddingVertical: 4,
  },
  // The whole 1/7-width square is the touch target (≈44–48 dp on phones).
  cellWrap: {
    flex: 1,
    aspectRatio: 1,
    padding: 2,
  },
  pressed: {
    opacity: 0.75,
  },
  cell: {
    flex: 1,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: {
    borderColor: Palette.accentBlue,
    borderStyle: 'solid',
    borderWidth: 2.5,
  },
  cellText: {
    fontSize: 13,
    fontWeight: '600',
  },
  todayText: {
    fontWeight: '800',
  },
  notStartedBar: {
    position: 'absolute',
    bottom: 5,
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: Palette.textMuted,
  },
  unreadableDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.danger,
  },
  hint: {
    color: Palette.textSecondary,
    fontSize: 13,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  legendNotStarted: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  legendBar: {
    width: 6,
    height: 1.5,
    backgroundColor: Palette.textMuted,
  },
  legendToday: {
    borderColor: Palette.text,
    borderStyle: 'dashed',
  },
  legendDot: {
    position: 'relative',
    top: 0,
    right: 0,
  },
  legendText: {
    color: Palette.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
});
