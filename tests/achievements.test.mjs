import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ACHIEVEMENTS } from '../src/data/achievement-definitions.ts';
import { evaluateAchievements, hasProvisionalEffort } from '../src/utils/achievements.ts';
import { addDays, parseLocalDateKey, toLocalDateKey } from '../src/utils/date.ts';
import { tick, count, checklist } from './support/fixtures.mjs';

const done = { type: 'tick', done: true };
const record = (entries) => ({ entries });
const history = (days = [], unreadableDays = []) => ({ days: new Map(days), unreadableDays });
const key = (i) => toLocalDateKey(addDays(new Date(2026, 0, 1), i));
const series = (n, id = 'a') => Array.from({ length: n }, (_, i) => [key(i), record({ [id]: done })]);
const evaluate = (habits, days = [], unknown = [], today = '2026-12-01') => evaluateAchievements(habits, history(days, unknown), today);

describe('achievement formulas', () => {
  test('catalog has exactly 12 distinct stable badges', () => {
    assert.equal(ACHIEVEMENTS.length, 12);
    assert.equal(new Set(ACHIEVEMENTS.map((b) => b.id)).size, 12);
  });
  for (const [id, metric, threshold] of [
    ['first-checkin', 'checkins', 1], ['checkins-10', 'checkins', 10], ['checkins-50', 'checkins', 50], ['checkins-100', 'checkins', 100],
    ['active-days-7', 'activeDays', 7], ['active-days-30', 'activeDays', 30],
    ['streak-3', 'streak', 3], ['streak-7', 'streak', 7], ['streak-30', 'streak', 30],
    ['perfect-day', 'perfectDays', 1],
  ]) {
    test(`${id} unlocks exactly at ${threshold} with earliest saved evidence`, () => {
      const before = evaluate([tick('a')], series(threshold - 1));
      const at = evaluate([tick('a')], series(threshold));
      assert.equal(before.candidates[id], undefined);
      assert.equal(at.metrics[metric], threshold);
      assert.equal(at.candidates[id].evidenceThrough, key(threshold - 1));
      const later = evaluate([tick('a')], series(threshold + 4));
      assert.equal(later.candidates[id].evidenceThrough, key(threshold - 1));
    });
  }
  test('multiple habits contribute separate check-ins but one active day; no summed streaks', () => {
    const e = evaluate([tick('a'), tick('b'), tick('c')], [[key(0), record({ a: done, b: done, c: done })]]);
    assert.equal(e.metrics.checkins, 3); assert.equal(e.metrics.activeDays, 1); assert.equal(e.metrics.streak, 1);
    assert.equal(e.candidates['streak-3'], undefined);
  });
  test('Count and Checklist use historical snapshots; extras do not inflate totals', () => {
    const e = evaluate([count('c', 999), checklist('l')], [
      [key(0), record({ c: { type: 'count', value: 7, target: 8 }, l: { type: 'checklist', done: ['s1'], required: ['s1', 's2'] } })],
      [key(1), record({ c: { type: 'count', value: 8, target: 8 }, l: { type: 'checklist', done: ['old', 'optional'], required: ['old'] } })],
      [key(2), record({ c: { type: 'count', value: 12, target: 8 }, l: { type: 'checklist', done: ['optional'], required: [] } })],
      [key(3), record({ l: { type: 'checklist', done: ['optional'], required: ['s1'] } })],
    ]);
    assert.equal(e.metrics.checkins, 3); assert.deepEqual(e.types.sort(), ['checklist', 'count']);
  });
  test('Tracking Trio reaches 3/3 only with all snapshot types, even on one edited habit', () => {
    const days = [[key(0), record({ a: done })], [key(1), record({ a: { type: 'count', value: 5, target: 5 } })]];
    assert.equal(evaluate([tick('a')], days).candidates['tracking-trio'], undefined);
    days.push([key(2), record({ a: { type: 'checklist', done: ['old'], required: ['old'] } })]);
    const e = evaluate([tick('a')], days);
    assert.equal(e.metrics.types, 3); assert.equal(e.candidates['tracking-trio'].evidenceThrough, key(2));
  });
  test('M/W/F streak skips rest days; current schedule applies retroactively and EXTRA is excluded', () => {
    const habit = tick('a', { kind: 'weekdays', days: [1, 3, 5] });
    const dates = ['2026-11-02', '2026-11-04', '2026-11-06'];
    const days = dates.map((d) => [d, record({ a: done })]);
    const e = evaluate([habit], days);
    assert.equal(e.metrics.streak, 3); assert.equal(e.candidates['streak-3'].evidenceThrough, dates[2]);
    const changed = evaluate([{ ...habit, schedule: { kind: 'weekdays', days: [1] } }], days);
    assert.equal(changed.metrics.checkins, 1); assert.equal(changed.notes.extraCompletions, 2);
    assert.equal(evaluate([tick('a')], days).metrics.streak, 1);
  });
  for (const gap of ['missing', 'partial', 'unknown']) {
    test(`${gap} scheduled day breaks streak; later proven run can still qualify`, () => {
      const days = series(7);
      if (gap === 'missing') days.splice(2, 1);
      if (gap === 'partial') days[2][1] = record({ a: { type: 'count', value: 1, target: 8 } });
      const e = evaluate([tick('a')], days, gap === 'unknown' ? [key(2)] : []);
      assert.equal(e.metrics.streak, 4); assert.equal(e.candidates['streak-3'].evidenceThrough, key(5));
      assert.equal(e.candidates['streak-7'], undefined);
    });
  }
  test('perfect day requires known nonempty due set and all habits done', () => {
    assert.equal(evaluate([tick('a'), tick('b')], series(1)).metrics.perfectDays, 0);
    assert.equal(evaluate([tick('a')], series(1), [key(0)]).metrics.perfectDays, 0);
    assert.equal(evaluate([tick('a', { kind: 'weekdays', days: [1] })], series(1)).metrics.perfectDays, 0);
  });
  test('perfect week waits until Monday; missed/partial/unknown dates and empty week fail', () => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = toLocalDateKey(addDays(parseLocalDateKey('2026-11-02'), i));
      return [d, record({ a: done })];
    });
    const sunday = evaluate([tick('a')], days, [], '2026-11-08');
    assert.equal(sunday.metrics.perfectWeeks, 0);
    const monday = evaluate([tick('a')], days, [], '2026-11-09');
    assert.equal(monday.metrics.perfectWeeks, 1);
    assert.equal(monday.candidates['perfect-week'].evidenceThrough, '2026-11-08');
    assert.equal(monday.candidates['perfect-week'].evidence.windowStart, '2026-11-02');
    assert.equal(evaluate([tick('a')], days.slice(1), [], '2026-11-09').metrics.perfectWeeks, 0);
    assert.equal(evaluate([tick('a')], days, ['2026-11-04'], '2026-11-09').metrics.perfectWeeks, 0);
    assert.equal(evaluate([tick('a')], [], [], '2026-11-09').metrics.perfectWeeks, 0);
    const partial = days.map(([d, r]) => [d, d === '2026-11-04' ? record({ a: { type: 'count', value: 1, target: 2 } }) : r]);
    assert.equal(evaluate([tick('a')], partial, [], '2026-11-09').metrics.perfectWeeks, 0);
  });
  test('first Friday can qualify a week after Sunday; unreadable rest day disqualifies week', () => {
    const h = { ...tick('a', { kind: 'weekdays', days: [5] }), createdAt: new Date(2026, 10, 6, 9).toISOString() };
    const days = [['2026-11-06', record({ a: done })]];
    assert.equal(evaluate([h], days, [], '2026-11-09').metrics.perfectWeeks, 1);
    assert.equal(evaluate([h], days, ['2026-11-07'], '2026-11-09').metrics.perfectWeeks, 0);
  });
  test('first-day, future and invalid records never unlock; no habits never invents evidence', () => {
    const days = [['2026-11-09', record({ a: done })], ['2026-11-10', record({ a: done })], ['2026-02-30', record({ a: done })]];
    const e = evaluate([tick('a')], days, [], '2026-11-09');
    assert.deepEqual(e.candidates, {}); assert.equal(e.notes.ignoredDays, 2);
    const deleted = evaluate([], series(4));
    assert.equal(deleted.metrics.checkins, 0); assert.equal(deleted.notes.deletedHabits, 1);
  });
  test('start is earlier reliable creation or partial saved evidence; invalid/future creation is safe', () => {
    const h = { ...tick('a'), createdAt: '2026-11-07T12:00:00Z' };
    const days = [['2026-11-06', record({ a: done })]];
    assert.equal(evaluate([h], days, [], '2026-11-09').metrics.checkins, 1);
    for (const createdAt of ['invalid', '1990-01-01', '2099-01-01']) {
      assert.equal(evaluate([{ ...h, createdAt }], days, [], '2026-11-09').metrics.checkins, 1);
      assert.deepEqual(evaluate([{ ...h, createdAt }], [], [], '2026-11-09').candidates, {});
    }
  });
  test('streak crossing ties use lexical habit ID and earliest date, not latest longest run', () => {
    const days = series(7).map(([d]) => [d, record({ z: done, a: done })]);
    const e = evaluate([tick('z'), tick('a')], days);
    assert.equal(e.candidates['streak-3'].evidence.habitId, 'a');
    assert.equal(e.candidates['streak-3'].evidenceThrough, key(2));
  });
  test('calendar arithmetic works across leap day and year boundary', () => {
    for (const dates of [['2024-02-28', '2024-02-29', '2024-03-01'], ['2026-12-30', '2026-12-31', '2027-01-01']]) {
      const e = evaluate([{ ...tick('a'), createdAt: '2020-01-01' }], dates.map((d) => [d, record({ a: done })]), [], '2027-02-01');
      assert.equal(e.metrics.streak, 3);
    }
  });
  test('provisional encouragement accepts genuine partial effort, ignores optional-only, undo and rest days', () => {
    assert.equal(hasProvisionalEffort([tick('a')], record({ a: done }), '2026-11-09'), true);
    assert.equal(hasProvisionalEffort([count('a')], record({ a: { type: 'count', value: 1, target: 8 } }), '2026-11-09'), true);
    assert.equal(hasProvisionalEffort([checklist('a')], record({ a: { type: 'checklist', done: ['s1'], required: ['s1', 's2'] } }), '2026-11-09'), true);
    assert.equal(hasProvisionalEffort([checklist('a')], record({ a: { type: 'checklist', done: ['s3'], required: ['s1', 's2'] } }), '2026-11-09'), false);
    assert.equal(hasProvisionalEffort([tick('a')], record({}), '2026-11-09'), false);
    assert.equal(hasProvisionalEffort([tick('a', { kind: 'weekdays', days: [2] })], record({ a: done }), '2026-11-09'), false);
  });
  test('five years of sparse history retains full lifetime totals without a calendar lookback cap', () => {
    const habits = Array.from({ length: 12 }, (_, i) => ({ ...tick(`h${i}`), createdAt: '2020-01-01T12:00:00Z' }));
    const days = Array.from({ length: 1826 }, (_, i) => [
      toLocalDateKey(addDays(new Date(2020, 0, 1), i)), record(Object.fromEntries(habits.map((h) => [h.id, done]))),
    ]);
    const e = evaluate(habits, days);
    assert.equal(e.metrics.checkins, 1826 * 12); assert.equal(e.metrics.activeDays, 1826);
    assert.equal(e.metrics.streak, 1826); assert.equal(e.candidates['checkins-100'].evidenceThrough, days[8][0]);
    assert.equal(e.candidates['streak-30'].evidenceThrough, days[29][0]);
  });
});
