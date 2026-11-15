import type { Weekday } from '@/data/habit-storage';
export type HabitReminder = { enabled: boolean; time: string; days: Weekday[] };
export const DEFAULT_REMINDER: HabitReminder = { enabled: false, time: '09:00', days: [0, 1, 2, 3, 4, 5, 6] };
export const validTime = (v: unknown): v is string => typeof v === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
export function validReminder(v: unknown): v is HabitReminder {
  if (!v || typeof v !== 'object') return false;
  const r = v as HabitReminder;
  return typeof r.enabled === 'boolean' && validTime(r.time) && Array.isArray(r.days) && r.days.length > 0 &&
    r.days.length <= 7 && new Set(r.days).size === r.days.length && r.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6);
}
/** Turning off must not trap a form behind now-hidden, incomplete draft fields.
 * Only invalid unsaved controls fall back; valid saved configuration is retained. */
export function setReminderEnabled(r: HabitReminder, enabled: boolean): HabitReminder {
  if (enabled) return { ...r, enabled };
  return { enabled: false, time: validTime(r.time) ? r.time : DEFAULT_REMINDER.time,
    days: validReminder({ ...r, time: DEFAULT_REMINDER.time }) ? [...r.days] : [...DEFAULT_REMINDER.days] };
}
export type NotificationSettings = {
  unfinished: boolean; inactivity: boolean; time: string; quietStart: string; quietEnd: string;
  dailyCap: number; inactiveDays: number;
};
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  unfinished: false, inactivity: false, time: '18:00', quietStart: '22:00', quietEnd: '08:00', dailyCap: 3, inactiveDays: 3,
};
export function validSettings(v: unknown): v is NotificationSettings {
  if (!v || typeof v !== 'object') return false;
  const s = v as NotificationSettings;
  return typeof s.unfinished === 'boolean' && typeof s.inactivity === 'boolean' && validTime(s.time) &&
    validTime(s.quietStart) && validTime(s.quietEnd) && s.quietStart !== s.quietEnd &&
    Number.isInteger(s.dailyCap) && s.dailyCap >= 1 && s.dailyCap <= 6 &&
    Number.isInteger(s.inactiveDays) && s.inactiveDays >= 1 && s.inactiveDays <= 14;
}
