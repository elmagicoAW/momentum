import { COUNT_VALUE_MAX, type DayRecord, type HabitEntry } from '@/data/completion-storage';
import type { Habit, HabitTracking } from '@/data/habit-storage';

/**
 * COMPLETION RULES — the single source of truth for Today, Goals and history.
 * ===========================================================================
 * Every scheduled habit is ONE unit: complete or not. Partial progress (5 of 8
 * glasses, 2 of 3 steps) is only shown on the habit's own card.
 *
 * - Tick:      complete when ticked.
 * - Count:     complete when value >= target (going over the target is still 1 unit).
 * - Checklist: complete when every required step is done (optional steps never block).
 *
 * Which rule applies:
 * - Today: the habit's CURRENT definition. An entry whose type no longer matches
 *   the habit (tracking type was changed today) counts as no progress.
 * - Past days: the snapshot stored in the entry (target / required steps at the
 *   time). Past records are never rewritten, so editing a habit never changes history.
 */

type ChecklistTracking = Extract<HabitTracking, { type: 'checklist' }>;

export function requiredStepIds(tracking: ChecklistTracking): string[] {
  return tracking.steps.filter((s) => !s.optional).map((s) => s.id);
}

function meets(entry: HabitEntry, target: number, required: readonly string[]): boolean {
  switch (entry.type) {
    case 'tick':
      return true;
    case 'count':
      return entry.value >= target;
    case 'checklist':
      return required.length > 0 && required.every((id) => entry.done.includes(id));
  }
}

/** Today's entry for a habit, only if it matches the habit's current tracking type. */
export function currentEntry(record: DayRecord | undefined, habit: Habit): HabitEntry | undefined {
  const entry = record?.entries[habit.id];
  return entry && entry.type === habit.tracking.type ? entry : undefined;
}

/** Judged against the habit's current definition (used for today). */
export function isCompleteNow(record: DayRecord | undefined, habit: Habit): boolean {
  const entry = currentEntry(record, habit);
  if (!entry) return false;
  const t = habit.tracking;
  return meets(entry, t.type === 'count' ? t.target : 0, t.type === 'checklist' ? requiredStepIds(t) : []);
}

/** Judged against the rule stored in the entry (used for past days). */
export function isCompleteBySnapshot(entry: HabitEntry | undefined): boolean {
  if (!entry) return false;
  return meets(entry, entry.type === 'count' ? entry.target : 0, entry.type === 'checklist' ? entry.required : []);
}

export function isHabitCompleteOn(
  record: DayRecord | undefined,
  habit: Habit,
  dateKey: string,
  todayKey: string,
): boolean {
  return dateKey === todayKey ? isCompleteNow(record, habit) : isCompleteBySnapshot(record?.entries[habit.id]);
}

// ---------------------------------------------------------------------------
// Reading progress for display (today)
// ---------------------------------------------------------------------------

export function countValue(record: DayRecord | undefined, habit: Habit): number {
  const entry = currentEntry(record, habit);
  return entry?.type === 'count' ? entry.value : 0;
}

export function doneStepIds(record: DayRecord | undefined, habit: Habit): Set<string> {
  const entry = currentEntry(record, habit);
  if (entry?.type !== 'checklist' || habit.tracking.type !== 'checklist') return new Set();
  // Ignore IDs of steps that were removed since.
  const existing = new Set(habit.tracking.steps.map((s) => s.id));
  return new Set(entry.done.filter((id) => existing.has(id)));
}

/** True when the habit has any recorded progress today (any type). */
export function hasAnyProgress(record: DayRecord | undefined, habitId: string): boolean {
  return record?.entries[habitId] !== undefined;
}

// ---------------------------------------------------------------------------
// Updaters — pure; return a new record (never mutate). Entries carry a fresh
// snapshot of the current rule on every write.
// ---------------------------------------------------------------------------

function withEntry(record: DayRecord, habitId: string, entry: HabitEntry | undefined): DayRecord {
  const entries = { ...record.entries };
  if (entry) entries[habitId] = entry;
  else delete entries[habitId];
  return { entries };
}

export function applyTick(record: DayRecord, habit: Habit): DayRecord {
  if (habit.tracking.type !== 'tick') return record;
  return withEntry(record, habit.id, currentEntry(record, habit) ? undefined : { type: 'tick', done: true });
}

export function applyCount(record: DayRecord, habit: Habit, delta: number): DayRecord {
  const t = habit.tracking;
  if (t.type !== 'count') return record;
  const current = countValue(record, habit);
  const value = Math.min(Math.max(current + delta, 0), COUNT_VALUE_MAX);
  if (value === current) return record; // at 0 or at the max: nothing to save
  return withEntry(record, habit.id, value === 0 ? undefined : { type: 'count', value, target: t.target });
}

export function applyStep(record: DayRecord, habit: Habit, stepId: string): DayRecord {
  const t = habit.tracking;
  if (t.type !== 'checklist' || !t.steps.some((s) => s.id === stepId)) return record;
  const done = doneStepIds(record, habit);
  if (done.has(stepId)) done.delete(stepId);
  else done.add(stepId);
  // Keep step order stable in storage.
  const ordered = t.steps.map((s) => s.id).filter((id) => done.has(id));
  return withEntry(
    record,
    habit.id,
    ordered.length === 0 ? undefined : { type: 'checklist', done: ordered, required: requiredStepIds(t) },
  );
}

function sameIds(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Brings TODAY's entries in line with the current habit definitions, so the
 * snapshot that freezes at midnight is the rule that was really in force:
 * - type changed → today's entry is removed (the user confirmed this reset)
 * - count → snapshot target updated (value kept)
 * - checklist → removed steps dropped, required snapshot updated
 * Entries for habits not in `habits` (deleted) are left untouched.
 * Returns the same object when nothing changes (idempotent).
 */
export function normalizeTodayRecord(record: DayRecord, habits: readonly Habit[]): DayRecord {
  let next = record;
  for (const habit of habits) {
    const entry = record.entries[habit.id];
    if (!entry) continue;
    const t = habit.tracking;
    if (entry.type !== t.type) {
      next = withEntry(next, habit.id, undefined);
    } else if (entry.type === 'count' && t.type === 'count') {
      if (entry.target !== t.target) next = withEntry(next, habit.id, { ...entry, target: t.target });
    } else if (entry.type === 'checklist' && t.type === 'checklist') {
      const stepIds = t.steps.map((s) => s.id);
      const done = stepIds.filter((id) => entry.done.includes(id));
      const required = requiredStepIds(t);
      if (done.length === 0) next = withEntry(next, habit.id, undefined);
      else if (!sameIds(done, entry.done) || !sameIds(required, entry.required)) {
        next = withEntry(next, habit.id, { type: 'checklist', done, required });
      }
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** e.g. "8 glasses", "4 steps", "Check off". Used in the habit list. */
export function describeTracking(tracking: HabitTracking): string {
  switch (tracking.type) {
    case 'tick':
      return 'Check off';
    case 'count':
      return tracking.unit ? `${tracking.target} ${tracking.unit}` : `Target ${tracking.target}`;
    case 'checklist': {
      const n = tracking.steps.length;
      return n === 1 ? '1 step' : `${n} steps`;
    }
  }
}
