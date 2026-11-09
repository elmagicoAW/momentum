import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PermissionNotice, permissionProblem } from '@/components/reminders/permission-notice';
import { ReminderItemRow } from '@/components/reminders/reminder-item-row';
import { formatTime } from '@/components/reminders/time-picker';
import { RoutineIcon } from '@/components/routines/routine-badges';
import { BottomTabInset, MaxContentWidth, Palette, Radius, Spacing } from '@/constants/theme';
import type { ReminderKind } from '@/data/reminder-storage';
import { useHabits } from '@/hooks/use-habits';
import { useReminders, type SyncState } from '@/hooks/use-reminders';
import { useRoutines } from '@/hooks/use-routines';
import { routineDueWeekdays, type ReminderOverlap } from '@/utils/reminder-plan';
import type { PermissionReport } from '@/notifications/permission-check';
import { probeChannels } from '@/notifications/scheduler';
import { canDeliver, canRequestPermission, type PermissionInfo } from '@/utils/reminder-presentation';
import { DEFAULT_HABIT_REMINDER_TIME, ROUTINE_DEFAULT_TIMES, type ReminderTime } from '@/utils/reminder-time';
import { describeSchedule } from '@/utils/schedule';

/**
 * Settings tab. Currently: Reminders — permission, master switch, per-routine
 * and per-habit reminders, overlaps, delivery help and a test notification.
 * All changes go to reminder settings only; habits and routines are read-only here.
 */
