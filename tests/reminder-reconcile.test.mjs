import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createSyncRunner, reconcile } from '../src/notifications/reconcile.ts';
import { planReminders } from '../src/utils/reminder-plan.ts';
import { deferred, routine, tick } from './support/fixtures.mjs';

const on = (hour = 9, minute = 0) => ({ enabled: true, time: { hour, minute }, updatedAt: 'x' });
const weekdays = (...days) => ({ kind: 'weekdays', days });

/** In-memory OS schedule with failure injection. */
function fakeScheduler(initial = []) {
  const scheduled = new Map(initial.map((e) => [e.identifier, e]));
  const calls = [];
  const fail = { list: false, cancel: new Set(), schedule: new Set() };
  return {
    scheduled,
    calls,
    fail,
    async listScheduled() {
      calls.push(['list']);
      if (fail.list) throw new Error('list failed');
      return [...scheduled.values()].map((e) => ({ identifier: e.identifier, sig: e.sig ?? null }));
    },
    async cancel(identifier) {
      calls.push(['cancel', identifier]);
      if (fail.cancel.has(identifier)) throw new Error(`cancel ${identifier} failed`);
      scheduled.delete(identifier);
    },
    async schedule(reminder) {
      calls.push(['schedule', reminder.identifier]);
      if (fail.schedule.has(reminder.identifier)) throw new Error(`schedule ${reminder.identifier} failed`);
      // Like the OS: one entry per identifier.
      scheduled.set(reminder.identifier, { identifier: reminder.identifier, sig: reminder.sig });
    },
  };
}

const habits = [tick('a'), tick('b', weekdays(1, 3))];
const routines = [routine('r', ['a'])];
const makePlan = (habitSettings, routineSettings = {}, enabled = true) =>
  planReminders({ habits, routines, settings: { enabled, habits: habitSettings, routines: routineSettings }, limit: 150 });
const input = (plan, extra = {}) => ({ sourcesReady: true, permission: 'granted', plan, ...extra });
const foreign = [
  { identifier: 'expo-go-other-project', sig: null },
  { identifier: 'momentum.test.1', sig: null },
];

