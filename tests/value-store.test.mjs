import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createValueStore } from '../src/data/value-store.ts';
import { deferred } from './support/fixtures.mjs';

/** A store whose load/save are controllable from the test. */
function harness({ initial = { n: 0 }, loadValue = { n: 1 }, failLoad = false } = {}) {
  const saved = [];
  const changes = [];
  let failSave = false;
  let saveGate = null;
  let loadImpl = async () => {
    if (failLoad) throw new Error('read failed');
    return loadValue;
  };
  const store = createValueStore({
    initial,
    load: () => loadImpl(),
    save: async (value) => {
      if (saveGate) await saveGate;
      if (failSave) throw new Error('write failed');
      saved.push(value);
    },
    onChange: (value) => changes.push(value),
  });
  return {
    store,
    saved,
    changes,
    setFailSave: (v) => (failSave = v),
    gate: (p) => (saveGate = p),
    setLoad: (fn) => (loadImpl = fn),
  };
}

const add = (k) => (v) => ({ next: { n: v.n + k }, result: v.n + k });

describe('save-first serialized value store (profile)', () => {
  test('refuses to write before a successful load', async () => {
    const h = harness();
    await assert.rejects(h.store.commit(add(1)), /hasn't loaded/);
    assert.deepEqual(h.saved, []);
  });

  test('refuses to write after a failed load (corrupt data is never replaced)', async () => {
    const h = harness({ failLoad: true });
    await assert.rejects(h.store.load(), /read failed/);
    await assert.rejects(h.store.commit(add(1)), /hasn't loaded/);
    assert.deepEqual(h.saved, []);
    assert.equal(h.store.isLoaded(), false);
  });

  test('saves first, then commits and notifies', async () => {
    const h = harness();
    await h.store.load();
    assert.equal(await h.store.commit(add(2)), 3);
    assert.deepEqual(h.saved, [{ n: 3 }]);
    assert.deepEqual(h.changes, [{ n: 3 }]);
    assert.deepEqual(h.store.current(), { n: 3 });
  });

  test('a failed save keeps the old value, rejects, and does not block later writes', async () => {
    const h = harness();
    await h.store.load();
    h.setFailSave(true);
    await assert.rejects(h.store.commit(add(5)), /write failed/);
    assert.deepEqual(h.store.current(), { n: 1 });
    assert.deepEqual(h.changes, []);
    h.setFailSave(false);
    assert.equal(await h.store.commit(add(1)), 2);
  });

  test('writes run in order, each building on the last saved value', async () => {
    const h = harness();
    await h.store.load();
    const gate = deferred();
    h.gate(gate.promise);
    const a = h.store.commit(add(1));
    const b = h.store.commit(add(10));
    gate.resolve();
    assert.deepEqual(await Promise.all([a, b]), [2, 12]);
    assert.deepEqual(h.saved, [{ n: 2 }, { n: 12 }]);
  });

  test('an unchanged value writes nothing', async () => {
    const h = harness();
    await h.store.load();
    await h.store.commit((v) => ({ next: v, result: 'same' }));
    assert.deepEqual(h.saved, []);
    assert.deepEqual(h.changes, []);
  });

  test('only the latest load applies', async () => {
    const h = harness();
    const first = deferred();
    h.setLoad(() => first.promise);
    const p1 = h.store.load();
    h.setLoad(async () => ({ n: 99 }));
    await h.store.load();
    first.resolve({ n: -1 });
    await assert.rejects(p1, /Superseded/);
    assert.deepEqual(h.store.current(), { n: 99 });
  });
});
