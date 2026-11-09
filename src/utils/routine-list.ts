import {
  createRoutineId,
  MAX_HABITS_PER_ROUTINE,
  MAX_ROUTINES,
  type Routine,
  type RoutineInput,
} from '@/data/routine-storage';

/**
 * Pure list changes used by `useRoutines`. Each returns `{ next, result }` for
 * `ListStore.commit`, and returns the SAME list when nothing changes (no write).
 * Habit definitions and progress are never touched — a routine only holds IDs.
 */

/** Trims text, drops empty optional fields and duplicate habit IDs. */
export function cleanRoutineInput(input: RoutineInput): RoutineInput {
  const description = input.description?.trim();
  return {
    title: input.title.trim(),
    ...(description ? { description } : {}),
    icon: input.icon,
    color: input.color,
    timeOfDay: input.timeOfDay,
    habitIds: [...new Set(input.habitIds)],
  };
}

function checkLimits(input: RoutineInput) {
  if (input.title.length === 0) throw new Error('A routine needs a title');
  if (input.habitIds.length > MAX_HABITS_PER_ROUTINE) {
    throw new Error(`A routine can hold up to ${MAX_HABITS_PER_ROUTINE} habits`);
  }
}

export function addRoutine(list: Routine[], input: RoutineInput, now: Date): { next: Routine[]; result: Routine } {
  if (list.length >= MAX_ROUTINES) throw new Error(`You can have up to ${MAX_ROUTINES} routines`);
  const clean = cleanRoutineInput(input);
  checkLimits(clean);
  const routine: Routine = {
    ...clean,
    id: createRoutineId(list.map((r) => r.id)),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return { next: [...list, routine], result: routine };
}

export function updateRoutineIn(
  list: Routine[],
  id: string,
  input: RoutineInput,
  now: Date,
): { next: Routine[]; result: undefined } {
  const existing = list.find((r) => r.id === id);
  if (!existing) throw new Error('This routine no longer exists');
  const clean = cleanRoutineInput(input);
  checkLimits(clean);
  const updated: Routine = { ...clean, id: existing.id, createdAt: existing.createdAt, updatedAt: now.toISOString() };
  return { next: list.map((r) => (r.id === id ? updated : r)), result: undefined };
}

export function deleteRoutineFrom(list: Routine[], id: string): { next: Routine[]; result: undefined } {
  if (!list.some((r) => r.id === id)) throw new Error('This routine no longer exists');
  // Habits, their progress, goals and insights are not affected.
  return { next: list.filter((r) => r.id !== id), result: undefined };
}

/** Moves a routine one place up (-1) or down (+1). At the edge: unchanged (no write). */
export function moveRoutineIn(list: Routine[], id: string, delta: -1 | 1): { next: Routine[]; result: boolean } {
  const from = list.findIndex((r) => r.id === id);
  if (from === -1) throw new Error('This routine no longer exists');
  const to = from + delta;
  if (to < 0 || to >= list.length) return { next: list, result: false };
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return { next, result: true };
}

/** Moves an item in an ID list one place up/down (used for habit order in the form). */
export function moveId(ids: readonly string[], id: string, delta: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
