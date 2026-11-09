import { usePreventRemove } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
  type TextInputInstance,
  type ViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ColorPicker } from '@/components/habits/color-picker';
import { IconPicker } from '@/components/habits/icon-picker';
import { ProfileAvatar } from '@/components/profile/profile-avatar';
import { BottomTabInset, MaxContentWidth, Palette, Radius, Spacing } from '@/constants/theme';
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '@/data/habit-options';
import { draftToProfileInput, profileToDraft, type Profile, type ProfileInput } from '@/data/profile-storage';
import { useCurrentDate } from '@/hooks/use-current-date';
import { confirmDestructive } from '@/utils/confirm';
import { getGreeting } from '@/utils/date';
import {
  hasProfileErrors,
  normalizeName,
  PROFILE_NAME_MAX_LENGTH,
  sameProfileDraft,
  validateProfileDraft,
  type AvatarKind,
  type ProfileDraft,
} from '@/utils/profile-validation';

type Props = {
  profile: Profile;
  /** Resolves when saved; throw to keep the form open and show an error. */
  onSave: (input: ProfileInput) => Promise<void>;
  /** Leaves the screen. Only called once leaving is allowed (saved, unchanged or discard confirmed). */
  onClose: () => void;
};

type Busy = 'idle' | 'saving' | 'done';

const AVATAR_OPTIONS: { value: AvatarKind; label: string; hint: string }[] = [
  { value: 'initials', label: 'Initials', hint: 'From your name' },
  { value: 'icon', label: 'Icon', hint: 'Pick a symbol' },
];

const DISCARD_PROMPT = {
  title: 'Discard changes?',
  message: "Your profile changes haven't been saved.",
  confirmLabel: 'Discard',
};

function errorMessage(error: unknown, fallback: string) {
  const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
  return `${fallback}${detail}`;
}

