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

import { DatePicker } from '@/components/goals/date-picker';
import { HabitLinkPicker } from '@/components/goals/habit-link-picker';
import { StatusPicker } from '@/components/goals/status-picker';
import { BottomTabInset, MaxContentWidth, Palette, Radius, Spacing } from '@/constants/theme';
import type { GoalInput } from '@/data/goal-storage';
import { useHabits } from '@/hooks/use-habits';
import { formatShortDate } from '@/utils/date';
import {
  GOAL_DESCRIPTION_MAX_LENGTH,
  GOAL_TITLE_MAX_LENGTH,
  goalDraftToInput,
  hasGoalErrors,
  validateGoalDraft,
  type GoalDraft,
} from '@/utils/goal-validation';

type Props = {
  title: string;
  initialDraft: GoalDraft;
  submitLabel: string;
  todayKey: string;
  /** Edit mode only. */
  startDate?: string;
  /** Rendered below the fields in edit mode (e.g. Habit Consistency details). */
  footer?: ReactNode;
  /** Resolves when saved; throw to keep the form open and show an error. */
  onSubmit: (input: GoalInput) => Promise<void>;
  onCancel: () => void;
  /** Edit mode only. Resolves true when deleted, false when the user cancelled. */
  onDelete?: () => Promise<boolean>;
};

type Busy = 'idle' | 'saving' | 'deleting' | 'done';

function errorMessage(error: unknown, fallback: string) {
  const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
  return `${fallback}${detail}`;
}

export function GoalForm({
  title,
  initialDraft,
  submitLabel,
  todayKey,
  startDate,
  footer,
  onSubmit,
  onCancel,
  onDelete,
}: Props) {
  const { habits, status: habitsStatus } = useHabits();
  const [draft, setDraft] = useState<GoalDraft>(initialDraft);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<Busy>('idle');
  const [failure, setFailure] = useState<string | null>(null);

  const savedTargetDate = startDate ? initialDraft.targetDate ?? undefined : undefined;
  const errors = validateGoalDraft(draft, { todayKey, startDate, savedTargetDate });
  const visibleErrors = showErrors ? errors : {};
  const locked = busy !== 'idle';
  // Saving without loaded habits would drop every link, so wait for them.
  const habitsReady = habitsStatus === 'ready';
  // Links to deleted habits are ignored (and dropped on save).
  const linkedCount = draft.habitIds.filter((id) => habits.some((h) => h.id === id)).length;

  const update = <K extends keyof GoalDraft>(key: K, value: GoalDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleSubmit = async () => {
    if (locked) return;
    if (!habitsReady) {
      setFailure('Your habits haven’t loaded, so links can’t be saved safely. Go back and try again.');
      return;
    }
    if (hasGoalErrors(errors)) {
      setShowErrors(true);
      return;
    }
    setBusy('saving');
    setFailure(null);
    try {
      await onSubmit(goalDraftToInput(draft, new Set(habits.map((h) => h.id))));
      setBusy('done'); // stays locked while the screen closes
    } catch (error) {
      console.warn('[momentum] Failed to save goal', error);
      setFailure(errorMessage(error, "Couldn't save this goal. Your changes are still here — try again."));
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
      console.warn('[momentum] Failed to delete goal', error);
      setFailure(errorMessage(error, "Couldn't delete this goal. Nothing was removed — try again."));
      setBusy('idle');
    }
  };

  // Earliest pickable day: today. An already-saved past target stays selected (validation allows it).
  const minDate = todayKey;

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
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
            <Field label="Title" error={visibleErrors.title} counter={`${draft.title.length}/${GOAL_TITLE_MAX_LENGTH}`}>
              <TextInput
                value={draft.title}
                onChangeText={(text) => update('title', text)}
                placeholder="e.g. Run a half marathon"
                placeholderTextColor={Palette.textMuted}
                maxLength={GOAL_TITLE_MAX_LENGTH}
                autoCapitalize="sentences"
                returnKeyType="done"
                editable={!locked}
                accessibilityLabel="Goal title"
                style={[styles.input, visibleErrors.title && styles.inputError]}
              />
            </Field>

            <Field
              label="Description"
              optional
              error={visibleErrors.description}
              counter={`${draft.description.length}/${GOAL_DESCRIPTION_MAX_LENGTH}`}>
              <TextInput
                value={draft.description}
                onChangeText={(text) => update('description', text)}
                placeholder="Why it matters to you"
                placeholderTextColor={Palette.textMuted}
                maxLength={GOAL_DESCRIPTION_MAX_LENGTH}
                multiline
                textAlignVertical="top"
                editable={!locked}
                accessibilityLabel="Goal description"
                style={[styles.input, styles.multiline, visibleErrors.description && styles.inputError]}
              />
            </Field>

            <Field
              label="Target date"
              error={visibleErrors.targetDate}
              counter={draft.targetDate ? formatShortDate(draft.targetDate) : undefined}>
              <DatePicker
                value={draft.targetDate}
                onChange={(key) => update('targetDate', key)}
                minDate={minDate}
                todayKey={todayKey}
                disabled={locked}
              />
            </Field>

            <Field label="Status" hint="You decide when a goal is achieved — Habit Consistency never changes it.">
              <StatusPicker value={draft.status} onChange={(s) => update('status', s)} disabled={locked} />
            </Field>

            <Field
              label="Linked habits"
              optional
              counter={linkedCount > 0 ? `${linkedCount} selected` : undefined}>
              {habitsStatus === 'ready' ? (
                <HabitLinkPicker
                  habits={habits}
                  selectedIds={draft.habitIds}
                  onChange={(ids) => update('habitIds', ids)}
                  onCreateHabit={() => router.push('/habits/new')}
                  disabled={locked}
                />
              ) : habitsStatus === 'loading' ? (
                <ActivityIndicator color={Palette.accent} />
              ) : (
                <Text style={styles.hint}>Couldn’t load your habits. Linked habits can’t be changed right now.</Text>
              )}
            </Field>

            {footer}

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
                  <Text style={styles.deleteText}>Delete goal</Text>
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
  hint: {
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
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
