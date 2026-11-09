import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { askForPermission, checkPermission, EXPO_CHANNEL_IMPORTANCE_NONE } from '../src/notifications/permission-check.ts';
import { reconcile } from '../src/notifications/reconcile.ts';
import { planReminders } from '../src/utils/reminder-plan.ts';
import { tick } from './support/fixtures.mjs';

const HIGH = 6; // expo AndroidImportance.HIGH
const raw = (status, granted, canAskAgain, importance = 3) => ({
  status,
  granted,
  canAskAgain,
  android: { importance, interruptionFilter: 1 },
});

/** Fake native layer recording call order. */
function fakeDeps({ initial, afterRequest = initial, channels = { 'habit-reminders': HIGH, 'routine-reminders': HIGH }, fail = {} } = {}) {
  const calls = [];
  let current = initial;
  return {
    calls,
    deps: {
      platform: 'android',
      supported: true,
      channelIds: ['habit-reminders', 'routine-reminders'],
      async getRaw() {
        calls.push('getRaw');
        if (fail.getRaw) throw new Error('getPermissionsAsync failed');
        return current;
      },
      async requestRaw() {
        calls.push('requestRaw');
        if (fail.requestRaw) throw new Error('requestPermissionsAsync failed');
        current = afterRequest;
        return current;
      },
      async ensureChannels() {
        calls.push('ensureChannels');
        if (fail.ensureChannels) throw new Error('setNotificationChannelAsync failed');
      },
      async getChannelImportance(id) {
        calls.push(`channel:${id}`);
        if (fail.channel === id) throw new Error('getNotificationChannelAsync failed');
        return channels[id] ?? null;
      },
    },
  };
}

describe('checkPermission', () => {
  test('Expo Go case: system ON + scoped undetermined → system-allowed, channels inspected, nothing requested', async () => {
    const { deps, calls } = fakeDeps({ initial: raw('undetermined', false, true) });
    const r = await checkPermission(deps);
    assert.equal(r.info.state, 'system-allowed');
    assert.deepEqual(r.info.channelsOff, []);
    assert.ok(!calls.includes('requestRaw'));
    assert.deepEqual(r.raw, raw('undetermined', false, true)); // raw kept for diagnostics
  });

  test('API failure → state "error" with the message, never "denied"/"not allowed"', async () => {
    const { deps } = fakeDeps({ initial: raw('granted', true, true), fail: { getRaw: true } });
    const r = await checkPermission(deps);
    assert.equal(r.info.state, 'error');
    assert.match(r.info.error, /getPermissionsAsync failed/);
  });

  test('a channel turned off in system settings is reported', async () => {
    const { deps } = fakeDeps({
      initial: raw('granted', true, true),
      channels: { 'habit-reminders': EXPO_CHANNEL_IMPORTANCE_NONE, 'routine-reminders': HIGH },
    });
    const r = await checkPermission(deps);
    assert.equal(r.info.state, 'granted');
    assert.deepEqual(r.info.channelsOff, ['habit-reminders']);
  });

  test('a channel check error is recorded but doesn’t flip the permission state', async () => {
    const { deps } = fakeDeps({ initial: raw('granted', true, true), fail: { channel: 'routine-reminders' } });
    const r = await checkPermission(deps);
    assert.equal(r.info.state, 'granted');
    assert.deepEqual(r.info.channelsOff, []);
    assert.match(r.channels.find((c) => c.id === 'routine-reminders').error, /failed/);
  });

  test('refresh after returning from system settings picks up the new state', async () => {
    const f = fakeDeps({ initial: raw('denied', false, false, 0) });
    assert.equal((await checkPermission(f.deps)).info.state, 'blocked');
    // User enables notifications in Android settings, returns → AppState active → re-check.
    const g = fakeDeps({ initial: raw('granted', true, true) });
    assert.equal((await checkPermission(g.deps)).info.state, 'granted');
  });

  test('unsupported platform makes no native calls', async () => {
    const { deps, calls } = fakeDeps({ initial: raw('granted', true, true) });
    const r = await checkPermission({ ...deps, supported: false });
    assert.equal(r.info.state, 'unsupported');
    assert.deepEqual(calls, []);
  });
});

