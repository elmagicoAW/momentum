/**
 * Pure decisions around delivered notifications and permission status.
 * No Expo imports — the native layer passes plain values in.
 */
import type { DayRecord } from '@/data/completion-storage';
import type { Habit } from '@/data/habit-storage';
import type { Routine } from '@/data/routine-storage';
import { isCompleteNow } from '@/utils/habit-progress';
import { isScheduledOn } from '@/utils/schedule';
import type { ReminderChannelId } from '@/utils/reminder-plan';

// ---------------------------------------------------------------------------
// Notification data
// ---------------------------------------------------------------------------

/** What every MOMENTUM reminder carries in `content.data`. Only IDs — no other user content. */
export type ReminderData = { v: 1; kind: 'habit' | 'routine'; id: string; slot: string; sig: string };

export function parseReminderData(data: unknown): ReminderData | null {
  if (typeof data !== 'object' || data === null) return null;
  const { v, kind, id, slot, sig } = data as Record<string, unknown>;
  if (v !== 1 || (kind !== 'habit' && kind !== 'routine')) return null;
  if (typeof id !== 'string' || id.length === 0) return null;
  return { v: 1, kind, id, slot: typeof slot === 'string' ? slot : '', sig: typeof sig === 'string' ? sig : '' };
}

// ---------------------------------------------------------------------------
// Foreground presentation
// ---------------------------------------------------------------------------

export type ForegroundContext = {
  habitsById: ReadonlyMap<string, Habit>;
  routinesById: ReadonlyMap<string, Routine>;
  /** Today's progress, or null while it's loading / failed to load. */
  todayRecord: DayRecord | null;
  today: Date;
};

/**
 * True when a reminder arriving while MOMENTUM is open should stay quiet:
 * - habit: already complete today (partial progress still shows the reminder)
 * - routine: every habit due today in it is complete, or nothing in it is due
 * - the habit/routine no longer exists (a stale reminder about to be cancelled)
 * Unknown data, or progress that hasn't loaded → shown (never hide by mistake).
 */
export function shouldSuppressInForeground(data: unknown, ctx: ForegroundContext): boolean {
  const parsed = parseReminderData(data);
  if (!parsed) return false;
  if (parsed.kind === 'habit') {
    const habit = ctx.habitsById.get(parsed.id);
    if (!habit) return ctx.habitsById.size > 0; // deleted habit (only judged once habits are known)
    if (!ctx.todayRecord) return false;
    return isCompleteNow(ctx.todayRecord, habit);
  }
  const routine = ctx.routinesById.get(parsed.id);
  if (!routine) return ctx.routinesById.size > 0;
  if (!ctx.todayRecord) return false;
  const due = routine.habitIds
    .map((id) => ctx.habitsById.get(id))
    .filter((h): h is Habit => h !== undefined && isScheduledOn(h, ctx.today));
  if (due.length === 0) return true;
  return due.every((h) => isCompleteNow(ctx.todayRecord ?? undefined, h));
}

// ---------------------------------------------------------------------------
// Tap navigation
// ---------------------------------------------------------------------------

export type TapTarget = { screen: 'today' } | { screen: 'routine'; id: string };

/**
 * Where a tapped reminder opens. Habit → Today (where check-in happens).
 * Routine → its detail screen if it still exists, otherwise Today.
 * Non-MOMENTUM data → null (ignored).
 */
export function tapTarget(data: unknown, routineIds: ReadonlySet<string>): TapTarget | null {
  const parsed = parseReminderData(data);
  if (!parsed) return null;
  if (parsed.kind === 'routine' && routineIds.has(parsed.id)) return { screen: 'routine', id: parsed.id };
  return { screen: 'today' };
}

