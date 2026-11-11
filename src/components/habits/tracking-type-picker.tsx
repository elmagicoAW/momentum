"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {Text} from '@/components/localized-native';
import { appLabel } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import type { TrackingType } from '@/data/habit-storage';

const OPTIONS: { value: TrackingType; label: string; hint: string }[] = [
  { value: 'tick', get label(){return appLabel("habits.tracking-type-picker.tick");}, get hint(){return appLabel("habits.tracking-type-picker.doneOrNotDone");} },
  { value: 'count', get label(){return appLabel("habits.tracking-type-picker.count");}, get hint(){return appLabel("habits.tracking-type-picker.reachADailyTarget");} },
  { value: 'checklist', get label(){return appLabel("habits.tracking-type-picker.checklist");}, get hint(){return appLabel("habits.tracking-type-picker.completeASetOfSteps");} },
];

type Props = {
  value: TrackingType;
  disabled?: boolean;
  onChange: (value: TrackingType) => void;
};

export function TrackingTypePicker({ value, disabled = false, onChange }: Props) {
  const { styles } = useAppStyles(createStyles);
  const hint = OPTIONS.find((o) => o.value === value)?.hint;
  return (
    <View style={styles.container}>
      <View style={styles.segmented} accessibilityRole="radiogroup">
        {OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityHint={option.hint}
              style={[styles.segment, selected && styles.segmentSelected]}>
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  container: {
    gap: 8,
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
  hint: {
    color: Palette.textMuted,
    fontSize: 13,
  },
});
