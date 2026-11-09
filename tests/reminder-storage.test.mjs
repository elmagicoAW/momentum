import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import { createValueStore } from '../src/data/value-store.ts';
import {
  defaultReminderSettings,
  loadReminderSettings,
  parseReminderStore,
  pruneOrphans,
  REMINDERS_KEY,
  saveReminderSettings,
  withItemReminder,
} from '../src/data/reminder-storage.ts';
import { mock } from './support/async-storage-mock.mjs';
import { deferred } from './support/fixtures.mjs';

const setting = (enabled = true, hour = 9, minute = 0) => ({ enabled, time: { hour, minute }, updatedAt: '2026-11-09T08:00:00.000Z' });
const raw = (value) => JSON.stringify(value);
const NOW = new Date(2026, 10, 9, 8, 0, 0);

describe('reminder storage', () => {
  beforeEach(() => mock.reset());

  test('uses its own versioned key', () => {
    assert.equal(REMINDERS_KEY, 'momentum:reminders:v1');
  });

  test('nothing saved → defaults, and nothing is written', async () => {
    assert.deepEqual(await loadReminderSettings(), defaultReminderSettings());
    assert.deepEqual(mock.writes(), []);
  });

  test('round-trips', async () => {
    const value = { enabled: false, habits: { h1: setting() }, routines: { r1: setting(false, 20, 15) } };
    await saveReminderSettings(value);
    assert.deepEqual(await loadReminderSettings(), value);
  });

  test('saving reminders never touches habits, routines, goals or check-ins', async () => {
    const existing = {
      'momentum:habits:v2': '{"version":2,"habits":[]}',
      'momentum:routines:v1': '{"version":1,"routines":[]}',
      'momentum:goals:v1': '{"version":1,"goals":[]}',
      'momentum:checkins:v2:2026-11-09': '{"version":2,"entries":{}}',
    };
    mock.seed(existing);
    await saveReminderSettings({ enabled: true, habits: { h1: setting() }, routines: {} });
    assert.deepEqual(mock.writes(), [REMINDERS_KEY]);
    for (const [key, value] of Object.entries(existing)) assert.equal(mock.get(key), value);
  });

  const corrupt = {
    'invalid JSON': '{nope',
    'wrong shape': '[]',
    'future version': raw({ version: 2, enabled: true, habits: {}, routines: {} }),
    'missing switch': raw({ version: 1, habits: {}, routines: {} }),
    'hour out of range': raw({ version: 1, enabled: true, habits: { h1: setting(true, 24) }, routines: {} }),
    'non-integer minute': raw({ version: 1, enabled: true, habits: { h1: setting(true, 9, 7.5) }, routines: {} }),
    'enabled not boolean': raw({ version: 1, enabled: true, habits: { h1: { ...setting(), enabled: 'yes' } }, routines: {} }),
    'routines not an object': raw({ version: 1, enabled: true, habits: {}, routines: [] }),
  };
  for (const [name, value] of Object.entries(corrupt)) {
    test(`strict parsing rejects ${name}; load throws and writes nothing`, async () => {
      assert.throws(() => parseReminderStore(value));
      mock.seed({ [REMINDERS_KEY]: value });
      await assert.rejects(loadReminderSettings());
      assert.deepEqual(mock.writes(), []);
      assert.equal(mock.get(REMINDERS_KEY), value);
    });
  }

  test('read failure propagates (no fallback to defaults)', async () => {
    mock.fail('getItem');
    await assert.rejects(loadReminderSettings());
  });
});