export default function SettingsScreen() {
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title} accessibilityRole="header">
            Settings
          </Text>
          <RemindersSection />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function RemindersSection() {
  const reminders = useReminders();
  const { habits, status: habitsStatus, reload: reloadHabits } = useHabits();
  const { routines, status: routinesStatus, reload: reloadRoutines } = useRoutines();
  const [asking, setAsking] = useState(false);
  const [masterBusy, setMasterBusy] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);

  if (!reminders.supported) {
    return (
      <Card>
        <SectionTitle icon="bell">Reminders</SectionTitle>
        <Text style={styles.body}>Reminders are available in the Android and iOS app, not on the web.</Text>
      </Card>
    );
  }

  if (reminders.status === 'loading') {
    return (
      <Card>
        <SectionTitle icon="bell">Reminders</SectionTitle>
        <ActivityIndicator color={Palette.accent} />
      </Card>
    );
  }

  if (reminders.status === 'load-error') {
    return (
      <Card>
        <SectionTitle icon="bell">Reminders</SectionTitle>
        <Text style={styles.body}>
          Couldn’t load your reminder settings. Nothing has been changed, and reminders that were already scheduled keep
          working.
        </Text>
        <SmallButton label="Try again" onPress={reminders.reload} />
      </Card>
    );
  }

  const { settings, permission } = reminders;
  const problem = permissionProblem(permission);
  const habitsById = new Map(habits.map((h) => [h.id, h]));
  const itemsLocked = !settings.enabled;

  const ask = async () => {
    setAsking(true);
    try {
      await reminders.askPermission();
    } finally {
      setAsking(false);
    }
  };

  /** Turning a reminder ON needs permission; turning it OFF never does. */
  const toggleItem = async (kind: ReminderKind, id: string, enabled: boolean, time: ReminderTime) => {
    if (enabled) {
      const result = await reminders.askPermission();
      if (!canDeliver(result.state)) return false;
    }
    await reminders.setItemReminder(kind, id, { enabled, time });
    return true;
  };

  const toggleMaster = async (enabled: boolean) => {
    setMasterBusy(true);
    setMasterError(null);
    try {
      await reminders.setMasterEnabled(enabled);
      if (enabled && canRequestPermission(permission.state)) await reminders.askPermission();
    } catch (error) {
      console.warn('[momentum] Failed to save reminder switch', error);
      setMasterError('Couldn’t save this change. Nothing was changed — try again.');
    } finally {
      setMasterBusy(false);
    }
  };

  return (
    <>
      <Card>
        <SectionTitle icon="bell">Reminders</SectionTitle>
        <PermissionStatus permission={permission} />
        {problem && (
          <PermissionNotice
            problem={problem}
            busy={asking}
            onAsk={() => void ask()}
            onOpenSettings={reminders.openSystemSettings}
            onRecheck={() => void reminders.recheckPermission()}
          />
        )}

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>All reminders</Text>
            <Text style={styles.rowSub}>
              {settings.enabled ? 'On. Choose which routines and habits remind you below.' : 'Paused. Your choices below are kept.'}
            </Text>
          </View>
          {masterBusy ? (
            <ActivityIndicator color={Palette.accent} />
          ) : (
            <Switch
              value={settings.enabled}
              onValueChange={(v) => void toggleMaster(v)}
              trackColor={{ false: Palette.border, true: Palette.accentSoft }}
              thumbColor={settings.enabled ? Palette.accent : Palette.textSecondary}
              accessibilityLabel="All reminders"
            />
          )}
        </View>
        {masterError && <Text style={styles.error}>{masterError}</Text>}

        <SyncStatus sync={reminders.sync} permission={permission} onRetry={reminders.retrySync} />
      </Card>

      {reminders.overlaps.length > 0 && (
        <OverlapCard
          overlaps={reminders.overlaps}
          onTurnOff={(kind, id, time) => reminders.setItemReminder(kind, id, { enabled: false, time })}
        />
      )}

      <Card dim={itemsLocked}>
        <SectionTitle icon="routine">Routines</SectionTitle>
        {routinesStatus === 'loading' || habitsStatus === 'loading' ? (
          <ActivityIndicator color={Palette.accent} />
        ) : routinesStatus === 'load-error' ? (
          <LoadError what="routines" onRetry={reloadRoutines} />
        ) : routines.length === 0 ? (
          <Text style={styles.body}>Create a routine in Habits › Routines to get a reminder for it.</Text>
        ) : (
          <>
            <Text style={styles.hint}>Sent only on days when at least one of the routine’s habits is due.</Text>
            {routines.map((r, i) => {
              const days = routineDueWeekdays(r, habitsById);
              return (
                <View key={r.id} style={i > 0 && styles.divider}>
                  <ReminderItemRow
                    icon={<RoutineIcon routine={r} size={36} />}
                    title={r.title}
                    daysLabel={days.length ? describeSchedule({ kind: 'weekdays', days }) : null}
                    setting={settings.routines[r.id]}
                    defaultTime={ROUTINE_DEFAULT_TIMES[r.timeOfDay]}
                    onToggle={(enabled, time) => toggleItem('routine', r.id, enabled, time)}
                    onSaveTime={(time) => reminders.setItemReminder('routine', r.id, { enabled: true, time })}
                    disabled={itemsLocked || habitsStatus !== 'ready'}
                  />
                </View>
              );
            })}
          </>
        )}
      </Card>

      <Card dim={itemsLocked}>
        <SectionTitle icon="habit">Habits</SectionTitle>
        {habitsStatus === 'loading' ? (
          <ActivityIndicator color={Palette.accent} />
        ) : habitsStatus === 'load-error' ? (
          <LoadError what="habits" onRetry={reloadHabits} />
        ) : habits.length === 0 ? (
          <Text style={styles.body}>Create a habit to get a reminder for it.</Text>
        ) : (
          <>
            <Text style={styles.hint}>Sent only on the days each habit is scheduled.</Text>
            {habits.map((h, i) => (
              <View key={h.id} style={i > 0 && styles.divider}>
                <ReminderItemRow
                  icon={<RoutineIcon routine={h} size={36} />}
                  title={h.name}
                  daysLabel={describeSchedule(h.schedule)}
                  setting={settings.habits[h.id]}
                  defaultTime={DEFAULT_HABIT_REMINDER_TIME}
                  onToggle={(enabled, time) => toggleItem('habit', h.id, enabled, time)}
                  onSaveTime={(time) => reminders.setItemReminder('habit', h.id, { enabled: true, time })}
                  disabled={itemsLocked}
                />
              </View>
            ))}
          </>
        )}
      </Card>

      <HelpCard inExpoGo={reminders.inExpoGo} canTest={canDeliver(permission.state)} onTest={reminders.sendTest} />

      {__DEV__ && <PermissionDiagnostics report={reminders.permissionReport} onRecheck={reminders.recheckPermission} />}
    </>
  );
}

