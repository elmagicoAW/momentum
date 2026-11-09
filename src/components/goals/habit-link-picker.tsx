import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';
import { habitIconSymbol } from '@/data/habit-options';
import type { Habit } from '@/data/habit-storage';
import { describeSchedule } from '@/utils/schedule';

type Props = {
  habits: readonly Habit[];
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
  /** Shown when there are no habits yet. */
  onCreateHabit: () => void;
  disabled?: boolean;
  /** Shown when there are no habits yet. Defaults to the Goals wording. */
  emptyText?: string;
};

const DEFAULT_EMPTY_TEXT =
  'You don’t have any habits yet. Goals can be saved without habits, but Habit Consistency needs at least one linked habit.';

/** Multi-select list of existing habits. Selection order is kept. */
export function HabitLinkPicker({ habits, selectedIds, onChange, onCreateHabit, disabled, emptyText }: Props) {
  if (habits.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyText ?? DEFAULT_EMPTY_TEXT}</Text>
        <Pressable
          onPress={onCreateHabit}
          disabled={disabled}
          accessibilityRole="button"
          style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}>
          <Text style={styles.emptyButtonText}>Create a habit</Text>
        </Pressable>
      </View>
    );
  }

  const selected = new Set(selectedIds);
  const toggle = (id: string) => {
    if (disabled) return;
    onChange(selected.has(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]);
  };

  return (
    <View style={styles.list}>
      {habits.map((habit) => {
        const isOn = selected.has(habit.id);
        const schedule = describeSchedule(habit.schedule);
        return (
          <Pressable
            key={habit.id}
            onPress={() => toggle(habit.id)}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isOn, disabled }}
            accessibilityLabel={`${habit.name}, ${schedule}`}
            android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
            style={({ pressed }) => [
              styles.row,
              isOn && { borderColor: habit.color, backgroundColor: `${habit.color}14` },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.icon, { backgroundColor: `${habit.color}22` }]}>
              <SymbolView name={habitIconSymbol(habit.icon)} size={20} tintColor={habit.color} />
            </View>
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>
                {habit.name}
              </Text>
              <Text style={styles.schedule} numberOfLines={1}>
                {schedule}
              </Text>
            </View>
            <View style={[styles.check, isOn && { backgroundColor: habit.color, borderColor: habit.color }]}>
              {isOn && (
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={14}
                  tintColor={Palette.background}
                />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    overflow: 'hidden',
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  schedule: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Palette.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  empty: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: 12,
  },
  emptyText: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accentSoft,
    justifyContent: 'center',
  },
  emptyButtonText: {
    color: Palette.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
