"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import { useArabicComposition } from '@/hooks/use-arabic-composition';
import {SymbolView, Text, TextInput} from '@/components/localized-native';
import { appLabel, appMessage, displayError } from '@/i18n/app-copy';
import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance, type TextInputInstance, type ViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChecklistEditor } from '@/components/habits/checklist-editor';
import { ColorPicker } from '@/components/habits/color-picker';
import { CountFields } from '@/components/habits/count-fields';
import { IconPicker } from '@/components/habits/icon-picker';
import { TrackingTypePicker } from '@/components/habits/tracking-type-picker';
import { WeekdayPicker } from '@/components/habits/weekday-picker';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { habitIconSymbol } from '@/data/habit-options';
import { createStepId, type HabitInput, type TrackingType } from '@/data/habit-storage';
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
  /**
   * Resolves when saved; throw to keep the form open and show an error.
   * Resolve `false` when the user cancelled (e.g. a confirmation) — the form stays open, no error.
   */
  onSubmit: (input: HabitInput) => Promise<boolean | void>;
  onCancel: () => void;
  /** Edit mode only. Resolves true when deleted, false when the user cancelled. */
  onDelete?: () => Promise<boolean>;
};

type Busy = 'idle' | 'saving' | 'deleting' | 'done';

function errorMessage(error: unknown, fallback: string) {
  return displayError(error, fallback);
}

