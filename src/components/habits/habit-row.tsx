"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {SymbolView, Text} from '@/components/localized-native';
import { appLabel, appMessage } from '@/i18n/app-copy';
import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';

import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { habitIconSymbol } from '@/data/habit-options';
import type { Habit } from '@/data/habit-storage';
import { describeTracking } from '@/utils/habit-progress';
import { describeSchedule } from '@/utils/schedule';

type Props = {
  habit: Habit;
  onPress: (id: string) => void;
};

export function HabitRow({ habit, onPress }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const schedule = appMessage("display.descriptionPair", { first: String(describeTracking(habit.tracking)), second: String(describeSchedule(habit.schedule)) });
  return (
    <Pressable
      onPress={() => onPress(habit.id)}
      accessibilityRole="button"
      accessibilityLabel={appMessage("display.labelValue", { label: String(habit.name), textValue: schedule })}
      accessibilityHint={appLabel("habits.habit-row.opensTheHabitEditor")}
      android_ripple={{ color: Palette.ripple }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.iconWrap, { backgroundColor: `${habit.color}22` }]}>
        <SymbolView name={habitIconSymbol(habit.icon)} size={22} tintColor={readableAccent(habit.color, Palette)} />
      </View>

      <View style={[styles.body,{minWidth:0,flexShrink:1}]}>
        <Text style={styles.title} numberOfLines={1}>
          {habit.name}
        </Text>
        {habit.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {habit.description}
          </Text>
        ) : null}
        <View style={styles.scheduleRow}>
          <View style={[styles.dot, { backgroundColor: habit.color }]} />
          <Text style={styles.schedule} numberOfLines={1}>
            {schedule}
          </Text>
        </View>
      </View>

      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={18}
        tintColor={Palette.textMuted}
      />
    </Pressable>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
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
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: Palette.text,
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    color: Palette.textSecondary,
    fontSize: 13,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  schedule: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
