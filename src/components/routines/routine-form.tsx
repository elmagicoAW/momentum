"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import { useArabicComposition } from '@/hooks/use-arabic-composition';
import {SymbolView, Text, TextInput} from '@/components/localized-native';
import { appLabel, appMessage, displayError } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { router } from 'expo-router';

import { useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HabitLinkPicker } from '@/components/goals/habit-link-picker';
import { ColorPicker } from '@/components/habits/color-picker';
import { IconPicker } from '@/components/habits/icon-picker';
import { RoutineIcon } from '@/components/routines/routine-badges';
import { RoutineHabitOrder } from '@/components/routines/routine-habit-order';
import { TimeOfDayPicker } from '@/components/routines/time-of-day-picker';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  MAX_HABITS_PER_ROUTINE,
  ROUTINE_DESCRIPTION_MAX_LENGTH,
  ROUTINE_TITLE_MAX_LENGTH,
  type RoutineInput,
} from '@/data/routine-storage';
import { useHabits } from '@/hooks/use-habits';
import {
  hasRoutineErrors,
  routineDraftToInput,
  validateRoutineDraft,
  type RoutineDraft,
} from '@/utils/routine-validation';

type Props = {
  title: string;
  initialDraft: RoutineDraft;
  submitLabel: string;
  /** Resolves when saved; throw to keep the form open and show an error. */
  onSubmit: (input: RoutineInput) => Promise<void>;
  onCancel: () => void;
  /** Edit mode only. Resolves true when deleted, false when the user cancelled. */
  onDelete?: () => Promise<boolean>;
};

type Busy = 'idle' | 'saving' | 'deleting' | 'done';

function errorMessage(error: unknown, fallback: string) {
  return displayError(error, fallback);
}

