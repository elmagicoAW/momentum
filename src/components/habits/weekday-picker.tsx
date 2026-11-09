import type { AppPalette } from '@/constants/palettes';
import { foregroundOnColor } from '@/utils/theme-color';
import { useAppStyles } from '@/hooks/use-app-styles';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import type { Weekday } from '@/data/habit-storage';
import { WEEKDAY_DISPLAY_ORDER, WEEKDAY_LONG, WEEKDAY_SHORT } from '@/utils/schedule';

type Props = {
  kind: 'daily' | 'weekdays';
  days: Weekday[];
  color: string;
  onKindChange: (kind: 'daily' | 'weekdays') => void;
  onDaysChange: (days: Weekday[]) => void;
};

const KINDS = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Specific days' },
] as const;

export function WeekdayPicker({ kind, days, color, onKindChange, onDaysChange }: Props) {
  const { styles } = useAppStyles(createStyles);
  const toggleDay = (day: Weekday) => {
    onDaysChange(days.includes(day) ? days.filter((d) => d !== day) : [...days, day]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.segmented} accessibilityRole="radiogroup">
        {KINDS.map((option) => {
          const selected = option.value === kind;
          return (
            <Pressable
              key={option.value}
              onPress={() => onKindChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.segment, selected && styles.segmentSelected]}>
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {kind === 'weekdays' && (
        <View style={styles.days}>
          {WEEKDAY_DISPLAY_ORDER.map((day) => {
            const selected = days.includes(day);
            return (
              <Pressable
                key={day}
                onPress={() => toggleDay(day)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={WEEKDAY_LONG[day]}
                hitSlop={2}
                style={({ pressed }) => [
                  styles.day,
                  selected && { backgroundColor: color, borderColor: color },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.dayText, selected && styles.dayTextSelected, selected && { color: foregroundOnColor(color) }]}>
                  {WEEKDAY_SHORT[day].charAt(0)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.controlBorder,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: Palette.accentSoft,
  },
  segmentText: {
    color: Palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextSelected: {
    color: Palette.text,
  },
  days: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  day: {
    flex: 1,
    maxWidth: 44,
    aspectRatio: 1,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Palette.controlBorder,
    backgroundColor: Palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    color: Palette.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: Palette.onAccent,
  },
  pressed: {
    opacity: 0.75,
  },
});
