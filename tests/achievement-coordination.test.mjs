import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createAchievementCoordinator } from '../src/data/achievement-coordinator.ts';
import { emptyAchievements } from '../src/data/achievement-storage.ts';
import { createSaveQueue } from '../src/data/save-queue.ts';
import { tick, deferred } from './support/fixtures.mjs';

const history = () => ({ days: new Map([['2026-11-08', { entries: { a: { type: 'tick', done: true } } }]]), unreadableDays: [] });
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
function harness(overrides = {}) {
  let inputs = { today: '2026-11-09', habits: [tick('a')], ready: true, pending: false, revision: 0, finishedRevision: 0 };
  let persisted = emptyAchievements();
  let loads = 0, scans = 0, writes = 0;
  let failSave = false;
  const states = [];
  const c = createAchievementCoordinator({
    inputs: () => inputs,
    load: async () => { loads += 1; return persisted; },
    save: async (next) => { writes += 1; if (failSave) throw new Error('disk full'); persisted = next; },
    history: async () => { scans += 1; return history(); },
    now: () => new Date('2026-11-09T12:00:00.000Z'), onChange: (s) => states.push(s), ...overrides,
  });
  return { c, states, update: (change) => { inputs = { ...inputs, ...change }; }, inputs: () => inputs,
    fail: (yes) => { failSave = yes; }, persisted: () => persisted, counts: () => ({ loads, scans, writes }) };
}

