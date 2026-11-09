import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  canDeliver,
  canRequestPermission,
  permissionAction,
  parseReminderData,
  responseKey,
  shouldSuppressInForeground,
  tapTarget,
  timeZoneSignature,
  toPermissionState,
} from '../src/utils/reminder-presentation.ts';
import {
  formatReminderTime,
  isNearDstChangeHour,
  isValidReminderTime,
  minutesApart,
  stepHour,
  stepMinute,
} from '../src/utils/reminder-time.ts';
import { checklist, count, MONDAY, routine, tick, TUESDAY } from './support/fixtures.mjs';

const weekdays = (...days) => ({ kind: 'weekdays', days });
const habitData = (id) => ({ v: 1, kind: 'habit', id, slot: 'd', sig: 's' });
const routineData = (id) => ({ v: 1, kind: 'routine', id, slot: 'd', sig: 's' });

function ctx({ habits = [], routines = [], entries = {}, today = MONDAY, loaded = true } = {}) {
  return {
    habitsById: new Map(habits.map((h) => [h.id, h])),
    routinesById: new Map(routines.map((r) => [r.id, r])),
    todayRecord: loaded ? { entries } : null,
    today,
  };
}

describe('foreground suppression', () => {
  test('habit not started → shown', () => {
    assert.equal(shouldSuppressInForeground(habitData('a'), ctx({ habits: [tick('a')] })), false);
  });

  test('tick habit done → suppressed', () => {
    const c = ctx({ habits: [tick('a')], entries: { a: { type: 'tick', done: true } } });
    assert.equal(shouldSuppressInForeground(habitData('a'), c), true);
  });

  test('count habit partially done (5/8) → still shown; at target → suppressed', () => {
    const habits = [count('a', 8)];
    const partial = ctx({ habits, entries: { a: { type: 'count', value: 5, target: 8 } } });
    const full = ctx({ habits, entries: { a: { type: 'count', value: 8, target: 8 } } });
    assert.equal(shouldSuppressInForeground(habitData('a'), partial), false);
    assert.equal(shouldSuppressInForeground(habitData('a'), full), true);
  });

  test('checklist: optional step missing still counts as complete; a required step missing does not', () => {
    const habits = [checklist('a')];
    const required = ctx({ habits, entries: { a: { type: 'checklist', done: ['s1', 's2'], required: ['s1', 's2'] } } });
    const partial = ctx({ habits, entries: { a: { type: 'checklist', done: ['s1', 's3'], required: ['s1', 's2'] } } });
    assert.equal(shouldSuppressInForeground(habitData('a'), required), true);
    assert.equal(shouldSuppressInForeground(habitData('a'), partial), false);
  });

  test('progress not loaded → always shown (never hide by mistake)', () => {
    const c = ctx({ habits: [tick('a')], loaded: false });
    assert.equal(shouldSuppressInForeground(habitData('a'), c), false);
    assert.equal(shouldSuppressInForeground(routineData('r'), { ...c, routinesById: new Map([['r', routine('r', ['a'])]]) }), false);
  });

  test('routine partially complete → shown; all due habits complete → suppressed', () => {
    const habits = [tick('a'), tick('b')];
    const routines = [routine('r', ['a', 'b'])];
    const partial = ctx({ habits, routines, entries: { a: { type: 'tick', done: true } } });
    const done = ctx({ habits, routines, entries: { a: { type: 'tick', done: true }, b: { type: 'tick', done: true } } });
    assert.equal(shouldSuppressInForeground(routineData('r'), partial), false);
    assert.equal(shouldSuppressInForeground(routineData('r'), done), true);
  });

  test('routine: habits not due today are ignored (Tuesday, b is Monday-only)', () => {
    const habits = [tick('a'), tick('b', weekdays(1))];
    const routines = [routine('r', ['a', 'b'])];
    const c = ctx({ habits, routines, entries: { a: { type: 'tick', done: true } }, today: TUESDAY });
    assert.equal(shouldSuppressInForeground(routineData('r'), c), true);
    assert.equal(shouldSuppressInForeground(routineData('r'), { ...c, today: MONDAY }), false);
  });

  test('deleted habit/routine → suppressed (stale), unknown data → shown', () => {
    const c = ctx({ habits: [tick('a')], routines: [routine('r', ['a'])] });
    assert.equal(shouldSuppressInForeground(habitData('gone'), c), true);
    assert.equal(shouldSuppressInForeground(routineData('gone'), c), true);
    assert.equal(shouldSuppressInForeground({ some: 'other' }, c), false);
    assert.equal(shouldSuppressInForeground(undefined, c), false);
  });
});

describe('tap navigation', () => {
  const ids = new Set(['r1']);
  test('habit → Today', () => assert.deepEqual(tapTarget(habitData('h1'), ids), { screen: 'today' }));
  test('existing routine → that routine', () =>
    assert.deepEqual(tapTarget(routineData('r1'), ids), { screen: 'routine', id: 'r1' }));
  test('deleted routine → Today', () => assert.deepEqual(tapTarget(routineData('gone'), ids), { screen: 'today' }));
  test('not a MOMENTUM reminder → ignored', () => {
    assert.equal(tapTarget({ url: 'x' }, ids), null);
    assert.equal(tapTarget(null, ids), null);
    assert.equal(tapTarget({ v: 2, kind: 'habit', id: 'h' }, ids), null);
  });
  test('response key distinguishes deliveries of the same reminder', () => {
    assert.notEqual(responseKey('momentum.h.a.d', 1), responseKey('momentum.h.a.d', 2));
  });
  test('parseReminderData requires an id', () => {
    assert.equal(parseReminderData({ v: 1, kind: 'habit', id: '' }), null);
  });
});

