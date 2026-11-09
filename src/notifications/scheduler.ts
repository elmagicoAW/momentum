/**
 * The ONLY module that talks to `expo-notifications`. Everything else works on
 * plain values (see reconcile.ts / reminder-plan.ts), so it can be tested in Node.
 *
 * Local notifications only — no push tokens, no server.
 */
import { isRunningInExpoGo } from 'expo';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import {
  askForPermission,
  checkPermission,
  type PermissionDeps,
  type PermissionReport,
} from '@/notifications/permission-check';
import type { ReminderScheduler } from '@/notifications/reconcile';
import {
  HABIT_CHANNEL_ID,
  MAX_SCHEDULED_ANDROID,
  MAX_SCHEDULED_IOS,
  ROUTINE_CHANNEL_ID,
  TEST_ID_PREFIX,
  type PlannedReminder,
  type ReminderChannelId,
  type ScheduledInfo,
} from '@/utils/reminder-plan';
import {
  shouldSuppressInForeground,
  timeZoneSignature,
  type ForegroundContext,
  type ReminderData,
} from '@/utils/reminder-presentation';

export const notificationsSupported = Platform.OS === 'android' || Platform.OS === 'ios';
export const runningInExpoGo = isRunningInExpoGo();
export const scheduleLimit = Platform.OS === 'ios' ? MAX_SCHEDULED_IOS : MAX_SCHEDULED_ANDROID;

// ---------------------------------------------------------------------------
// Channels (Android)
// ---------------------------------------------------------------------------

/**
 * Importance/sound can't be changed by the app after a channel exists (only
 * name/description) — the user owns them from then on. Changing them would
 * need a NEW channel ID.
 */
const CHANNELS: { id: ReminderChannelId; name: string; description: string }[] = [
  { id: HABIT_CHANNEL_ID, name: 'Habit reminders', description: 'Reminders for individual habits.' },
  { id: ROUTINE_CHANNEL_ID, name: 'Routine reminders', description: 'Reminders for your routines.' },
];

let channelsReady: Promise<void> | null = null;

/** Idempotent. Must run before the Android 13+ permission dialog can appear. */
export function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelsReady ??= Promise.all(
    CHANNELS.map((c) =>
      Notifications.setNotificationChannelAsync(c.id, {
        name: c.name,
        description: c.description,
        importance: AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: '#8B7CF6',
        showBadge: false,
      }),
    ),
  )
    .then(() => undefined)
    .catch((error) => {
      channelsReady = null; // retry next time
      throw error;
    });
  return channelsReady;
}

// ---------------------------------------------------------------------------
// Permission (logic in permission-check.ts; this only wires the native calls)
// ---------------------------------------------------------------------------

const permissionDeps: PermissionDeps = {
  platform: Platform.OS,
  supported: notificationsSupported,
  channelIds: CHANNELS.map((c) => c.id),
  getRaw: () => Notifications.getPermissionsAsync(),
  requestRaw: () => Notifications.requestPermissionsAsync(),
  ensureChannels,
  getChannelImportance: async (id) => {
    const channel = await Notifications.getNotificationChannelAsync(id);
    return channel ? channel.importance : null;
  },
};

/**
 * TEMPORARY development diagnostics (dev builds / Expo Go only, never in
 * production). Logs only permission and channel status — no habit names,
 * routine titles or other user data.
 */
function logDiagnostics(label: string, report: PermissionReport) {
  if (!__DEV__) return;
  console.log(`[momentum][notifications] ${label}`, {
    platform: Platform.OS,
    osVersion: Platform.Version,
    expoGo: runningInExpoGo,
    state: report.info.state,
    error: report.info.error ?? null,
    requested: report.requested,
    raw: report.raw
      ? {
          status: report.raw.status,
          granted: report.raw.granted,
          canAskAgain: report.raw.canAskAgain,
          androidImportance: report.raw.android?.importance ?? null,
          interruptionFilter: report.raw.android?.interruptionFilter ?? null,
        }
      : null,
    channels: report.channels,
  });
}

/**
 * TEMPORARY development probe: isolates the Android channel failure from the
 * app's channel options. Each step runs independently and reports ok/error —
 * nothing is marked successful unless the native call actually resolved.
 *
 * 1. getNotificationChannelsAsync() — no arguments at all.
 * 2. getNotificationChannelAsync(<id that never exists>) — expected `null`.
 * 3. setNotificationChannelAsync(HABIT_CHANNEL_ID, { name, importance }) — the
 *    smallest valid input, same ID/name/importance the app already uses (so it
 *    can't change anything the user configured: Android ignores importance on
 *    an existing channel).
 *
 * If 1 and 2 fail too, the app's channel options can't be the cause.
 */
