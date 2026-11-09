import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ColorPicker } from '@/components/habits/color-picker';
import { IconPicker } from '@/components/habits/icon-picker';
import { WeekdayPicker } from '@/components/habits/weekday-picker';
import { BottomTabInset, MaxContentWidth, Palette, Radius, Spacing } from '@/constants/theme';
import { habitIconSymbol } from '@/data/habit-options';
import type { HabitInput } from '@/data/habit-storage';
import {
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  draftToInput,
  hasErrors,
  validateHabitDraft,
  type HabitDraft,
} from '@/utils/habit-validation';

type Props = {
  title: string;
  initialDraft: HabitDraft;
  submitLabel: string;
  /** Resolves when saved; throw to keep the form open and show an error. */
  onSubmit: (input: HabitInput) => Promise<void>;
  onCancel: () => void;
  /** Edit mode only. Resolves true when deleted, false when the user cancelled. */
  onDelete?: () => Promise<boolean>;
};

type Busy = 'idle' | 'saving' | 'deleting' | 'done';

function errorMessage(error: unknown, fallback: string) {
  const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
  return `${fallback}${detail}`;
}

export function HabitForm({ title, initialDraft, submitLabel, onSubmit, onCancel, onDelete }: Props) {
  const [draft, setDraft] = useState<HabitDraft>(initialDraft);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<Busy>('idle');
  const [failure, setFailure] = useState<string | null>(null);

  const errors = validateHabitDraft(draft);
  const visibleErrors = showErrors ? errors : {};
  const locked = busy !== 'idle';

  const update = <K extends keyof HabitDraft>(key: K, value: HabitDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleSubmit = async () => {
    if (locked) return;
    if (hasErrors(errors)) {
      setShowErrors(true);
      return;
    }
    setBusy('saving');
    setFailure(null);
    try {
      await onSubmit(draftToInput(draft));
      setBusy('done'); // stays locked while the screen closes
    } catch (error) {
      console.warn('[momentum] Failed to save habit', error);
      setFailure(errorMessage(error, "Couldn't save this habit. Your changes are still here — try again."));
      setBusy('idle');
    }
  };

  const handleDelete = async () => {
    if (locked || !onDelete) return;
    setBusy('deleting');
    setFailure(null);
    try {
      const deleted = await onDelete();
      setBusy(deleted ? 'done' : 'idle');
    } catch (error) {
      console.warn('[momentum] Failed to delete habit', error);
      setFailure(errorMessage(error, "Couldn't delete this habit. Nothing was removed — try again."));
      setBusy('idle');
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onCancel}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={20}
              tintColor={Palette.textSecondary}
            />
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            {title}
          </Text>
          <Pressable
            onPress={handleSubmit}
            disabled={locked}
            accessibilityRole="button"
            accessibilityState={{ disabled: locked, busy: busy === 'saving' }}
            android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
            style={({ pressed }) => [styles.saveButton, locked && styles.saveDisabled, pressed && styles.pressed]}>
            {busy === 'saving' ? (
              <ActivityIndicator size="small" color={Palette.background} />
            ) : (
              <Text style={styles.saveText}>{submitLabel}</Text>
            )}
          </Pressable>
        </View>

        {failure && (
          <View style={styles.failure} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Text style={styles.failureText}>{failure}</Text>
          </View>
        )}

        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}>
            {/* Preview */}
            <View style={styles.preview}>
              <View style={[styles.previewIcon, { backgroundColor: `${draft.color}22` }]}>
                <SymbolView name={habitIconSymbol(draft.icon)} size={28} tintColor={draft.color} />
              </View>
              <Text style={styles.previewName} numberOfLines={1}>
                {draft.name.trim() || 'New habit'}
              </Text>
            </View>

            <Field label="Name" error={visibleErrors.name} counter={`${draft.name.length}/${NAME_MAX_LENGTH}`}>
              <TextInput
                value={draft.name}
                onChangeText={(text) => update('name', text)}
                placeholder="e.g. Morning walk"
                placeholderTextColor={Palette.textMuted}
                maxLength={NAME_MAX_LENGTH}
                autoCapitalize="sentences"
                returnKeyType="done"
                editable={!locked}
                accessibilityLabel="Habit name"
                style={[styles.input, visibleErrors.name && styles.inputError]}
              />
            </Field>

            <Field
              label="Description"
              optional
              error={visibleErrors.description}
              counter={`${draft.description.length}/${DESCRIPTION_MAX_LENGTH}`}>
              <TextInput
                value={draft.description}
                onChangeText={(text) => update('description', text)}
                placeholder="When, where or how much"
                placeholderTextColor={Palette.textMuted}
                maxLength={DESCRIPTION_MAX_LENGTH}
                multiline
                textAlignVertical="top"
                editable={!locked}
                accessibilityLabel="Habit description"
                style={[styles.input, styles.multiline, visibleErrors.description && styles.inputError]}
              />
            </Field>

            <Field label="Schedule" error={visibleErrors.schedule}>
              <WeekdayPicker
                kind={draft.scheduleKind}
                days={draft.days}
                color={draft.color}
                onKindChange={(kind) => update('scheduleKind', kind)}
                onDaysChange={(days) => update('days', days)}
              />
            </Field>

            <Field label="Icon">
              <IconPicker value={draft.icon} color={draft.color} onChange={(icon) => update('icon', icon)} />
            </Field>

            <Field label="Color">
              <ColorPicker value={draft.color} onChange={(color) => update('color', color)} />
            </Field>

            {onDelete && (
              <Pressable
                onPress={handleDelete}
                disabled={locked}
                accessibilityRole="button"
                android_ripple={{ color: 'rgba(248,113,113,0.15)' }}
                style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                {busy === 'deleting' ? (
                  <ActivityIndicator size="small" color={Palette.danger} />
                ) : (
                  <Text style={styles.deleteText}>Delete habit</Text>
                )}
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field({
  label,
  optional,
  error,
  counter,
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string;
  counter?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.label}>
          {label}
          {optional && <Text style={styles.optional}> · optional</Text>}
        </Text>
        {counter && <Text style={styles.counter}>{counter}</Text>}
      </View>
      {children}
      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: 20,
    paddingVertical: Spacing.three,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: Palette.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  saveButton: {
    minWidth: 76,
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: Palette.background,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
  failure: {
    marginHorizontal: 20,
    marginBottom: Spacing.two,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Palette.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  failureText: {
    color: Palette.text,
    fontSize: 13,
    lineHeight: 18,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.four,
  },
  preview: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  previewIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: {
    color: Palette.text,
    fontSize: 18,
    fontWeight: '700',
    maxWidth: '90%',
  },
  field: {
    gap: 10,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  label: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  optional: {
    textTransform: 'none',
    letterSpacing: 0,
    fontWeight: '500',
  },
  counter: {
    color: Palette.textMuted,
    fontSize: 12,
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
  multiline: {
    minHeight: 88,
  },
  inputError: {
    borderColor: Palette.danger,
  },
  error: {
    color: Palette.danger,
    fontSize: 13,
  },
  deleteButton: {
    marginTop: Spacing.two,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    backgroundColor: Palette.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  deleteText: {
    color: Palette.danger,
    fontSize: 15,
    fontWeight: '700',
  },
});
