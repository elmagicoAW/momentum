"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {SymbolView, Text, NumericText} from '@/components/localized-native';
import { appLabel, appMessage, appNumber } from '@/i18n/app-copy';
import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';

import { Pressable, StyleSheet, View } from 'react-native';

import { formatRate, withAlpha } from '@/components/insights/format';
import { Radius, Spacing } from '@/constants/theme';
import { habitIconSymbol } from '@/data/habit-options';
import { formatMonthDay } from '@/i18n/presentation-date';
import { DayStatus, type HabitSummary } from '@/utils/insights';
import { describeSchedule } from '@/utils/schedule';

type Props = {
  summary: HabitSummary;
  todayKey: string;
  onPress: (id: string) => void;
};

export function streakText(summary: HabitSummary): string {
  const { current } = summary;
  return appMessage("history.streak.length", { count: (current.length), uncertainty: (current.uncertain ? '+' : '') });
}

export function HabitInsightRow({ summary, todayKey, onPress }: Props) {
  const { palette: Palette, styles, language } = useAppStyles(createStyles);
  const { habit, current, longest, last30 } = summary;
  const label = appMessage(current.uncertain ? 'history.row.accessibleUncertain' : 'history.row.accessible', {name:habit.name, schedule:describeSchedule(habit.schedule), streak:streakText(summary), best:appNumber(longest.length), rate:formatRate(last30.rate)});

  return (
    <Pressable
      onPress={() => onPress(habit.id)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={appLabel("insights.habit-insight-row.opensThisHabitSHistory")}
      android_ripple={{ color: Palette.ripple }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: withAlpha(habit.color, 0.14, Palette.accent) }]}>
          <SymbolView name={habitIconSymbol(habit.icon)} size={20} tintColor={readableAccent(habit.color, Palette)} />
        </View>
        <View style={[styles.body,{minWidth:0,flexShrink:1}]}>
          <Text style={styles.title} numberOfLines={1}>
            {habit.name}
          </Text>
          <Text style={styles.schedule} numberOfLines={1}>
            {describeSchedule(habit.schedule)}
            {summary.possibleScheduleChange ? appLabel("insights.habit-insight-row.scheduleMayHaveChanged") : ''}
          </Text>
        </View>
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={18}
          tintColor={Palette.textMuted}
        />
      </View>

      <View style={[styles.metrics,language === 'ar' && {flexWrap:'wrap'}]}>
        <Metric value={streakText(summary)} label={current.todayPending && current.length > 0 ? appLabel("insights.habit-insight-row.keepItGoingToday") : appLabel("insights.habit-insight-row.current")} />
        <Metric value={appMessage("display.uncertainCount", { count: longest.length, uncertainty: String(longest.uncertain ? '+' : '') })} label={appLabel("insights.habit-insight-row.best")} />
        <Metric value={formatRate(last30.rate)} label={appLabel("insights.habit-insight-row.30Days")} />
      </View>

      <View style={styles.dots} importantForAccessibility="no-hide-descendants">
        {summary.last7.map((d) => (
          <View key={d.dateKey} style={styles.dotWrap}>
            <View style={[styles.dot, dotStyle(d.status, readableAccent(habit.color, Palette), d.dateKey === todayKey, Palette)]} />
            <Text style={styles.dotLabel}>{formatMonthDay(d.dateKey).split(' ')[1]}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function dotStyle(status: number, color: string, isToday: boolean, Palette: AppPalette) {
  switch (status) {
    case DayStatus.DONE:
      return { backgroundColor: color, borderColor: color };
    case DayStatus.PARTIAL:
      return { backgroundColor: withAlpha(color, 0.3, Palette.accent), borderColor: withAlpha(color, 0.7, Palette.accent), borderStyle: 'dashed' as const };
    case DayStatus.MISSED:
      return { backgroundColor: Palette.ringTrack, borderColor: Palette.ringTrack };
    case DayStatus.PENDING:
    case DayStatus.UNKNOWN:
      return { borderColor: isToday ? Palette.text : Palette.danger, borderStyle: 'dashed' as const };
    case DayStatus.EXTRA:
      return { borderColor: color };
    default:
      return { borderColor: Palette.border };
  }
}

function Metric({ value, label }: { value: string; label: string }) {
  const { styles, language } = useAppStyles(createStyles);
  return (
    <View style={[styles.metric,language === 'ar' && {flexBasis:'100%',minWidth:0}]}>
      <NumericText style={[styles.metricValue,{width:'100%'}]} numberOfLines={1}>
        {value}
      </NumericText>
      <Text style={styles.metricLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  card: {
    gap: 12,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: Palette.text,
    fontSize: 16,
    fontWeight: '600',
  },
  schedule: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  metrics: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceRaised,
  },
  metricValue: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  metricLabel: {
    color: Palette.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dotWrap: {
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  dotLabel: {
    color: Palette.textMuted,
    fontSize: 10,
  },
});