export function RoutineForm({ title, initialDraft, submitLabel, onSubmit, onCancel, onDelete }: Props) {
  const arabic = useArabicComposition();
  const { palette: Palette, styles, scheme } = useAppStyles(createStyles);
  const { habits, status: habitsStatus } = useHabits();
  const [draft, setDraft] = useState<RoutineDraft>(initialDraft);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<Busy>('idle');
  const [failure, setFailure] = useState<string | null>(null);

  const habitsReady = habitsStatus === 'ready';
  const existingIds = new Set(habits.map((h) => h.id));
  const errors = validateRoutineDraft(draft, existingIds);
  const visibleErrors = showErrors ? errors : {};
  const locked = busy !== 'idle';
  const linkedCount = new Set(draft.habitIds.filter((id) => existingIds.has(id))).size;
  // Only meaningful once habits are loaded — before that every ID would look "missing".
  const missingCount = habitsReady ? draft.habitIds.filter((id) => !existingIds.has(id)).length : 0;

  const update = <K extends keyof RoutineDraft>(key: K, value: RoutineDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleSubmit = async () => {
    if (locked) return;
    if (!habitsReady) {
      // Saving now would drop every habit link (they'd all look deleted).
      setFailure(appLabel("routines.routine-form.yourHabitsHavenTLoadedSoThisRoutineCanTBeSavedSafelyGoBackAndTryAgain"));
      return;
    }
    if (hasRoutineErrors(errors)) {
      setShowErrors(true);
      return;
    }
    setBusy('saving');
    setFailure(null);
    try {
      await onSubmit(routineDraftToInput(draft, existingIds));
      setBusy('done'); // stays locked while the screen closes
    } catch (error) {
      console.warn('[momentum] Failed to save routine', error);
      setFailure(errorMessage(error, appLabel("routines.routine-form.couldnTSaveThisRoutineYourChangesAreStillHereTryAgain")));
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
      console.warn('[momentum] Failed to delete routine', error);
      setFailure(errorMessage(error, appLabel("routines.routine-form.couldnTDeleteThisRoutineNothingWasRemovedTryAgain")));
      setBusy('idle');
    }
  };

  return (
    <View style={[styles.screen,arabic.active && arabic.surface]}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.flex}>
        <View style={styles.header}>
          <Pressable
            onPress={onCancel}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel={appLabel("routines.routine-form.cancel")}
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
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}>
            {/* Live preview of icon + colour */}
            <View style={styles.preview}>
              <RoutineIcon routine={draft} size={52} />
              <Text style={styles.previewTitle} numberOfLines={1}>
                {draft.title.trim() || appLabel("routines.routine-form.newRoutine")}
              </Text>
            </View>

            <Field
              label={appLabel("routines.routine-form.title")}
              error={visibleErrors.title}
              counter={appMessage("display.ratio", { value: draft.title.length, maximum: ROUTINE_TITLE_MAX_LENGTH })}>
              <TextInput
                selectionColor={Palette.accent}
                keyboardAppearance={scheme}
                value={draft.title}
                onChangeText={(text) => update('title', text)}
                placeholder={appLabel("routines.routine-form.eGMorningRoutine")}
                placeholderTextColor={Palette.textMuted}
                maxLength={ROUTINE_TITLE_MAX_LENGTH}
                autoCapitalize="sentences"
                returnKeyType="done"
                editable={!locked}
                accessibilityLabel={appLabel("routines.routine-form.routineTitle")}
                style={[styles.input, visibleErrors.title && styles.inputError]}
              />
            </Field>

            <Field
              label={appLabel("routines.routine-form.description")}
              optional
              error={visibleErrors.description}
              counter={appMessage("display.ratio", { value: draft.description.length, maximum: ROUTINE_DESCRIPTION_MAX_LENGTH })}>
              <TextInput
                selectionColor={Palette.accent}
                keyboardAppearance={scheme}
                value={draft.description}
                onChangeText={(text) => update('description', text)}
                placeholder={appLabel("routines.routine-form.whatThisRoutineSetsYouUpFor")}
                placeholderTextColor={Palette.textMuted}
                maxLength={ROUTINE_DESCRIPTION_MAX_LENGTH}
                multiline
                textAlignVertical="top"
                editable={!locked}
                accessibilityLabel={appLabel("routines.routine-form.routineDescription")}
                style={[styles.input, styles.multiline, visibleErrors.description && styles.inputError]}
              />
            </Field>

            <Field
              label={appLabel("routines.routine-form.preferredTime")}
              hint={appLabel("routines.routine-form.ordersYourPlanOnTodayAndHighlightsWhatFitsRightNowHabitsAreAlwaysAvailable")}>
              <TimeOfDayPicker value={draft.timeOfDay} onChange={(t) => update('timeOfDay', t)} disabled={locked} />
            </Field>

            <Field label={appLabel("routines.routine-form.icon")}>
              <IconPicker value={draft.icon} color={draft.color} onChange={(icon) => !locked && update('icon', icon)} />
            </Field>

            <Field label={appLabel("routines.routine-form.color")}>
              <ColorPicker value={draft.color} onChange={(color) => !locked && update('color', color)} />
            </Field>

            <Field
              label={appLabel("routines.routine-form.habits")}
              optional
              error={visibleErrors.habitIds}
              counter={appMessage("display.ratio", { value: linkedCount, maximum: MAX_HABITS_PER_ROUTINE })}
              hint={appLabel("routines.routine-form.habitsStayExactlyAsTheyAreARoutineOnlyGroupsThemAHabitCanBeInMoreThanOneRoutineAndIsStillTrackedOnce")}>
              {habitsReady ? (
                <View style={styles.habitsBlock}>
                  {missingCount > 0 && (
                    <Text style={styles.hint}>
                      {appMessage("routines.form.deletedHabits", { count: missingCount })}</Text>
                  )}
                  {linkedCount > 0 && (
                    <>
                      <Text style={styles.subLabel}>{appLabel("routines.routine-form.order")}</Text>
                      <RoutineHabitOrder
                        habitIds={draft.habitIds}
                        habits={habits}
                        onChange={(ids) => update('habitIds', ids)}
                        disabled={locked}
                      />
                      <Text style={styles.subLabel}>{appLabel("routines.routine-form.chooseHabits")}</Text>
                    </>
                  )}
                  <HabitLinkPicker
                    habits={habits}
                    selectedIds={draft.habitIds}
                    onChange={(ids) => update('habitIds', ids)}
                    onCreateHabit={() => router.navigate('/habits/new')}
                    disabled={locked}
                    emptyText={appLabel("routines.routine-form.youDonTHaveAnyHabitsYetSaveThisRoutineNowAndAddHabitsLaterOrCreateAHabitFirstThisFormWillCloseWithoutSaving")}
                  />
                </View>
              ) : habitsStatus === 'loading' ? (
                <ActivityIndicator color={Palette.accent} />
              ) : (
                <Text style={styles.hint}>{appLabel("routines.routine-form.couldnTLoadYourHabitsThisRoutineCanTBeSavedRightNow")}</Text>
              )}
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
                  <Text style={styles.deleteText}>{appLabel("routines.routine-form.deleteRoutine")}</Text>
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
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string;
  counter?: string;
  hint?: string;
  children: ReactNode;
}) {
  const { styles } = useAppStyles(createStyles);
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.label}>
          {label}
          {optional && <Text style={styles.optional}> {appLabel("routines.routine-form.optional")}</Text>}
        </Text>
        {counter && <Text style={styles.counter}>{counter}</Text>}
      </View>
      {hint && <Text style={styles.hint}>{hint}</Text>}
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
    width: 44,
    height: 44,
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
    height: 44,
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
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  previewTitle: {
    flex: 1,
    color: Palette.text,
    fontSize: 18,
    fontWeight: '700',
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
  subLabel: {
    color: Palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
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
  hint: {
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  habitsBlock: {
    gap: 10,
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
