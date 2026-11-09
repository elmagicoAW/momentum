import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createSaveQueue } from '../src/data/save-queue.ts';
import { deferred } from './support/fixtures.mjs';

// The existing daily-progress writer used by Today AND the routine screen.
// These tests pin down how pending/failed progress writes are communicated.

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('daily progress save queue (shared by Today and routines)', () => {
  test('synchronous revisions invalidate in-flight evaluations even when React has not rendered', async () => {
    const gate = deferred();
    const queue = createSaveQueue(async () => gate.promise, () => {});
    assert.equal(queue.revision(), 0);
    queue.enqueue('2026-11-08', { entries: {} });
    assert.equal(queue.revision(), 1);
    queue.enqueue('2026-11-08', { entries: { a: { type: 'tick', done: true } } });
    assert.equal(queue.revision(), 2);
    assert.equal(queue.finishedRevision('2026-11-09'), 0, 'pending writes are never successful evidence');
    gate.resolve(); await tick();
    assert.equal(queue.hasPending(), false);
    assert.equal(queue.revision(), 4, 'both the interim and latest write succeeded');
    assert.equal(queue.finishedRevision('2026-11-08'), 0, 'same-day saves do not dirty finished history');
    assert.equal(queue.finishedRevision('2026-11-09'), 2, 'previous-day saves dirty finished history');
  });
  test('reports saving → saved only after the write is on disk', async () => {
    const states = [];
    const gate = deferred();
    const queue = createSaveQueue(async () => gate.promise, (s) => states.push(s), [1]);
    queue.enqueue('2026-11-09', { entries: { h1: { type: 'tick', done: true } } });
    assert.deepEqual(states, ['saving']);
    assert.ok(queue.hasPending());
    gate.resolve();
    await tick();
    assert.deepEqual(states, ['saving', 'saved']);
    assert.equal(queue.hasPending(), false);
  });

  test('a failed write reports error, keeps the record pending, and retries until saved', async () => {
    const states = [];
    let attempts = 0;
    const written = [];
    const queue = createSaveQueue(
      async (key, value) => {
        attempts += 1;
        if (attempts === 1) throw new Error('disk full');
        written.push([key, value]);
      },
      (s) => states.push(s),
      [5], // fast backoff for the test
    );
    const record = { entries: { shared: { type: 'tick', done: true } } };
    queue.enqueue('2026-11-09', record);
    await tick();
    assert.equal(states.at(-1), 'error');
    assert.equal(queue.pendingValue('2026-11-09'), record, 'record kept, never dropped');
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(states.at(-1), 'saved');
    assert.deepEqual(written, [['2026-11-09', record]]);
  });

  test('rapid taps coalesce: the latest full record wins, nothing is lost', async () => {
    const written = [];
    const gate = deferred();
    let first = true;
    const queue = createSaveQueue(
      async (key, value) => {
        if (first) {
          first = false;
          await gate.promise;
        }
        written.push(value);
      },
      () => {},
      [1],
    );
    const r1 = { entries: { a: { type: 'tick', done: true } } };
    const r2 = { entries: { a: { type: 'tick', done: true }, b: { type: 'tick', done: true } } };
    const r3 = { entries: { b: { type: 'tick', done: true } } };
    queue.enqueue('d', r1);
    queue.enqueue('d', r2);
    queue.enqueue('d', r3);
    gate.resolve();
    await tick();
    await tick();
    assert.deepEqual(written, [r1, r3]);
  });

  test('a save pending at midnight is still written to its own date', async () => {
    const written = [];
    const gate = deferred();
    const queue = createSaveQueue(
      async (key) => {
        await gate.promise;
        written.push(key);
      },
      () => {},
      [1],
    );
    queue.enqueue('2026-11-09', { entries: {} });
    queue.enqueue('2026-11-10', { entries: {} });
    gate.resolve();
    await tick();
    await tick();
    assert.deepEqual(written, ['2026-11-09', '2026-11-10']);
  });
});
