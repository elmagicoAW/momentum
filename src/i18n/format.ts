import type { Language } from '@/data/preferences-storage';
import { isLocalDateKey, parseLocalDateKey } from '@/utils/date';

/** Explicit display policy, independent of device locale and machine/storage formats. */
export const DISPLAY_LOCALES = Object.freeze({ en: 'en-US', ar: 'ar-EG' });
const cache = new Map<Language, ReturnType<typeof makeFormatters>>();
function makeFormatters(language: Language) {
  const locale = DISPLAY_LOCALES[language];
  const numberingSystem = language === 'ar' ? 'arab' : 'latn';
  const dateOptions = { calendar: 'gregory', numberingSystem };
  return {
    number: new Intl.NumberFormat(locale, { numberingSystem, maximumFractionDigits: 20 }),
    percent: new Intl.NumberFormat(locale, { numberingSystem, style: 'percent', maximumFractionDigits: 0 }),
    plural: new Intl.PluralRules(locale, { maximumFractionDigits: 20 }),
    date: new Intl.DateTimeFormat(locale, { ...dateOptions, year: 'numeric', month: 'long', day: 'numeric' }),
    month: new Intl.DateTimeFormat(locale, { ...dateOptions, year: 'numeric', month: 'long' }),
    weekday: new Intl.DateTimeFormat(locale, { ...dateOptions, weekday: 'long' }),
  };
}
function formatters(language: Language) {
  let value = cache.get(language);
  if (!value) { value = makeFormatters(language); cache.set(language, value); }
  return value;
}
function finite(value: number) {
  if (!Number.isFinite(value)) throw new RangeError('Expected a finite display number');
  return value;
}
export const formatNumber = (language: Language, value: number) => formatters(language).number.format(finite(value));
export const formatPercent = (language: Language, rate: number) => formatters(language).percent.format(finite(rate));
export const pluralCategory = (language: Language, count: number) => formatters(language).plural.select(finite(count));
function localDate(key: string) {
  if (!isLocalDateKey(key)) throw new RangeError('Invalid local date key');
  return parseLocalDateKey(key);
}
/** Display only. Never change machine date keys or Monday-first domain calendar semantics. */
export function formatLocalDate(language: Language, key: string): string {
  return formatters(language).date.format(localDate(key));
}
export const formatLocalMonth = (language: Language, key: string) => formatters(language).month.format(localDate(key));
export const formatLocalWeekday = (language: Language, key: string) => formatters(language).weekday.format(localDate(key));
export function formatLocalDateRange(language: Language, start: string, end: string) {
  localDate(start); localDate(end);
  if (end < start) throw new RangeError('Invalid display date range');
  return start === end ? formatLocalDate(language, start) : `${formatLocalDate(language, start)} – ${formatLocalDate(language, end)}`;
}

/** Future numeric-input boundary only. Does not parse, strip separators, or change any validator. */
export function normalizeNumericInput(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) - (digit >= '۰' ? 0x06f0 : 0x0660)));
}
