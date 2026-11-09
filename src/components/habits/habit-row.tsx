import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';
import { habitIconSymbol } from '@/data/habit-options';
import type { Habit } from '@/data/habit-storage';
import { describeSchedule } from '@/utils/schedule';

type Props = {
  habit: Habit;
  onPress: (id: string) => void;
};

export function HabitRow({ habit, onPress }: Props) {
  const schedule = describeSchedule(habit.schedule);
  return (
    <Pressable
      onPress={() => onPress(habit.id)}
      accessibilityRole="button"
      accessibilityLabel={`${habit.name}, ${schedule}`}
      accessibilityHint="Opens the habit editor"
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.iconWrap, { backgroundColor: `${habit.color}22` }]}>
        <SymbolView name={habitIconSymbol(habit.icon)} size={22} tintColor={habit.color} />
      </View>

      <View style={styles.body}>
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

const styles = StyleSheet.create({
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
