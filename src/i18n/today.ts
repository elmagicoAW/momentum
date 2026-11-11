import type { Language } from '@/data/preferences-storage';
import type { HabitSchedule } from '@/data/habit-storage';
import type { AchievementDefinition } from '@/data/achievement-definitions';
import type { AchievementEvaluation } from '@/utils/achievements';
import type { RoutineDay } from '@/utils/routine-progress';
import { formatLongDate, getGreeting } from '@/utils/date';
import { describeSchedule, WEEKDAY_DISPLAY_ORDER } from '@/utils/schedule';
import { createTranslator, translate } from './translate';
import { formatDisplayDate, formatNumber } from './format';
import { en } from './en';
import type { MessageKey, MessageParams, TemplateKey } from './types';

/** Preserve Today's original ungrouped English numerals, including large Count values. */
export const todayNumber = (language: Language, value: number) => language === 'en' ? String(value) : formatNumber(language, value);
const translator = createTranslator({ numberFormat: todayNumber });
export const todayMessage = translator.message;
function makeCopy(language: Language) {
  return {
    t: (key: MessageKey) => translate(language, key),
    m: <K extends TemplateKey>(key: K, params: MessageParams<NoInfer<K>>) => todayMessage(language, key, params),
    number: (value: number) => todayNumber(language, value),
  };
}
const copies = { en: makeCopy('en'), ar: makeCopy('ar') };
export const todayCopy = (language: Language) => copies[language];

/** Retain existing nested Text styling while permitting a full sentence to reorder its named slot. */
type TextSlot<K extends TemplateKey> = { [P in keyof MessageParams<K>]: MessageParams<K>[P] extends string ? P : never }[keyof MessageParams<K>];
export function todayRich<K extends TemplateKey>(language: Language, key: K, params: MessageParams<NoInfer<K>>, slot: TextSlot<NoInfer<K>>) {
  const slotValue = params[slot];
  if (typeof slotValue !== 'string') throw new TypeError('Rich message slot must be text');
  let token = '\u0000slot\u0000';
  while (Object.values(params).some((value) => typeof value === 'string' && value.includes(token))) token += '\u0000';
  const text = todayMessage(language, key, { ...params, [slot]: token });
  return { parts: text.split(token), slotValue };
}

const greetings = { 'Good night': 'greeting.night', 'Good morning': 'greeting.morning',
  'Good afternoon': 'greeting.afternoon', 'Good evening': 'greeting.evening' } as const;
export const todayGreeting = (language: Language, date: Date) => translate(language, greetings[getGreeting(date)]);
export function todayDate(language: Language, date: Date) {
  if (language === 'en') return formatLongDate(date).toUpperCase();
  return formatDisplayDate(language, date, 'header');
}

/** Presentation only: do not change schedule identity, Monday-first ordering, or due-day decisions. */
export function todaySchedule(language: Language, schedule: HabitSchedule): string {
  const original = describeSchedule(schedule);
  if (language === 'en') return original;
  if (schedule.kind === 'daily' || schedule.days.length === 7) return translate(language, 'habits.daily');
  if (schedule.kind === 'weekdays' && schedule.days.length === 5 && [1,2,3,4,5].every(d => schedule.days.includes(d as never))) return translate(language, 'today.schedule.weekdays');
  if (schedule.kind === 'weekdays' && schedule.days.length === 2 && schedule.days.includes(0) && schedule.days.includes(6)) return translate(language, 'today.schedule.weekends');
  const days = schedule.kind === 'weekdays' ? schedule.days : [];
  return WEEKDAY_DISPLAY_ORDER.filter((day) => days.includes(day))
    .map((day) => translate(language, `today.weekday.short.${day}`)).join(translate(language, 'today.schedule.separator'));
}
export function todayRoutineDay(language: Language, day: RoutineDay): string {
  const { t, m } = todayCopy(language);
  if (day.state === 'empty') return t('habits.empty.title');
  if (day.state === 'rest') return t('today.plan.rest');
  return day.state === 'complete' ? m('today.plan.allDone', { total: day.total }) : m('today.plan.progress', { completed: day.done, total: day.total });
}
const badgeNames = {
  'first-checkin': 'today.badge.first-checkin', 'checkins-10': 'today.badge.checkins-10', 'checkins-50': 'today.badge.checkins-50',
  'checkins-100': 'today.badge.checkins-100', 'active-days-7': 'today.badge.active-days-7', 'active-days-30': 'today.badge.active-days-30',
  'streak-3': 'today.badge.streak-3', 'streak-7': 'today.badge.streak-7', 'streak-30': 'today.badge.streak-30',
  'tracking-trio': 'today.badge.tracking-trio', 'perfect-day': 'today.badge.perfect-day', 'perfect-week': 'today.badge.perfect-week',
} as const;
export function todayBadgeName(language: Language, badge: Pick<AchievementDefinition, 'id' | 'name'>) {
  return Object.hasOwn(badgeNames, badge.id) ? translate(language, badgeNames[badge.id as keyof typeof badgeNames]) : badge.name;
}
export function todayAchievementProgress(language: Language, badge: AchievementDefinition, evaluation: AchievementEvaluation) {
  // Same display clamp as the original achievementProgress; no evaluation/award/state mutation.
  const value = Math.min(badge.target, evaluation.metrics[badge.metric]);
  return todayMessage(language, `today.achievement.progress.${badge.metric}`, { value, target: badge.target });
}
const quoteKeys = ['today.quote.0', 'today.quote.1', 'today.quote.2', 'today.quote.3', 'today.quote.4', 'today.quote.5', 'today.quote.6'] as const;
const authorKeys = ['today.author.0', 'today.author.1', 'today.author.2', 'today.author.3', 'today.author.4', 'today.author.5', 'today.author.6'] as const;
/** Localize only the known built-in quote/credit pair returned by the existing daily selector. */
export function todayMotivation(language: Language, source: { quote: string; author: string }) {
  const index = quoteKeys.findIndex((key, i) => en[key] === source.quote && en[authorKeys[i]] === source.author);
  return index < 0 ? source : { quote: translate(language, quoteKeys[index]), author: translate(language, authorKeys[index]) };
}
