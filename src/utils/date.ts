const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** e.g. "Monday, November 9" — formatted manually so it is identical on every JS engine. */
export function formatLongDate(date: Date) {
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Local calendar date as "YYYY-MM-DD" (device time zone, not UTC), so a day
 * rolls over at the user's local midnight.
 */
export function toLocalDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** True for a real calendar date written as "YYYY-MM-DD" (e.g. rejects "2026-02-30"). */
export function isLocalDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseLocalDateKey(value);
  return toLocalDateKey(date) === value;
}

/**
 * "YYYY-MM-DD" → local midnight Date. Built from parts on purpose:
 * `new Date("2026-11-09")` would be parsed as UTC and can land on the wrong day.
 */
export function parseLocalDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Calendar-day arithmetic in local time (safe across daylight-saving changes). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Same day of month `months` later, clamped to the month's last day (Jan 31 + 1 → Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(fromKey: string, toKey: string): number {
  const from = parseLocalDateKey(fromKey);
  const to = parseLocalDateKey(toKey);
  // Date.UTC removes daylight-saving hour differences.
  const ms =
    Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
    Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round(ms / 86_400_000);
}

/** e.g. "Mar 1, 2027" */
export function formatShortDate(key: string): string {
  const date = parseLocalDateKey(key);
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** e.g. "March 2027" */
export function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Monday of the week containing `date` (local time). Weeks run Monday–Sunday. */
export function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

/** e.g. "Nov 2 – 8", "Oct 26 – Nov 1", "Dec 28, 2026 – Jan 3, 2027". */
export function formatWeekRange(startKey: string): string {
  const start = parseLocalDateKey(startKey);
  const end = addDays(start, 6);
  const sm = SHORT_MONTHS[start.getMonth()];
  const em = SHORT_MONTHS[end.getMonth()];
  if (start.getFullYear() !== end.getFullYear()) {
    return `${sm} ${start.getDate()}, ${start.getFullYear()} – ${em} ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (start.getMonth() === end.getMonth()) return `${sm} ${start.getDate()} – ${end.getDate()}`;
  return `${sm} ${start.getDate()} – ${em} ${end.getDate()}`;
}

/** e.g. "Nov 3" */
export function formatMonthDay(key: string): string {
  const date = parseLocalDateKey(key);
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** e.g. "Tuesday, November 3" */
export function formatLongDateKey(key: string): string {
  return formatLongDate(parseLocalDateKey(key));
}

/** e.g. "Nov" */
export function shortMonthName(month: number): string {
  return SHORT_MONTHS[month];
}

export type MonthGridCell = { dateKey: string; day: number; inMonth: boolean };

/**
 * Calendar grid for a month, Monday-first, padded with the adjacent months'
 * days to whole weeks (28–42 cells). `month` is 0-based.
 */
export function monthGrid(year: number, month: number): MonthGridCell[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;
  const cells: MonthGridCell[] = [];
  for (let i = 0; i < total; i += 1) {
    const date = addDays(first, i - lead);
    cells.push({ dateKey: toLocalDateKey(date), day: date.getDate(), inMonth: date.getMonth() === month });
  }
  return cells;
}
