import type { DayRecord } from '@/data/completion-storage';
import type { Habit } from '@/data/habit-storage';
import type { Routine, TimeOfDay } from '@/data/routine-storage';
import { isCompleteNow } from '@/utils/habit-progress';
import { isScheduledOn } from '@/utils/schedule';

/**
 * ROUTINE PROGRESS — derived, display-only, never stored.
 * =====================================================
 * A routine is an ordered list of habit IDs. Progress always comes from the ONE
 * daily record kept by `DailyProgressProvider`, keyed by habit ID, using the
 * shared rule `isCompleteNow` (Tick ticked · Count >= target · every required
 * Checklist step done). So:
 *
 * - A habit in several routines has one entry per day: completing it once marks
 *   it done in every routine, and Today / Goals / Insights count it once — they
 *   never look at routines at all.
 * - Routine completion is not saved and feeds no other statistic.
 *
 * Per routine, for the given (provider) date:
 * - members: IDs that still match a habit, in routine order. Deleted habits
 *   are skipped and only counted in `missingCount`.
 * - due:     members scheduled that day — the only trackable ones (same as Today).
 * - notDue:  members not scheduled that day — shown, never trackable, because
 *   progress on an unscheduled day would look like a schedule change in Insights.
 * - done / total: complete due habits / due habits (each habit = one unit).
 */

export type RoutineState = 'empty' | 'rest' | 'todo' | 'partial' | 'complete';

export type RoutineDay = {
  routine: Routine;
  members: Habit[];
  due: Habit[];
  notDue: Habit[];
  /** IDs in the routine whose habit was deleted. */
  missingCount: number;
  done: number;
  total: number;
  state: RoutineState;
};

export function indexHabits(habits: readonly Habit[]): Map<string, Habit> {
  return new Map(habits.map((h) => [h.id, h]));
}

export function routineMembers(routine: Routine, habitsById: ReadonlyMap<string, Habit>): Habit[] {
  return routine.habitIds.map((id) => habitsById.get(id)).filter((h): h is Habit => h !== undefined);
}

export function routineDay(
  routine: Routine,
  habitsById: ReadonlyMap<string, Habit>,
  date: Date,
  record: DayRecord | undefined,
): RoutineDay {
  const members = routineMembers(routine, habitsById);
  const due = members.filter((h) => isScheduledOn(h, date));
  const notDue = members.filter((h) => !isScheduledOn(h, date));
  const done = due.filter((h) => isCompleteNow(record, h)).length;
  const total = due.length;
  let state: RoutineState;
  if (members.length === 0) state = 'empty';
  else if (total === 0) state = 'rest';
  else if (done === total) state = 'complete';
  else state = done === 0 ? 'todo' : 'partial';
  return { routine, members, due, notDue, missingCount: routine.habitIds.length - members.length, done, total, state };
}

// ---------------------------------------------------------------------------
// Time of day — ordering and highlighting only. Nothing is ever hidden or locked.
// ---------------------------------------------------------------------------

export type ClockBucket = Exclude<TimeOfDay, 'anytime'>;

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Anytime',
};

export const TIME_OF_DAY_HINTS: Record<TimeOfDay, string> = {
  morning: '5 am – noon',
  afternoon: 'Noon – 6 pm',
  evening: '6 pm – 5 am',
  anytime: 'No preferred time',
};

const TIME_ORDER: Record<TimeOfDay, number> = { morning: 0, afternoon: 1, evening: 2, anytime: 3 };

/** Local clock → bucket. Morning 05:00–11:59 · Afternoon 12:00–17:59 · Evening 18:00–04:59. */
export function timeOfDayBucket(date: Date): ClockBucket {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

/** Stable: morning → afternoon → evening → anytime; the user's order within a bucket. */
export function sortByTimeOfDay<T extends { routine: Routine }>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => TIME_ORDER[a.item.routine.timeOfDay] - TIME_ORDER[b.item.routine.timeOfDay] || a.index - b.index)
    .map(({ item }) => item);
}

// ---------------------------------------------------------------------------
// Today's plan
// ---------------------------------------------------------------------------

export type DailyPlan = {
  /** Routines with at least one habit due, in time-of-day order. Empty → the plan is hidden. */
  items: RoutineDay[];
  /** Routines with habits, none due on this date. */
  restRoutines: RoutineDay[];
  /** Number of `items` that are complete. Counts ROUTINES, never a sum of habits. */
  routinesDone: number;
  /** First incomplete item whose time of day matches the current clock bucket. */
  nowRoutineId: string | null;
  /** Habits due on this date that are in no routine. */
  outsideCount: number;
};

export function planForDay(
  routines: readonly Routine[],
  habits: readonly Habit[],
  date: Date,
  record: DayRecord | undefined,
  bucket: ClockBucket,
): DailyPlan {
  const byId = indexHabits(habits);
  const days = routines.map((r) => routineDay(r, byId, date, record));
  const items = sortByTimeOfDay(days.filter((d) => d.total > 0));
  const restRoutines = days.filter((d) => d.state === 'rest');
  const inRoutine = new Set(routines.flatMap((r) => r.habitIds));
  const outsideCount = habits.filter((h) => isScheduledOn(h, date) && !inRoutine.has(h.id)).length;
  const now = items.find((d) => d.routine.timeOfDay === bucket && d.state !== 'complete');
  return {
    items,
    restRoutines,
    routinesDone: items.filter((d) => d.state === 'complete').length,
    nowRoutineId: now?.routine.id ?? null,
    outsideCount,
  };
}

/** Routines that list a habit (including when it's listed more than once across routines). */
export function routinesContaining(routines: readonly Routine[], habitId: string): Routine[] {
  return routines.filter((r) => r.habitIds.includes(habitId));
}

/** e.g. "2 of 4 done", "Nothing due today", "No habits yet". */
export function describeRoutineDay(day: RoutineDay): string {
  switch (day.state) {
    case 'empty':
      return 'No habits yet';
    case 'rest':
      return 'Nothing due today';
    case 'complete':
      return `All ${day.total} done`;
    default:
      return `${day.done} of ${day.total} done`;
  }
}
