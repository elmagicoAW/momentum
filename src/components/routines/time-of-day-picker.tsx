"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {Text} from '@/components/localized-native';
import { appMessage } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { TIME_OF_DAY_VALUES, type TimeOfDay } from '@/data/routine-storage';
import { TIME_OF_DAY_HINTS, TIME_OF_DAY_LABELS } from '@/utils/routine-progress';

type Props = {
  value: TimeOfDay;
  onChange: (value: TimeOfDay) => void;
  disabled?: boolean;
};

/** 2×2 choice of preferred time. Only used for ordering and the "Now" highlight. */
export function TimeOfDayPicker({ value, onChange, disabled = false }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {TIME_OF_DAY_VALUES.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityLabel={appMessage("display.labelValue", { label: String(TIME_OF_DAY_LABELS[option]), textValue: TIME_OF_DAY_HINTS[option] })}
            android_ripple={{ color: Palette.ripple }}
            style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}>
            <Text style={[styles.label, selected && styles.labelSelected]}>{TIME_OF_DAY_LABELS[option]}</Text>
            <Text style={styles.hint} numberOfLines={1}>
              {TIME_OF_DAY_HINTS[option]}
            </Text>
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
  option: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 2,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.controlBorder,
    overflow: 'hidden',
  },
  selected: {
    backgroundColor: Palette.accentSoft,
    borderColor: Palette.accent,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  labelSelected: {
    color: Palette.accent,
  },
  hint: {
    color: Palette.textMuted,
    fontSize: 12,
  },
});
