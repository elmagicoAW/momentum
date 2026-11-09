import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { COUNT_VALUE_MAX } from '@/data/completion-storage';

type Props = {
  value: number;
  label: string;
  color: string;
  disabled: boolean;
  onAdjust: (delta: number) => void;
};

/** − / + buttons for a Count habit. 44 dp targets, plus a screen-reader "adjustable" action. */
export function CountControl({ value, label, color, disabled, onAdjust }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const canDecrease = !disabled && value > 0;
  const canIncrease = !disabled && value < COUNT_VALUE_MAX;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment' && canIncrease) onAdjust(1);
        if (e.nativeEvent.actionName === 'decrement' && canDecrease) onAdjust(-1);
      }}>
      <Pressable
        onPress={() => onAdjust(-1)}
        disabled={!canDecrease}
        hitSlop={4}
        android_ripple={{ color: Palette.rippleStrong, borderless: true }}
        style={({ pressed }) => [styles.button, !canDecrease && styles.buttonDisabled, pressed && styles.pressed]}>
        <SymbolView name={{ ios: 'minus', android: 'remove', web: 'remove' }} size={18} tintColor={Palette.text} />
      </Pressable>
      <Pressable
        onPress={() => onAdjust(1)}
        disabled={!canIncrease}
        hitSlop={4}
        android_ripple={{ color: Palette.rippleOnAccent, borderless: true }}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: `${color}33`, borderColor: `${color}66` },
          !canIncrease && styles.buttonDisabled,
          pressed && styles.pressed,
        ]}>
        <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={18} tintColor={readableAccent(color, Palette)} />
      </Pressable>
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.controlBorder,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});
