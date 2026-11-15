import assert from 'node:assert/strict';
import test from 'node:test';
import { computeHabitConsistency } from '../src/utils/goal-progress.ts';
import { buildInsightsIndex, overview } from '../src/utils/insights.ts';
import { tick, count, checklist, deferred } from './support/fixtures.mjs';
import { hookHarness, loadSource, settle } from './support/hook-harness.mjs';
import { createSaveQueue } from '../src/data/save-queue.ts';

const created = day => new Date(2026, 10, day, 12).toISOString();
const goal = (extra = {}) => ({ startDate: '2026-11-10', targetDate: '2026-11-20', status: 'active', habitIds: ['h'], ...extra });
const history = (days = [], unreadableDays = []) => ({ days: new Map(days), unreadableDays });
const day = entries => ({ entries });
const done = { type: 'tick', done: true };

test('Goals do not penalize pre-creation days and agree numerically with Insights', () => {
  const h = { ...tick('h'), createdAt: created(14) }; const saved = history();
  const result = computeHabitConsistency(goal(), [h], saved, '2026-11-15', day({}));
  assert.deepEqual(result.finished, { completed: 0, scheduled: 1, rate: 0 });
  assert.equal(result.finished.scheduled, overview(buildInsightsIndex([h], saved, '2026-11-15', day({}))).counts.finished);
  assert.deepEqual(result.today, { completed: 0, scheduled: 1 });
});

test('earlier partial entries are start evidence; invalid/future days are ignored; unknown creation invents no past', () => {
  for (const createdAt of [created(14), 'invalid', '1990-01-01T12:00:00Z']) {
    const h = { ...count('h', 9), createdAt };
    const saved = history([['2026-11-12', day({ h: { type: 'count', value: 1, target: 8 } })], ['2026-11-16', day({ h: done })], ['bad', day({ h: done })]]);
    assert.deepEqual(computeHabitConsistency(goal(), [h], saved, '2026-11-15').finished, { completed: 0, scheduled: 3, rate: 0 });
  }
  for (const createdAt of ['invalid', created(20)]) {
    const result = computeHabitConsistency(goal(), [{ ...tick('h'), createdAt }], history(), '2026-11-15');
    assert.deepEqual(result.finished, { completed: 0, scheduled: 0, rate: null });
    assert.equal(result.today, null, 'unknown live today is never inferred from a saved snapshot');
  }
});

test('goal window, snapshot rules, rest days, deleted links and completed target boundaries', () => {
  const a = { ...count('a', 99), createdAt: created(9) };
  const b = { ...checklist('b'), createdAt: created(12), schedule: { kind: 'weekdays', days: [4] } }; // Thu 12
  const saved = history([
    ['2026-11-09', day({ a: { type: 'count', value: 8, target: 8 } })], // outside goal
    ['2026-11-10', day({ a: { type: 'count', value: 8, target: 8 } })],
    ['2026-11-12', day({ b: { type: 'checklist', done: ['old'], required: ['old'] } })],
    ['2026-11-14', day({ a: { type: 'count', value: 8, target: 8 } })],
  ]);
  const result = computeHabitConsistency(goal({ habitIds: ['a', 'b', 'deleted'], status: 'completed', completedAt: '2026-11-12' }), [a, b], saved, '2026-11-15');
  assert.equal(result.linkedHabits.length, 2);
  assert.deepEqual(result.finished, { completed: 2, scheduled: 4, rate: .5 });
  assert.equal(result.today, null);
  assert.equal(computeHabitConsistency(goal({ targetDate: '2026-11-10', habitIds: ['a'] }), [a], saved, '2026-11-15').finished.rate, 1);
});

test('unreadable opportunities excluded; paused/link history remains current-policy; today is live/provisional only', () => {
  const h = { ...tick('h'), createdAt: created(12) };
  const saved = history([['2026-11-15', day({ h: done })]], ['2026-11-11', '2026-11-13']);
  const result = computeHabitConsistency(goal({ status: 'paused' }), [h], saved, '2026-11-15', day({ h: done }));
  assert.deepEqual(result.finished, { completed: 0, scheduled: 2, rate: 0 });
  assert.equal(result.unreadableDays, 1, 'pre-start unreadable days are not opportunities');
  assert.deepEqual(result.today, { completed: 1, scheduled: 1 });
  assert.equal(computeHabitConsistency(goal(), [h], saved, '2026-11-15').today, null);
  assert.deepEqual(computeHabitConsistency(goal({ habitIds: [] }), [h], saved, '2026-11-15').finished, { completed: 0, scheduled: 0, rate: null });
});

