/**
 * Reminder planning — PURE. No Expo imports, no clock reads, no storage.
 *
 * Turns (habits, routines, reminder settings) into the exact set of repeating
 * local notifications that should exist, and diffs that against what the OS
 * has scheduled. Everything here is deterministic so it can be unit-tested.
 *
 * Triggers are repeating wall-clock times (DAILY / WEEKLY), so WHEN a reminder
 * fires never depends on today's date. The time-zone signature only feeds the
 * change-detection hash (see `reminderSignature`).
 */
import type { Habit, Weekday } from '@/data/habit-storage';
import type { ReminderSettings } from '@/data/reminder-storage';
import type { Routine } from '@/data/routine-storage';
import { isScheduledOnWeekday } from '@/utils/schedule';
import type { ReminderTime } from '@/utils/reminder-time';

export const HABIT_CHANNEL_ID = 'habit-reminders';
export const ROUTINE_CHANNEL_ID = 'routine-reminders';
export type ReminderChannelId = typeof HABIT_CHANNEL_ID | typeof ROUTINE_CHANNEL_ID;

/**
 * Every scheduled reminder identifier starts with one of these. Reconciliation
 * only ever cancels identifiers with these prefixes — never anything else
 * (not even MOMENTUM's own test notification).
 */
export const HABIT_ID_PREFIX = 'momentum.h.';
export const ROUTINE_ID_PREFIX = 'momentum.r.';
export const TEST_ID_PREFIX = 'momentum.test.';

/** Content format version, part of every signature. Bump to reschedule everything once. */
const CONTENT_VERSION = 1;

/**
 * Android allows roughly 500 concurrent alarms per app (shared by every project
 * inside Expo Go). iOS keeps at most 64 pending notifications.
 */
export const MAX_SCHEDULED_ANDROID = 150;
export const MAX_SCHEDULED_IOS = 64;

export type ReminderTrigger =
  | { type: 'daily'; hour: number; minute: number }
  /** `weekday`: 1–7 with 1 = Sunday (expo-notifications WEEKLY convention). */
  | { type: 'weekly'; weekday: number; hour: number; minute: number };

export type PlannedReminder = {
  /** OS identifier, e.g. `momentum.h.h_abc.w2`. Deterministic. */
  identifier: string;
  kind: 'habit' | 'routine';
  /** Habit or routine ID. */
  targetId: string;
  /** `d` (daily) or `w1`…`w7`. */
  slot: string;
  channelId: ReminderChannelId;
  trigger: ReminderTrigger;
  title: string;
  body: string;
  /** Hash of everything that affects delivery or content. A change → reschedule. */
  sig: string;
};

