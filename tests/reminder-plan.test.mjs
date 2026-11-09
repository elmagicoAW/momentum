import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  diffSchedule,
  findOverlaps,
  fromTriggerWeekday,
  habitDueWeekdays,
  isOwnedReminderIdentifier,
  planHabitReminders,
  planReminders,
  planRoutineReminders,
  routineDueWeekdays,
  toTriggerWeekday,
} from '../src/utils/reminder-plan.ts';
import { checklist, count, routine, tick } from './support/fixtures.mjs';

const T = (hour, minute = 0) => ({ hour, minute });
const on = (time = T(9)) => ({ enabled: true, time, updatedAt: '2026-11-09T00:00:00.000Z' });
const off = (time = T(9)) => ({ ...on(time), enabled: false });
const settings = (habits = {}, routines = {}, enabled = true) => ({ enabled, habits, routines });
const weekdays = (...days) => ({ kind: 'weekdays', days });
const byId = (habits) => new Map(habits.map((h) => [h.id, h]));
const plan = (habits, routines, s, limit = 150, zone = '') => planReminders({ habits, routines, settings: s, limit, zone });

describe('weekday conversion (app 0=Sun…6=Sat ↔ expo WEEKLY 1=Sun…7=Sat)', () => {
  test('every weekday maps one-to-one', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(toTriggerWeekday), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(fromTriggerWeekday), [0, 1, 2, 3, 4, 5, 6]);
  });
  test('Sunday is 1 and Saturday is 7', () => {
    assert.equal(toTriggerWeekday(0), 1);
    assert.equal(toTriggerWeekday(6), 7);
  });
});

describe('habit reminders respect the habit schedule', () => {
  test('daily habit → exactly one DAILY trigger', () => {
    const [r, ...rest] = planHabitReminders(tick('h1'), T(7, 30));
    assert.equal(rest.length, 0);
    assert.equal(r.identifier, 'momentum.h.h1.d');
    assert.deepEqual(r.trigger, { type: 'daily', hour: 7, minute: 30 });
    assert.equal(r.channelId, 'habit-reminders');
  });

  test('Mon/Wed/Fri habit → WEEKLY 2, 4, 6 only — nothing on other days', () => {
    const list = planHabitReminders(tick('h1', weekdays(1, 3, 5)), T(9));
    assert.deepEqual(
      list.map((r) => r.trigger),
      [2, 4, 6].map((weekday) => ({ type: 'weekly', weekday, hour: 9, minute: 0 })),
    );
    assert.deepEqual(list.map((r) => r.identifier), ['momentum.h.h1.w2', 'momentum.h.h1.w4', 'momentum.h.h1.w6']);
  });

  test('weekend habit → Sunday (1) and Saturday (7)', () => {
    const list = planHabitReminders(tick('h1', weekdays(0, 6)), T(10));
    assert.deepEqual(list.map((r) => r.trigger.weekday), [1, 7]);
  });

  test('all seven weekdays selected → collapses to one DAILY', () => {
    const list = planHabitReminders(tick('h1', weekdays(0, 1, 2, 3, 4, 5, 6)), T(9));
    assert.equal(list.length, 1);
    assert.equal(list[0].trigger.type, 'daily');
  });

  test('body follows the tracking type', () => {
    assert.equal(planHabitReminders(tick('a'), T(9))[0].body, 'Due today · tap to check in');
    assert.equal(planHabitReminders(count('b', 8), T(9))[0].body, 'Goal: 8 glasses today');
    assert.equal(planHabitReminders(checklist('c'), T(9))[0].body, '2 steps today'); // optional step not counted
  });
});

