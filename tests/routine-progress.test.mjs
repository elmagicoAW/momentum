import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { applyCount, applyStep, applyTick, isCompleteNow } from '../src/utils/habit-progress.ts';
import { indexHabits, planForDay, routineDay, timeOfDayBucket } from '../src/utils/routine-progress.ts';
import { isScheduledOn } from '../src/utils/schedule.ts';
import { checklist, count, EMPTY, MONDAY, routine, tick, TUESDAY } from './support/fixtures.mjs';

/** Today's ring, exactly as `src/app/(tabs)/index.tsx` computes it. */
function todayRing(habits, record, date) {
  const due = habits.filter((h) => isScheduledOn(h, date));
  return { done: due.filter((h) => isCompleteNow(record, h)).length, total: due.length };
}

const mondayOnly = { kind: 'weekdays', days: [1] };

describe('routine progress', () => {
  test('states: empty, rest, todo, partial, complete', () => {
    const habits = [tick('a'), tick('b'), tick('mon', mondayOnly)];
    const byId = indexHabits(habits);
    assert.equal(routineDay(routine('r', []), byId, MONDAY, EMPTY()).state, 'empty');
    assert.equal(routineDay(routine('r', ['mon']), byId, TUESDAY, EMPTY()).state, 'rest');
    assert.equal(routineDay(routine('r', ['a', 'b']), byId, MONDAY, EMPTY()).state, 'todo');
    let record = applyTick(EMPTY(), habits[0]);
    assert.equal(routineDay(routine('r', ['a', 'b']), byId, MONDAY, record).state, 'partial');
    record = applyTick(record, habits[1]);
    assert.equal(routineDay(routine('r', ['a', 'b']), byId, MONDAY, record).state, 'complete');
  });

  test('deleted habit IDs are ignored in progress and only counted as missing', () => {
    const habits = [tick('a')];
    const day = routineDay(routine('r', ['gone', 'a', 'gone2']), indexHabits(habits), MONDAY, applyTick(EMPTY(), habits[0]));
    assert.deepEqual(day.members.map((h) => h.id), ['a']);
    assert.equal(day.missingCount, 2);
    assert.equal(day.total, 1);
    assert.equal(day.state, 'complete');
  });

  test('a routine whose habits were all deleted becomes empty (kept, not removed)', () => {
    const day = routineDay(routine('r', ['gone']), indexHabits([]), MONDAY, EMPTY());
    assert.equal(day.state, 'empty');
    assert.equal(day.missingCount, 1);
  });

  test('habits not due today are listed separately and never counted', () => {
    const habits = [tick('a'), tick('mon', mondayOnly)];
    const day = routineDay(routine('r', ['mon', 'a']), indexHabits(habits), TUESDAY, EMPTY());
    assert.deepEqual(day.due.map((h) => h.id), ['a']);
    assert.deepEqual(day.notDue.map((h) => h.id), ['mon']);
    assert.equal(day.total, 1);
  });

  test('order follows the routine, not the habit list', () => {
    const habits = [tick('a'), tick('b'), tick('c')];
    const day = routineDay(routine('r', ['c', 'a', 'b']), indexHabits(habits), MONDAY, EMPTY());
    assert.deepEqual(day.due.map((h) => h.id), ['c', 'a', 'b']);
  });

  test('Count and Checklist count as one unit, complete only at target / all required steps', () => {
    const water = count('water', 3);
    const steps = checklist('steps');
    const byId = indexHabits([water, steps]);
    const r = routine('r', ['water', 'steps']);
    let record = applyCount(EMPTY(), water, 2);
    record = applyStep(record, steps, 's1');
    assert.equal(routineDay(r, byId, MONDAY, record).done, 0, '2/3 and 1 of 2 required are not done');
    record = applyCount(record, water, 5); // over target is still one unit
    record = applyStep(record, steps, 's2'); // optional s3 not needed
    const day = routineDay(r, byId, MONDAY, record);
    assert.equal(day.done, 2);
    assert.equal(day.total, 2);
  });
});

