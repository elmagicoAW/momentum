import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createListStore } from '../src/data/list-store.ts';
import { deferred } from './support/fixtures.mjs';

/** A store whose load/save are controllable from the test. */
function harness({ initial = ['a'], failLoad = false } = {}) {
  const saved = [];
  const changes = [];
  let failSave = false;
  let saveGate = null;
  const store = createListStore({
    load: async () => {
      if (failLoad) throw new Error('read failed');
      return initial;
    },
    save: async (list) => {
      if (saveGate) await saveGate;
      if (failSave) throw new Error('write failed');
      saved.push(list);
    },
    onChange: (list) => changes.push(list),
  });
  return {
    store,
    saved,
    changes,
    setFailSave: (v) => (failSave = v),
    gate: (p) => (saveGate = p),
  };
}

const append = (item) => (list) => ({ next: [...list, item], result: item });

describe('save-first serialized list store (routine mutations)', () => {
  test('refuses to write before a successful load', async () => {
    const h = harness();
    await assert.rejects(h.store.commit(append('b')), /hasn't loaded/);
    assert.deepEqual(h.saved, []);
  });

  test('after a failed load nothing can be written (corrupt data is never overwritten)', async () => {
    const h = harness({ failLoad: true });
    await assert.rejects(h.store.load());
    await assert.rejects(h.store.commit(append('b')));
    assert.deepEqual(h.saved, []);
    assert.equal(h.store.isLoaded(), false);
  });

  test('a change is reported only after it is saved', async () => {
    const h = harness();
    await h.store.load();
    const gate = deferred();
    h.gate(gate.promise);
    const pending = h.store.commit(append('b'));
    await Promise.resolve();
    assert.deepEqual(h.changes, [], 'nothing shown while the write is in flight');
    assert.deepEqual(h.store.current(), ['a']);
    gate.resolve();
    assert.equal(await pending, 'b');
    assert.deepEqual(h.changes, [['a', 'b']]);
  });

  test('a failed save rejects, keeps the old list, and does not report a change', async () => {
    const h = harness();
    await h.store.load();
    h.setFailSave(true);
    await assert.rejects(h.store.commit(append('b')), /write failed/);
    assert.deepEqual(h.store.current(), ['a']);
    assert.deepEqual(h.changes, []);
    // The queue keeps working after a failure.
    h.setFailSave(false);
    await h.store.commit(append('c'));
    assert.deepEqual(h.store.current(), ['a', 'c']);
  });

  test('writes are serialized: each builds on the previous saved list, in call order', async () => {
    const h = harness();
    await h.store.load();
    const gate = deferred();
    h.gate(gate.promise);
    const p1 = h.store.commit(append('b'));
    const p2 = h.store.commit(append('c'));
    const p3 = h.store.commit(append('d'));
    gate.resolve();
    await Promise.all([p1, p2, p3]);
    assert.deepEqual(h.saved, [['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd']]);
  });

  test('an unchanged list (e.g. move at the edge) is not written', async () => {
    const h = harness();
    await h.store.load();
    const result = await h.store.commit((list) => ({ next: list, result: false }));
    assert.equal(result, false);
    assert.deepEqual(h.saved, []);
  });

  test('an older load cannot overwrite a newer one', async () => {
    const first = deferred();
    const second = deferred();
    const loads = [first.promise, second.promise];
    const store = createListStore({ load: () => loads.shift(), save: async () => {}, onChange: () => {} });
    const p1 = store.load();
    const p2 = store.load();
    second.resolve(['new']);
    assert.deepEqual(await p2, ['new']);
    first.resolve(['old']);
    await assert.rejects(p1, /Superseded/);
    assert.deepEqual(store.current(), ['new']);
  });
});