describe('routine reminders respect the days their habits are due', () => {
  test('due days are the union of member schedules', () => {
    const habits = [tick('a', weekdays(1, 2)), tick('b', weekdays(2, 3))];
    assert.deepEqual(routineDueWeekdays(routine('r', ['a', 'b']), byId(habits)), [1, 2, 3]);
  });

  test('weekday-only habits → no routine reminder on the weekend', () => {
    const habits = [tick('a', weekdays(1, 2, 3, 4, 5))];
    const list = planRoutineReminders(routine('r', ['a']), byId(habits), T(7, 30));
    assert.deepEqual(list.map((r) => r.trigger.weekday), [2, 3, 4, 5, 6]);
    assert.ok(list.every((r) => r.channelId === 'routine-reminders'));
  });

  test('same habits every day → one DAILY', () => {
    const list = planRoutineReminders(routine('r', ['a', 'b']), byId([tick('a'), tick('b')]), T(7));
    assert.equal(list.length, 1);
    assert.equal(list[0].identifier, 'momentum.r.r.d');
    assert.equal(list[0].body, '2 habits due today');
  });

  test('due every day but with different habits → one WEEKLY per day with that day’s count', () => {
    const habits = [tick('a'), tick('b', weekdays(1))];
    const list = planRoutineReminders(routine('r', ['a', 'b']), byId(habits), T(7));
    assert.equal(list.length, 7);
    const monday = list.find((r) => r.trigger.weekday === 2);
    const tuesday = list.find((r) => r.trigger.weekday === 3);
    assert.equal(monday.body, '2 habits due today');
    assert.equal(tuesday.body, '1 habit due today');
  });

  test('deleted habit IDs are ignored; a routine with no existing habits plans nothing', () => {
    assert.deepEqual(planRoutineReminders(routine('r', ['gone']), byId([]), T(7)), []);
    const list = planRoutineReminders(routine('r', ['gone', 'a']), byId([tick('a')]), T(7));
    assert.equal(list[0].body, '1 habit due today');
  });
});