describe('pure updates', () => {
  const base = { enabled: true, habits: { h1: setting(), gone: setting() }, routines: { r1: setting(), rgone: setting() } };
  const existing = { habitIds: new Set(['h1', 'h2']), routineIds: new Set(['r1']) };

  test('withItemReminder sets one entry and keeps the rest when IDs are unknown', () => {
    const next = withItemReminder(base, 'habit', 'h2', { enabled: true, time: { hour: 7, minute: 30 } }, NOW);
    assert.deepEqual(next.habits.h2.time, { hour: 7, minute: 30 });
    assert.equal(next.habits.h2.updatedAt, NOW.toISOString());
    assert.ok(next.habits.gone); // not pruned without ID lists
    assert.notEqual(next, base);
    assert.ok(base.habits.h2 === undefined); // input not mutated
  });

  test('withItemReminder prunes orphans when the full ID lists are known', () => {
    const next = withItemReminder(base, 'routine', 'r1', { enabled: false, time: { hour: 20, minute: 0 } }, NOW, existing);
    assert.deepEqual(Object.keys(next.habits), ['h1']);
    assert.deepEqual(Object.keys(next.routines), ['r1']);
    assert.equal(next.routines.r1.enabled, false);
  });

  test('the edited item is kept even if it isn’t in the ID list yet (just created)', () => {
    const next = withItemReminder(base, 'habit', 'h_new', { enabled: true, time: { hour: 9, minute: 0 } }, NOW, existing);
    assert.ok(next.habits.h_new);
  });

  test('pruning never flips another item’s enabled state', () => {
    const next = pruneOrphans(base, existing);
    assert.equal(next.habits.h1.enabled, true);
    assert.equal(next.routines.r1.enabled, true);
    assert.equal(next.enabled, true);
  });
});

describe('value store (save-first)', () => {
  beforeEach(() => mock.reset());

  const make = (onChange = () => undefined) =>
    createValueStore({
      initial: defaultReminderSettings(),
      load: loadReminderSettings,
      save: saveReminderSettings,
      onChange,
      notLoadedMessage: 'not loaded',
    });

  test('no write before a successful load', async () => {
    const store = make();
    await assert.rejects(store.commit((s) => ({ next: { ...s, enabled: false }, result: undefined })), /not loaded/);
    assert.deepEqual(mock.writes(), []);
  });

  test('a failed load keeps the store locked; stored data untouched', async () => {
    mock.seed({ [REMINDERS_KEY]: '{bad' });
    const store = make();
    await assert.rejects(store.load());
    await assert.rejects(store.commit((s) => ({ next: { ...s, enabled: false }, result: undefined })));
    assert.equal(mock.get(REMINDERS_KEY), '{bad');
  });

  test('failed save → caller sees the error, value and onChange unchanged; later saves still work', async () => {
    const changes = [];
    const store = make((v) => changes.push(v));
    await store.load();
    mock.fail('setItem');
    await assert.rejects(store.commit((s) => ({ next: { ...s, enabled: false }, result: undefined })));
    assert.equal(store.current().enabled, true);
    assert.equal(changes.length, 0);
    mock.fail('setItem', false);
    await store.commit((s) => ({ next: { ...s, enabled: false }, result: undefined }));
    assert.equal(store.current().enabled, false);
    assert.equal(changes.length, 1);
  });

  test('writes are serialized and each builds on the last saved value', async () => {
    const store = make();
    await store.load();
    const a = store.commit((s) => ({ next: withItemReminder(s, 'habit', 'a', { enabled: true, time: { hour: 7, minute: 0 } }, NOW), result: 1 }));
    const b = store.commit((s) => ({ next: withItemReminder(s, 'habit', 'b', { enabled: true, time: { hour: 8, minute: 0 } }, NOW), result: 2 }));
    assert.deepEqual(await Promise.all([a, b]), [1, 2]);
    assert.deepEqual(Object.keys(JSON.parse(mock.get(REMINDERS_KEY)).habits).sort(), ['a', 'b']);
  });

  test('only the latest load applies', async () => {
    const slow = deferred();
    let calls = 0;
    const store = createValueStore({
      initial: 0,
      load: () => (++calls === 1 ? slow.promise : Promise.resolve(2)),
      save: async () => undefined,
      onChange: () => undefined,
    });
    const first = store.load();
    await store.load();
    slow.resolve(1);
    await assert.rejects(first, /Superseded/);
    assert.equal(store.current(), 2);
  });
});
