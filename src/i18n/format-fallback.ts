import type { Language } from '@/data/preferences-storage';

// Scoped presentation fallback, not a global Intl polyfill. Gregorian local date parts only.
const months = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
};
const weekdays = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
};
const digits = (language: Language, text: string) => language === 'en' ? text
  : text.replace(/[0-9]/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);

/** Expand JS scientific notation without depending on any locale runtime. */
function decimal(value: number): string {
  const [coefficient, exponent] = String(value).split('e');
  if (exponent === undefined) return coefficient;
  const [whole, fraction = ''] = coefficient.split('.');
  const raw = whole + fraction;
  const point = whole.length + Number(exponent);
  return point <= 0 ? `0.${'0'.repeat(-point)}${raw}`
    : point >= raw.length ? raw + '0'.repeat(point - raw.length)
    : `${raw.slice(0, point)}.${raw.slice(point)}`;
}
export function fallbackNumber(language: Language, value: number, percent = false): string {
  const negative = value < 0 || Object.is(value, -0);
  // Shift decimal digits instead of multiplying by 100 (which can overflow).
  let text = decimal(Math.abs(value));
  if (percent) {
    const [whole, fraction = ''] = text.split('.');
    const shifted = whole + fraction.padEnd(2, '0').slice(0, 2);
    const roundUp = Number(fraction[2] ?? '0') >= 5;
    text = String(BigInt(shifted) + (roundUp ? 1n : 0n));
  } else if (text.includes('.')) {
    // Match the display policy of at most 20 fractional digits, half-expand.
    const [whole, fraction] = text.split('.');
    if (fraction.length > 20) {
      const rounded = BigInt(whole + fraction.slice(0, 20)) + (Number(fraction[20]) >= 5 ? 1n : 0n);
      const raw = String(rounded).padStart(21, '0');
      text = `${raw.slice(0, -20)}.${raw.slice(-20)}`;
    }
    text = text.replace(/0+$/, '').replace(/\.$/, '');
  }
  const [whole, fraction] = text.split('.');
  const group = language === 'ar' ? '٬' : ',';
  const separator = language === 'ar' ? '٫' : '.';
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${negative ? (language === 'ar' ? '\u061c-' : '-') : ''}${digits(language, grouped + (fraction ? separator + fraction : ''))}${percent ? (language === 'ar' ? '٪\u061c' : '%') : ''}`;
}
export function fallbackDate(language: Language, date: Date, style: 'date' | 'month' | 'weekday' | 'header'): string {
  const month = months[language][date.getMonth()];
  const weekday = weekdays[language][date.getDay()];
  const day = digits(language, String(date.getDate()));
  const year = digits(language, String(date.getFullYear()));
  if (style === 'weekday') return weekday;
  if (style === 'month') return `${month} ${year}`;
  if (style === 'header') return language === 'en' ? `${weekday}, ${month} ${day}` : `${weekday}، ${day} ${month}`;
  return language === 'en' ? `${month} ${day}, ${year}` : `${day} ${month} ${year}`;
}