/** Key that identifies one delivered notification, so a tap is handled once. */
export function responseKey(identifier: string, date: number): string {
  return `${identifier}@${date}`;
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

export type PermissionState =
  | 'checking'
  /** Web, or anywhere scheduling isn't available. */
  | 'unsupported'
  /** Never asked (or the dialog was dismissed) — the system dialog can be shown. */
  | 'undetermined'
  /** Denied, but Android will still show the dialog again. */
  | 'denied'
  /** Denied and the dialog won't appear any more — only system settings can fix it. */
  | 'blocked'
  | 'granted'
  /**
   * Android reports notifications ENABLED for the app, but Expo's permission
   * layer doesn't report POST_NOTIFICATIONS as granted. Seen in Expo Go, whose
   * per-project permission records are separate from the system switch.
   * Notifications are delivered by the OS, so this counts as allowed.
   */
  | 'system-allowed'
  /** Checking failed (API error). Unknown — never shown as "not allowed". */
  | 'error';

export type PermissionInfo = {
  state: PermissionState;
  /** Channels the user turned off in system settings (only meaningful when allowed). */
  channelsOff: ReminderChannelId[];
  /** Set when `state === 'error'`. */
  error?: string;
};

/** Raw `getPermissionsAsync()` / `requestPermissionsAsync()` result (the fields we use). */
export type RawPermission = {
  status: string;
  granted: boolean;
  canAskAgain: boolean;
  /** Android only. `importance` is Android's RAW app importance: IMPORTANCE_NONE = 0 (blocked). */
  android?: { importance?: number; interruptionFilter?: number } | null;
};

/** Android `NotificationManagerCompat.IMPORTANCE_NONE` (raw value, not Expo's channel enum). */
export const ANDROID_APP_IMPORTANCE_NONE = 0;

/**
 * Maps a raw permission response to a state.
 *
 * Android (expo-notifications 58.x, `NotificationPermissionsModule.kt`):
 * - API 33+: status = denied if POST_NOTIFICATIONS is denied OR
 *   `areNotificationsEnabled()` is false; granted if granted; otherwise
 *   'undetermined'. So 'undetermined' is only ever returned while Android has
 *   notifications ENABLED → 'system-allowed' (deliverable).
 * - Below API 33: status = granted ⇔ notifications enabled.
 * - `android.importance === 0` means the app's notifications are off in system
 *   settings, whatever the status says.
 */
export function toPermissionState(response: RawPermission, platform: string = 'android'): PermissionState {
  if (platform === 'android') {
    const importance = response.android?.importance;
    if (importance === ANDROID_APP_IMPORTANCE_NONE) return response.canAskAgain ? 'denied' : 'blocked';
    if (response.granted || response.status === 'granted') return 'granted';
    if (response.status === 'undetermined') return 'system-allowed';
    return response.canAskAgain ? 'denied' : 'blocked';
  }
  if (response.granted || response.status === 'granted') return 'granted';
  if (response.status === 'undetermined') return response.canAskAgain ? 'undetermined' : 'blocked';
  return response.canAskAgain ? 'denied' : 'blocked';
}

/** Reminders can be delivered (scheduling and the test notification are allowed). */
export function canDeliver(state: PermissionState): boolean {
  return state === 'granted' || state === 'system-allowed';
}

/** The system dialog may still appear. Never true for blocked/allowed/unknown states. */
export function canRequestPermission(state: PermissionState): boolean {
  return state === 'undetermined' || state === 'denied';
}

export type PermissionAction = 'none' | 'request' | 'open-settings' | 'recheck';

/** What the "fix it" button should do for a state. */
export function permissionAction(state: PermissionState): PermissionAction {
  if (canRequestPermission(state)) return 'request';
  if (state === 'blocked') return 'open-settings';
  if (state === 'error') return 'recheck';
  return 'none';
}

// ---------------------------------------------------------------------------
// Time zones
// ---------------------------------------------------------------------------

/**
 * Identifies the device's current zone AND offset. The offset changes on
 * daylight-saving days and when travelling, the name changes when travelling.
 */
export function timeZoneSignature(zoneName: string | undefined, utcOffsetMinutes: number): string {
  return `${zoneName ?? 'unknown'}|${utcOffsetMinutes}`;
}
