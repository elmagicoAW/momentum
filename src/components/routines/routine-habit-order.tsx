import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { habitIconSymbol } from '@/data/habit-options';
import type { Habit } from '@/data/habit-storage';
import { moveId } from '@/utils/routine-list';

type Props = {
  /** Selected IDs in routine order (may include deleted habits — they're not shown). */
  habitIds: readonly string[];
  habits: readonly Habit[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

/** The routine's habits in order, with ↑ / ↓ / remove. No drag library needed. */
export function RoutineHabitOrder({ habitIds, habits, onChange, disabled = false }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const byId = new Map(habits.map((h) => [h.id, h]));
  const ordered = habitIds.filter((id) => byId.has(id));
  if (ordered.length === 0) return null;

  return (
    <View style={styles.list}>
      {ordered.map((id, index) => {
        const habit = byId.get(id)!;
        const first = index === 0;
        const last = index === ordered.length - 1;
        return (
          <View key={id} style={styles.row}>
            <Text style={styles.position}>{index + 1}</Text>
            <View style={[styles.icon, { backgroundColor: `${habit.color}22` }]}>
              <SymbolView name={habitIconSymbol(habit.icon)} size={18} tintColor={readableAccent(habit.color, Palette)} />
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {habit.name}
            </Text>
            <IconButton
              label={`Move ${habit.name} up`}
              symbol={{ ios: 'chevron.up', android: 'keyboard_arrow_up', web: 'keyboard_arrow_up' }}
              disabled={disabled || first}
              onPress={() => onChange(moveId(habitIds, id, -1))}
            />
            <IconButton
              label={`Move ${habit.name} down`}
              symbol={{ ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' }}
              disabled={disabled || last}
              onPress={() => onChange(moveId(habitIds, id, 1))}
            />
            <IconButton
              label={`Remove ${habit.name} from this routine`}
              symbol={{ ios: 'xmark', android: 'close', web: 'close' }}
              disabled={disabled}
              onPress={() => onChange(habitIds.filter((h) => h !== id))}
            />
          </View>
        );
      })}
    </View>
  );
}

export function IconButton({
  label,
  symbol,
  disabled,
  onPress,
}: {
  label: string;
  symbol: ComponentProps<typeof SymbolView>['name'];
  disabled?: boolean;
  onPress: () => void;
}) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      android_ripple={{ color: Palette.rippleMedium, borderless: true }}
      style={({ pressed }) => [styles.iconButton, disabled && styles.disabled, pressed && styles.pressed]}>
      <SymbolView name={symbol} size={20} tintColor={Palette.textSecondary} />
    </Pressable>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 56,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  position: {
    width: 18,
    color: Palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.one,
  },
  name: {
    flex: 1,
    color: Palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.3,
  },
  pressed: {
    opacity: 0.7,
  },
});
