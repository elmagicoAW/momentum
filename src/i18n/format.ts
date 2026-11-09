import type { Language } from '@/data/preferences-storage';
import { isLocalDateKey, parseLocalDateKey } from '@/utils/date';

export const formatNumber = (language: Language, value: number) => new Intl.NumberFormat(language).format(value);
export const formatPercent = (language: Language, rate: number) =>
  new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 }).format(rate);
export const pluralCategory = (language: Language, count: number) => new Intl.PluralRules(language).select(count);
/** Display only. Never change machine date keys or Monday-first domain calendar semantics. */
export function formatLocalDate(language: Language, key: string): string {
  if (!isLocalDateKey(key)) throw new RangeError('Invalid local date key');
  return new Intl.DateTimeFormat(language, { calendar: 'gregory', year: 'numeric', month: 'long', day: 'numeric' })
    .format(parseLocalDateKey(key));
}
