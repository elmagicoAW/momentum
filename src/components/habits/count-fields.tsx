import { useRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';
import { UNIT_MAX_LENGTH } from '@/utils/habit-validation';

type Props = {
  target: string;
  unit: string;
  editable: boolean;
  targetError?: string;
  unitError?: string;
  onTargetChange: (text: string) => void;
  onUnitChange: (text: string) => void;
  onInputFocus?: (input: TextInputInstance | null) => void;
};

export function CountFields({
  target,
  unit,
  editable,
  targetError,
  unitError,
  onTargetChange,
  onUnitChange,
  onInputFocus,
}: Props) {
  const targetRef = useRef<TextInputInstance>(null);
  const unitRef = useRef<TextInputInstance>(null);
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.targetCol}>
          <Text style={styles.subLabel}>Daily target</Text>
          <TextInput
            value={target}
            // Digits only, so pasted text can't sneak in letters or decimals.
            onChangeText={(text) => onTargetChange(text.replace(/\D/g, '').slice(0, 4))}
            ref={targetRef}
            onFocus={() => onInputFocus?.(targetRef.current)}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={4}
            returnKeyType="done"
            editable={editable}
            placeholder="8"
            placeholderTextColor={Palette.textMuted}
            accessibilityLabel="Daily target"
            style={[styles.input, styles.targetInput, targetError && styles.inputError]}
          />
        </View>
        <View style={styles.unitCol}>
          <Text style={styles.subLabel}>Unit · optional</Text>
          <TextInput
            value={unit}
            onChangeText={onUnitChange}
            ref={unitRef}
            onFocus={() => onInputFocus?.(unitRef.current)}
            maxLength={UNIT_MAX_LENGTH}
            autoCapitalize="none"
            returnKeyType="done"
            editable={editable}
            placeholder="glasses, pages, min"
            placeholderTextColor={Palette.textMuted}
            accessibilityLabel="Unit"
            style={[styles.input, unitError && styles.inputError]}
          />
        </View>
      </View>
      {(targetError || unitError) && (
        <Text style={styles.error} accessibilityRole="alert">
          {targetError ?? unitError}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  targetCol: {
    width: 110,
    gap: 6,
  },
  unitCol: {
    flex: 1,
    gap: 6,
  },
  subLabel: {
    color: Palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    color: Palette.text,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  targetInput: {
    fontWeight: '700',
    textAlign: 'center',
  },
  inputError: {
    borderColor: Palette.danger,
  },
  error: {
    color: Palette.danger,
    fontSize: 13,
  },
});