describe('askForPermission', () => {
  test('channels are created BEFORE the status is read or the dialog requested', async () => {
    const { deps, calls } = fakeDeps({ initial: raw('denied', false, true, 0), afterRequest: raw('granted', true, true) });
    const r = await askForPermission(deps);
    assert.equal(calls[0], 'ensureChannels');
    assert.ok(calls.indexOf('ensureChannels') < calls.indexOf('requestRaw'));
    assert.equal(r.info.state, 'granted');
    assert.equal(r.requested, true);
  });

  test('already allowed (incl. Expo Go system-allowed) → no dialog requested', async () => {
    for (const initial of [raw('granted', true, true), raw('undetermined', false, true)]) {
      const { deps, calls } = fakeDeps({ initial });
      const r = await askForPermission(deps);
      assert.ok(!calls.includes('requestRaw'));
      assert.equal(r.requested, false);
    }
  });

  test('blocked → no dialog requested (the UI offers Open settings instead)', async () => {
    const { deps, calls } = fakeDeps({ initial: raw('denied', false, false, 0) });
    const r = await askForPermission(deps);
    assert.equal(r.info.state, 'blocked');
    assert.ok(!calls.includes('requestRaw'));
  });

  test('dialog denied → denied; denied permanently → blocked', async () => {
    const a = fakeDeps({ initial: raw('denied', false, true, 0), afterRequest: raw('denied', false, true, 0) });
    assert.equal((await askForPermission(a.deps)).info.state, 'denied');
    const b = fakeDeps({ initial: raw('denied', false, true, 0), afterRequest: raw('denied', false, false, 0) });
    assert.equal((await askForPermission(b.deps)).info.state, 'blocked');
  });

  test('channel creation failure → error (not denied), and no dialog', async () => {
    const { deps, calls } = fakeDeps({ initial: raw('denied', false, true, 0), fail: { ensureChannels: true } });
    const r = await askForPermission(deps);
    assert.equal(r.info.state, 'error');
    assert.ok(!calls.includes('requestRaw'));
  });

  test('request failure → error (not denied)', async () => {
    const { deps } = fakeDeps({ initial: raw('denied', false, true, 0), fail: { requestRaw: true } });
    const r = await askForPermission(deps);
    assert.equal(r.info.state, 'error');
    assert.match(r.info.error, /requestPermissionsAsync failed/);
    assert.equal(r.requested, true);
  });
});

describe('reconcile with the new permission states', () => {
  const plan = planReminders({
    habits: [tick('a')],
    routines: [],
    settings: { enabled: true, habits: { a: { enabled: true, time: { hour: 9, minute: 0 }, updatedAt: 'x' } }, routines: {} },
    limit: 150,
  });

  function scheduler(initial = []) {
    const scheduled = new Map(initial.map((i) => [i, { identifier: i, sig: 'old' }]));
    const calls = [];
    return {
      scheduled,
      calls,
      async listScheduled() {
        calls.push('list');
        return [...scheduled.values()];
      },
      async cancel(id) {
        calls.push(`cancel:${id}`);
        scheduled.delete(id);
      },
      async schedule(r) {
        calls.push(`schedule:${r.identifier}`);
        scheduled.set(r.identifier, { identifier: r.identifier, sig: r.sig });
      },
    };
  }

  test('system-allowed schedules reminders like granted', async () => {
    const s = scheduler();
    const r = await reconcile(s, { sourcesReady: true, permission: 'system-allowed', plan });
    assert.equal(r.status, 'done');
    assert.ok(s.scheduled.has('momentum.h.a.d'));
  });

  test('a FAILED permission check changes nothing (existing reminders and foreign IDs kept)', async () => {
    const s = scheduler(['momentum.h.a.d', 'other-app']);
    const r = await reconcile(s, { sourcesReady: true, permission: 'error', plan });
    assert.deepEqual(r, { status: 'skipped', reason: 'permission-unknown' });
    assert.deepEqual(s.calls, []);
    assert.equal(s.scheduled.size, 2);
  });
});
