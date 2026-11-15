import type { DayRecord } from '@/data/completion-storage';
import type { Habit, Weekday } from '@/data/habit-storage';
import { isCompleteNow } from '@/utils/habit-progress';
import { isScheduledOn } from '@/utils/schedule';
import { toLocalDateKey } from '@/utils/date';
import { notificationsEn } from '@/i18n/notifications-en';
import { notificationsAr } from '@/i18n/notifications-ar';
import type { NotificationSettings } from './model';

export const PREFIX = 'momentum.smart.v1.';
export type Issued = Record<string, { at: number; date: string }>;
export type Planned = { id: string; at: number; date: string; title: string; body: string; habitId?: string; kind: 'habit' | 'unfinished' | 'inactivity' };
export type PlanInput = { now: Date; habits: readonly Habit[]; today: DayRecord; settings: NotificationSettings; lastActive: number; language: 'en' | 'ar'; issued: Issued };
export function inQuietHours(time: string, start: string, end: string): boolean {
  return start < end ? time >= start && time < end : time >= start || time < end;
}
export function localTime(day: Date, time: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
}
/** Calendar arithmetic (not 24h additions) preserves local wall time across DST. */
export function planNotifications(input: PlanInput): Planned[] {
  const { now, habits, today, settings: s, lastActive, language, issued } = input;
  const copy = language === 'ar' ? notificationsAr : notificationsEn;
  const candidates: Planned[] = [];
  const todayKey = toLocalDateKey(now);
  const threshold = new Date(lastActive);
  threshold.setDate(threshold.getDate() + s.inactiveDays);
  const awayId = `${PREFIX}inactivity.${lastActive}`;
  let awayPlanned = false;
  // Habits have a seven-calendar-day horizon. A single inactivity reminder may
  // be farther away when the configured threshold is greater than that horizon.
  for (let offset = 0; offset < Math.max(7, s.inactiveDays + 2); offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const date = toLocalDateKey(day);
    const unfinished = habits.filter(h => isScheduledOn(h, day) && (date !== todayKey || !isCompleteNow(today, h)));
    const add = (time: string, kind: Planned['kind'], habit?: Habit) => {
      const atDate = localTime(day, time);
      // A nonexistent spring-forward time is skipped, not silently moved into quiet hours.
      const [hh, mm] = time.split(':').map(Number);
      if (atDate.getHours() !== hh || atDate.getMinutes() !== mm || atDate.getTime() <= now.getTime() || inQuietHours(time, s.quietStart, s.quietEnd)) return false;
      const id = kind === 'inactivity' ? awayId : `${PREFIX}${kind}.${date}.${encodeURIComponent(habit?.id ?? 'today')}`;
      if (issued[id] && issued[id].at <= now.getTime()) return false;
      // An explicit habit reminder already offers the same invitation. Do not
      // stack a generic encouragement on top of it at the very same instant.
      if (kind !== 'habit' && candidates.some(p => p.at === atDate.getTime())) return false;
      candidates.push({ id, at: atDate.getTime(), date, kind, ...(habit ? { habitId: habit.id } : {}),
        title: habit?.name ?? copy['notifications.gentleTitle'],
        body: copy[kind === 'habit' ? 'notifications.habitBody' : kind === 'unfinished' ? 'notifications.unfinishedBody' : 'notifications.inactivityBody'] });
      return true;
    };
    for (const habit of offset < 7 ? unfinished : []) {
      const r = habit.reminder;
      if (r?.enabled && r.days.includes(day.getDay() as Weekday)) add(r.time, 'habit', habit);
    }
    if (offset < 7 && s.unfinished && unfinished.length) add(s.time, 'unfinished');
    if (s.inactivity && habits.length && !awayPlanned && localTime(day, s.time).getTime() >= threshold.getTime()) awayPlanned = add(s.time, 'inactivity');
  }
  // Reserve already elapsed deliveries in the daily budget, including after settings/time edits.
  const counts = new Map<string, number>();
  for (const entry of Object.values(issued)) if (entry.at <= now.getTime()) counts.set(entry.date, (counts.get(entry.date) ?? 0) + 1);
  return candidates.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)).filter(p => {
    const count = counts.get(p.date) ?? 0;
    if (count >= s.dailyCap) return false;
    counts.set(p.date, count + 1);
    return true;
  }).slice(0, 43);
}

/** Never trust a URL or route supplied by notification data. */
export function notificationTarget(data: unknown, habits: readonly Habit[]) {
  if (!data || typeof data !== 'object' || (data as Record<string, unknown>).owner !== PREFIX) return null;
  const id = (data as Record<string, unknown>).habitId;
  return typeof id === 'string' && habits.some(h => h.id === id)
    ? { pathname: '/(tabs)/habits/[id]' as const, params: { id } } : '/(tabs)' as const;
}
