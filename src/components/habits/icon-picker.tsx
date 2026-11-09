import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { HABIT_ICON_KEYS, HABIT_ICONS } from '@/data/habit-options';

type Props = {
  value: string;
  color: string;
  onChange: (icon: string) => void;
};

export function IconPicker({ value, color, onChange }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {HABIT_ICON_KEYS.map((key) => {
        const selected = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={HABIT_ICONS[key].label}
            hitSlop={4}
            style={({ pressed }) => [
              styles.cell,
              selected && { borderColor: color, backgroundColor: `${color}22` },
              pressed && styles.pressed,
            ]}>
            <SymbolView
              name={HABIT_ICONS[key].symbol}
              size={22}
              tintColor={readableAccent(selected ? color : Palette.textSecondary, Palette)}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm + 4,
    borderWidth: 1.5,
    borderColor: Palette.controlBorder,
    backgroundColor: Palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