describe('permission states — Android (expo-notifications 58 NotificationPermissionsModule semantics)', () => {
  // android.importance is Android's RAW app importance: 0 = IMPORTANCE_NONE (off), -1000 = unspecified, 3 = default.
  const raw = (status, granted, canAskAgain, importance = 3) => ({
    status,
    granted,
    canAskAgain,
    android: { importance, interruptionFilter: 1 },
  });
  const cases = [
    ['granted', raw('granted', true, true), 'granted'],
    // THE BUG: Expo Go's scoped permission layer says "undetermined" while Android has notifications ON.
    // The module only returns 'undetermined' when areNotificationsEnabled() is true.
    ['Expo Go: system ON, scoped record undetermined', raw('undetermined', false, true), 'system-allowed'],
    ['Expo Go: system ON, scoped record undetermined, canAskAgain=false', raw('undetermined', false, false), 'system-allowed'],
    ['unspecified importance (-1000) + undetermined', raw('undetermined', false, true, -1000), 'system-allowed'],
    ['never asked / denied once (dialog still possible)', raw('denied', false, true, 0), 'denied'],
    ['denied permanently', raw('denied', false, false, 0), 'blocked'],
    ['app notifications switched OFF in system settings', raw('granted', true, true, 0), 'denied'],
    ['switched OFF and cannot ask', raw('granted', true, false, 0), 'blocked'],
    ['denied without android details', { status: 'denied', granted: false, canAskAgain: true }, 'denied'],
  ];
  for (const [name, response, expected] of cases) {
    test(`${name} → ${expected}`, () => {
      assert.equal(toPermissionState(response, 'android'), expected);
    });
  }
});

describe('permission states — iOS keeps the classic mapping', () => {
  const cases = [
    [{ status: 'granted', granted: true, canAskAgain: true }, 'granted'],
    [{ status: 'undetermined', granted: false, canAskAgain: true }, 'undetermined'],
    [{ status: 'denied', granted: false, canAskAgain: true }, 'denied'],
    [{ status: 'denied', granted: false, canAskAgain: false }, 'blocked'],
  ];
  for (const [response, expected] of cases) {
    test(`${response.status}/canAskAgain=${response.canAskAgain} → ${expected}`, () => {
      assert.equal(toPermissionState(response, 'ios'), expected);
    });
  }
});

describe('permission helpers', () => {
  const ALL = ['checking', 'unsupported', 'undetermined', 'denied', 'blocked', 'granted', 'system-allowed', 'error'];
  test('only undetermined and denied can show the system dialog', () => {
    assert.deepEqual(ALL.filter(canRequestPermission), ['undetermined', 'denied']);
  });
  test('granted and system-allowed can deliver (test button enabled, reminders scheduled)', () => {
    assert.deepEqual(ALL.filter(canDeliver), ['granted', 'system-allowed']);
  });
  test('actions: blocked → open settings (never a dialog Android can’t show); error → re-check', () => {
    assert.equal(permissionAction('blocked'), 'open-settings');
    assert.equal(permissionAction('error'), 'recheck');
    assert.equal(permissionAction('undetermined'), 'request');
    assert.equal(permissionAction('denied'), 'request');
    assert.equal(permissionAction('granted'), 'none');
    assert.equal(permissionAction('system-allowed'), 'none');
  });
});

describe('time zones and times', () => {
  test('signature changes with the zone name or the UTC offset', () => {
    assert.equal(timeZoneSignature('Europe/London', 0), 'Europe/London|0');
    assert.notEqual(timeZoneSignature('Europe/London', 0), timeZoneSignature('Europe/London', -60));
    assert.equal(timeZoneSignature(undefined, 300), 'unknown|300');
  });

  test('formatting is engine-independent', () => {
    assert.equal(formatReminderTime({ hour: 0, minute: 5 }, true), '12:05 AM');
    assert.equal(formatReminderTime({ hour: 12, minute: 0 }, true), '12:00 PM');
    assert.equal(formatReminderTime({ hour: 19, minute: 30 }, true), '7:30 PM');
    assert.equal(formatReminderTime({ hour: 7, minute: 5 }, false), '07:05');
  });

  test('steppers wrap within the day/hour', () => {
    assert.deepEqual(stepHour({ hour: 23, minute: 10 }, 1), { hour: 0, minute: 10 });
    assert.deepEqual(stepHour({ hour: 0, minute: 10 }, -1), { hour: 23, minute: 10 });
    assert.deepEqual(stepMinute({ hour: 9, minute: 55 }, 1), { hour: 9, minute: 0 });
    assert.deepEqual(stepMinute({ hour: 9, minute: 0 }, -1), { hour: 9, minute: 55 });
    assert.deepEqual(stepMinute({ hour: 9, minute: 7 }, 1), { hour: 9, minute: 10 });
  });

  test('validation, distance and DST-hour hint', () => {
    assert.equal(isValidReminderTime({ hour: 23, minute: 59 }), true);
    assert.equal(isValidReminderTime({ hour: 24, minute: 0 }), false);
    assert.equal(minutesApart({ hour: 23, minute: 50 }, { hour: 0, minute: 10 }), 20);
    assert.equal(isNearDstChangeHour({ hour: 2, minute: 30 }), true);
    assert.equal(isNearDstChangeHour({ hour: 3, minute: 0 }), false);
  });
});
