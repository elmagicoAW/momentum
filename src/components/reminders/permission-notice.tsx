import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';
import type { PermissionInfo } from '@/utils/reminder-presentation';

export type PermissionProblem = { message: string; action: 'ask' | 'settings' | 'recheck' | null } | null;

/** What (if anything) stands between the user's settings and a delivered reminder. */
export function permissionProblem(permission: PermissionInfo): PermissionProblem {
  switch (permission.state) {
    case 'granted':
    case 'system-allowed':
      if (permission.channelsOff.length === 2) {
        return { message: 'Both reminder categories are turned off in system settings.', action: 'settings' };
      }
      if (permission.channelsOff.includes('habit-reminders')) {
        return { message: 'Habit reminders are turned off in system settings.', action: 'settings' };
      }
      if (permission.channelsOff.includes('routine-reminders')) {
        return { message: 'Routine reminders are turned off in system settings.', action: 'settings' };
      }
      return null;
    case 'undetermined':
      return { message: 'Notifications aren’t allowed yet, so reminders won’t appear.', action: 'ask' };
    case 'denied':
      return { message: 'Notifications are not allowed, so reminders won’t appear.', action: 'ask' };
    case 'blocked':
      return {
        message: 'Notifications are blocked for this app. Allow them in system settings to get reminders.',
        action: 'settings',
      };
    case 'unsupported':
      return { message: 'Reminders aren’t available on this platform.', action: null };
    case 'error':
      return {
        message: 'Couldn’t check notification permission. This doesn’t mean it’s off — check again.',
        action: 'recheck',
      };
    case 'checking':
      return null;
  }
}

type Props = {
  problem: NonNullable<PermissionProblem>;
  onAsk: () => void;
  onOpenSettings: () => void;
  onRecheck: () => void;
  busy?: boolean;
};

const ACTION_LABEL = { ask: 'Allow notifications', settings: 'Open settings', recheck: 'Check again' } as const;

export function PermissionNotice({ problem, onAsk, onOpenSettings, onRecheck, busy = false }: Props) {
  const { action } = problem;
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={styles.text}>{problem.message}</Text>
      {action && (
        <Pressable
          onPress={action === 'ask' ? onAsk : action === 'settings' ? onOpenSettings : onRecheck}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.busy]}>
          <Text style={styles.buttonText}>{ACTION_LABEL[action]}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: Spacing.two,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(251, 191, 36, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  text: {
    color: Palette.text,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
    justifyContent: 'center',
  },
  buttonText: {
    color: Palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
  busy: {
    opacity: 0.5,
  },
});
