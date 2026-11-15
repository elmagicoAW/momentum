import type { Habit } from '@/data/habit-storage';
import { toLocalDateKey } from '@/utils/date';

/** Same evidence policy for Insights and Goals. Old demo recreation timestamps
 * can be later than saved entries. Unreliable/missing dates invent no past days. */
export function evidencedHabitStart(habit: Habit, firstEntry: string | undefined, todayKey: string) {
  const date = new Date(habit.createdAt);
  const created = Number.isFinite(date.getTime()) && date.getFullYear() >= 2000 ? toLocalDateKey(date) : null;
  let startKey = todayKey;
  if (created !== null && created < startKey) startKey = created;
  if (firstEntry !== undefined && firstEntry < startKey) startKey = firstEntry;
  return { startKey, startFromEntries: firstEntry !== undefined && firstEntry === startKey && (created === null || firstEntry < created) };
}