export async function probeChannels(): Promise<string[]> {
  if (Platform.OS !== 'android') return ['probe: android only'];
  const step = async (label: string, run: () => Promise<unknown>) => {
    try {
      const result = await run();
      return `${label}: ok (${result === null ? 'null' : Array.isArray(result) ? `${result.length} channels` : typeof result})`;
    } catch (error) {
      return `${label}: ERROR ${error instanceof Error ? error.message : String(error)}`;
    }
  };
  const lines = [
    `expoGo=${String(runningInExpoGo)} osVersion=${String(Platform.Version)}`,
    await step('1 getChannels()', () => Notifications.getNotificationChannelsAsync()),
    await step('2 getChannel(missing id)', () =>
      Notifications.getNotificationChannelAsync('momentum-probe-does-not-exist'),
    ),
    await step('3 setChannel(minimal)', () =>
      Notifications.setNotificationChannelAsync(HABIT_CHANNEL_ID, {
        name: 'Habit reminders',
        importance: AndroidImportance.HIGH,
      }),
    ),
  ];
  if (__DEV__) console.log('[momentum][notifications] channel probe', lines);
  return lines;
}

/** Reads the current status. Never shows anything to the user. */
export async function readPermission(): Promise<PermissionReport> {
  const report = await checkPermission(permissionDeps);
  logDiagnostics('permission check', report);
  return report;
}

/**
 * From a user action: creates channels first, then shows the system dialog
 * only if Android can still show it (never for allowed/blocked states).
 */
export async function requestPermission(): Promise<PermissionReport> {
  const report = await askForPermission(permissionDeps);
  logDiagnostics('permission request', report);
  return report;
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

function toTriggerInput(r: PlannedReminder): Notifications.SchedulableNotificationTriggerInput {
  if (r.trigger.type === 'daily') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: r.trigger.hour,
      minute: r.trigger.minute,
      channelId: r.channelId,
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: r.trigger.weekday,
    hour: r.trigger.hour,
    minute: r.trigger.minute,
    channelId: r.channelId,
  };
}

export const expoScheduler: ReminderScheduler = {
  async listScheduled(): Promise<ScheduledInfo[]> {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    return requests.map((req) => {
      const sig = (req.content.data as Record<string, unknown> | null | undefined)?.sig;
      return { identifier: req.identifier, sig: typeof sig === 'string' ? sig : null };
    });
  },
  async cancel(identifier) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  },
  async schedule(r) {
    await ensureChannels();
    const data: ReminderData = { v: 1, kind: r.kind, id: r.targetId, slot: r.slot, sig: r.sig };
    await Notifications.scheduleNotificationAsync({
      identifier: r.identifier,
      content: { title: r.title, body: r.body, data, sound: true },
      trigger: toTriggerInput(r),
    });
  },
};

/** One-off notification ~5 s from now. Its ID is never touched by reconciliation. */
export async function sendTestNotification(): Promise<void> {
  await ensureChannels();
  await Notifications.scheduleNotificationAsync({
    identifier: `${TEST_ID_PREFIX}${Date.now()}`,
    content: {
      title: 'MOMENTUM reminders are working',
      body: 'This is what a reminder looks like.',
      sound: true,
      data: { test: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: HABIT_CHANNEL_ID,
    },
  });
}

/** Device time-zone signature (zone name + current UTC offset). */
export function currentTimeZoneSignature(now = new Date()): string {
  let zone: string | undefined;
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    zone = undefined;
  }
  return timeZoneSignature(zone, now.getTimezoneOffset());
}

// ---------------------------------------------------------------------------
// Foreground presentation
// ---------------------------------------------------------------------------

let foregroundContext: Omit<ForegroundContext, 'today'> | null = null;

/**
 * The reminders provider keeps this up to date with habits, routines and
 * today's progress (null = unknown → every reminder is shown).
 */
export function setForegroundContext(context: Omit<ForegroundContext, 'today'> | null) {
  foregroundContext = context;
}

let handlerInstalled = false;

/**
 * Installed once at startup. Decides synchronously (well within the 3 s limit)
 * from in-memory state. Only affects notifications that arrive while MOMENTUM
 * is in the foreground; background delivery is up to the OS.
 */
export function installForegroundHandler() {
  if (handlerInstalled || !notificationsSupported) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      let quiet = false;
      try {
        const context = foregroundContext;
        quiet = context
          ? shouldSuppressInForeground(notification.request.content.data, { ...context, today: new Date() })
          : false;
      } catch {
        quiet = false; // never hide because of a bug
      }
      return {
        shouldShowBanner: !quiet,
        shouldShowList: !quiet,
        shouldPlaySound: !quiet,
        shouldSetBadge: false,
      };
    },
  });
}
