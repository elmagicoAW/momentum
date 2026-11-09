import { foregroundOnColor } from '@/utils/theme-color';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { HABIT_COLORS } from '@/data/habit-options';

type Props = {
  value: string;
  onChange: (color: string) => void;
};

export function ColorPicker({ value, onChange }: Props) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {HABIT_COLORS.map(({ value: color, label }) => {
        const selected = color === value;
        return (
          <Pressable
            key={color}
            onPress={() => onChange(color)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            hitSlop={4}
            style={({ pressed }) => [
              styles.ring,
              selected && { borderColor: color },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.swatch, { backgroundColor: color }]}>
              {selected && (
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={16}
                  tintColor={foregroundOnColor(color)}
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ring: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
