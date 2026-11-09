import { ACHIEVEMENTS, type AchievementMetric } from '@/data/achievement-definitions';
import type { CompletionHistory, DayRecord } from '@/data/completion-storage';
import type { Habit, TrackingType } from '@/data/habit-storage';
import { addDays, isLocalDateKey, parseLocalDateKey, startOfWeek, toLocalDateKey } from '@/utils/date';
import { currentEntry, isCompleteBySnapshot } from '@/utils/habit-progress';
import { isScheduledOnWeekday } from '@/utils/schedule';

export type AchievementEvidence = { metric: number; habitId?: string; windowStart?: string; windowEnd: string };
export type AchievementCandidate = { evidenceThrough: string; evidence: AchievementEvidence };
export type AchievementEvaluation = {
  metrics: Record<AchievementMetric, number>;
  candidates: Record<string, AchievementCandidate>;
  types: TrackingType[];
  notes: { unreadableDays: number; deletedHabits: number; ignoredDays: number; extraCompletions: number };
};

const scheduled = (habit: Habit, date: string) => isScheduledOnWeekday(habit.schedule, parseLocalDateKey(date).getDay());

/** Mirrors Insights' reliable start, without allocating a habit × calendar-day index. */
function habitStart(habit: Habit, firstEntry: string | undefined, today: string): string {
  const created = new Date(habit.createdAt);
  const key = Number.isFinite(created.getTime()) && created.getFullYear() >= 2000 ? toLocalDateKey(created) : today;
  return [key, firstEntry ?? today, today].sort()[0];
}

function nextScheduled(habit: Habit, from: string): string | null {
  const date = parseLocalDateKey(from);
  for (let n = 1; n <= 7; n += 1) {
    const key = toLocalDateKey(addDays(date, n));
    if (scheduled(habit, key)) return key;
  }
  return null;
}

/** Only persisted FINISHED days enter this pure evaluator. No live Today overlay. */
export function evaluateAchievements(habits: readonly Habit[], history: CompletionHistory, today: string): AchievementEvaluation {
  if (!isLocalDateKey(today)) throw new Error('Invalid achievement evaluation date');
  const metrics: AchievementEvaluation['metrics'] = { checkins: 0, activeDays: 0, streak: 0, types: 0, perfectDays: 0, perfectWeeks: 0 };
  const candidates: AchievementEvaluation['candidates'] = {};
  const ids = new Set(habits.map((h) => h.id));
  const deleted = new Set<string>();
  const first = new Map<string, string>();
  const unknown = new Set(history.unreadableDays.filter((d) => isLocalDateKey(d) && d < today));
  let ignoredDays = history.unreadableDays.filter((d) => !isLocalDateKey(d) || d > today).length;
  const saved = [...history.days.entries()].filter(([d]) => {
    if (!isLocalDateKey(d) || d > today) { ignoredDays += 1; return false; }
    return true;
  }).sort(([a], [b]) => a.localeCompare(b));
  for (const [day, record] of saved) {
    if (unknown.has(day)) continue;
    for (const id of Object.keys(record.entries)) {
      if (!ids.has(id)) deleted.add(id);
      else if (!first.has(id)) first.set(id, day);
    }
  }
  const ordered = [...habits].sort((a, b) => a.id.localeCompare(b.id));
  const starts = new Map(ordered.map((h) => [h.id, habitStart(h, first.get(h.id), today)]));
  const types = new Set<TrackingType>();
  const runs = new Map<string, { length: number; last: string; start: string }>();
  const perfect = new Set<string>();
  let extraCompletions = 0;
  const cross = (metric: AchievementMetric, day: string, evidence?: Partial<AchievementEvidence>) => {
    for (const badge of ACHIEVEMENTS) {
      if (badge.metric === metric && metrics[metric] >= badge.target && !candidates[badge.id]) {
        candidates[badge.id] = { evidenceThrough: day, evidence: { metric: badge.target, windowEnd: day, ...evidence } };
      }
    }
  };
  for (const [day, record] of saved) {
    if (day >= today || unknown.has(day)) continue;
    let due = 0;
    let done = 0;
    for (const habit of ordered) {
      if (day < starts.get(habit.id)!) continue;
      const entry = record.entries[habit.id];
      if (!scheduled(habit, day)) {
        if (isCompleteBySnapshot(entry)) extraCompletions += 1;
        continue;
      }
      due += 1;
      if (!isCompleteBySnapshot(entry)) continue;
      done += 1;
      metrics.checkins += 1;
      cross('checkins', day);
      types.add(entry.type);
      metrics.types = types.size;
      cross('types', day);
      const previous = runs.get(habit.id);
      const continues = previous && nextScheduled(habit, previous.last) === day;
      const run = { length: continues ? previous.length + 1 : 1, start: continues ? previous.start : day, last: day };
      runs.set(habit.id, run);
      metrics.streak = Math.max(metrics.streak, run.length);
      cross('streak', day, { habitId: habit.id, windowStart: run.start });
    }
    if (done > 0) { metrics.activeDays += 1; cross('activeDays', day); }
    if (due > 0 && done === due) {
      perfect.add(day);
      metrics.perfectDays += 1;
      cross('perfectDays', day);
    }
  }
  // Only weeks containing a proven perfect day can qualify. At most seven dates per week.
  const weeks = [...new Set([...perfect].map((d) => toLocalDateKey(startOfWeek(parseLocalDateKey(d)))))].sort();
  for (const week of weeks) {
    const start = parseLocalDateKey(week);
    const end = toLocalDateKey(addDays(start, 6));
    if (end >= today) continue;
    let valid = true;
    for (let i = 0; i < 7; i += 1) {
      const day = toLocalDateKey(addDays(start, i));
      const due = ordered.some((h) => starts.get(h.id)! <= day && scheduled(h, day));
      if (unknown.has(day) || (due && !perfect.has(day))) { valid = false; break; }
    }
    if (valid) { metrics.perfectWeeks += 1; cross('perfectWeeks', end, { windowStart: week }); }
  }
  return { metrics, candidates, types: [...types], notes: { unreadableDays: unknown.size, deletedHabits: deleted.size, ignoredDays, extraCompletions } };
}

/** Lightweight encouragement only. Partial Count/required Checklist progress is genuine effort. */
export function hasProvisionalEffort(habits: readonly Habit[], record: DayRecord, today: string): boolean {
  return habits.some((habit) => {
    if (!scheduled(habit, today)) return false;
    const entry = currentEntry(record, habit);
    if (!entry) return false;
    if (entry.type === 'tick') return true;
    if (entry.type === 'count') return entry.value > 0;
    return habit.tracking.type === 'checklist' && habit.tracking.steps.some((step) => !step.optional && entry.done.includes(step.id));
  });
}