export type ReminderPlan = {
  reminders: PlannedReminder[];
  /** Reminders left out because of the platform cap. */
  omittedForLimit: number;
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** App weekday (0 = Sunday … 6 = Saturday) → expo WEEKLY weekday (1 = Sunday … 7 = Saturday). */
export function toTriggerWeekday(day: Weekday): number {
  return day + 1;
}

/** expo WEEKLY weekday → app weekday. */
export function fromTriggerWeekday(weekday: number): Weekday {
  return (weekday - 1) as Weekday;
}

export function habitIdentifier(habitId: string, slot: string): string {
  return `${HABIT_ID_PREFIX}${habitId}.${slot}`;
}

export function routineIdentifier(routineId: string, slot: string): string {
  return `${ROUTINE_ID_PREFIX}${routineId}.${slot}`;
}

/** True only for identifiers that reconciliation is allowed to cancel. */
export function isOwnedReminderIdentifier(identifier: string): boolean {
  return identifier.startsWith(HABIT_ID_PREFIX) || identifier.startsWith(ROUTINE_ID_PREFIX);
}

/** FNV-1a 32-bit, base 36. Stable across runs and engines; not cryptographic. */
export function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * `zone` is the device's time-zone signature (see `timeZoneSignature`). It is
 * part of every signature so a zone or UTC-offset change (travel, daylight
 * saving) reschedules every reminder through the normal diff — even across
 * app restarts — instead of leaving alarms armed at the old absolute instant.
 */
export function reminderSignature(r: Omit<PlannedReminder, 'sig'>, zone: string): string {
  return hashString(
    JSON.stringify([CONTENT_VERSION, r.identifier, r.channelId, r.trigger, r.title, r.body, zone]),
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Weekdays the habit is due on, ascending. */
export function habitDueWeekdays(habit: Pick<Habit, 'schedule'>): Weekday[] {
  return ALL_WEEKDAYS.filter((d) => isScheduledOnWeekday(habit.schedule, d));
}

/** Existing habits of a routine, in routine order (deleted IDs skipped). */
function routineMembers(routine: Routine, habitsById: ReadonlyMap<string, Habit>): Habit[] {
  return routine.habitIds.map((id) => habitsById.get(id)).filter((h): h is Habit => h !== undefined);
}

/** Per weekday (0–6): the routine's existing habits due that day. */
export function routineDueByWeekday(routine: Routine, habitsById: ReadonlyMap<string, Habit>): Habit[][] {
  const members = routineMembers(routine, habitsById);
  return ALL_WEEKDAYS.map((d) => members.filter((h) => isScheduledOnWeekday(h.schedule, d)));
}

/** Weekdays on which at least one of the routine's habits is due. */
export function routineDueWeekdays(routine: Routine, habitsById: ReadonlyMap<string, Habit>): Weekday[] {
  const byDay = routineDueByWeekday(routine, habitsById);
  return ALL_WEEKDAYS.filter((d) => byDay[d].length > 0);
}

function habitBody(habit: Habit): string {
  const t = habit.tracking;
  switch (t.type) {
    case 'tick':
      return 'Due today · tap to check in';
    case 'count':
      return `Goal: ${t.target}${t.unit ? ` ${t.unit}` : ''} today`;
    case 'checklist': {
      const required = t.steps.filter((s) => !s.optional).length;
      return `${plural(required, 'step', 'steps')} today`;
    }
  }
}

function withSig(r: Omit<PlannedReminder, 'sig'>, zone: string): PlannedReminder {
  return { ...r, sig: reminderSignature(r, zone) };
}

function triggerFor(slotDay: Weekday | 'daily', time: ReminderTime): ReminderTrigger {
  return slotDay === 'daily'
    ? { type: 'daily', hour: time.hour, minute: time.minute }
    : { type: 'weekly', weekday: toTriggerWeekday(slotDay), hour: time.hour, minute: time.minute };
}

const slotFor = (slotDay: Weekday | 'daily') => (slotDay === 'daily' ? 'd' : `w${toTriggerWeekday(slotDay)}`);

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

/** Reminders for one habit. Nothing on days the habit isn't due. */
export function planHabitReminders(habit: Habit, time: ReminderTime, zone = ''): PlannedReminder[] {
  const days = habitDueWeekdays(habit);
  if (days.length === 0) return [];
  const slots: (Weekday | 'daily')[] = days.length === 7 ? ['daily'] : days;
  const body = habitBody(habit);
  return slots.map((slotDay) => {
    const slot = slotFor(slotDay);
    return withSig({
      identifier: habitIdentifier(habit.id, slot),
      kind: 'habit',
      targetId: habit.id,
      slot,
      channelId: HABIT_CHANNEL_ID,
      trigger: triggerFor(slotDay, time),
      title: habit.name,
      body,
    }, zone);
  });
}

/**
 * Reminders for one routine: only on weekdays where at least one of its
 * existing habits is due. One DAILY when the same habits are due every day;
 * otherwise one WEEKLY per due weekday, each with that day's habit count.
 */
export function planRoutineReminders(
  routine: Routine,
  habitsById: ReadonlyMap<string, Habit>,
  time: ReminderTime,
  zone = '',
): PlannedReminder[] {
  const byDay = routineDueByWeekday(routine, habitsById);
  const dueDays = ALL_WEEKDAYS.filter((d) => byDay[d].length > 0);
  if (dueDays.length === 0) return [];

  const key = (habits: Habit[]) => habits.map((h) => h.id).join(',');
  const sameEveryDay = dueDays.length === 7 && byDay.every((habits) => key(habits) === key(byDay[0]));
  const slots: (Weekday | 'daily')[] = sameEveryDay ? ['daily'] : dueDays;

  return slots.map((slotDay) => {
    const slot = slotFor(slotDay);
    const due = byDay[slotDay === 'daily' ? 0 : slotDay];
    return withSig({
      identifier: routineIdentifier(routine.id, slot),
      kind: 'routine',
      targetId: routine.id,
      slot,
      channelId: ROUTINE_CHANNEL_ID,
      trigger: triggerFor(slotDay, time),
      title: routine.title,
      body: `${plural(due.length, 'habit', 'habits')} due today`,
    }, zone);
  });
}

/**
 * The complete desired schedule. Only enabled settings for habits/routines
 * that exist are planned. With the master switch off the plan is empty.
 * Order = priority when the cap applies: routines (user order), then habits
 * (list order).
 */
export function planReminders(input: {
  habits: readonly Habit[];
  routines: readonly Routine[];
  settings: ReminderSettings;
  limit: number;
  /** Device time-zone signature; '' in tests that don't care. */
  zone?: string;
}): ReminderPlan {
  const { habits, routines, settings, limit, zone = '' } = input;
  if (!settings.enabled) return { reminders: [], omittedForLimit: 0 };

  const habitsById = new Map(habits.map((h) => [h.id, h]));
  const all: PlannedReminder[] = [];

  for (const routine of routines) {
    const s = settings.routines[routine.id];
    if (s?.enabled) all.push(...planRoutineReminders(routine, habitsById, s.time, zone));
  }
  for (const habit of habits) {
    const s = settings.habits[habit.id];
    if (s?.enabled) all.push(...planHabitReminders(habit, s.time, zone));
  }

  if (all.length <= limit) return { reminders: all, omittedForLimit: 0 };
  return { reminders: all.slice(0, limit), omittedForLimit: all.length - limit };
}

// ---------------------------------------------------------------------------
// Diff against the OS schedule
// ---------------------------------------------------------------------------

export type ScheduledInfo = { identifier: string; sig: string | null };

export type ScheduleDiff = {
  /** Owned identifiers to cancel (stale, or changed and about to be rescheduled). */
  toCancel: string[];
  /** Reminders to schedule (missing, or changed). */
  toSchedule: PlannedReminder[];
  /** Identifiers in `toCancel` that are being replaced (changed signature). */
  replacing: Set<string>;
  /** Already correct — left untouched. */
  unchanged: number;
};

/**
 * Identifiers that aren't owned reminder IDs are ignored completely: they are
 * never cancelled, whatever they are.
 */
export function diffSchedule(existing: readonly ScheduledInfo[], desired: readonly PlannedReminder[]): ScheduleDiff {
  const owned = new Map<string, string | null>();
  for (const e of existing) if (isOwnedReminderIdentifier(e.identifier)) owned.set(e.identifier, e.sig);

  const desiredIds = new Set(desired.map((d) => d.identifier));
  const toCancel: string[] = [];
  const replacing = new Set<string>();
  const toSchedule: PlannedReminder[] = [];
  let unchanged = 0;

  for (const [identifier] of owned) if (!desiredIds.has(identifier)) toCancel.push(identifier);
  for (const d of desired) {
    if (!owned.has(d.identifier)) toSchedule.push(d);
    else if (owned.get(d.identifier) !== d.sig) {
      toCancel.push(d.identifier);
      replacing.add(d.identifier);
      toSchedule.push(d);
    } else unchanged += 1;
  }
  return { toCancel, toSchedule, replacing, unchanged };
}

// ---------------------------------------------------------------------------
// Overlaps: a habit reminder AND a reminder for a routine containing it
// ---------------------------------------------------------------------------

export type ReminderOverlap = {
  habit: Habit;
  routine: Routine;
  habitTime: ReminderTime;
  routineTime: ReminderTime;
  /** 0 = same minute. */
  minutesApart: number;
  /** Weekdays both reminders fire (= the habit's due days). */
  days: Weekday[];
};

export function findOverlaps(
  habits: readonly Habit[],
  routines: readonly Routine[],
  settings: ReminderSettings,
): ReminderOverlap[] {
  if (!settings.enabled) return [];
  const habitsById = new Map(habits.map((h) => [h.id, h]));
  const out: ReminderOverlap[] = [];
  for (const routine of routines) {
    const rs = settings.routines[routine.id];
    if (!rs?.enabled) continue;
    for (const id of routine.habitIds) {
      const habit = habitsById.get(id);
      const hs = habit ? settings.habits[habit.id] : undefined;
      if (!habit || !hs?.enabled) continue;
      const days = habitDueWeekdays(habit);
      if (days.length === 0) continue;
      const d = Math.abs(hs.time.hour * 60 + hs.time.minute - (rs.time.hour * 60 + rs.time.minute));
      out.push({
        habit,
        routine,
        habitTime: hs.time,
        routineTime: rs.time,
        minutesApart: Math.min(d, 1440 - d),
        days,
      });
    }
  }
  return out;
}