// ---------------------------------------------------------------------------

function PermissionStatus({ permission }: { permission: PermissionInfo }) {
  const map: Record<PermissionInfo['state'], { label: string; color: string }> = {
    checking: { label: 'Checking notification permission…', color: Palette.textMuted },
    unsupported: { label: 'Not available here', color: Palette.textMuted },
    undetermined: { label: 'Notifications not allowed yet', color: '#FBBF24' },
    denied: { label: 'Notifications not allowed', color: '#FBBF24' },
    blocked: { label: 'Notifications blocked', color: Palette.danger },
    granted: {
      label: permission.channelsOff.length ? 'Allowed, but some categories are off' : 'Notifications allowed',
      color: permission.channelsOff.length ? '#FBBF24' : Palette.success,
    },
    'system-allowed': {
      label: permission.channelsOff.length
        ? 'Allowed in Android settings, but some categories are off'
        : 'Notifications allowed in Android settings',
      color: permission.channelsOff.length ? '#FBBF24' : Palette.success,
    },
    error: { label: 'Couldn’t check notification permission', color: '#FBBF24' },
  };
  const { label, color } = map[permission.state];
  return (
    <View style={styles.status} accessibilityLabel={label}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

function SyncStatus({ sync, permission, onRetry }: { sync: SyncState; permission: PermissionInfo; onRetry: () => void }) {
  if (!canDeliver(permission.state)) return null;
  const r = sync.result;
  let text: string;
  let problem = false;
  if (sync.phase === 'syncing') text = 'Updating reminders…';
  else if (!r || r.status === 'skipped') text = 'Waiting for your habits and routines to load…';
  else if (r.status === 'list-failed') {
    text = 'Couldn’t check scheduled reminders. Retrying automatically.';
    problem = true;
  } else if (r.failures.length > 0) {
    const n = r.failures.length;
    text = `${n} reminder ${n === 1 ? 'change' : 'changes'} couldn’t be applied. Retrying automatically. Your settings are saved.`;
    problem = true;
  } else {
    text =
      r.desiredCount === 0
        ? 'Up to date · no reminders scheduled'
        : `Up to date · ${r.desiredCount} scheduled ${r.desiredCount === 1 ? 'notification' : 'notifications'}`;
  }
  return (
    <View style={styles.syncRow}>
      <Text style={[styles.syncText, problem && styles.syncProblem]}>{text}</Text>
      {problem && <SmallButton label="Retry now" onPress={onRetry} />}
      {r?.status === 'done' && r.omittedForLimit > 0 && (
        <Text style={styles.syncProblem}>
          {r.omittedForLimit} {r.omittedForLimit === 1 ? 'reminder is' : 'reminders are'} paused because the device limit
          was reached. Turn off a few reminders to make room.
        </Text>
      )}
    </View>
  );
}

function OverlapCard({
  overlaps,
  onTurnOff,
}: {
  overlaps: ReminderOverlap[];
  onTurnOff: (kind: ReminderKind, id: string, time: ReminderTime) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sameTimeCount = overlaps.filter((o) => o.minutesApart === 0).length;

  const turnOff = async (key: string, kind: ReminderKind, id: string, time: ReminderTime) => {
    setBusy(key);
    setError(null);
    try {
      await onTurnOff(kind, id, time);
    } catch (e) {
      console.warn('[momentum] Failed to turn off reminder', e);
      setError('Couldn’t save this change. Nothing was changed — try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.card, styles.overlapCard, sameTimeCount > 0 && styles.overlapStrong]}>
      <SectionTitle icon="overlap">
        {sameTimeCount > 0 ? 'Double reminders at the same time' : 'Habits with two reminders'}
      </SectionTitle>
      <Text style={styles.body}>
        These habits have their own reminder and are also in a routine with a reminder, so you’ll get both. Nothing is
        turned off unless you choose to.
      </Text>
      {overlaps.map((o) => {
        const key = `${o.habit.id}:${o.routine.id}`;
        return (
          <View key={key} style={styles.overlapItem}>
            <Text style={styles.rowTitle}>
              {o.habit.name} <Text style={styles.rowSub}>in</Text> {o.routine.title}
            </Text>
            <Text style={[styles.rowSub, o.minutesApart === 0 && styles.syncProblem]}>
              Habit {formatTime(o.habitTime)} · Routine {formatTime(o.routineTime)}
              {o.minutesApart === 0 ? ' · same time' : ''}
            </Text>
            <View style={styles.overlapActions}>
              <SmallButton
                label="Turn off habit reminder"
                disabled={busy !== null}
                onPress={() => void turnOff(key, 'habit', o.habit.id, o.habitTime)}
              />
              <SmallButton
                label="Turn off routine reminder"
                disabled={busy !== null}
                onPress={() => void turnOff(key, 'routine', o.routine.id, o.routineTime)}
              />
            </View>
          </View>
        );
      })}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function HelpCard({ inExpoGo, canTest, onTest }: { inExpoGo: boolean; canTest: boolean; onTest: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  const test = async () => {
    setTestState('sending');
    setTestError(null);
    try {
      await onTest();
      setTestState('sent');
    } catch (e) {
      console.warn('[momentum] Test notification failed', e);
      setTestError(e instanceof Error && e.message ? e.message : String(e));
      setTestState('error');
    }
  };

  return (
    <Card>
      <SectionTitle icon="help">How reminders work</SectionTitle>
      <Text style={styles.body}>
        If a reminder arrives while MOMENTUM is open and that habit (or every habit due in that routine) is already done,
        it stays quiet. In the background it may still arrive after you’ve finished, because the phone delivers it
        without opening the app.
      </Text>

      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]}>
        <Text style={styles.rowTitle}>Reminders late or missing?</Text>
        <SymbolView
          name={
            open
              ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
              : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
          }
          size={16}
          tintColor={Palette.textSecondary}
        />
      </Pressable>
      {open && (
        <View style={styles.helpList}>
          <Text style={styles.body}>• Reminders are local to this phone. No account or internet connection is needed.</Text>
          <Text style={styles.body}>
            • Android may delay them by a few minutes, especially on battery saver or when the phone is idle.
          </Text>
          <Text style={styles.body}>
            • Some phones stop apps that aren’t opened often. If reminders stop, allow MOMENTUM to run in the background
            in your phone’s battery settings.
          </Text>
          <Text style={styles.body}>
            • After “Force stop” Android removes scheduled reminders. Opening MOMENTUM schedules them again.
          </Text>
          <Text style={styles.body}>
            • After travelling to another time zone, open MOMENTUM once so reminders line up with local time.
          </Text>
          {inExpoGo && (
            <Text style={styles.body}>
              • You’re using Expo Go: notifications show Expo Go’s name and icon, and their permission and categories are
              under Expo Go in system settings. The installed app will show MOMENTUM.
            </Text>
          )}
        </View>
      )}

      <View style={styles.testRow}>
        <SmallButton
          label={testState === 'sending' ? 'Sending…' : 'Send a test notification'}
          onPress={() => void test()}
          disabled={!canTest || testState === 'sending'}
        />
        <Text style={styles.hint}>
          {!canTest
            ? 'Allow notifications to send a test.'
            : testState === 'sent'
              ? 'Arrives in about 5 seconds. Try locking the phone.'
              : testState === 'error'
                ? 'Couldn’t schedule the test notification.'
                : 'Arrives in about 5 seconds.'}
        </Text>
        {testError && (
          <Text style={styles.error} accessibilityRole="alert">
            {testError}
          </Text>
        )}
      </View>
    </Card>
  );
}

/**
 * TEMPORARY — development builds / Expo Go only (`__DEV__`). Shows the raw
 * permission response and channel status to diagnose permission issues.
 * Contains no habit names, routine titles or other user data.
 */
function PermissionDiagnostics({
  report,
  onRecheck,
}: {
  report: PermissionReport | null;
  onRecheck: () => Promise<unknown>;
}) {
  const [probe, setProbe] = useState<string[] | null>(null);
  const lines = !report
    ? ['No check yet']
    : [
        `state: ${report.info.state}${report.info.error ? ` (error: ${report.info.error})` : ''}`,
        report.raw
          ? `raw: status=${report.raw.status} granted=${String(report.raw.granted)} canAskAgain=${String(report.raw.canAskAgain)}`
          : 'raw: (none)',
        report.raw?.android
          ? `android: importance=${String(report.raw.android.importance)} interruptionFilter=${String(report.raw.android.interruptionFilter)}`
          : 'android: (none)',
        ...report.channels.map(
          (c) => `channel ${c.id}: importance=${c.importance ?? 'missing'}${c.error ? ` error=${c.error}` : ''}`,
        ),
        `last action: ${report.requested ? 'requested dialog' : 'check only'}`,
      ];
  return (
    <Card>
      <SectionTitle icon="help">Notification diagnostics (dev only)</SectionTitle>
      {lines.map((line) => (
        <Text key={line} style={styles.mono} selectable>
          {line}
        </Text>
      ))}
      <SmallButton label="Check again" onPress={() => void onRecheck()} />
      {probe?.map((line) => (
        <Text key={line} style={styles.mono} selectable>
          {line}
        </Text>
      ))}
      <SmallButton label="Run channel probe" onPress={() => void probeChannels().then(setProbe)} />
    </Card>
  );
}

// ---------------------------------------------------------------------------

function Card({ children, dim = false }: { children: ReactNode; dim?: boolean }) {
  return <View style={[styles.card, dim && styles.dimCard]}>{children}</View>;
}

const SECTION_ICONS = {
  bell: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
  routine: { ios: 'list.bullet.rectangle', android: 'view_list', web: 'view_list' },
  habit: { ios: 'checklist', android: 'checklist', web: 'checklist' },
  overlap: { ios: 'bell.badge', android: 'notifications_active', web: 'notifications_active' },
  help: { ios: 'questionmark.circle', android: 'help', web: 'help' },
} as const;

function SectionTitle({ icon, children }: { icon: keyof typeof SECTION_ICONS; children: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <SymbolView name={SECTION_ICONS[icon]} size={18} tintColor={Palette.accent} />
      <Text style={styles.sectionText} accessibilityRole="header">
        {children}
      </Text>
    </View>
  );
}

function SmallButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.smallButton, disabled && styles.dim, pressed && styles.pressed]}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <View style={styles.helpList}>
      <Text style={styles.body}>Couldn’t load your {what}. Reminders already scheduled are left as they are.</Text>
      <SmallButton label="Try again" onPress={onRetry} />
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
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
  },
  title: {
    color: Palette.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginBottom: Spacing.two,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  dimCard: {
    opacity: 0.55,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionText: {
    flex: 1,
    color: Palette.text,
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    flexShrink: 1,
    color: Palette.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: Palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  rowTitle: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    color: Palette.textSecondary,
    fontSize: 13,
    fontWeight: '400',
  },
  syncRow: {
    gap: Spacing.two,
  },
  syncText: {
    color: Palette.textMuted,
    fontSize: 13,
  },
  syncProblem: {
    color: '#FBBF24',
    fontSize: 13,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  overlapCard: {
    backgroundColor: 'rgba(91, 141, 239, 0.08)',
    borderColor: 'rgba(91, 141, 239, 0.35)',
  },
  overlapStrong: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  overlapItem: {
    gap: 4,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  overlapActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: 6,
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  helpList: {
    gap: Spacing.two,
  },
  testRow: {
    gap: Spacing.two,
  },
  smallButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
    justifyContent: 'center',
  },
  smallButtonText: {
    color: Palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  error: {
    color: Palette.danger,
    fontSize: 13,
  },
  mono: {
    color: Palette.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  dim: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.8,
  },
});
