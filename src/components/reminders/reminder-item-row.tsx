import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { formatTime, TimePicker } from '@/components/reminders/time-picker';
import { Palette, Radius, Spacing } from '@/constants/theme';
import type { ReminderSetting } from '@/data/reminder-storage';
import { sameTime, type ReminderTime } from '@/utils/reminder-time';

type Props = {
  icon: ReactNode;
  title: string;
  /** e.g. "Mon · Wed · Fri", or null when nothing is due on any day. */
  daysLabel: string | null;
  setting: ReminderSetting | undefined;
  defaultTime: ReminderTime;
  /** Resolves when saved; throws on failure. Resolve false when it couldn't be turned on (e.g. no permission). */
  onToggle: (enabled: boolean, time: ReminderTime) => Promise<boolean | void>;
  onSaveTime: (time: ReminderTime) => Promise<void>;
  disabled?: boolean;
};

/** One habit/routine in Settings › Reminders: switch + inline time editor (saved on "Save time"). */
export function ReminderItemRow({ icon, title, daysLabel, setting, defaultTime, onToggle, onSaveTime, disabled = false }: Props) {
  const enabled = setting?.enabled ?? false;
  const time = setting?.time ?? defaultTime;
  const [expanded, setExpanded] = useState(false);
  const [pendingTime, setPendingTime] = useState<ReminderTime | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editingTime = pendingTime ?? time;
  const timeChanged = pendingTime !== null && !sameTime(pendingTime, time);

  const toggle = async (next: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const result = await onToggle(next, time);
      if (result === false) {
        setError('Notifications aren’t allowed, so this reminder stays off. See the notice at the top.');
        return;
      }
      if (!next) {
        setExpanded(false);
        setPendingTime(null);
      }
    } catch (e) {
      console.warn('[momentum] Failed to save reminder', e);
      setError('Couldn’t save this change. Nothing was changed — try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveTime = async () => {
    if (!pendingTime) return;
    setBusy(true);
    setError(null);
    try {
      await onSaveTime(pendingTime);
      setPendingTime(null);
      setExpanded(false);
    } catch (e) {
      console.warn('[momentum] Failed to save reminder time', e);
      setError('Couldn’t save the new time. The previous time is still in place — try again.');
    } finally {
      setBusy(false);
    }
  };

  const subtitle = !daysLabel
    ? 'No habits due on any day'
    : enabled
      ? `${daysLabel} · ${formatTime(time)}`
      : daysLabel;

  return (
    <View style={styles.item}>
      <View style={styles.row}>
        {icon}
        <Pressable
          style={styles.text}
          onPress={() => enabled && setExpanded((e) => !e)}
          disabled={!enabled || disabled}
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${enabled ? `reminder at ${formatTime(time)}` : 'reminder off'}`}
          accessibilityHint={enabled ? 'Change the reminder time' : undefined}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.sub, enabled && styles.subOn]} numberOfLines={1}>
            {subtitle}
          </Text>
        </Pressable>
        {enabled && !busy && (
          <Pressable
            onPress={() => setExpanded((e) => !e)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Change time for ${title}`}
            hitSlop={6}
            style={({ pressed }) => [styles.timePill, pressed && styles.pressed]}>
            <Text style={styles.timePillText}>{formatTime(time)}</Text>
          </Pressable>
        )}
        {busy ? (
          <ActivityIndicator color={Palette.accent} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={(v) => void toggle(v)}
            disabled={disabled}
            trackColor={{ false: Palette.border, true: Palette.accentSoft }}
            thumbColor={enabled ? Palette.accent : Palette.textSecondary}
            accessibilityLabel={`${title} reminder`}
          />
        )}
      </View>

      {expanded && enabled && (
        <View style={styles.editor}>
          <TimePicker value={editingTime} onChange={setPendingTime} disabled={busy || disabled} />
          <View style={styles.editorActions}>
            <Pressable
              onPress={() => {
                setPendingTime(null);
                setExpanded(false);
              }}
              disabled={busy}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void saveTime()}
              disabled={busy || !timeChanged}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || !timeChanged }}
              style={({ pressed }) => [styles.primary, (!timeChanged || busy) && styles.dim, pressed && styles.pressed]}>
              <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={16} tintColor={Palette.background} />
              <Text style={styles.primaryText}>Save time</Text>
            </Pressable>
          </View>
        </View>
      )}

      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    gap: Spacing.two,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    flex: 1,
    gap: 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  title: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  sub: {
    color: Palette.textMuted,
    fontSize: 13,
  },
  subOn: {
    color: Palette.textSecondary,
  },
  timePill: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accentSoft,
    justifyContent: 'center',
  },
  timePillText: {
    color: Palette.accent,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  editor: {
    gap: Spacing.two,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  secondary: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    justifyContent: 'center',
  },
  secondaryText: {
    color: Palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  primary: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryText: {
    color: Palette.background,
    fontSize: 14,
    fontWeight: '700',
  },
  dim: {
    opacity: 0.45,
  },
  error: {
    color: Palette.danger,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.8,
  },
});
