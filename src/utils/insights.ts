import { appLabel, appMessage } from '@/i18n/app-copy';
import { weekSummary } from '@/i18n/insight-summary';
import type { CompletionHistory, DayRecord, HabitEntry } from '@/data/completion-storage';
import type { Habit } from '@/data/habit-storage';
import {
  addDays,
  daysBetween,
  formatMonthDay,
  formatWeekRange,
  isLocalDateKey,
  parseLocalDateKey,
  shortMonthName,
  startOfWeek,
  toLocalDateKey,
} from '@/i18n/presentation-date';
import { currentEntry, isCompleteBySnapshot, isCompleteNow, requiredStepIds } from '@/utils/habit-progress';
import { isScheduledOnWeekday } from '@/utils/schedule';

/**
 * INSIGHTS & HISTORY — read-only calculations
 * ===========================================
 * Pure functions: no React, no storage. Nothing here (or anywhere in Insights)
 * writes, migrates, repairs or deletes saved data.
 *
 * Unit: one "scheduled check-in" = one habit on one day it is scheduled. A
 * habit contributes at most ONE completed check-in a day, whatever its type.
 * Completion follows the shared rules in `utils/habit-progress.ts`:
 * - past days: the rule saved with that day's entry (count target / required
 *   steps at the time), so later habit edits never rewrite history;
 * - today: the habit's current definition and the LIVE record (incl. pending saves).
 *
 * Day status for a habit (checked in this order):
 *   after today                       → not part of the index (never counted)
 *   before the habit's start          → BEFORE      (not counted)
 *   not scheduled (current schedule)  → UNSCHEDULED, or EXTRA if completed (not counted)
 *   today                             → DONE, or PENDING (never missed), or UNKNOWN if today's progress isn't loaded
 *   unreadable saved record           → UNKNOWN     (excluded from completed AND scheduled)
 *   completed by snapshot             → DONE
 *   entry exists but not complete     → PARTIAL     (counts as missed)
 *   no entry                          → MISSED
 *
 * Habit start = the earlier of its creation date and its first saved entry.
 * Saved entries can move the start earlier (legacy demo habits were re-created
 * after their first check-ins), but nothing before the first evidence of the
 * habit is ever treated as scheduled or missed, and no check-ins are invented.
 *
 * Finished days are days before today. Rates use finished days only; today is
 * reported separately and is provisional.
 *
 * Streaks count consecutive SCHEDULED opportunities, not calendar days.
 * Unscheduled days are skipped. A streak only breaks once a scheduled day has
 * ended without completion; today's pending check-in never breaks it.
 *
 * KNOWN LIMITATION: schedules are not versioned. The current schedule is applied
 * to every past day. EXTRA days (completed on a day the habit isn't scheduled
 * now) are surfaced as a hint that the schedule probably changed.
 */

export const DayStatus = {
  BEFORE: 0,
  UNSCHEDULED: 1,
  EXTRA: 2,
  UNKNOWN: 3,
  DONE: 4,
  PENDING: 5,
  PARTIAL: 6,
  MISSED: 7,
} as const;
export type DayStatusCode = (typeof DayStatus)[keyof typeof DayStatus];

const S = DayStatus;

/** Habits whose saved creation date is before this are treated as having no reliable creation date. */
const MIN_RELIABLE_YEAR = 2000;

export type HabitIndex = {
  habit: Habit;
  /** First day the habit counts (see header). */
  startKey: string;
  startOffset: number;
  /** True when saved entries moved the start before the creation date (or the creation date was unusable). */
  startFromEntries: boolean;
  /** One status per day from the index start to today. */
  status: Uint8Array;
  /** Days with a completed entry while not scheduled under the current schedule. */
  extraDays: number;
  /** Scheduled finished days whose saved record couldn't be read. */
  unknownDays: number;
};

export type InsightsIndex = {
  todayKey: string;
  /** Earliest habit start; offset 0. */
  startKey: string;
  /** Offset of today (= number of days - 1). */
  todayOffset: number;
  dateKeys: string[];
  habits: HabitIndex[];
  /** Today's progress has loaded (otherwise today is UNKNOWN, never missed). */
  todayKnown: boolean;
  /** Valid date keys up to today whose saved record couldn't be read, sorted. */
  unreadableDays: string[];
  unreadable: Set<string>;
  /** Saved day records ignored because their date is after today or invalid. */
  ignoredRecordDays: number;
  /** Habit IDs with saved entries that are not in the habit list (deleted habits). */
  deletedHabitsWithHistory: number;
  /** Read-only references, used to show saved progress for a selected day. */
  history: CompletionHistory;
  todayRecord: DayRecord | undefined;
};

function reliableCreatedKey(createdAt: string): string | null {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < MIN_RELIABLE_YEAR) return null;
  return toLocalDateKey(date);
}

/**
 * Builds the per-habit day-status index in one pass per habit.
 * O(habits × days). Returns null when there are no habits.
 */