describe('reconcile', () => {
  test('schedules the plan from scratch', async () => {
    const s = fakeScheduler();
    const r = await reconcile(s, input(makePlan({ a: on(), b: on() })));
    assert.equal(r.status, 'done');
    assert.deepEqual([...s.scheduled.keys()].sort(), ['momentum.h.a.d', 'momentum.h.b.w2', 'momentum.h.b.w4']);
    assert.equal(r.scheduledCount, 3);
  });

  test('idempotent: a second run performs no cancel or schedule (no duplicates)', async () => {
    const s = fakeScheduler();
    const plan = makePlan({ a: on(), b: on() }, { r: on(7) });
    await reconcile(s, input(plan));
    s.calls.length = 0;
    const r = await reconcile(s, input(plan));
    assert.deepEqual(s.calls, [['list']]);
    assert.equal(r.unchanged, 4);
  });

  test('sources not ready → no OS calls at all; existing schedule preserved', async () => {
    const existing = [{ identifier: 'momentum.h.a.d', sig: 'whatever' }];
    const s = fakeScheduler(existing);
    const r = await reconcile(s, input(makePlan({}), { sourcesReady: false }));
    assert.deepEqual(r, { status: 'skipped', reason: 'sources-not-ready' });
    assert.deepEqual(s.calls, []);
    assert.ok(s.scheduled.has('momentum.h.a.d'));
  });

  test('permission still being checked → no OS calls', async () => {
    const s = fakeScheduler([{ identifier: 'momentum.h.a.d', sig: 'x' }]);
    const r = await reconcile(s, input(makePlan({ a: on() }), { permission: 'checking' }));
    assert.equal(r.status, 'skipped');
    assert.deepEqual(s.calls, []);
  });

  test('unsupported platform (web) → no OS calls', async () => {
    const s = fakeScheduler();
    const r = await reconcile(s, input(makePlan({ a: on() }), { permission: 'unsupported' }));
    assert.equal(r.status, 'skipped');
    assert.deepEqual(s.calls, []);
  });

  for (const permission of ['denied', 'blocked', 'undetermined']) {
    test(`permission ${permission} → cancels only MOMENTUM reminders, schedules nothing`, async () => {
      const s = fakeScheduler([...foreign, { identifier: 'momentum.h.a.d', sig: 'x' }]);
      const r = await reconcile(s, input(makePlan({ a: on() }), { permission }));
      assert.equal(r.status, 'done');
      assert.deepEqual([...s.scheduled.keys()].sort(), ['expo-go-other-project', 'momentum.test.1']);
      assert.equal(r.desiredCount, 0);
    });
  }

  test('master switch off → our reminders are cancelled, foreign ones kept', async () => {
    const s = fakeScheduler(foreign);
    await reconcile(s, input(makePlan({ a: on() })));
    await reconcile(s, input(makePlan({ a: on() }, {}, false)));
    assert.deepEqual([...s.scheduled.keys()].sort(), ['expo-go-other-project', 'momentum.test.1']);
  });

  test('deleting a habit (absent from sources) cancels its reminders', async () => {
    const s = fakeScheduler();
    await reconcile(s, input(makePlan({ a: on(), b: on() })));
    const withoutB = planReminders({
      habits: [tick('a')],
      routines,
      settings: { enabled: true, habits: { a: on(), b: on() }, routines: {} },
      limit: 150,
    });
    await reconcile(s, input(withoutB));
    assert.deepEqual([...s.scheduled.keys()], ['momentum.h.a.d']);
  });

  test('list failure → nothing cancelled or scheduled', async () => {
    const s = fakeScheduler([{ identifier: 'momentum.h.a.d', sig: 'x' }]);
    s.fail.list = true;
    const r = await reconcile(s, input(makePlan({})));
    assert.equal(r.status, 'list-failed');
    assert.deepEqual(s.calls, [['list']]);
    assert.ok(s.scheduled.has('momentum.h.a.d'));
  });

  test('one schedule failure does not stop the others; it is reported', async () => {
    const s = fakeScheduler();
    s.fail.schedule.add('momentum.h.b.w2');
    const r = await reconcile(s, input(makePlan({ a: on(), b: on() })));
    assert.deepEqual([...s.scheduled.keys()].sort(), ['momentum.h.a.d', 'momentum.h.b.w4']);
    assert.equal(r.failures.length, 1);
    assert.deepEqual(r.failures[0].op, 'schedule');
    assert.equal(r.scheduledCount, 2);
    assert.equal(r.desiredCount, 3);
  });

  test('stale cancel failure is reported; the rest still runs', async () => {
    const s = fakeScheduler([{ identifier: 'momentum.h.gone.d', sig: 'x' }]);
    s.fail.cancel.add('momentum.h.gone.d');
    const r = await reconcile(s, input(makePlan({ a: on() })));
    assert.ok(s.scheduled.has('momentum.h.a.d'));
    assert.equal(r.failures[0].op, 'cancel');
    assert.equal(r.scheduledCount, 1);
  });

  test('changed reminder whose cancel fails is NOT rescheduled (no duplicate); a retry fixes it', async () => {
    const s = fakeScheduler();
    await reconcile(s, input(makePlan({ a: on(9) })));
    const oldSig = s.scheduled.get('momentum.h.a.d').sig;

    s.fail.cancel.add('momentum.h.a.d');
    s.calls.length = 0;
    const r1 = await reconcile(s, input(makePlan({ a: on(10) })));
    assert.ok(!s.calls.some(([op]) => op === 'schedule'));
    assert.equal(s.scheduled.get('momentum.h.a.d').sig, oldSig); // old one still works
    assert.equal(r1.scheduledCount, 0);

    s.fail.cancel.clear();
    const r2 = await reconcile(s, input(makePlan({ a: on(10) })));
    assert.equal(r2.failures.length, 0);
    assert.notEqual(s.scheduled.get('momentum.h.a.d').sig, oldSig);
    assert.equal(s.scheduled.size, 1);
  });

  test('a failed schedule is retried by the next run', async () => {
    const s = fakeScheduler();
    s.fail.schedule.add('momentum.h.a.d');
    await reconcile(s, input(makePlan({ a: on() })));
    assert.equal(s.scheduled.size, 0);
    s.fail.schedule.clear();
    const r = await reconcile(s, input(makePlan({ a: on() })));
    assert.equal(r.newlyScheduled, 1);
    assert.ok(s.scheduled.has('momentum.h.a.d'));
  });

  test('time-zone change reschedules every reminder through the normal diff', async () => {
    const s = fakeScheduler();
    const p = (zone) =>
      planReminders({ habits, routines, settings: { enabled: true, habits: { a: on(), b: on() }, routines: {} }, limit: 150, zone });
    await reconcile(s, input(p('Europe/London|0')));
    s.calls.length = 0;
    const r = await reconcile(s, input(p('Europe/London|-60')));
    assert.equal(r.cancelled, 3);
    assert.equal(r.newlyScheduled, 3);
    assert.equal(s.scheduled.size, 3);
  });

  test('cap: omitted reminders are reported', async () => {
    const plan = planReminders({
      habits,
      routines,
      settings: { enabled: true, habits: { a: on(), b: on() }, routines: {} },
      limit: 2,
    });
    const r = await reconcile(fakeScheduler(), input(plan));
    assert.equal(r.omittedForLimit, 1);
  });
});