describe('achievement persistence coordination', () => {
  test('startup backfills a batch save-first; acknowledgement survives reload and never repeats', async () => {
    const h = harness(); await h.c.request();
    assert.equal(h.counts().writes, 1); assert.equal(h.counts().scans, 1);
    const saved = h.persisted(); assert.ok(saved.awards['first-checkin']); assert.ok(saved.awards['perfect-day']);
    assert.equal(saved.awards['first-checkin'].awardedAt, '2026-11-09T12:00:00.000Z');
    await h.c.acknowledge(Object.keys(saved.awards)); const after = h.persisted();
    await h.c.acknowledge(Object.keys(saved.awards)); assert.equal(h.counts().writes, 2);
    const next = harness({ load: async () => after }); await next.c.request();
    assert.deepEqual(next.c.current().collection.seenBadgeIds, Object.keys(saved.awards)); assert.equal(next.counts().writes, 0);
  });
  test('no optimistic award while save in flight; failed save stays unearned and retry recomputes', async () => {
    const gate = deferred(); const started = deferred();
    const h = harness({ save: async () => { started.resolve(); await gate.promise; throw new Error('disk full'); } });
    const running = h.c.request(); await started.promise;
    assert.deepEqual(h.c.current().collection.awards, {}); gate.resolve(); await running;
    assert.equal(h.c.current().status, 'save-error'); assert.deepEqual(h.c.current().collection.awards, {});
    const retry = harness(); retry.fail(true); await retry.c.request();
    retry.update({ habits: [] }); retry.fail(false); await retry.c.request(true);
    assert.deepEqual(retry.persisted().awards, {}, 'stale candidates never saved after deletion');
    retry.update({ habits: [tick('a')] }); await retry.c.request(true); assert.ok(retry.persisted().awards['first-checkin']);
  });
  test('pending writes block all permanent evaluations, including a previous local date', async () => {
    const h = harness(); h.update({ pending: true, revision: 1 }); await h.c.request();
    assert.equal(h.c.current().status, 'waiting'); assert.equal(h.counts().scans, 0); assert.equal(h.counts().writes, 0);
    h.update({ pending: false, revision: 2, finishedRevision: 1 }); await h.c.request();
    assert.equal(h.counts().scans, 1); assert.ok(h.persisted().awards['first-checkin']);
  });
  for (const change of ['pending', 'revision', 'date', 'habits', 'ready']) {
    test(`stale async history is discarded after ${change} changes, before any award commit`, async () => {
      const gate = deferred(); const started = deferred();
      const h = harness({ history: async () => { started.resolve(); return gate.promise; } });
      const running = h.c.request(); await started.promise;
      const updates = { pending: { pending: true, revision: 1 }, revision: { revision: 2 }, date: { today: '2026-11-10' }, habits: { habits: [] }, ready: { ready: false } };
      h.update(updates[change]); gate.resolve(history()); await running;
      assert.equal(h.counts().writes, 0); assert.deepEqual(h.persisted().awards, {});
    });
  }
  test('today-only drains reuse finished metrics; foreground and previous-date drains recheck history', async () => {
    const h = harness(); await h.c.request();
    for (let i = 1; i <= 20; i += 1) {
      h.update({ pending: true, revision: i * 2 - 1 }); await h.c.request();
      h.update({ pending: false, revision: i * 2 }); await h.c.request();
    }
    assert.equal(h.counts().scans, 1, 'no full history scan per tap/drain');
    h.update({ finishedRevision: 1, revision: 41 }); await h.c.request(); assert.equal(h.counts().scans, 2);
    await h.c.request(true); assert.equal(h.counts().scans, 3); assert.equal(h.counts().writes, 1);
  });
  test('midnight discards old read, pending undo blocks interim disk completion, drain reads final record', async () => {
    let today = '2026-11-08'; let disk = history(); const gate = deferred(); let revision = 0;
    const daily = createSaveQueue(async (_date, value) => { await gate.promise; disk = { days: new Map([['2026-11-08', value]]), unreadableDays: [] }; }, () => { revision += 1; });
    const h = harness({ inputs: () => ({ today, habits: habits, ready: true, pending: daily.hasPending(), revision: daily.revision(), finishedRevision: daily.finishedRevision(today) }), history: async () => disk });
    const habits = [tick('a')];
    await h.c.request(); assert.deepEqual(h.persisted().awards, {}, 'today cannot unlock');
    daily.enqueue('2026-11-08', { entries: {} }); today = '2026-11-09';
    await h.c.request(); assert.equal(h.c.current().status, 'waiting');
    gate.resolve(); await turn(); await h.c.request(); assert.deepEqual(h.persisted().awards, {}, 'persisted undo wins');
    assert.ok(revision > 0);
  });
  test('failed daily writes remain pending and no award happens until complete drain', async () => {
    let allow = false; const saved = deferred();
    const habits = [tick('a')];
    const daily = createSaveQueue(async () => { if (!allow) throw new Error('daily failure'); }, (state) => { if (state === 'saved') saved.resolve(); }, [10]);
    const h = harness({ inputs: () => ({ today: '2026-11-09', habits, ready: true, pending: daily.hasPending(), revision: daily.revision(), finishedRevision: daily.finishedRevision('2026-11-09') }) });
    daily.enqueue('2026-11-08', { entries: { a: { type: 'tick', done: true } } });
    await turn(); await h.c.request(); assert.equal(h.counts().scans, 0);
    allow = true; daily.retry(); await saved.promise; await h.c.request(); assert.ok(h.persisted().awards['first-checkin']);
  });
  test('failed acknowledgement stays unseen, successful retry is saved once', async () => {
    const h = harness(); await h.c.request(); h.fail(true);
    await h.c.acknowledge(['first-checkin']);
    assert.equal(h.c.current().acknowledgementError, true); assert.deepEqual(h.c.current().collection.seenBadgeIds, []);
    h.fail(false); await h.c.acknowledge(['first-checkin']);
    assert.deepEqual(h.persisted().seenBadgeIds, ['first-checkin']); assert.equal(h.c.current().acknowledgementError, false);
    const writes = h.counts().writes; await h.c.acknowledge(['first-checkin']); assert.equal(h.counts().writes, writes);
  });
  test('concurrent requests coalesce; ack and foreground retry cannot race load against a write', async () => {
    const gate = deferred(); const started = deferred(); let disk = emptyAchievements(); let loads = 0, writes = 0, activeWrites = 0;
    const h = harness({
      load: async () => { loads += 1; assert.equal(activeWrites, 0); return disk; },
      save: async (next) => { activeWrites += 1; assert.equal(activeWrites, 1); writes += 1; if (writes === 1) { started.resolve(); await gate.promise; } disk = next; activeWrites -= 1; },
    });
    const first = h.c.request(); await started.promise;
    const ack = h.c.acknowledge(['first-checkin']); const more = Array.from({ length: 10 }, () => h.c.request(true));
    gate.resolve(); await Promise.all([first, ack, ...more]);
    assert.equal(loads, 1); assert.equal(writes, 2); assert.deepEqual(disk.seenBadgeIds, ['first-checkin']);
    assert.ok(disk.awards['first-checkin']); assert.equal(h.c.current().status, 'ready');
  });
  test('history failures do not become zero metrics or write defaults; retry recovers', async () => {
    let fail = true; const h = harness({ history: async () => { if (fail) throw new Error('read failed'); return history(); } });
    await h.c.request(); assert.equal(h.c.current().status, 'history-error'); assert.equal(h.c.current().evaluation, null); assert.equal(h.counts().writes, 0);
    fail = false; await h.c.request(true); assert.ok(h.persisted().awards['first-checkin']);
  });
  test('corrupt/future achievements block evaluation and acknowledgement until a successful load', async () => {
    let fail = true; const h = harness({ load: async () => { if (fail) throw new Error('future store'); return emptyAchievements(); } });
    await h.c.request(); await h.c.acknowledge(['first-checkin']);
    assert.equal(h.c.current().status, 'store-error'); assert.equal(h.counts().scans, 0); assert.equal(h.counts().writes, 0);
    fail = false; await h.c.request(true); assert.ok(h.persisted().awards['first-checkin']);
  });
  test('no habits retains stored awards without creating candidates; app restart reconstructs unsaved awards', async () => {
    const h = harness(); await h.c.request(); const original = h.persisted();
    h.update({ habits: [] }); await h.c.request(); assert.equal(h.persisted(), original); assert.equal(h.c.current().evaluation.metrics.checkins, 0);
    const restart = harness(); await restart.c.request(); assert.ok(restart.persisted().awards['first-checkin']);
  });
  test('effect cleanup invalidates in-flight reads; fresh request can proceed', async () => {
    const gate = deferred(); const started = deferred(); let reads = 0;
    const h = harness({ history: async () => { reads += 1; if (reads === 1) { started.resolve(); await gate.promise; } return history(); } });
    const first = h.c.request(); await started.promise; h.c.invalidate(); gate.resolve(); await first;
    assert.equal(h.counts().writes, 0); await h.c.request(); assert.equal(h.counts().writes, 1);
  });
  test('a forced refresh interrupted by a tap is re-read after drain, not left with null cached progress', async () => {
    const gate = deferred(); const started = deferred(); let reads = 0;
    const h = harness({ history: async () => { reads += 1; if (reads === 2) { started.resolve(); await gate.promise; } return history(); } });
    await h.c.request(); const refresh = h.c.request(true); await started.promise;
    h.update({ pending: true, revision: 1 }); const pending = h.c.request(); gate.resolve(); await Promise.all([refresh, pending]);
    h.update({ pending: false, revision: 2 }); await h.c.request();
    assert.equal(reads, 3); assert.equal(h.c.current().status, 'ready'); assert.equal(h.c.current().evaluation.metrics.checkins, 1);
  });
});