export function buildInsightsIndex(
  habits: readonly Habit[],
  history: CompletionHistory,
  todayKey: string,
  /** Today's live record; undefined when today's progress isn't loaded. */
  todayRecord: DayRecord | undefined,
): InsightsIndex | null {
  if (habits.length === 0) return null;

  // Valid past records only; future/invalid dates are ignored (and counted).
  const habitIds = new Set(habits.map((h) => h.id));
  const firstEntry = new Map<string, string>();
  const deleted = new Set<string>();
  let ignoredRecordDays = 0;
  for (const [dateKey, record] of history.days) {
    if (!isLocalDateKey(dateKey) || dateKey > todayKey) {
      ignoredRecordDays += 1;
      continue;
    }
    for (const habitId of Object.keys(record.entries)) {
      if (!habitIds.has(habitId)) {
        deleted.add(habitId);
        continue;
      }
      const prev = firstEntry.get(habitId);
      if (prev === undefined || dateKey < prev) firstEntry.set(habitId, dateKey);
    }
  }
  const unreadableDays: string[] = [];
  for (const key of history.unreadableDays) {
    if (isLocalDateKey(key) && key <= todayKey) unreadableDays.push(key);
    else ignoredRecordDays += 1;
  }
  unreadableDays.sort();
  const unreadable = new Set(unreadableDays);

  // Habit starts.
  const starts = habits.map((habit) => {
    const created = reliableCreatedKey(habit.createdAt);
    const entry = firstEntry.get(habit.id);
    let startKey = todayKey;
    if (created !== null && created < startKey) startKey = created;
    if (entry !== undefined && entry < startKey) startKey = entry;
    const startFromEntries = entry !== undefined && entry === startKey && (created === null || entry < created);
    return { startKey, startFromEntries };
  });
  const startKey = starts.reduce((min, s) => (s.startKey < min ? s.startKey : min), todayKey);
  const todayOffset = daysBetween(startKey, todayKey);
  const dayCount = todayOffset + 1;

  const start = parseLocalDateKey(startKey);
  const dateKeys = new Array<string>(dayCount);
  const weekdays = new Uint8Array(dayCount);
  for (let i = 0; i < dayCount; i += 1) {
    const date = addDays(start, i);
    dateKeys[i] = toLocalDateKey(date);
    weekdays[i] = date.getDay();
  }

  const todayKnown = todayRecord !== undefined;
  const habitIndexes = habits.map((habit, h): HabitIndex => {
    const startOffset = daysBetween(startKey, starts[h].startKey);
    const status = new Uint8Array(dayCount); // filled with BEFORE (0)
    let extraDays = 0;
    let unknownDays = 0;
    for (let i = startOffset; i < dayCount; i += 1) {
      const isToday = i === todayOffset;
      const scheduled = isScheduledOnWeekday(habit.schedule, weekdays[i]);
      let code: DayStatusCode;
      if (isToday) {
        const complete = todayRecord !== undefined && isCompleteNow(todayRecord, habit);
        if (!scheduled) code = complete ? S.EXTRA : S.UNSCHEDULED;
        else if (!todayKnown) code = S.UNKNOWN;
        else code = complete ? S.DONE : S.PENDING;
      } else if (unreadable.has(dateKeys[i])) {
        code = scheduled ? S.UNKNOWN : S.UNSCHEDULED;
        if (scheduled) unknownDays += 1;
      } else {
        const entry = history.days.get(dateKeys[i])?.entries[habit.id];
        const complete = isCompleteBySnapshot(entry);
        if (!scheduled) code = complete ? S.EXTRA : S.UNSCHEDULED;
        else if (complete) code = S.DONE;
        else code = entry ? S.PARTIAL : S.MISSED;
      }
      if (code === S.EXTRA) extraDays += 1;
      status[i] = code;
    }
    return {
      habit,
      startKey: starts[h].startKey,
      startOffset,
      startFromEntries: starts[h].startFromEntries,
      status,
      extraDays,
      unknownDays,
    };
  });

  return {
    todayKey,
    startKey,
    todayOffset,
    dateKeys,
    habits: habitIndexes,
    todayKnown,
    unreadableDays,
    unreadable,
    ignoredRecordDays,
    deletedHabitsWithHistory: deleted.size,
    history,
    todayRecord,
  };
}

// ---------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------

export type CheckInCounts = {
  /** Completed check-ins on finished days. */
  done: number;
  /** Missed check-ins on finished days (includes partial). */
  missed: number;
  /** Of `missed`, days with some progress that didn't meet the rule. */
  partial: number;
  /** Scheduled finished check-ins whose record couldn't be read (excluded). */
  unknown: number;
  /** done + missed. Denominator for the rate. */
  finished: number;
  /** done / finished, or null when nothing finished was scheduled. */
  rate: number | null;
};

export type TodayCounts = {
  /** False when today's progress isn't loaded — today is then shown as unknown. */
  known: boolean;
  done: number;
  /** Habits scheduled today. */
  due: number;
};

const emptyCounts = (): CheckInCounts => ({ done: 0, missed: 0, partial: 0, unknown: 0, finished: 0, rate: null });

function finalize(c: CheckInCounts): CheckInCounts {
  c.finished = c.done + c.missed;
  c.rate = c.finished > 0 ? c.done / c.finished : null;
  return c;
}

function addStatus(c: CheckInCounts, code: number) {
  if (code === S.DONE) c.done += 1;
  else if (code === S.MISSED) c.missed += 1;
  else if (code === S.PARTIAL) {
    c.missed += 1;
    c.partial += 1;
  } else if (code === S.UNKNOWN) c.unknown += 1;
}