export function HabitForm({ title, initialDraft, submitLabel, onSubmit, onCancel, onDelete }: Props) {
  const arabic = useArabicComposition();
  const { palette: Palette, styles, scheme } = useAppStyles(createStyles);
  const [draft, setDraft] = useState<HabitDraft>(initialDraft);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<Busy>('idle');
  const [failure, setFailure] = useState<string | null>(null);

  const errors = validateHabitDraft(draft);
  const visibleErrors = showErrors ? errors : {};
  const locked = busy !== 'idle';

  const update = <K extends keyof HabitDraft>(key: K, value: HabitDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const changeTrackingType = (trackingType: TrackingType) =>
    setDraft((d) => ({
      ...d,
      trackingType,
      // Start a new checklist with one empty step to type into.
      steps:
        trackingType === 'checklist' && d.steps.length === 0
          ? [{ id: createStepId([]), label: '', optional: false }]
          : d.steps,
    }));

  // Android: keep a focused tracking input above the keyboard. KeyboardAvoidingView
  // shrinks the scroll area; this scrolls the field into the visible part.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const contentRef = useRef<ViewInstance>(null);
  const revealInput = useCallback((input: TextInputInstance | null) => {
    setTimeout(() => {
      const content = contentRef.current;
      if (!input || !content) return;
      input.measureLayout(
        content,
        (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true }),
        () => undefined,
      );
    }, 300); // after the keyboard has opened and the layout has adjusted
  }, []);

  const handleSubmit = async () => {
    if (locked) return;
    if (hasErrors(errors)) {
      setShowErrors(true);
      return;
    }
    setBusy('saving');
    setFailure(null);
    try {
      const saved = await onSubmit(draftToInput(draft));
      setBusy(saved === false ? 'idle' : 'done'); // 'done' stays locked while the screen closes
    } catch (error) {
      console.warn('[momentum] Failed to save habit', error);
      setFailure(errorMessage(error, appLabel("habits.habit-form.couldnTSaveThisHabitYourChangesAreStillHereTryAgain")));
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
      setFailure(errorMessage(error, appLabel("habits.habit-form.couldnTDeleteThisHabitNothingWasRemovedTryAgain")));
      setBusy('idle');
    }
  };

  return (
    <View style={[styles.screen,arabic.active && arabic.surface]}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onCancel}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel={appLabel("habits.habit-form.cancel")}
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
            android_ripple={{ color: Palette.rippleStrong }}
            style={({ pressed }) => [styles.saveButton, locked && styles.saveDisabled, pressed && styles.pressed]}>
            {busy === 'saving' ? (
              <ActivityIndicator size="small" color={Palette.onAccent} />
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
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}>
            <View ref={contentRef} style={styles.contentInner}>
              {/* Preview */}
              <View style={styles.preview}>
                <View style={[styles.previewIcon, { backgroundColor: `${draft.color}22` }]}>
                  <SymbolView name={habitIconSymbol(draft.icon)} size={28} tintColor={readableAccent(draft.color, Palette)} />
                </View>
                <Text style={styles.previewName} numberOfLines={1}>
                  {draft.name.trim() || appLabel("habits.habit-form.newHabit")}
                </Text>
              </View>

              <Field label={appLabel("habits.habit-form.name")} error={visibleErrors.name} counter={appMessage("display.ratio", { value: draft.name.length, maximum: NAME_MAX_LENGTH })}>
                <TextInput
                  selectionColor={Palette.accent}
                  keyboardAppearance={scheme}
                  value={draft.name}
                  onChangeText={(text) => update('name', text)}
                  placeholder={appLabel("habits.habit-form.eGMorningWalk")}
                  placeholderTextColor={Palette.textMuted}
                  maxLength={NAME_MAX_LENGTH}
                  autoCapitalize="sentences"
                  returnKeyType="done"
                  editable={!locked}
                  accessibilityLabel={appLabel("habits.habit-form.habitName")}
                  style={[styles.input, visibleErrors.name && styles.inputError]}
                />
              </Field>

              <Field
                label={appLabel("habits.habit-form.description")}
                optional
                error={visibleErrors.description}
                counter={appMessage("display.ratio", { value: draft.description.length, maximum: DESCRIPTION_MAX_LENGTH })}>
                <TextInput
                  selectionColor={Palette.accent}
                  keyboardAppearance={scheme}
                  value={draft.description}
                  onChangeText={(text) => update('description', text)}
                  placeholder={appLabel("habits.habit-form.whenWhereOrHowMuch")}
                  placeholderTextColor={Palette.textMuted}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  multiline
                  textAlignVertical="top"
                  editable={!locked}
                  accessibilityLabel={appLabel("habits.habit-form.habitDescription")}
                  style={[styles.input, styles.multiline, visibleErrors.description && styles.inputError]}
                />
              </Field>

              <Field label={appLabel("habits.habit-form.tracking")}>
                <TrackingTypePicker value={draft.trackingType} disabled={locked} onChange={changeTrackingType} />
                {draft.trackingType === 'count' && (
                  <CountFields
                    target={draft.countTarget}
                    unit={draft.countUnit}
                    editable={!locked}
                    targetError={visibleErrors.countTarget}
                    unitError={visibleErrors.countUnit}
                    onTargetChange={(text) => update('countTarget', text)}
                    onUnitChange={(text) => update('countUnit', text)}
                    onInputFocus={revealInput}
                  />
                )}
                {draft.trackingType === 'checklist' && (
                  <ChecklistEditor
                    steps={draft.steps}
                    color={draft.color}
                    editable={!locked}
                    error={visibleErrors.steps}
                    onChange={(steps) => update('steps', steps)}
                    onInputFocus={revealInput}
                  />
                )}
              </Field>

              <Field label={appLabel("habits.habit-form.schedule")} error={visibleErrors.schedule}>
                <WeekdayPicker
                  kind={draft.scheduleKind}
                  days={draft.days}
                  color={draft.color}
                  onKindChange={(kind) => update('scheduleKind', kind)}
                  onDaysChange={(days) => update('days', days)}
                />
              </Field>

              <Field label={appLabel("habits.habit-form.icon")}>
                <IconPicker value={draft.icon} color={draft.color} onChange={(icon) => update('icon', icon)} />
              </Field>

              <Field label={appLabel("habits.habit-form.color")}>
                <ColorPicker value={draft.color} onChange={(color) => update('color', color)} />
              </Field>

              {onDelete && (
                <Pressable
                  onPress={handleDelete}
                  disabled={locked}
                  accessibilityRole="button"
                  android_ripple={{ color: Palette.rippleDanger }}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                  {busy === 'deleting' ? (
                    <ActivityIndicator size="small" color={Palette.danger} />
                  ) : (
                    <Text style={styles.deleteText}>{appLabel("habits.habit-form.deleteHabit")}</Text>
                  )}
                </Pressable>
              )}
            </View>
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
  const { styles } = useAppStyles(createStyles);
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.label}>
          {label}
          {optional && <Text style={styles.optional}> {appLabel("habits.habit-form.optional")}</Text>}
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

const createStyles = (Palette: AppPalette) => StyleSheet.create({
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
    borderColor: Palette.controlBorder,
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
    color: Palette.onAccent,
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
    borderColor: Palette.dangerBorder,
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
  },
  contentInner: {
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
    borderColor: Palette.controlBorder,
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
    borderColor: Palette.dangerBorder,
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
