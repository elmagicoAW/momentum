import { appLabel } from '@/i18n/app-copy';
import type { Habit, HabitSchedule, Weekday } from '@/data/habit-storage';

/** Display order for weekday pickers: Monday first. */
export const WEEKDAY_DISPLAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_SHORT = {get 0(){return appLabel("schedule.sun");},get 1(){return appLabel("schedule.mon");},get 2(){return appLabel("schedule.tue");},get 3(){return appLabel("schedule.wed");},get 4(){return appLabel("schedule.thu");},get 5(){return appLabel("schedule.fri");},get 6(){return appLabel("schedule.sat");}} as Readonly<Record<number, string>>;
export const WEEKDAY_LONG = {get 0(){return appLabel("schedule.sunday");},get 1(){return appLabel("schedule.monday");},get 2(){return appLabel("schedule.tuesday");},get 3(){return appLabel("schedule.wednesday");},get 4(){return appLabel("schedule.thursday");},get 5(){return appLabel("schedule.friday");},get 6(){return appLabel("schedule.saturday");}} as Readonly<Record<number, string>>;

/** True when the habit is due on the given date, using the device's local weekday. */
export function isScheduledOn(habit: Pick<Habit, 'schedule'>, date: Date): boolean {
  const { schedule } = habit;
  if (schedule.kind === 'daily') return true;
  return schedule.days.includes(date.getDay() as Weekday);
}

/** e.g. "Every day", "Weekdays", "Weekends", "Mon · Wed · Fri". */
export function describeSchedule(schedule: HabitSchedule): string {
  if (schedule.kind === 'daily') return appLabel("schedule.everyDay");
  const days = new Set(schedule.days);
  if (days.size === 7) return appLabel("schedule.everyDay");
  if (days.size === 5 && [1, 2, 3, 4, 5].every((d) => days.has(d as Weekday))) return appLabel("schedule.weekdays");
  if (days.size === 2 && days.has(0) && days.has(6)) return appLabel("schedule.weekends");
  return WEEKDAY_DISPLAY_ORDER.filter((d) => days.has(d))
    .map((d) => WEEKDAY_SHORT[d])
    .join(' · ');
}

/** Same as `isScheduledOn`, for a weekday number (0 = Sunday … 6 = Saturday). */
export function isScheduledOnWeekday(schedule: HabitSchedule, weekday: number): boolean {
  return schedule.kind === 'daily' || schedule.days.includes(weekday as Weekday);
}
