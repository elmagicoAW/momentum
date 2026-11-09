import type { TimeOfDay } from '@/data/routine-storage';

/** Local wall-clock time. `hour` 0–23, `minute` 0–59. */
export type ReminderTime = { hour: number; minute: number };

export const DEFAULT_HABIT_REMINDER_TIME: ReminderTime = { hour: 9, minute: 0 };

/** A routine reminder starts inside the routine's preferred time-of-day bucket. */
export const ROUTINE_DEFAULT_TIMES: Record<TimeOfDay, ReminderTime> = {
  morning: { hour: 7, minute: 30 },
  afternoon: { hour: 13, minute: 0 },
  evening: { hour: 20, minute: 0 },
  anytime: { hour: 9, minute: 0 },
};

export const MINUTE_STEP = 5;

export function isValidReminderTime(value: unknown): value is ReminderTime {
  if (typeof value !== 'object' || value === null) return false;
  const { hour, minute } = value as Record<string, unknown>;
  return (
    typeof hour === 'number' &&
    typeof minute === 'number' &&
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

export function sameTime(a: ReminderTime, b: ReminderTime): boolean {
  return a.hour === b.hour && a.minute === b.minute;
}

/** Minutes after midnight. */
export function minutesOfDay(t: ReminderTime): number {
  return t.hour * 60 + t.minute;
}

/** Shortest distance between two times on the 24 h clock, in minutes (0–720). */
export function minutesApart(a: ReminderTime, b: ReminderTime): number {
  const d = Math.abs(minutesOfDay(a) - minutesOfDay(b));
  return Math.min(d, 1440 - d);
}

/** Wraps within the day: 23 + 1 → 0. */
export function stepHour(t: ReminderTime, delta: number): ReminderTime {
  return { hour: (((t.hour + delta) % 24) + 24) % 24, minute: t.minute };
}

/** Snaps to the minute grid and wraps within the hour (the hour is not carried). */
export function stepMinute(t: ReminderTime, delta: number, step = MINUTE_STEP): ReminderTime {
  const snapped = Math.round(t.minute / step) * step;
  const next = (((snapped + delta * step) % 60) + 60) % 60;
  return { hour: t.hour, minute: next };
}

/** "7:30 AM" (12 h) or "07:30" (24 h). Formatted manually so it's identical on every JS engine. */
export function formatReminderTime(t: ReminderTime, hour12: boolean): string {
  const mm = String(t.minute).padStart(2, '0');
  if (!hour12) return `${String(t.hour).padStart(2, '0')}:${mm}`;
  const suffix = t.hour < 12 ? 'AM' : 'PM';
  const h = t.hour % 12 === 0 ? 12 : t.hour % 12;
  return `${h}:${mm} ${suffix}`;
}

/** Best guess at the device's clock style. Falls back to 24 h when Intl can't tell. */
export function deviceUses12HourClock(): boolean {
  try {
    const options = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions() as {
      hour12?: boolean;
      hourCycle?: string;
    };
    if (typeof options.hour12 === 'boolean') return options.hour12;
    if (options.hourCycle) return options.hourCycle === 'h11' || options.hourCycle === 'h12';
  } catch {
    // Intl unavailable — fall through.
  }
  return false;
}

/**
 * Times that can be skipped or repeated on a daylight-saving change day in many
 * time zones (clocks usually change between 01:00 and 03:00 local time).
 */
export function isNearDstChangeHour(t: ReminderTime): boolean {
  return t.hour >= 1 && t.hour <= 2;
}
