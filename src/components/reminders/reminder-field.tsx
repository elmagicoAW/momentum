import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { PermissionNotice, permissionProblem } from '@/components/reminders/permission-notice';
import { formatTime, TimePicker } from '@/components/reminders/time-picker';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useReminders } from '@/hooks/use-reminders';
import { canDeliver } from '@/utils/reminder-presentation';
import { sameTime, type ReminderTime } from '@/utils/reminder-time';

export type ReminderDraft = { enabled: boolean; time: ReminderTime };

export type OverlapNote = { name: string; time: ReminderTime };

type Props = {
  noun: 'habit' | 'routine';
  value: ReminderDraft;
  onChange: (value: ReminderDraft) => void;
  /** e.g. "Mon · Wed · Fri", or null when nothing is due on any day. */
  daysLabel: string | null;
  /** Reminders of the other kind that will also fire (routines for a habit, habits for a routine). */
  overlaps: OverlapNote[];
  disabled?: boolean;
};

/**
 * Simple reminder control for the habit/routine editors. The value is a
 * draft: it's saved (to reminder settings only) after the habit/routine itself
 * has been saved. Turning it on asks for notification permission in context.
 */
export function ReminderField({ noun, value, onChange, daysLabel, overlaps, disabled = false }: Props) {
  const { supported, status, settings, permission, askPermission, recheckPermission, openSystemSettings, reload } =
    useReminders();
  const [asking, setAsking] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  /** The user tried to turn it on but permission wasn't granted (e.g. dialog dismissed). */
  const [refused, setRefused] = useState(false);

  if (!supported) {
    return <Text style={styles.hint}>Reminders are available in the Android and iOS app.</Text>;
  }
  if (status === 'loading') return <ActivityIndicator color={Palette.accent} />;
  if (status === 'load-error') {
    return (
      <View style={styles.card}>
        <Text style={styles.hint}>
          Reminder settings couldn’t be loaded, so this {noun}’s reminder can’t be changed right now. Saving the {noun}{' '}
          still works.
        </Text>
        <Pressable onPress={reload} accessibilityRole="button" style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
          <Text style={styles.linkText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const toggle = async (next: boolean) => {
    if (!next) {
      onChange({ ...value, enabled: false });
      return;
    }
    setAsking(true);
    try {
      const result = await askPermission();
      // Turn on only when reminders can actually be delivered; otherwise the
      // notice below explains what to do.
      const allowed = canDeliver(result.state);
      setRefused(!allowed);
      if (allowed) onChange({ ...value, enabled: true });
    } finally {
      setAsking(false);
    }
  };

  const problem = permissionProblem(permission);
  const showProblem =
    problem &&
    (value.enabled ||
      refused ||
      permission.state === 'denied' ||
      permission.state === 'blocked' ||
      permission.state === 'error');
  const sameTimeCount = overlaps.filter((o) => sameTime(o.time, value.time)).length;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.rowIcon}>
          <SymbolView
            name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
            size={18}
            tintColor={value.enabled ? Palette.accent : Palette.textMuted}
          />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Remind me</Text>
          <Text style={styles.rowSub} numberOfLines={2}>
            {value.enabled
              ? daysLabel
                ? `${daysLabel} · around ${formatTime(value.time)}`
                : `Nothing due on any day yet, so no reminder will be sent.`
              : 'Off'}
          </Text>
        </View>
        {asking ? (
          <ActivityIndicator color={Palette.accent} />
        ) : (
          <Switch
            value={value.enabled}
            onValueChange={(v) => void toggle(v)}
            disabled={disabled}
            trackColor={{ false: Palette.border, true: Palette.accentSoft }}
            thumbColor={value.enabled ? Palette.accent : Palette.textSecondary}
            accessibilityLabel={`${noun === 'habit' ? 'Habit' : 'Routine'} reminder`}
          />
        )}
      </View>

      {value.enabled && (
        <>
          <Pressable
            onPress={() => setShowPicker((s) => !s)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Change time, currently ${formatTime(value.time)}`}
            style={({ pressed }) => [styles.timeButton, pressed && styles.pressed]}>
            <Text style={styles.timeLabel}>Time</Text>
            <Text style={styles.timeValue}>{formatTime(value.time)}</Text>
            <SymbolView
              name={
                showPicker
                  ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
                  : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
              }
              size={16}
              tintColor={Palette.textSecondary}
            />
          </Pressable>
          {showPicker && (
            <TimePicker value={value.time} onChange={(time) => onChange({ ...value, time })} disabled={disabled} />
          )}
        </>
      )}

      {value.enabled && overlaps.length > 0 && (
        <View style={[styles.overlap, sameTimeCount > 0 && styles.overlapStrong]} accessibilityRole="alert">
          <Text style={styles.overlapTitle}>
            {sameTimeCount > 0 ? 'Two reminders at the same time' : 'You’ll also get another reminder'}
          </Text>
          {overlaps.map((o) => (
            <Text key={o.name} style={styles.overlapText}>
              • {noun === 'habit' ? 'Routine' : 'Habit'} “{o.name}” at {formatTime(o.time)}
              {sameTime(o.time, value.time) ? ' — same time' : ''}
            </Text>
          ))}
          <Text style={styles.overlapText}>
            {noun === 'habit'
              ? 'Both stay on unless you turn one off.'
              : 'Those habits keep their own reminders unless you turn them off (Settings › Reminders).'}
          </Text>
          <Pressable
            onPress={() => onChange({ ...value, enabled: false })}
            disabled={disabled}
            accessibilityRole="button"
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
            <Text style={styles.linkText}>Turn off this {noun}’s reminder</Text>
          </Pressable>
        </View>
      )}

      {value.enabled && !settings.enabled && (
        <Text style={styles.warn}>All reminders are paused in Settings › Reminders. This one is kept for later.</Text>
      )}

      {showProblem && problem && (
        <PermissionNotice
          problem={problem}
          busy={asking}
          onAsk={() => void toggle(true)}
          onOpenSettings={openSystemSettings}
          onRecheck={() => void recheckPermission()}
        />
      )}

      {value.enabled && (
        <Text style={styles.hint}>
          Reminders can arrive a few minutes late on battery saver. One that arrives while MOMENTUM is open stays quiet if
          it’s already done; in the background it may still arrive after you’ve finished.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    color: Palette.textSecondary,
    fontSize: 13,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  timeLabel: {
    flex: 1,
    color: Palette.textSecondary,
    fontSize: 14,
  },
  timeValue: {
    color: Palette.text,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  overlap: {
    gap: 6,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Palette.accentBlueSoft,
    borderWidth: 1,
    borderColor: 'rgba(91, 141, 239, 0.35)',
  },
  overlapStrong: {
    backgroundColor: 'rgba(251, 191, 36, 0.10)',
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  overlapTitle: {
    color: Palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  overlapText: {
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  linkButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
    justifyContent: 'center',
  },
  linkText: {
    color: Palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  warn: {
    color: '#FBBF24',
    fontSize: 13,
    lineHeight: 18,
  },
  hint: {
    color: Palette.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.8,
  },
});