describe('planReminders', () => {
  const habits = [tick('h1'), tick('h2', weekdays(1))];
  const routines = [routine('r1', ['h1'])];

  test('only enabled settings for existing items are planned', () => {
    const p = plan(habits, routines, settings({ h1: on(), h2: off(), ghost: on() }, { r1: off(), rghost: on() }));
    assert.deepEqual(p.reminders.map((r) => r.identifier), ['momentum.h.h1.d']);
  });

  test('master switch off → empty plan, whatever the item settings are', () => {
    const p = plan(habits, routines, settings({ h1: on() }, { r1: on() }, false));
    assert.deepEqual(p, { reminders: [], omittedForLimit: 0 });
  });

  test('routines come first; the cap keeps the first N and reports the rest', () => {
    const p = plan(habits, routines, settings({ h1: on(), h2: on() }, { r1: on() }), 2);
    assert.deepEqual(p.reminders.map((r) => r.identifier), ['momentum.r.r1.d', 'momentum.h.h1.d']);
    assert.equal(p.omittedForLimit, 1);
  });

  test('identifiers are unique across the whole plan', () => {
    const many = [tick('a'), tick('b', weekdays(1, 3)), tick('c', weekdays(0, 6))];
    const p = plan(many, [routine('r', ['a', 'b'])], settings({ a: on(), b: on(), c: on() }, { r: on() }));
    const ids = p.reminders.map((r) => r.identifier);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('planning reads no clock: the same input gives the same output', () => {
    const s = settings({ h1: on(T(8)) });
    assert.deepEqual(plan(habits, [], s), plan(habits, [], s));
  });
});

describe('signatures', () => {
  const sigOf = (habit, time = T(9), zone = '') => planHabitReminders(habit, time, zone)[0].sig;

  test('stable when nothing relevant changed', () => {
    assert.equal(sigOf(tick('h1')), sigOf(tick('h1')));
    assert.equal(sigOf({ ...tick('h1'), color: '#000000', icon: 'moon' }), sigOf(tick('h1')));
  });
  test('changes with name, time or tracking', () => {
    const base = sigOf(tick('h1'));
    assert.notEqual(sigOf({ ...tick('h1'), name: 'Renamed' }), base);
    assert.notEqual(sigOf(tick('h1'), T(9, 5)), base);
    assert.notEqual(sigOf(count('h1')), base);
  });
  test('changes with the time zone or UTC offset (travel, daylight saving)', () => {
    const winter = sigOf(tick('h1'), T(9), 'Europe/London|0');
    const summer = sigOf(tick('h1'), T(9), 'Europe/London|-60');
    const travel = sigOf(tick('h1'), T(9), 'America/New_York|300');
    assert.notEqual(winter, summer);
    assert.notEqual(winter, travel);
    assert.equal(sigOf(tick('h1'), T(9), 'Europe/London|0'), winter);
  });
});

describe('diffSchedule', () => {
  const desired = planHabitReminders(tick('h1', weekdays(1, 3)), T(9));
  const asExisting = (list) => list.map((r) => ({ identifier: r.identifier, sig: r.sig }));

  test('identical → no operations', () => {
    const d = diffSchedule(asExisting(desired), desired);
    assert.deepEqual(d.toCancel, []);
    assert.deepEqual(d.toSchedule, []);
    assert.equal(d.unchanged, 2);
  });

  test('nothing scheduled → schedule all', () => {
    assert.equal(diffSchedule([], desired).toSchedule.length, 2);
  });

  test('changed signature → cancel then reschedule that one only', () => {
    const existing = asExisting(desired);
    existing[0].sig = 'old';
    const d = diffSchedule(existing, desired);
    assert.deepEqual(d.toCancel, [desired[0].identifier]);
    assert.deepEqual(d.toSchedule.map((r) => r.identifier), [desired[0].identifier]);
    assert.ok(d.replacing.has(desired[0].identifier));
  });

  test('missing signature (e.g. scheduled by an older build) → rescheduled', () => {
    const d = diffSchedule([{ identifier: desired[0].identifier, sig: null }], desired.slice(0, 1));
    assert.equal(d.toSchedule.length, 1);
  });

  test('schedule changed Mon/Wed → Wed only: Monday is cancelled', () => {
    const next = planHabitReminders(tick('h1', weekdays(3)), T(9));
    const d = diffSchedule(asExisting(desired), next);
    assert.deepEqual(d.toCancel, ['momentum.h.h1.w2']);
    assert.deepEqual(d.toSchedule, []);
  });

  test('foreign identifiers are never cancelled — including our own test notification', () => {
    const existing = [
      { identifier: 'other-app-or-project', sig: null },
      { identifier: 'momentum.test.123', sig: null },
      { identifier: 'momentumX.h.h1.d', sig: null },
      { identifier: 'momentum.h.deleted.d', sig: 'x' },
    ];
    const d = diffSchedule(existing, []);
    assert.deepEqual(d.toCancel, ['momentum.h.deleted.d']);
  });

  test('isOwnedReminderIdentifier', () => {
    assert.equal(isOwnedReminderIdentifier('momentum.h.a.d'), true);
    assert.equal(isOwnedReminderIdentifier('momentum.r.a.w1'), true);
    assert.equal(isOwnedReminderIdentifier('momentum.test.1'), false);
    assert.equal(isOwnedReminderIdentifier('h.a.d'), false);
  });
});

describe('overlaps (habit reminder + reminder of a routine containing it)', () => {
  const habits = [tick('a', weekdays(1, 3)), tick('b')];
  const routines = [routine('r', ['a', 'b', 'gone'])];

  test('same time → minutesApart 0, on the habit’s due days', () => {
    const [o] = findOverlaps(habits, routines, settings({ a: on(T(7, 30)) }, { r: on(T(7, 30)) }));
    assert.equal(o.habit.id, 'a');
    assert.equal(o.minutesApart, 0);
    assert.deepEqual(o.days, [1, 3]);
  });

  test('different times are still reported, with the distance (wrapping midnight)', () => {
    const [o] = findOverlaps(habits, routines, settings({ b: on(T(23, 50)) }, { r: on(T(0, 10)) }));
    assert.equal(o.minutesApart, 20);
  });

  test('no overlap when either side is disabled, or master is off', () => {
    assert.deepEqual(findOverlaps(habits, routines, settings({ a: on() }, { r: off() })), []);
    assert.deepEqual(findOverlaps(habits, routines, settings({ a: off() }, { r: on() })), []);
    assert.deepEqual(findOverlaps(habits, routines, settings({ a: on() }, { r: on() }, false)), []);
  });

  test('detecting overlaps never changes the settings', () => {
    const s = settings({ a: on(T(7)) }, { r: on(T(7)) });
    const before = JSON.stringify(s);
    findOverlaps(habits, routines, s);
    assert.equal(JSON.stringify(s), before);
    // …and both reminders stay in the plan.
    // r: 7 WEEKLY (different habits due on Mon/Wed) + a: Mon, Wed.
    assert.equal(plan(habits, routines, s).reminders.length, 9);
  });

  test('habitDueWeekdays', () => {
    assert.deepEqual(habitDueWeekdays(tick('x')), [0, 1, 2, 3, 4, 5, 6]);
  });
});