/** Offset of a date key in the index (may be < 0 or > todayOffset). */
export function offsetOf(index: InsightsIndex, key: string): number {
  return daysBetween(index.startKey, key);
}

/** Finished-day counts for one habit between two date keys (inclusive). Today and future are excluded. */
export function habitCounts(index: InsightsIndex, h: HabitIndex, fromKey: string, toKey: string): CheckInCounts {
  const c = emptyCounts();
  const from = Math.max(offsetOf(index, fromKey), h.startOffset, 0);
  const to = Math.min(offsetOf(index, toKey), index.todayOffset - 1);
  for (let i = from; i <= to; i += 1) addStatus(c, h.status[i]);
  return finalize(c);
}

/** Finished-day counts across all habits (weighted by check-in). */
export function overallCounts(index: InsightsIndex, fromKey: string, toKey: string): CheckInCounts {
  const total = emptyCounts();
  for (const h of index.habits) {
    const c = habitCounts(index, h, fromKey, toKey);
    total.done += c.done;
    total.missed += c.missed;
    total.partial += c.partial;
    total.unknown += c.unknown;
  }
  return finalize(total);
}

export function todayCounts(index: InsightsIndex): TodayCounts {
  let done = 0;
  let due = 0;
  for (const h of index.habits) {
    const code = h.status[index.todayOffset];
    if (code === S.DONE || code === S.PENDING || code === S.UNKNOWN) due += 1;
    if (code === S.DONE) done += 1;
  }
  return { known: index.todayKnown, done, due };
}

/** Unreadable saved days between two keys (inclusive). */
export function unreadableBetween(index: InsightsIndex, fromKey: string, toKey: string): number {
  let n = 0;
  for (const key of index.unreadableDays) if (key >= fromKey && key <= toKey) n += 1;
  return n;
}

type DayTotals = { due: number; done: number; unknown: number };

/** All habits on one day: due = known scheduled check-ins (unknown excluded). */
function dayTotals(index: InsightsIndex, offset: number): DayTotals {
  const t: DayTotals = { due: 0, done: 0, unknown: 0 };
  for (const h of index.habits) {
    const code = h.status[offset];
    if (code === S.DONE) {
      t.done += 1;
      t.due += 1;
    } else if (code === S.MISSED || code === S.PARTIAL || code === S.PENDING) t.due += 1;
    else if (code === S.UNKNOWN) t.unknown += 1;
  }
  return t;
}

/** A finished day where every scheduled habit was completed (and nothing is unreadable). */
function isPerfectDay(t: DayTotals) {
  return t.due > 0 && t.unknown === 0 && t.done === t.due;
}

function perfectDaysBetween(index: InsightsIndex, fromKey: string, toKey: string): number {
  const from = Math.max(offsetOf(index, fromKey), 0);
  const to = Math.min(offsetOf(index, toKey), index.todayOffset - 1);
  let n = 0;
  for (let i = from; i <= to; i += 1) if (isPerfectDay(dayTotals(index, i))) n += 1;
  return n;
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

export type CurrentStreak = {
  /** Consecutive completed scheduled check-ins, ending today (if done) or at the last finished scheduled day. */
  length: number;
  /** An unreadable record ended the count, so the real streak may be longer. */
  uncertain: boolean;
  /** Today is scheduled and not done yet — the streak is at risk, not broken. */
  todayPending: boolean;
  todayDone: boolean;
};

export type LongestStreak = {
  length: number;
  /** Last day of the longest run (most recent run wins ties). */
  endKey: string | null;
  /** Some scheduled days couldn't be read, so a longer run may exist. */
  uncertain: boolean;
  /** The longest run is the current, unbroken run. */
  ongoing: boolean;
  /** The longest run includes today's (provisional) completion. */
  includesToday: boolean;
};

export function currentStreak(index: InsightsIndex, h: HabitIndex): CurrentStreak {
  let length = 0;
  let uncertain = false;
  for (let i = index.todayOffset - 1; i >= h.startOffset; i -= 1) {
    const code = h.status[i];
    if (code === S.UNSCHEDULED || code === S.EXTRA) continue;
    if (code === S.DONE) length += 1;
    else {
      if (code === S.UNKNOWN) uncertain = true;
      break; // MISSED, PARTIAL, UNKNOWN
    }
  }
  const today = h.status[index.todayOffset];
  if (today === S.DONE) length += 1;
  return { length, uncertain, todayPending: today === S.PENDING, todayDone: today === S.DONE };
}

export function longestStreak(index: InsightsIndex, h: HabitIndex): LongestStreak {
  let run = 0;
  let best = 0;
  let endKey: string | null = null;
  for (let i = h.startOffset; i <= index.todayOffset; i += 1) {
    const code = h.status[i];
    if (code === S.UNSCHEDULED || code === S.EXTRA || code === S.PENDING) continue;
    if (code === S.DONE) {
      run += 1;
      if (run >= best) {
        best = run;
        endKey = index.dateKeys[i];
      }
    } else if (index.todayKnown || i !== index.todayOffset) {
      run = 0; // MISSED, PARTIAL, UNKNOWN (an unknown today never ends a run)
    }
  }
  return {
    length: best,
    endKey,
    uncertain: h.unknownDays > 0,
    ongoing: best > 0 && run === best,
    includesToday: best > 0 && endKey === index.todayKey,
  };
}

// ---------------------------------------------------------------------------
// Per-habit summary
// ---------------------------------------------------------------------------

export type HabitSummary = {
  habit: Habit;
  startKey: string;
  startFromEntries: boolean;
  current: CurrentStreak;
  longest: LongestStreak;
  allTime: CheckInCounts;
  last30: CheckInCounts;
  thisMonth: CheckInCounts;
  /** Statuses of the last 7 days, oldest first, ending today. */
  last7: { dateKey: string; status: DayStatusCode }[];
  today: DayStatusCode;
  /** Completed on days it isn't scheduled now → its schedule probably changed. */
  possibleScheduleChange: boolean;
  unknownDays: number;
};

export function summarizeHabit(index: InsightsIndex, h: HabitIndex): HabitSummary {
  const today = parseLocalDateKey(index.todayKey);
  const yesterday = toLocalDateKey(addDays(today, -1));
  const last7: HabitSummary['last7'] = [];
  for (let i = index.todayOffset - 6; i <= index.todayOffset; i += 1) {
    const dateKey = i >= 0 ? index.dateKeys[i] : toLocalDateKey(addDays(today, i - index.todayOffset));
    last7.push({ dateKey, status: (i >= 0 ? h.status[i] : S.BEFORE) as DayStatusCode });
  }
  return {
    habit: h.habit,
    startKey: h.startKey,
    startFromEntries: h.startFromEntries,
    current: currentStreak(index, h),
    longest: longestStreak(index, h),
    allTime: habitCounts(index, h, index.startKey, yesterday),
    last30: habitCounts(index, h, toLocalDateKey(addDays(today, -30)), yesterday),
    thisMonth: habitCounts(index, h, toLocalDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), yesterday),
    last7,
    today: h.status[index.todayOffset] as DayStatusCode,
    possibleScheduleChange: h.extraDays > 0,
    unknownDays: h.unknownDays,
  };
}