export function ProfileForm({ profile, onSave, onClose }: Props) {
  const [initialDraft] = useState<ProfileDraft>(() =>
    profileToDraft(profile, { icon: DEFAULT_HABIT_ICON, color: DEFAULT_HABIT_COLOR }),
  );
  const [draft, setDraft] = useState<ProfileDraft>(initialDraft);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<Busy>('idle');
  const [failure, setFailure] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const askingRef = useRef(false);

  const now = useCurrentDate();
  const errors = validateProfileDraft(draft);
  const visibleErrors = showErrors ? errors : {};
  const locked = busy !== 'idle';
  const dirty = !sameProfileDraft(draft, initialDraft);
  const previewName = normalizeName(draft.name);

  const update = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /** One discard confirmation at a time (a second back press while it's open is ignored). */
  const confirmDiscard = useCallback(async () => {
    if (askingRef.current) return false;
    askingRef.current = true;
    try {
      return await confirmDestructive(DISCARD_PROMPT);
    } finally {
      askingRef.current = false;
    }
  }, []);

  // Android hardware/gesture back, the iOS swipe and any other navigation that
  // would remove this screen are stopped while there are unsaved changes.
  // `repeat()` turns the prevention off and replays the blocked navigation.
  const disablePrevention = usePreventRemove(dirty && !leaving && busy !== 'done', ({ repeat }) => {
    void confirmDiscard().then((discard) => {
      if (!discard) return;
      setLeaving(true);
      repeat();
    });
  });

  /** Leaves on purpose: prevention is turned off first, so the hook doesn't ask again. */
  const leave = useCallback(() => {
    setLeaving(true);
    disablePrevention();
    onClose();
  }, [disablePrevention, onClose]);

  // The visible Cancel button checks for changes itself, so it is protected even
  // if removal prevention isn't available on some navigator/platform.
  const handleCancel = async () => {
    if (locked) return;
    if (dirty && !(await confirmDiscard())) return;
    leave();
  };

  // Android: keep the focused name field above the keyboard (same pattern as the habit form).
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
    }, 300);
  }, []);
  const nameRef = useRef<TextInputInstance>(null);

  const handleSave = async () => {
    if (locked) return;
    if (hasProfileErrors(errors)) {
      setShowErrors(true);
      return;
    }
    setBusy('saving');
    setFailure(null);
    try {
      await onSave(draftToProfileInput(draft));
      setBusy('done'); // stays locked while the screen closes
      leave();
    } catch (error) {
      console.warn('[momentum] Failed to save profile', error);
      setFailure(errorMessage(error, "Couldn't save your profile. Your changes are still here — try again."));
      setBusy('idle');
    }
  };

  const previewAvatar =
    draft.avatarKind === 'icon'
      ? ({ kind: 'icon', icon: draft.icon, color: draft.color } as const)
      : ({ kind: 'initials' } as const);
  const greeting = getGreeting(now);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleCancel}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            accessibilityHint={dirty ? 'Asks before discarding your changes' : undefined}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={20}
              tintColor={Palette.textSecondary}
            />
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Profile
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel="Save profile"
            accessibilityState={{ disabled: locked, busy: busy === 'saving' }}
            android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
            style={({ pressed }) => [styles.saveButton, locked && styles.saveDisabled, pressed && styles.pressed]}>
            {busy === 'saving' ? (
              <ActivityIndicator size="small" color={Palette.background} />
            ) : (
              <Text style={styles.saveText}>Save</Text>
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
              {/* Live preview of the Today header */}
              <View
                style={styles.preview}
                accessible
                accessibilityLabel={`Preview: ${previewName ? `${greeting}, ${previewName}` : `${greeting}.`}`}>
                <ProfileAvatar avatar={previewAvatar} displayName={previewName} size={72} />
                <View style={styles.previewText}>
                  <Text style={styles.previewLabel}>On Today</Text>
                  <Text style={styles.previewGreeting} numberOfLines={2}>
                    {previewName ? (
                      <>
                        {greeting}, <Text style={styles.previewName}>{previewName}</Text>
                      </>
                    ) : (
                      `${greeting}.`
                    )}
                  </Text>
                </View>
              </View>

              <Field
                label="Display name"
                optional
                error={visibleErrors.name}
                counter={`${draft.name.length}/${PROFILE_NAME_MAX_LENGTH}`}>
                <View>
                  <TextInput
                    ref={nameRef}
                    value={draft.name}
                    onChangeText={(text) => update('name', text)}
                    onFocus={() => revealInput(nameRef.current)}
                    placeholder="What should we call you?"
                    placeholderTextColor={Palette.textMuted}
                    maxLength={PROFILE_NAME_MAX_LENGTH}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    autoCorrect={false}
                    returnKeyType="done"
                    editable={!locked}
                    accessibilityLabel="Display name"
                    accessibilityHint="Optional. Shown on Today and stored only on this device."
                    style={[styles.input, draft.name.length > 0 && styles.inputWithClear, visibleErrors.name && styles.inputError]}
                  />
                  {draft.name.length > 0 && !locked && (
                    <Pressable
                      onPress={() => update('name', '')}
                      accessibilityRole="button"
                      accessibilityLabel="Clear name"
                      hitSlop={8}
                      style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
                      <SymbolView
                        name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                        size={20}
                        tintColor={Palette.textMuted}
                      />
                    </Pressable>
                  )}
                </View>
                <Text style={styles.helper}>Shown on Today. Leave it empty if you prefer no name.</Text>
              </Field>

              <Field label="Avatar" error={visibleErrors.avatar}>
                <View style={styles.segment} accessibilityRole="radiogroup">
                  {AVATAR_OPTIONS.map((option) => {
                    const selected = draft.avatarKind === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => update('avatarKind', option.value)}
                        disabled={locked}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected, disabled: locked }}
                        accessibilityLabel={`${option.label}, ${option.hint}`}
                        android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
                        style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}>
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                        <Text style={styles.optionHint}>{option.hint}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {draft.avatarKind === 'initials' && !previewName && (
                  <Text style={styles.helper}>Add a name to show your initials.</Text>
                )}
              </Field>

              {draft.avatarKind === 'icon' && (
                <>
                  <Field label="Icon">
                    <IconPicker value={draft.icon} color={draft.color} onChange={(icon) => update('icon', icon)} />
                  </Field>
                  <Field label="Color">
                    <ColorPicker value={draft.color} onChange={(color) => update('color', color)} />
                  </Field>
                </>
              )}

              <View style={styles.note}>
                <SymbolView
                  name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                  size={14}
                  tintColor={Palette.textMuted}
                />
                <Text style={styles.noteText}>
                  Your profile is stored locally on this device. Momentum has no account and no cloud sync.
                </Text>
              </View>
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
  },
  contentInner: {
    gap: Spacing.four,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: 20,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  previewText: {
    flex: 1,
    gap: 4,
  },
  previewLabel: {
    color: Palette.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  previewGreeting: {
    color: Palette.textSecondary,
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 26,
  },
  previewName: {
    color: Palette.text,
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
  inputWithClear: {
    paddingRight: 48,
  },
  inputError: {
    borderColor: Palette.danger,
  },
  clearButton: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helper: {
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    color: Palette.danger,
    fontSize: 13,
  },
  segment: {
    flexDirection: 'row',
    gap: 10,
  },
  option: {
    flex: 1,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 2,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  optionSelected: {
    backgroundColor: Palette.accentSoft,
    borderColor: Palette.accent,
  },
  optionLabel: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  optionLabelSelected: {
    color: Palette.accent,
  },
  optionHint: {
    color: Palette.textMuted,
    fontSize: 12,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  noteText: {
    flex: 1,
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
