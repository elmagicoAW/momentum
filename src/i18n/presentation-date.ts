import { ACTIVE_PRESENTATION } from '@/utils/presentation';
import type { Language } from '@/data/preferences-storage';
import * as original from '@/utils/date';
import { formatDisplayDate, formatLocalDate, formatLocalDateRange, formatLocalWeekday } from './format';
import { appMessage, appNumber } from './app-copy';

// Re-export calendar arithmetic unchanged; only display functions are overridden.
export { getGreeting, toLocalDateKey, isLocalDateKey, parseLocalDateKey, addDays, addMonths, daysBetween, startOfWeek, monthGrid, type MonthGridCell } from '@/utils/date';
const language = (): Language => ACTIVE_PRESENTATION.language;
export const formatShortDate = (key: string) => language() === 'en' ? original.formatShortDate(key) : formatLocalDate(language(), key);
export const formatMonthYear = (date: Date) => language() === 'en' ? original.formatMonthYear(date) : formatDisplayDate(language(), date, 'month');
export const formatLongDate = (date: Date) => language() === 'en' ? original.formatLongDate(date) : formatDisplayDate(language(), date, 'header');
export const formatLongDateKey = (key: string) => formatLongDate(original.parseLocalDateKey(key));
export const formatMonthDay = (key: string) => language() === 'en' ? original.formatMonthDay(key) : formatDisplayDate(language(), original.parseLocalDateKey(key), 'header');
export const shortMonthName = (month: number) => language() === 'en' ? original.shortMonthName(month) : formatDisplayDate(language(), new Date(2026, month, 1), 'month').split(' ')[0];
export const formatWeekRange = (key: string) => language() === 'en' ? original.formatWeekRange(key) : formatLocalDateRange(language(), key, original.toLocalDateKey(original.addDays(original.parseLocalDateKey(key), 6)));
export const formatWeekday = (key: string) => formatLocalWeekday(language(), key);
export function formatTimestamp(value: string) {
  const date = new Date(value);
  if (language() === 'en' && typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') return date.toLocaleString();
  return appMessage('display.timestamp', { date: formatShortDate(original.toLocalDateKey(date)), time: [date.getHours(), date.getMinutes(), date.getSeconds()].map(n => appNumber(n).padStart(2, language() === 'ar' ? '٠' : '0')).join(':') });
}