describe('shared habit in two routines — no double counting', () => {
  const habits = [tick('shared'), tick('morningOnly'), tick('eveningOnly')];
  const morning = routine('m', ['shared', 'morningOnly'], { timeOfDay: 'morning' });
  const evening = routine('e', ['eveningOnly', 'shared'], { timeOfDay: 'evening' });
  const byId = indexHabits(habits);

  test('one tick (the single daily record) marks it done in both routines', () => {
    const record = applyTick(EMPTY(), habits[0]); // tapped once, from either routine
    assert.deepEqual(Object.keys(record.entries), ['shared'], 'exactly one entry per habit per day');
    assert.equal(routineDay(morning, byId, MONDAY, record).done, 1);
    assert.equal(routineDay(evening, byId, MONDAY, record).done, 1);
  });

  test("Today's ring counts it once", () => {
    const record = applyTick(EMPTY(), habits[0]);
    assert.deepEqual(todayRing(habits, record, MONDAY), { done: 1, total: 3 });
  });

  test('ticking it again from the other routine toggles the SAME entry (un-tick), never adds a second', () => {
    const once = applyTick(EMPTY(), habits[0]);
    const twice = applyTick(once, habits[0]);
    assert.deepEqual(twice.entries, {});
  });

  test('the plan counts routines, and outside habits only once', () => {
    const extra = tick('loose');
    const all = [...habits, extra];
    const record = applyTick(applyTick(EMPTY(), habits[0]), habits[1]);
    const plan = planForDay([morning, evening], all, MONDAY, record, 'morning');
    assert.equal(plan.items.length, 2);
    assert.equal(plan.routinesDone, 1, 'Morning complete, Evening 1 of 2');
    assert.equal(plan.outsideCount, 1);
  });
});

describe("today's plan", () => {
  const habits = [tick('a'), tick('b'), tick('c'), tick('mon', mondayOnly)];
  const routines = [
    routine('any', ['a'], { timeOfDay: 'anytime' }),
    routine('eve', ['b'], { timeOfDay: 'evening' }),
    routine('mor1', ['c'], { timeOfDay: 'morning' }),
    routine('restDay', ['mon'], { timeOfDay: 'morning' }),
    routine('empty', [], { timeOfDay: 'morning' }),
  ];

  test('orders morning → afternoon → evening → anytime; hides empty and rest routines', () => {
    const plan = planForDay(routines, habits, TUESDAY, EMPTY(), 'morning');
    assert.deepEqual(plan.items.map((d) => d.routine.id), ['mor1', 'eve', 'any']);
    assert.deepEqual(plan.restRoutines.map((d) => d.routine.id), ['restDay']);
  });

  test('keeps the user order within the same time of day', () => {
    const list = [routine('x', ['a'], { timeOfDay: 'evening' }), routine('y', ['b'], { timeOfDay: 'evening' })];
    assert.deepEqual(planForDay(list, habits, MONDAY, EMPTY(), 'morning').items.map((d) => d.routine.id), ['x', 'y']);
  });

  test('"Now" highlights the first incomplete routine in the current bucket, and moves on when done', () => {
    assert.equal(planForDay(routines, habits, TUESDAY, EMPTY(), 'morning').nowRoutineId, 'mor1');
    assert.equal(planForDay(routines, habits, TUESDAY, EMPTY(), 'evening').nowRoutineId, 'eve');
    assert.equal(planForDay(routines, habits, TUESDAY, EMPTY(), 'afternoon').nowRoutineId, null);
    const done = applyTick(EMPTY(), habits[2]);
    assert.equal(planForDay(routines, habits, TUESDAY, done, 'morning').nowRoutineId, null);
  });

  test('time of day never hides anything: every bucket shows the same routines', () => {
    const ids = (b) => planForDay(routines, habits, TUESDAY, EMPTY(), b).items.map((d) => d.routine.id);
    assert.deepEqual(ids('morning'), ids('afternoon'));
    assert.deepEqual(ids('morning'), ids('evening'));
  });

  test('no routines with due habits → empty plan (Today unchanged)', () => {
    const plan = planForDay([routines[3], routines[4]], habits, TUESDAY, EMPTY(), 'morning');
    assert.equal(plan.items.length, 0);
  });
});

describe('midnight rollover (deterministic dates, no device clock)', () => {
  const habits = [tick('daily'), tick('mon', mondayOnly)];
  const r = routine('r', ['daily', 'mon']);
  const byId = indexHabits(habits);

  test("Monday's record does not carry into Tuesday; due list changes with the weekday", () => {
    const mondayRecord = applyTick(applyTick(EMPTY(), habits[0]), habits[1]);
    const mon = routineDay(r, byId, MONDAY, mondayRecord);
    assert.deepEqual([mon.done, mon.total, mon.state], [2, 2, 'complete']);
    // After midnight the provider loads Tuesday's (empty) record for the new date key.
    const tue = routineDay(r, byId, TUESDAY, EMPTY());
    assert.deepEqual([tue.done, tue.total, tue.state], [0, 1, 'todo']);
    assert.deepEqual(tue.notDue.map((h) => h.id), ['mon']);
  });
});

describe('time-of-day buckets', () => {
  const at = (h, m) => new Date(2026, 10, 9, h, m);
  const cases = [
    [0, 0, 'evening'],
    [4, 59, 'evening'],
    [5, 0, 'morning'],
    [11, 59, 'morning'],
    [12, 0, 'afternoon'],
    [17, 59, 'afternoon'],
    [18, 0, 'evening'],
    [23, 59, 'evening'],
  ];
  for (const [h, m, expected] of cases) {
    test(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} → ${expected}`, () => {
      assert.equal(timeOfDayBucket(at(h, m)), expected);
    });
  }
});
