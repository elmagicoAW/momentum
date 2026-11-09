import type { Habit, HabitSchedule, Weekday } from '@/data/habit-storage';

/** Display order for weekday pickers: Monday first. */
export const WEEKDAY_DISPLAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** True when the habit is due on the given date, using the device's local weekday. */
export function isScheduledOn(habit: Pick<Habit, 'schedule'>, date: Date): boolean {
  const { schedule } = habit;
  if (schedule.kind === 'daily') return true;
  return schedule.days.includes(date.getDay() as Weekday);
}

/** e.g. "Every day", "Weekdays", "Weekends", "Mon · Wed · Fri". */
export function describeSchedule(schedule: HabitSchedule): string {
  if (schedule.kind === 'daily') return 'Every day';
  const days = new Set(schedule.days);
  if (days.size === 7) return 'Every day';
  if (days.size === 5 && [1, 2, 3, 4, 5].every((d) => days.has(d as Weekday))) return 'Weekdays';
  if (days.size === 2 && days.has(0) && days.has(6)) return 'Weekends';
  return WEEKDAY_DISPLAY_ORDER.filter((d) => days.has(d))
    .map((d) => WEEKDAY_SHORT[d])
    .join(' · ');
}

/** Same as `isScheduledOn`, for a weekday number (0 = Sunday … 6 = Saturday). */
export function isScheduledOnWeekday(schedule: HabitSchedule, weekday: number): boolean {
  return schedule.kind === 'daily' || schedule.days.includes(weekday as Weekday);
}
