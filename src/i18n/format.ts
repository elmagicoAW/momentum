import type { Language } from '@/data/preferences-storage';
import { isLocalDateKey, parseLocalDateKey } from '@/utils/date';
import { fallbackDate, fallbackNumber } from './format-fallback';
import type { PluralCategory } from './types';

/** Explicit display policy, independent of device locale and machine/storage formats. */
export const DISPLAY_LOCALES = Object.freeze({ en: 'en-US', ar: 'ar-EG' });
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
type DateStyle = 'date' | 'month' | 'weekday' | 'header';
function numberFormatter(language: Language, percent: boolean) {
  if (typeof Intl === 'undefined' || typeof Intl.NumberFormat !== 'function') return undefined;
  const key = `${language}:${percent ? 'percent' : 'number'}`;
  if (!cache.has(key)) cache.set(key, new Intl.NumberFormat(DISPLAY_LOCALES[language], {
    numberingSystem: language === 'ar' ? 'arab' : 'latn',
    ...(percent ? { style: 'percent', maximumFractionDigits: 0 } : { maximumFractionDigits: 20 }),
  }));
  return cache.get(key) as Intl.NumberFormat;
}
function dateFormatter(language: Language, style: DateStyle) {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') return undefined;
  const key = `${language}:${style}`;
  const locale = DISPLAY_LOCALES[language];
  const numberingSystem = language === 'ar' ? 'arab' : 'latn';
  const dateOptions = { calendar: 'gregory', numberingSystem };
  const options: Intl.DateTimeFormatOptions = style === 'weekday' ? { weekday: 'long' }
    : style === 'month' ? { year: 'numeric', month: 'long' }
    : style === 'header' ? { weekday: 'long', month: 'long', day: 'numeric' }
    : { year: 'numeric', month: 'long', day: 'numeric' };
  if (!cache.has(key)) cache.set(key, new Intl.DateTimeFormat(locale, { ...dateOptions, ...options }));
  return cache.get(key) as Intl.DateTimeFormat;
}
function finite(value: number) {
  if (!Number.isFinite(value)) throw new RangeError('Expected a finite display number');
  return value;
}
export function formatNumber(language: Language, value: number) {
  finite(value);
  return numberFormatter(language, false)?.format(value) ?? fallbackNumber(language, value);
}
export function formatPercent(language: Language, rate: number) {
  finite(rate);
  return numberFormatter(language, true)?.format(rate) ?? fallbackNumber(language, rate, true);
}
/** CLDR cardinal rules for the two supported languages; independent of engine Intl support.
 * Numeric parameters have no visible trailing zeroes (1.0 is the number 1).
 * https://www.unicode.org/cldr/charts/49/supplemental/language_plural_rules.html
 */
export function pluralCategory(language: Language, count: number): PluralCategory {
  const n = Math.abs(finite(count));
  if (language === 'en') return n === 1 ? 'one' : 'other';
  if (n === 0) return 'zero';
  if (n === 1) return 'one';
  if (n === 2) return 'two';
  const remainder = n % 100;
  if (Number.isInteger(n) && remainder >= 3 && remainder <= 10) return 'few';
  if (Number.isInteger(n) && remainder >= 11 && remainder <= 99) return 'many';
  return 'other';
}
export function formatDisplayDate(language: Language, date: Date, style: DateStyle): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid display date');
  return dateFormatter(language, style)?.format(date) ?? fallbackDate(language, date, style);
}
function localDate(key: string) {
  if (!isLocalDateKey(key)) throw new RangeError('Invalid local date key');
  return parseLocalDateKey(key);
}
/** Display only. Never change machine date keys or Monday-first domain calendar semantics. */
export function formatLocalDate(language: Language, key: string): string {
  return formatDisplayDate(language, localDate(key), 'date');
}
export const formatLocalMonth = (language: Language, key: string) => formatDisplayDate(language, localDate(key), 'month');
export const formatLocalWeekday = (language: Language, key: string) => formatDisplayDate(language, localDate(key), 'weekday');
export function formatLocalDateRange(language: Language, start: string, end: string) {
  localDate(start); localDate(end);
  if (end < start) throw new RangeError('Invalid display date range');
  return start === end ? formatLocalDate(language, start) : `${formatLocalDate(language, start)} – ${formatLocalDate(language, end)}`;
}

/** Future numeric-input boundary only. Does not parse, strip separators, or change any validator. */
export function normalizeNumericInput(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) - (digit >= '۰' ? 0x06f0 : 0x0660)));
}
