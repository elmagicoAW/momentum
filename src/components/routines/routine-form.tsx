import { router } from 'expo-router';
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

import { HabitLinkPicker } from '@/components/goals/habit-link-picker';
import { ColorPicker } from '@/components/habits/color-picker';
import { IconPicker } from '@/components/habits/icon-picker';
import { RoutineIcon } from '@/components/routines/routine-badges';
import { RoutineHabitOrder } from '@/components/routines/routine-habit-order';
import { TimeOfDayPicker } from '@/components/routines/time-of-day-picker';
import { MaxContentWidth, Palette, Radius, Spacing } from '@/constants/theme';
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
  /** Optional reminder control, rendered with the live draft (saved separately by the screen). */
  renderReminder?: (draft: RoutineDraft, locked: boolean) => ReactNode;
};

type Busy = 'idle' | 'saving' | 'deleting' | 'done';

function errorMessage(error: unknown, fallback: string) {
  const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
  return `${fallback}${detail}`;
}

export function RoutineForm({ title, initialDraft, submitLabel, onSubmit, onCancel, onDelete, renderReminder }: Props) {
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
      setFailure('Your habits haven’t loaded, so this routine can’t be saved safely. Go back and try again.');
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
      setFailure(errorMessage(error, "Couldn't save this routine. Your changes are still here — try again."));
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
      setFailure(errorMessage(error, "Couldn't delete this routine. Nothing was removed — try again."));
      setBusy('idle');
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.flex}>
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
            {/* Live preview of icon + colour */}
            <View style={styles.preview}>
              <RoutineIcon routine={draft} size={52} />
              <Text style={styles.previewTitle} numberOfLines={1}>
                {draft.title.trim() || 'New routine'}
              </Text>
            </View>

            <Field
              label="Title"
              error={visibleErrors.title}
              counter={`${draft.title.length}/${ROUTINE_TITLE_MAX_LENGTH}`}>
              <TextInput
                value={draft.title}
                onChangeText={(text) => update('title', text)}
                placeholder="e.g. Morning Routine"
                placeholderTextColor={Palette.textMuted}
                maxLength={ROUTINE_TITLE_MAX_LENGTH}
                autoCapitalize="sentences"
                returnKeyType="done"
                editable={!locked}
                accessibilityLabel="Routine title"
                style={[styles.input, visibleErrors.title && styles.inputError]}
              />
            </Field>

            <Field
              label="Description"
              optional
              error={visibleErrors.description}
              counter={`${draft.description.length}/${ROUTINE_DESCRIPTION_MAX_LENGTH}`}>
              <TextInput
                value={draft.description}
                onChangeText={(text) => update('description', text)}
                placeholder="What this routine sets you up for"
                placeholderTextColor={Palette.textMuted}
                maxLength={ROUTINE_DESCRIPTION_MAX_LENGTH}
                multiline
                textAlignVertical="top"
                editable={!locked}
                accessibilityLabel="Routine description"
                style={[styles.input, styles.multiline, visibleErrors.description && styles.inputError]}
              />
            </Field>

            <Field
              label="Preferred time"
              hint="Orders your plan on Today and highlights what fits right now. Habits are always available.">
              <TimeOfDayPicker value={draft.timeOfDay} onChange={(t) => update('timeOfDay', t)} disabled={locked} />
            </Field>

            <Field label="Icon">
              <IconPicker value={draft.icon} color={draft.color} onChange={(icon) => !locked && update('icon', icon)} />
            </Field>

            <Field label="Color">
              <ColorPicker value={draft.color} onChange={(color) => !locked && update('color', color)} />
            </Field>

            <Field
              label="Habits"
              optional
              error={visibleErrors.habitIds}
              counter={`${linkedCount}/${MAX_HABITS_PER_ROUTINE}`}
              hint="Habits stay exactly as they are — a routine only groups them. A habit can be in more than one routine and is still tracked once.">
              {habitsReady ? (
                <View style={styles.habitsBlock}>
                  {missingCount > 0 && (
                    <Text style={styles.hint}>
                      {missingCount === 1 ? '1 habit was' : `${missingCount} habits were`} deleted and will be removed
                      from this routine when you save.
                    </Text>
                  )}
                  {linkedCount > 0 && (
                    <>
                      <Text style={styles.subLabel}>Order</Text>
                      <RoutineHabitOrder
                        habitIds={draft.habitIds}
                        habits={habits}
                        onChange={(ids) => update('habitIds', ids)}
                        disabled={locked}
                      />
                      <Text style={styles.subLabel}>Choose habits</Text>
                    </>
                  )}
                  <HabitLinkPicker
                    habits={habits}
                    selectedIds={draft.habitIds}
                    onChange={(ids) => update('habitIds', ids)}
                    onCreateHabit={() => router.navigate('/habits/new')}
                    disabled={locked}
                    emptyText="You don’t have any habits yet. Save this routine now and add habits later — or create a habit first (this form will close without saving)."
                  />
                </View>
              ) : habitsStatus === 'loading' ? (
                <ActivityIndicator color={Palette.accent} />
              ) : (
                <Text style={styles.hint}>Couldn’t load your habits. This routine can’t be saved right now.</Text>
              )}
            </Field>

            {renderReminder && (
              <Field label="Reminder" optional hint="Sent only on days when at least one of its habits is due.">
                {renderReminder(draft, locked)}
              </Field>
            )}

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
                  <Text style={styles.deleteText}>Delete routine</Text>
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
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.label}>
          {label}
          {optional && <Text style={styles.optional}> · optional</Text>}
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
    width: 44,
    height: 44,
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
