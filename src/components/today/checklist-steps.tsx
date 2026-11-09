import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius } from '@/constants/theme';
import type { ChecklistStep } from '@/data/habit-storage';

type Props = {
  steps: ChecklistStep[];
  done: ReadonlySet<string>;
  color: string;
  disabled: boolean;
  onToggle: (stepId: string) => void;
};

/** The expanded step list inside a Checklist habit card. */
export function ChecklistSteps({ steps, done, color, disabled, onToggle }: Props) {
  return (
    <View style={styles.list}>
      {steps.map((step) => {
        const checked = done.has(step.id);
        return (
          <Pressable
            key={step.id}
            onPress={() => onToggle(step.id)}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled }}
            accessibilityLabel={step.optional ? `${step.label}, optional` : step.label}
            android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={[styles.box, checked && { backgroundColor: color, borderColor: color }]}>
              {checked && (
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={14}
                  tintColor={Palette.background}
                />
              )}
            </View>
            <Text style={[styles.label, checked && styles.labelDone]} numberOfLines={2}>
              {step.label}
            </Text>
            {step.optional && <Text style={styles.optional}>Optional</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.8,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Palette.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    color: Palette.text,
    fontSize: 15,
  },
  labelDone: {
    color: Palette.textSecondary,
    textDecorationLine: 'line-through',
  },
  optional: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