export function findHabit(index: InsightsIndex, habitId: string): HabitIndex | undefined {
  return index.habits.find((h) => h.habit.id === habitId);
}

// ---------------------------------------------------------------------------
// Overview (last 30 finished days)
// ---------------------------------------------------------------------------

export type Overview = {
  fromKey: string;
  toKey: string;
  counts: CheckInCounts;
  perfectDays: number;
  unreadableDays: number;
  bestCurrent: { habit: Habit; streak: CurrentStreak } | null;
  today: TodayCounts;
};

export const OVERVIEW_DAYS = 30;

export function overview(index: InsightsIndex): Overview {
  const today = parseLocalDateKey(index.todayKey);
  const fromKey = toLocalDateKey(addDays(today, -OVERVIEW_DAYS));
  const toKey = toLocalDateKey(addDays(today, -1));
  let bestCurrent: Overview['bestCurrent'] = null;
  for (const h of index.habits) {
    const streak = currentStreak(index, h);
    if (streak.length > 0 && (!bestCurrent || streak.length > bestCurrent.streak.length)) {
      bestCurrent = { habit: h.habit, streak };
    }
  }
  return {
    fromKey,
    toKey,
    counts: overallCounts(index, fromKey, toKey),
    perfectDays: perfectDaysBetween(index, fromKey, toKey),
    unreadableDays: unreadableBetween(index, fromKey, toKey),
    bestCurrent,
    today: todayCounts(index),
  };
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

export type HeatLevel = 0 | 1 | 2 | 3;

export type HeatCell = {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  /**
   * future: after today · before: before any habit's start (or before this habit's start)
   * rest: nothing scheduled · data: has scheduled check-ins
   */
  kind: 'future' | 'before' | 'rest' | 'data';
  done: number;
  /** Known scheduled check-ins (unreadable excluded). */
  due: number;
  unknown: number;
  /** The saved record for this date couldn't be read. */
  unreadable: boolean;
  level: HeatLevel;
  /** Habit mode only: the habit's status that day. */
  status?: DayStatusCode;
};

function levelFor(done: number, due: number): HeatLevel {
  if (due === 0 || done === 0) return 0;
  const ratio = done / due;
  if (ratio >= 1) return 3;
  return ratio >= 0.5 ? 2 : 1;
}

/** Cells for a Monday-first month grid. With `habitId`, cells describe only that habit. */
export function heatmapCells(
  index: InsightsIndex,
  grid: { dateKey: string; day: number; inMonth: boolean }[],
  habitId?: string,
): HeatCell[] {
  const single = habitId ? findHabit(index, habitId) : undefined;
  return grid.map((g) => {
    const offset = offsetOf(index, g.dateKey);
    const base = {
      dateKey: g.dateKey,
      day: g.day,
      inMonth: g.inMonth,
      isToday: g.dateKey === index.todayKey,
      done: 0,
      due: 0,
      unknown: 0,
      unreadable: index.unreadable.has(g.dateKey),
      level: 0 as HeatLevel,
    };
    if (offset > index.todayOffset) return { ...base, kind: 'future' as const };
    if (offset < 0) return { ...base, kind: 'before' as const };
    if (single) {
      const status = single.status[offset] as DayStatusCode;
      if (status === S.BEFORE) return { ...base, kind: 'before' as const, status };
      if (status === S.UNSCHEDULED || status === S.EXTRA) return { ...base, kind: 'rest' as const, status };
      const done = status === S.DONE ? 1 : 0;
      const due = status === S.UNKNOWN ? 0 : 1;
      return {
        ...base,
        kind: 'data' as const,
        status,
        done,
        due,
        unknown: status === S.UNKNOWN ? 1 : 0,
        level: levelFor(done, due),
      };
    }
    if (!index.habits.some((h) => h.startOffset <= offset)) return { ...base, kind: 'before' as const };
    const t = dayTotals(index, offset);
    if (t.due === 0 && t.unknown === 0) return { ...base, kind: 'rest' as const };
    return { ...base, kind: 'data' as const, ...t, level: levelFor(t.done, t.due) };
  });
}

// ---------------------------------------------------------------------------
// Weekly review
// ---------------------------------------------------------------------------

export type HabitWeekLine = { habit: Habit; counts: CheckInCounts };

export type WeeklyReview = {
  startKey: string;
  endKey: string;
  label: string;
  isCurrent: boolean;
  /** Week is entirely before any history. */
  empty: boolean;
  /** Finished days of the week. */
  counts: CheckInCounts;
  /** Completed today so far (provisional, current week only). */
  todayDone: number;
  /** Today's pending check-ins plus scheduled days after today (current week only). */
  remaining: number;
  perfectDays: number;
  unreadableDays: number;
  best: HabitWeekLine | null;
  needsAttention: HabitWeekLine | null;
  previousRate: number | null;
  /** Change in consistency vs the previous week, in percentage points. */
  deltaPoints: number | null;
  achievements: string[];
  possibleScheduleChange: boolean;
};

export function weekStartKeyFor(dateKey: string): string {
  return toLocalDateKey(startOfWeek(parseLocalDateKey(dateKey)));
}

export function firstWeekStartKey(index: InsightsIndex): string {
  return weekStartKeyFor(index.startKey);
}

export function weeklyReview(index: InsightsIndex, startKey: string): WeeklyReview {
  const start = parseLocalDateKey(startKey);
  const endKey = toLocalDateKey(addDays(start, 6));
  const isCurrent = startKey <= index.todayKey && index.todayKey <= endKey;
  const counts = overallCounts(index, startKey, endKey);
  const lines: HabitWeekLine[] = index.habits.map((h) => ({ habit: h.habit, counts: habitCounts(index, h, startKey, endKey) }));

  let todayDone = 0;
  let remaining = 0;
  let possibleScheduleChange = false;
  const from = Math.max(offsetOf(index, startKey), 0);
  const to = Math.min(offsetOf(index, endKey), index.todayOffset);
  for (const h of index.habits) {
    for (let i = from; i <= to; i += 1) if (h.status[i] === S.EXTRA) possibleScheduleChange = true;
  }
  if (isCurrent) {
    for (const h of index.habits) {
      const code = h.status[index.todayOffset];
      if (code === S.DONE) todayDone += 1;
      if (code === S.PENDING || code === S.UNKNOWN) remaining += 1;
    }
    // Scheduled days after today in this week (habits already exist, so start can't exclude them).
    for (let d = addDays(parseLocalDateKey(index.todayKey), 1); toLocalDateKey(d) <= endKey; d = addDays(d, 1)) {
      for (const h of index.habits) if (isScheduledOnWeekday(h.habit.schedule, d.getDay())) remaining += 1;
    }
  }

  const eligible = lines.filter((l) => l.counts.finished >= 2 && l.counts.rate !== null);
  const best = eligible.reduce<HabitWeekLine | null>(
    (acc, l) =>
      !acc || l.counts.rate! > acc.counts.rate! || (l.counts.rate === acc.counts.rate && l.counts.done > acc.counts.done)
        ? l
        : acc,
    null,
  );
  const needsAttention = lines.reduce<HabitWeekLine | null>(
    (acc, l) => (l.counts.missed > 0 && (!acc || l.counts.missed > acc.counts.missed) ? l : acc),
    null,
  );

  const prevStart = toLocalDateKey(addDays(start, -7));
  const prev = overallCounts(index, prevStart, toLocalDateKey(addDays(start, -1)));
  const deltaPoints =
    counts.rate !== null && prev.rate !== null ? Math.round(counts.rate * 100) - Math.round(prev.rate * 100) : null;

  const perfectDays = perfectDaysBetween(index, startKey, endKey);
  const achievements: (() => string)[] = [];
  if (perfectDays > 0) achievements.push(() => appMessage("insights.highlight.perfectDays", { count: perfectDays }));
  for (const l of lines) {
    if (achievements.length >= 4) break;
    if (l.counts.finished >= 2 && l.counts.missed === 0 && l.counts.unknown === 0) {
      achievements.push(() => appMessage("insights.highlight.perfectHabit", { name: (l.habit.name), provisional: (isCurrent ? appLabel("insights.soFar") : '') }));
    }
  }
  if (isCurrent) {
    for (const h of index.habits) {
      if (achievements.length >= 5) break;
      const streak = currentStreak(index, h);
      if (streak.length >= 5) achievements.push(() => appMessage("insights.highlight.streak", { name: (h.habit.name), count: (streak.length), uncertainty: (streak.uncertain ? appLabel("insights.atLeast") : '') }));
    }
  }

  return {
    startKey,
    endKey,
    get label() { return formatWeekRange(startKey); },
    isCurrent,
    empty: endKey < index.startKey,
    counts,
    todayDone,
    remaining,
    perfectDays,
    unreadableDays: unreadableBetween(index, startKey, endKey < index.todayKey ? endKey : toLocalDateKey(addDays(parseLocalDateKey(index.todayKey), -1))),
    best,
    needsAttention,
    previousRate: prev.rate,
    deltaPoints,
    get achievements() { return achievements.map(render => render()); },
    possibleScheduleChange,
  };
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

export type TrendPoint = {
  key: string;
  label: string;
  /** Finished-day consistency; null = nothing finished was scheduled (drawn as a gap). */
  rate: number | null;
  done: number;
  finished: number;
  isCurrent: boolean;
};

export type Trend = {
  points: TrendPoint[];
  /** Weighted over all points. */
  average: number | null;
  best: number | null;
};

export const TREND_WEEKS = 8;
export const TREND_MONTHS = 6;

export function trend(index: InsightsIndex, kind: 'week' | 'month'): Trend {
  const today = parseLocalDateKey(index.todayKey);
  const points: TrendPoint[] = [];
  const count = kind === 'week' ? TREND_WEEKS : TREND_MONTHS;
  for (let n = count - 1; n >= 0; n -= 1) {
    let from: Date;
    let to: Date;
    let label: () => string;
    if (kind === 'week') {
      from = addDays(startOfWeek(today), -7 * n);
      to = addDays(from, 6);
      label = () => formatMonthDay(toLocalDateKey(from));
    } else {
      from = new Date(today.getFullYear(), today.getMonth() - n, 1);
      to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
      label = () => shortMonthName(from.getMonth());
    }
    const c = overallCounts(index, toLocalDateKey(from), toLocalDateKey(to));
    points.push({ key: toLocalDateKey(from), get label() { return label(); }, rate: c.rate, done: c.done, finished: c.finished, isCurrent: n === 0 });
  }
  const done = points.reduce((s, p) => s + p.done, 0);
  const finished = points.reduce((s, p) => s + p.finished, 0);
  const rates = points.map((p) => p.rate).filter((r): r is number => r !== null);
  return {
    points,
    average: finished > 0 ? done / finished : null,
    best: rates.length > 0 ? Math.max(...rates) : null,
  };
}

// ---------------------------------------------------------------------------
// Data notes
// ---------------------------------------------------------------------------

export type DataNotes = {
  unreadableDays: number;
  ignoredRecordDays: number;
  deletedHabitsWithHistory: number;
  /** Habits completed on days they aren't scheduled now. */
  scheduleChangeHabits: Habit[];
  /** Habits whose start comes from saved check-ins earlier than their creation date. */
  startFromEntriesHabits: Habit[];
  todayKnown: boolean;
  /** True when anything above means numbers may be incomplete or approximate. */
  incomplete: boolean;
};

export function dataNotes(index: InsightsIndex): DataNotes {
  const scheduleChangeHabits = index.habits.filter((h) => h.extraDays > 0).map((h) => h.habit);
  return {
    unreadableDays: index.unreadableDays.length,
    ignoredRecordDays: index.ignoredRecordDays,
    deletedHabitsWithHistory: index.deletedHabitsWithHistory,
    scheduleChangeHabits,
    startFromEntriesHabits: index.habits.filter((h) => h.startFromEntries).map((h) => h.habit),
    todayKnown: index.todayKnown,
    incomplete: index.unreadableDays.length > 0 || !index.todayKnown,
  };
}

/** True when there is at least one finished scheduled check-in anywhere. */
export function hasFinishedHistory(index: InsightsIndex): boolean {
  return index.habits.some((h) => {
    for (let i = h.startOffset; i < index.todayOffset; i += 1) {
      const c = h.status[i];
      if (c === S.DONE || c === S.MISSED || c === S.PARTIAL || c === S.UNKNOWN) return true;
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// Navigation bounds (calendar months and review weeks)
// ---------------------------------------------------------------------------

/**
 * How far back the calendar and weekly review can go before the first saved
 * history. Earlier months are browsable but show days as "Not started" /
 * "No habits yet" — never as missed — and nothing is invented for them.
 */
export const CALENDAR_LOOKBACK_MONTHS = 12;

/** `month` is 0-based. */
export type MonthRef = { year: number; month: number };

export const monthNumber = (m: MonthRef) => m.year * 12 + m.month;
export const monthFromNumber = (n: number): MonthRef => ({ year: Math.floor(n / 12), month: ((n % 12) + 12) % 12 });

export type MonthBounds = { min: MonthRef; max: MonthRef };

/**
 * Oldest → newest month the calendar may show:
 * min = the earlier of the first history month and 12 months before the current month;
 * max = the current month (future months are never shown).
 */
export function monthBounds(index: InsightsIndex): MonthBounds {
  const today = parseLocalDateKey(index.todayKey);
  const first = parseLocalDateKey(index.startKey);
  const max = monthNumber({ year: today.getFullYear(), month: today.getMonth() });
  const firstHistory = monthNumber({ year: first.getFullYear(), month: first.getMonth() });
  return { min: monthFromNumber(Math.min(firstHistory, max - CALENDAR_LOOKBACK_MONTHS)), max: monthFromNumber(max) };
}

export function clampMonth(m: MonthRef, bounds: MonthBounds): MonthRef {
  const n = monthNumber(m);
  if (n > monthNumber(bounds.max)) return bounds.max;
  if (n < monthNumber(bounds.min)) return bounds.min;
  return m;
}

/** The month `delta` months away, clamped to the bounds. */
export function stepMonth(m: MonthRef, delta: number, bounds: MonthBounds): MonthRef {
  return clampMonth(monthFromNumber(monthNumber(m) + delta), bounds);
}

export function canStepMonth(m: MonthRef, delta: -1 | 1, bounds: MonthBounds): boolean {
  const n = monthNumber(m);
  return delta < 0 ? n > monthNumber(bounds.min) : n < monthNumber(bounds.max);
}

export type WeekBounds = { minStartKey: string; maxStartKey: string };

/** Monday-start weeks: from the week containing the first day of the oldest calendar month, to the current week. */
export function weekBounds(index: InsightsIndex): WeekBounds {
  const { min } = monthBounds(index);
  return {
    minStartKey: weekStartKeyFor(toLocalDateKey(new Date(min.year, min.month, 1))),
    maxStartKey: weekStartKeyFor(index.todayKey),
  };
}

export function clampWeek(startKey: string, bounds: WeekBounds): string {
  if (startKey > bounds.maxStartKey) return bounds.maxStartKey;
  if (startKey < bounds.minStartKey) return bounds.minStartKey;
  return weekStartKeyFor(startKey);
}

export function stepWeek(startKey: string, delta: number, bounds: WeekBounds): string {
  return clampWeek(toLocalDateKey(addDays(parseLocalDateKey(startKey), delta * 7)), bounds);
}

// ---------------------------------------------------------------------------
// Day details (selected calendar date)
// ---------------------------------------------------------------------------

export type EntryProgress =
  | { kind: 'tick'; done: boolean }
  | { kind: 'count'; value: number; target: number; unit: string }
  | {
      kind: 'checklist';
      requiredDone: number;
      requiredTotal: number;
      optionalDone: number;
      steps: { id: string; label: string; done: boolean; optional: boolean }[];
    };

export type HabitDayDetail = {
  habit: Habit;
  /** null = upcoming (after today). */
  status: DayStatusCode | null;
  /** true / false under the CURRENT schedule; null when the habit hadn't started. */
  scheduled: boolean | null;
  /** Saved progress for that day, or (today) live progress. null when nothing was saved / readable. */
  progress: EntryProgress | null;
  label: string;
};

export type DayDetail = {
  dateKey: string;
  isToday: boolean;
  isFuture: boolean;
  unreadable: boolean;
  /** Known scheduled check-ins that day (unreadable excluded). */
  done: number;
  due: number;
  unknown: number;
  /** Habits that had started by that date (or, for future days, all habits). */
  habits: HabitDayDetail[];
  /** Habits that hadn't started yet on that date. */
  notStarted: number;
  summary: string;
};

/** Plain-language status of one habit on one day. `null` = upcoming. */
export function dayStatusLabel(status: DayStatusCode | null, isToday: boolean): string {
  switch (status) {
    case null:
      return appLabel("insights.upcoming");
    case S.DONE:
      return isToday ? appLabel("insights.completedTodayProvisional") : appLabel("insights.completed");
    case S.PARTIAL:
      return appLabel("insights.partialNotComplete");
    case S.MISSED:
      return appLabel("insights.notCheckedIn");
    case S.PENDING:
      return appLabel("insights.inProgressTodayIsnTOver");
    case S.UNKNOWN:
      return isToday ? appLabel("insights.todaySProgressHasnTLoaded") : appLabel("insights.savedRecordCouldnTBeRead");
    case S.EXTRA:
      return appLabel("insights.notScheduledDoneAnywayNotCounted");
    case S.UNSCHEDULED:
      return appLabel("insights.notScheduled");
    default:
      return appLabel("insights.notStarted");
  }
}

function stepLabels(habit: Habit): Map<string, string> {
  return new Map(habit.tracking.type === 'checklist' ? habit.tracking.steps.map((s) => [s.id, s.label]) : []);
}

/**
 * Progress to show for a habit on a day.
 * - Today: the live entry judged by the habit's CURRENT definition (an entry of
 *   another type counts as no progress), so "0 of 8" is shown before any tap.
 * - Past: exactly what was saved, judged by its own snapshot. Nothing saved → null.
 */
export function entryProgress(habit: Habit, entry: HabitEntry | undefined, isToday: boolean): EntryProgress | null {
  const t = habit.tracking;
  if (isToday) {
    const e = entry && entry.type === t.type ? entry : undefined;
    if (t.type === 'tick') return { kind: 'tick', done: e !== undefined };
    if (t.type === 'count') return { kind: 'count', value: e?.type === 'count' ? e.value : 0, target: t.target, unit: t.unit };
    const done = new Set(e?.type === 'checklist' ? e.done : []);
    const required = new Set(requiredStepIds(t));
    const steps = t.steps.map((s) => ({ id: s.id, label: s.label, done: done.has(s.id), optional: !required.has(s.id) }));
    return {
      kind: 'checklist',
      requiredDone: steps.filter((s) => !s.optional && s.done).length,
      requiredTotal: required.size,
      optionalDone: steps.filter((s) => s.optional && s.done).length,
      steps,
    };
  }
  if (!entry) return null;
  if (entry.type === 'tick') return { kind: 'tick', done: true };
  if (entry.type === 'count') {
    return { kind: 'count', value: entry.value, target: entry.target, unit: t.type === 'count' ? t.unit : '' };
  }
  const labels = stepLabels(habit);
  const required = new Set(entry.required);
  const done = new Set(entry.done);
  const ids = [...entry.required, ...entry.done.filter((id) => !required.has(id))];
  return {
    kind: 'checklist',
    requiredDone: entry.required.filter((id) => done.has(id)).length,
    requiredTotal: entry.required.length,
    optionalDone: entry.done.filter((id) => !required.has(id)).length,
    steps: ids.map((id) => ({ id, label: labels.get(id) ?? appLabel("insights.removedStep"), done: done.has(id), optional: !required.has(id) })),
  };
}

/** e.g. "Ticked", "5 of 8 glasses", "2 of 3 required steps · 1 optional". */
export function describeProgress(p: EntryProgress): string {
  switch (p.kind) {
    case 'tick':
      return p.done ? appLabel("insights.ticked") : appLabel("insights.notTickedYet");
    case 'count':
      return appMessage("history.progress.count", { value: (p.value), target: (p.target), unit: (p.unit ? ` ${p.unit}` : '') });
    case 'checklist': {
      const opt = p.optionalDone > 0 ? appMessage("history.progress.optional", { count: (p.optionalDone) }) : '';
      return appMessage("history.progress.required", { done: p.requiredDone, count: p.requiredTotal, optional: opt });
    }
  }
}

export function habitDayDetail(index: InsightsIndex, h: HabitIndex, dateKey: string): HabitDayDetail {
  const offset = offsetOf(index, dateKey);
  const isToday = dateKey === index.todayKey;
  if (offset > index.todayOffset) {
    const scheduled = isScheduledOnWeekday(h.habit.schedule, parseLocalDateKey(dateKey).getDay());
    return {
      habit: h.habit,
      status: null,
      scheduled,
      progress: null,
      label: scheduled ? appLabel("insights.upcomingScheduled") : appLabel("insights.upcomingNotScheduled"),
    };
  }
  const status = (offset < 0 ? S.BEFORE : h.status[offset]) as DayStatusCode;
  const scheduled = status === S.BEFORE ? null : status !== S.UNSCHEDULED && status !== S.EXTRA;
  let progress: EntryProgress | null = null;
  if (status !== S.BEFORE && status !== S.UNKNOWN) {
    const record = isToday ? index.todayRecord : index.history.days.get(dateKey);
    const entry = isToday ? currentEntry(record, h.habit) : record?.entries[h.habit.id];
    // Unscheduled days only show progress when something was actually saved.
    if (scheduled || entry) progress = entryProgress(h.habit, entry, isToday);
  }
  return { habit: h.habit, status, scheduled, progress, label: dayStatusLabel(status, isToday) };
}

/** Everything known about one date — all habits, or one habit (`habitId`). Read-only. */
export function dayDetail(index: InsightsIndex, dateKey: string, habitId?: string): DayDetail {
  const offset = offsetOf(index, dateKey);
  const isToday = dateKey === index.todayKey;
  const isFuture = offset > index.todayOffset;
  const pool = habitId ? index.habits.filter((h) => h.habit.id === habitId) : index.habits;
  const all = pool.map((h) => habitDayDetail(index, h, dateKey));
  const habits = all.filter((d) => d.status !== S.BEFORE);
  let done = 0;
  let due = 0;
  let unknown = 0;
  for (const d of habits) {
    if (d.status === S.DONE) done += 1;
    if (d.status === S.DONE || d.status === S.MISSED || d.status === S.PARTIAL || d.status === S.PENDING) due += 1;
    if (d.status === S.UNKNOWN) unknown += 1;
  }

  let summary: string;
  if (isFuture) summary = appLabel("insights.upcomingFutureDaysAreNeverCounted");
  else if (habits.length === 0) summary = habitId ? appLabel("insights.notStartedThisHabitDidnTExistYet") : appLabel("insights.noHabitsHadStartedYet");
  else if (due === 0 && unknown === 0) summary = appLabel("insights.nothingScheduled");
  else {
    summary = isToday ? (unknown > 0 ? appMessage("insights.complete.day.today.unreadable", { done: done, count: due, total: unknown }) : appMessage("insights.complete.day.today.readable", { done: done, count: due })) : (unknown > 0 ? appMessage("insights.complete.day.finished.unreadable", { done: done, count: due, total: unknown }) : appMessage("insights.complete.day.finished.readable", { done: done, count: due }));
  }
  return {
    dateKey,
    isToday,
    isFuture,
    unreadable: index.unreadable.has(dateKey),
    done,
    due,
    unknown,
    habits,
    notStarted: all.length - habits.length,
    summary,
  };
}

/** One-line summary of a review week (shown under the week navigation). */
export function describeWeek(r: WeeklyReview): string {
  return weekSummary(r);
}

/** Caption for a review week: current, finished, or before history. */
export function weekCaption(r: WeeklyReview): string {
  if (r.isCurrent) return appLabel("insights.thisWeekInProgress");
  if (r.empty) return appLabel("insights.beforeYourHabitsStarted");
  return appLabel("insights.finishedWeek");
}
