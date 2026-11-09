import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';

type Props = {
  onAdd: () => void;
  /** Resolves after the dismissal is saved; throws if saving failed. */
  onDismiss: () => Promise<void>;
};

/**
 * Optional first-run card on Today. Never blocks anything: the habits below stay
 * fully usable. "Not now" is saved first — the card disappears only once the
 * dismissal is on disk, so it doesn't come back on the next launch.
 */
export function NamePromptCard({ onAdd, onDismiss }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const dismiss = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onDismiss(); // on success this card unmounts
    } catch (error) {
      console.warn('[momentum] Failed to save name prompt dismissal', error);
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <SymbolView
            name={{ ios: 'person.crop.circle.badge.plus', android: 'person_add', web: 'person_add' }}
            size={22}
            tintColor={Palette.accent}
          />
        </View>
        <View style={styles.text}>
          <Text style={styles.title} accessibilityRole="header">
            Make Momentum yours
          </Text>
          <Text style={styles.body}>Add the name you&apos;d like to see here. You can change it any time in Settings.</Text>
        </View>
      </View>

      {failed && (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          Couldn&apos;t save that. Try again.
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={dismiss}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Not now"
          accessibilityHint="Hides this card. You can still add a name in Settings."
          accessibilityState={{ disabled: busy, busy }}
          android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
          style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}>
          {busy ? (
            <ActivityIndicator size="small" color={Palette.textSecondary} />
          ) : (
            <Text style={styles.secondaryText}>Not now</Text>
          )}
        </Pressable>
        <Pressable
          onPress={onAdd}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
          style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Add your name</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    gap: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 246, 0.3)',
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: Palette.text,
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: Palette.danger,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  },
  button: {
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  secondary: {
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  primary: {
    backgroundColor: Palette.accent,
  },
  pressed: {
    opacity: 0.85,
  },
  secondaryText: {
    color: Palette.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  primaryText: {
    color: Palette.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
