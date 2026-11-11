"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {SymbolView, Text, TextInput} from '@/components/localized-native';
import { appLabel, appMessage } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';

import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type TextInputInstance } from 'react-native';

import { Radius } from '@/constants/theme';
import { CHECKLIST_MAX_STEPS, createStepId } from '@/data/habit-storage';
import { STEP_LABEL_MAX_LENGTH, type StepDraft } from '@/utils/habit-validation';

type Props = {
  steps: StepDraft[];
  color: string;
  editable: boolean;
  error?: string;
  onChange: (steps: StepDraft[]) => void;
  onInputFocus?: (input: TextInputInstance | null) => void;
};

/**
 * Edits checklist steps. Step IDs are generated once and kept when a step is
 * renamed, so today's progress on a renamed step is preserved.
 */
export function ChecklistEditor({ steps, color, editable, error, onChange, onInputFocus }: Props) {
  const { palette: Palette, styles, scheme } = useAppStyles(createStyles);
  const inputs = useRef(new Map<string, TextInputInstance>());
  const pendingFocus = useRef<string | null>(null);
  const canAdd = editable && steps.length < CHECKLIST_MAX_STEPS;

  // Focus a step that was just added, once it has rendered.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    inputs.current.get(id)?.focus();
  }, [steps]);

  const addStep = () => {
    if (!canAdd) return;
    const id = createStepId(steps.map((s) => s.id));
    pendingFocus.current = id;
    onChange([...steps, { id, label: '', optional: false }]);
  };

  const updateStep = (id: string, patch: Partial<StepDraft>) =>
    onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const removeStep = (id: string) => onChange(steps.filter((s) => s.id !== id));

  const handleSubmit = (index: number) => {
    const next = steps[index + 1];
    if (next) inputs.current.get(next.id)?.focus();
    else if (steps[index].label.trim()) addStep();
  };

  return (
    <View style={styles.container}>
      {steps.map((step, index) => (
        <View key={step.id} style={styles.row}>
          <View style={[styles.bullet, { borderColor: step.optional ? Palette.textMuted : color }]} />
          <TextInput
            selectionColor={Palette.accent}
            keyboardAppearance={scheme}
            ref={(node) => {
              if (node) inputs.current.set(step.id, node);
              else inputs.current.delete(step.id);
            }}
            value={step.label}
            onChangeText={(label) => updateStep(step.id, { label })}
            onFocus={() => onInputFocus?.(inputs.current.get(step.id) ?? null)}
            onSubmitEditing={() => handleSubmit(index)}
            submitBehavior="submit"
            returnKeyType={index === steps.length - 1 && steps.length < CHECKLIST_MAX_STEPS ? 'next' : 'done'}
            placeholder={appMessage("habits.step.placeholder", { position: (index + 1) })}
            placeholderTextColor={Palette.textMuted}
            maxLength={STEP_LABEL_MAX_LENGTH}
            autoCapitalize="sentences"
            editable={editable}
            accessibilityLabel={appMessage("habits.step.nameAccessibility", { position: (index + 1) })}
            style={styles.input}
          />
          <Pressable
            onPress={() => updateStep(step.id, { optional: !step.optional })}
            disabled={!editable}
            accessibilityRole="switch"
            accessibilityState={{ checked: !step.optional, disabled: !editable }}
            accessibilityLabel={appMessage("habits.step.requiredAccessibility", { position: (index + 1) })}
            hitSlop={6}
            style={({ pressed }) => [styles.chip, !step.optional && styles.chipOn, pressed && styles.pressed]}>
            <Text style={[styles.chipText, !step.optional && styles.chipTextOn]}>
              {step.optional ? appLabel("habits.checklist-editor.optional") : appLabel("habits.checklist-editor.required")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => removeStep(step.id)}
            disabled={!editable}
            accessibilityRole="button"
            accessibilityLabel={appMessage("habits.step.removeAccessibility", { position: (index + 1) })}
            hitSlop={8}
            style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={16}
              tintColor={Palette.textSecondary}
            />
          </Pressable>
        </View>
      ))}

      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <Pressable
        onPress={addStep}
        disabled={!canAdd}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canAdd }}
        android_ripple={{ color: Palette.rippleSubtle }}
        style={({ pressed }) => [styles.addButton, !canAdd && styles.disabled, pressed && styles.pressed]}>
        <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={16} tintColor={Palette.accent} />
        <Text style={styles.addText}>
          {steps.length >= CHECKLIST_MAX_STEPS ? appMessage("habits.steps.limit", { limit: (CHECKLIST_MAX_STEPS) }) : appLabel("habits.checklist-editor.addStep")}
        </Text>
      </Pressable>
      <Text style={styles.hint}>
        {appLabel("habits.checklist-editor.theHabitIsDoneWhenEveryRequiredStepIsCheckedOptionalStepsDonTAffectCompletion")}</Text>
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  container: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bullet: {
    width: 14,
    height: 14,
    borderRadius: 5,
    borderWidth: 2,
  },
  input: {
    flex: 1,
    color: Palette.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.controlBorder,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surfaceRaised,
  },
  chipOn: {
    borderColor: Palette.accentBorderStrong,
    backgroundColor: Palette.accentSoft,
  },
  chipText: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextOn: {
    color: Palette.text,
  },
  remove: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surfaceRaised,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Palette.controlBorder,
    overflow: 'hidden',
  },
  addText: {
    color: Palette.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.75,
  },
  hint: {
    color: Palette.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    color: Palette.danger,
    fontSize: 13,
  },
});
