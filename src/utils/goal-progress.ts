import type { CompletionHistory, DayRecord } from '@/data/completion-storage';
import type { Goal } from '@/data/goal-storage';
import type { Habit } from '@/data/habit-storage';
import { addDays, daysBetween, formatShortDate, parseLocalDateKey, toLocalDateKey } from '@/utils/date';
import { isHabitCompleteOn } from '@/utils/habit-progress';
import { isScheduledOn } from '@/utils/schedule';

/**
 * HABIT CONSISTENCY
 * =================
 * How consistently the habits linked to a goal were checked off on Today,
 * since the goal was created. It is NOT the share of the goal achieved —
 * achievement is set manually through the goal's status.
 *
 * Window: goal.startDate … endDate,
 *   endDate = targetDate, or completedAt if the goal is marked completed (whichever is earlier).
 *
 * For each linked habit that still exists and each day in the window on which
 * that habit is scheduled, there is one "scheduled check-in", whatever the
 * habit's tracking type, so a habit never contributes more than one unit a day.
 * It is "completed" per the shared rules in `utils/habit-progress.ts`:
 * Tick ticked · Count value >= target · Checklist every required step done.
 * Past days are judged by the rule saved with that day's progress, so later
 * edits to a target or steps never rewrite history; today uses the current rule.
 *
 * - `finished`: days before today only. Rate = completed / scheduled.
 *   This is the headline "Habit Consistency" number.
 * - `today`: reported separately and labelled provisional. Today's unfinished
 *   habits are never counted as missed — the day isn't over.
 *
 * Only real saved completions count. Completions on unscheduled days, for
 * habits that aren't linked or no longer exist, or outside the window are
 * ignored. No streaks are derived.
 *
 * KNOWN LIMITATION: habit schedules are not versioned — the app only knows each
 * habit's *current* schedule. That schedule is applied to every past day, so if
 * a schedule was changed, past "scheduled" counts reflect the current schedule,
 * not the one that was actually in effect then.
 * Days while a goal was paused are also still counted (pauses aren't recorded).
 */
export type CheckInCount = { completed: number; scheduled: number };

export type HabitConsistency = {
  /** Linked habits that still exist. 0 → no consistency to show. */
  linkedHabits: Habit[];
  /** Finished days (before today) in the window. */
  finished: CheckInCount & {
    /** completed / scheduled, or null when nothing was scheduled yet. */
    rate: number | null;
  };
  /** Today's check-ins — provisional. null when today is outside the window. */
  today: CheckInCount | null;
  /** Days in the finished window whose saved completions couldn't be read. */
  unreadableDays: number;
};

function minKey(...keys: (string | undefined)[]): string {
  return keys.filter((k): k is string => k !== undefined).sort()[0];
}

export function linkedHabitsFor(goal: Goal, habits: readonly Habit[]): Habit[] {
  const byId = new Map(habits.map((h) => [h.id, h]));
  return goal.habitIds.map((id) => byId.get(id)).filter((h): h is Habit => h !== undefined);
}

export function computeHabitConsistency(
  goal: Goal,
  habits: readonly Habit[],
  history: CompletionHistory,
  todayKey: string,
  /** Today's live progress (may include changes still being saved). Used instead of history for today. */
  todayRecord?: DayRecord,
): HabitConsistency {
  const linkedHabits = linkedHabitsFor(goal, habits);
  const endKey = minKey(goal.targetDate, goal.status === 'completed' ? goal.completedAt : undefined);
  const yesterdayKey = toLocalDateKey(addDays(parseLocalDateKey(todayKey), -1));
  const finishedEndKey = minKey(endKey, yesterdayKey);
  const unreadable = new Set(history.unreadableDays);

  const count = (dateKey: string, into: CheckInCount) => {
    const date = parseLocalDateKey(dateKey);
    const record = dateKey === todayKey && todayRecord ? todayRecord : history.days.get(dateKey);
    for (const habit of linkedHabits) {
      if (!isScheduledOn(habit, date)) continue;
      into.scheduled += 1;
      if (isHabitCompleteOn(record, habit, dateKey, todayKey)) into.completed += 1;
    }
  };

  const finished: CheckInCount = { completed: 0, scheduled: 0 };
  let unreadableDays = 0;
  if (linkedHabits.length > 0) {
    for (let key = goal.startDate; key <= finishedEndKey; key = toLocalDateKey(addDays(parseLocalDateKey(key), 1))) {
      if (unreadable.has(key)) unreadableDays += 1;
      count(key, finished);
    }
  }

  let today: CheckInCount | null = null;
  if (linkedHabits.length > 0 && goal.startDate <= todayKey && todayKey <= endKey) {
    today = { completed: 0, scheduled: 0 };
    count(todayKey, today);
  }

  return {
    linkedHabits,
    finished: { ...finished, rate: finished.scheduled > 0 ? finished.completed / finished.scheduled : null },
    today,
    unreadableDays,
  };
}

/** Calendar timeline of a goal — elapsed time, not achievement. */
export function describeTimeline(goal: Goal, todayKey: string): string {
  if (goal.status === 'completed') {
    return goal.completedAt ? `Completed ${formatShortDate(goal.completedAt)}` : 'Completed';
  }
  const daysLeft = daysBetween(todayKey, goal.targetDate);
  if (daysLeft < 0) return `Target date passed · ${formatShortDate(goal.targetDate)}`;
  if (daysLeft === 0) return 'Target date is today';
  const totalDays = daysBetween(goal.startDate, goal.targetDate) + 1;
  const dayNumber = daysBetween(goal.startDate, todayKey) + 1;
  const left = daysLeft === 1 ? '1 day left' : `${daysLeft} days left`;
  return dayNumber >= 1 ? `Day ${dayNumber} of ${totalDays} · ${left}` : left;
}
