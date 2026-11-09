import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { addMonths, formatMonthYear, parseLocalDateKey, toLocalDateKey } from '@/utils/date';
import { WEEKDAY_DISPLAY_ORDER, WEEKDAY_LONG, WEEKDAY_SHORT } from '@/utils/schedule';

type Props = {
  /** Selected "YYYY-MM-DD", or null. */
  value: string | null;
  onChange: (dateKey: string) => void;
  /** Earliest selectable "YYYY-MM-DD" (inclusive). */
  minDate: string;
  todayKey: string;
  disabled?: boolean;
};

const PRESETS = [
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
] as const;

/** Dependency-free calendar: quick presets plus a Monday-first month grid. */
export function DatePicker({ value, onChange, minDate, todayKey, disabled }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const today = parseLocalDateKey(todayKey);
  const initial = value ? parseLocalDateKey(value) : addMonths(today, 1);
  const [month, setMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));

  const minMonth = (() => {
    const min = parseLocalDateKey(minDate);
    return new Date(min.getFullYear(), min.getMonth(), 1);
  })();
  const canGoBack = month > minMonth;

  const pick = (key: string) => {
    if (disabled || key < minDate) return;
    onChange(key);
  };

  const pickPreset = (months: number) => {
    const date = addMonths(today, months);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    pick(toLocalDateKey(date));
  };

  // Grid cells: leading blanks (Monday-first), then each day of the month.
  const leading = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toLocalDateKey(new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ),
  ];

  return (
    <View style={styles.container}>
      <View style={styles.presets}>
        {PRESETS.map((preset) => {
          const key = toLocalDateKey(addMonths(today, preset.months));
          const selected = key === value;
          return (
            <Pressable
              key={preset.label}
              onPress={() => pickPreset(preset.months)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={`Target in ${preset.label}`}
              style={({ pressed }) => [styles.preset, selected && styles.presetSelected, pressed && styles.pressed]}>
              <Text style={[styles.presetText, selected && styles.presetTextSelected]}>{preset.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.calendar}>
        <View style={styles.monthRow}>
          <Pressable
            onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            disabled={!canGoBack || disabled}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            accessibilityState={{ disabled: !canGoBack || disabled }}
            hitSlop={6}
            style={({ pressed }) => [styles.navButton, !canGoBack && styles.navDisabled, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
              size={18}
              tintColor={Palette.textSecondary}
            />
          </Pressable>
          <Text style={styles.monthLabel} accessibilityRole="header">
            {formatMonthYear(month)}
          </Text>
          <Pressable
            onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            hitSlop={6}
            style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={18}
              tintColor={Palette.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.grid}>
          {WEEKDAY_DISPLAY_ORDER.map((d) => (
            <View key={d} style={styles.cell}>
              <Text style={styles.weekday}>{WEEKDAY_SHORT[d].charAt(0)}</Text>
            </View>
          ))}
          {cells.map((key, index) => {
            if (!key) return <View key={`blank-${index}`} style={styles.cell} />;
            const date = parseLocalDateKey(key);
            const selected = key === value;
            const unavailable = key < minDate;
            const isToday = key === todayKey;
            return (
              <View key={key} style={styles.cell}>
                <Pressable
                  onPress={() => pick(key)}
                  disabled={unavailable || disabled}
                  accessibilityRole="button"
                  accessibilityLabel={`${WEEKDAY_LONG[date.getDay()]}, ${formatMonthYear(date)} ${date.getDate()}`}
                  accessibilityState={{ selected, disabled: unavailable || disabled }}
                  style={({ pressed }) => [
                    styles.day,
                    isToday && styles.today,
                    selected && styles.daySelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.dayText,
                      unavailable && styles.dayUnavailable,
                      selected && styles.dayTextSelected,
                    ]}>
                    {date.getDate()}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  container: {
    gap: 12,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preset: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetSelected: {
    borderColor: Palette.accent,
    backgroundColor: Palette.accentSoft,
  },
  presetText: {
    color: Palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  presetTextSelected: {
    color: Palette.accent,
  },
  calendar: {
    padding: Spacing.three,
    paddingTop: 12,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.two,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthLabel: {
    color: Palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDisabled: {
    opacity: 0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  day: {
    width: '100%',
    height: '100%',
    maxWidth: 44,
    maxHeight: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: {
    borderWidth: 1,
    borderColor: Palette.controlBorder,
  },
  daySelected: {
    backgroundColor: Palette.accent,
    borderColor: Palette.accent,
  },
  dayText: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '500',
  },
  dayUnavailable: {
    color: Palette.textMuted,
    opacity: 0.5,
  },
  dayTextSelected: {
    color: Palette.onAccent,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