describe('sync runner', () => {
  const ok = { status: 'done', scheduledCount: 0, desiredCount: 0, cancelled: 0, newlyScheduled: 0, unchanged: 0, failures: [], omittedForLimit: 0 };
  const bad = { ...ok, failures: [{ identifier: 'x', op: 'schedule', message: 'boom' }] };

  function manualTimers() {
    const pending = [];
    return {
      pending,
      set(fn, ms) {
        const handle = { fn, ms };
        pending.push(handle);
        return handle;
      },
      clear(handle) {
        const i = pending.indexOf(handle);
        if (i >= 0) pending.splice(i, 1);
      },
      fireNext() {
        const h = pending.shift();
        h.fn();
        return h.ms;
      },
    };
  }

  test('requests during a run collapse into exactly one follow-up run', async () => {
    const gate = deferred();
    let runs = 0;
    const runner = createSyncRunner({
      run: async () => {
        runs += 1;
        if (runs === 1) await gate.promise;
        return ok;
      },
      onResult: () => undefined,
      timers: manualTimers(),
    });
    const first = runner.request();
    runner.request();
    runner.request();
    runner.request();
    gate.resolve();
    await first;
    assert.equal(runs, 2);
    assert.equal(runner.isRunning(), false);
  });

  test('problems schedule a retry with backoff; success resets it', async () => {
    const timers = manualTimers();
    const results = [bad, bad, ok];
    const seen = [];
    const runner = createSyncRunner({
      run: async () => results.shift(),
      onResult: (r) => seen.push(r.failures.length),
      retryDelaysMs: [5, 50, 500],
      timers,
    });
    await runner.request();
    assert.equal(timers.pending.length, 1);
    assert.equal(timers.pending[0].ms, 5);

    timers.fireNext();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(timers.pending[0].ms, 50);

    timers.fireNext();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(seen, [1, 1, 0]);
    assert.equal(timers.pending.length, 0);
  });

  test('a skipped run (sources not ready) is not retried by timer', async () => {
    const timers = manualTimers();
    const runner = createSyncRunner({
      run: async () => ({ status: 'skipped', reason: 'sources-not-ready' }),
      onResult: () => undefined,
      timers,
    });
    await runner.request();
    assert.equal(timers.pending.length, 0);
  });

  test('a throwing run is reported as a problem and retried, never crashes the runner', async () => {
    const timers = manualTimers();
    let calls = 0;
    const seen = [];
    const runner = createSyncRunner({
      run: async () => {
        calls += 1;
        if (calls === 1) throw new Error('bug');
        return ok;
      },
      onResult: (r) => seen.push(r.status),
      timers,
    });
    await runner.request();
    assert.deepEqual(seen, ['list-failed']);
    assert.equal(timers.pending.length, 1);
    await runner.request(); // a manual retry clears the timer and runs now
    assert.deepEqual(seen, ['list-failed', 'done']);
    assert.equal(timers.pending.length, 0);
  });

  test('dispose stops pending retries', async () => {
    const timers = manualTimers();
    const runner = createSyncRunner({ run: async () => bad, onResult: () => undefined, timers });
    await runner.request();
    runner.dispose();
    assert.equal(timers.pending.length, 0);
  });
});