test('focused Goal history invalidates midnight/interim reads and publishes only drained successful history', async () => {
  const runner = hookHarness(); let dateKey = '2026-11-14'; let pending = false; let revision = 0;
  const persistence = { snapshot: () => ({ pending, finishedRevision: revision }) };
  const reads = [];
  const { useCompletionHistory } = loadSource('src/hooks/use-completion-history.ts', {
    react: runner.react, 'expo-router': { useFocusEffect: callback => runner.react.useEffect(callback, [callback]) },
    '@/data/completion-storage': { loadCompletionHistory: () => { const read = deferred(); reads.push(read); return read.promise; } },
  });
  const { useGoalHistory } = loadSource('src/hooks/use-goal-history.ts', {
    react: runner.react, '@/hooks/use-completion-history': { useCompletionHistory },
    '@/hooks/use-daily-progress': { useDailyProgress: () => ({ dateKey, persistence }) },
  });
  assert.equal(runner.render(useGoalHistory).status, 'loading');
  pending = true; dateKey = '2026-11-15';
  assert.equal(runner.render().status, 'loading');
  reads[0].resolve(history([['2026-11-14', day({ h: done })]])); await settle();
  assert.equal(runner.render().status, 'loading', 'late pre-midnight read cannot count interim completion');
  assert.equal(reads.length, 1, 'optimistic/failed write does not initiate saved-history reads');
  runner.render(); assert.equal(reads.length, 1);
  pending = false; revision = 1; runner.render(); assert.equal(reads.length, 2);
  const finalHistory = history([['2026-11-14', day({})]]);
  reads[1].resolve(finalHistory); await settle();
  assert.equal(runner.render().history, finalHistory, 'successful final undo is authoritative');
  dateKey = '2026-11-16';
  assert.equal(runner.render().status, 'loading', 'new date never displays old boundary data');
  assert.equal(reads.length, 3);
  // A completed-day write can finish after the date changes, without refocusing.
  revision = 2; runner.render(); assert.equal(reads.length, 4);
  reads[2].resolve(history()); await settle(); assert.equal(runner.render().status, 'loading');
  reads[3].resolve(finalHistory); await settle(); assert.equal(runner.render().history, finalHistory);
  runner.unmount();
});

test('real save queue failed completed-day undo cannot publish interim saved history; successful retry refreshes without focus', async () => {
  const runner = hookHarness(); const writes = []; let disk = day({ h: done }); let reads = 0;
  const queue = createSaveQueue(async (_key, record) => {
    const write = deferred(); writes.push(write); await write.promise; disk = record;
  }, () => {}, [60_000]);
  const persistence = { snapshot: today => ({ pending: queue.hasPending(), finishedRevision: queue.finishedRevision(today) }) };
  const { useCompletionHistory } = loadSource('src/hooks/use-completion-history.ts', {
    react: runner.react, 'expo-router': { useFocusEffect: callback => runner.react.useEffect(callback, [callback]) },
    '@/data/completion-storage': { loadCompletionHistory: async () => { reads++; return history([['2026-11-14', disk]]); } },
  });
  const { useGoalHistory } = loadSource('src/hooks/use-goal-history.ts', {
    react: runner.react, '@/hooks/use-completion-history': { useCompletionHistory },
    '@/hooks/use-daily-progress': { useDailyProgress: () => ({ dateKey: '2026-11-15', persistence }) },
  });
  runner.render(useGoalHistory); await settle(); assert.equal(runner.render().status, 'ready');
  queue.enqueue('2026-11-14', day({})); assert.equal(runner.render().status, 'loading');
  writes[0].reject(Error('synthetic failed undo')); await settle();
  assert.equal(runner.render().status, 'loading'); assert.equal(reads, 1); assert.equal(queue.finishedRevision('2026-11-15'), 0);
  queue.retry(); await settle(); writes[1].resolve(); await settle();
  assert.equal(queue.hasPending(), false); assert.equal(queue.finishedRevision('2026-11-15'), 1);
  runner.render(); await settle(); const result = runner.render();
  assert.equal(reads, 2); assert.deepEqual(result.history.days.get('2026-11-14'), day({}));
  runner.unmount();
});
