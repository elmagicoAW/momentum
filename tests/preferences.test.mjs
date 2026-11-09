import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { DEFAULT_PREFERENCES, PREFERENCES_KEY, loadPreferences, savePreferences, parsePreferencesStore } from '../src/data/preferences-storage.ts';
import { createPreferencesStore } from '../src/data/preferences-store.ts';
import { isUserKey } from '../src/data/backup-keys.ts';
import { canonical, createBackup } from '../src/data/backup-format.ts';
import { createBackupService, RecoveryBlocked } from '../src/data/backup-service.ts';
import { persistence } from '../src/data/persistence-coordinator.ts';
import { deferred } from './support/fixtures.mjs';
import { fullBackupRecords } from './support/backup-fixtures.mjs';

const raw = (preferences, version = 1) => JSON.stringify({ version, preferences });
const hasCode = (code) => (error) => error.code === code;
const hash = async (text) => createHash('sha256').update(text).digest('hex');

function fixture(initial = {}) {
  const data = new Map(Object.entries(initial));
  const writes = [];
  let failRead = false;
  let failWrite = false;
  const storage = {
    getItem: async (key) => { if (failRead) throw Error('read'); return data.get(key) ?? null; },
    getAllKeys: async () => [...data.keys()],
    multiGet: async (keys) => keys.map((key) => [key, data.get(key) ?? null]),
    setItem: async (key, value) => { if (failWrite) throw Error('write'); writes.push(key); data.set(key, value); },
    removeItem: async (key) => { if (failWrite) throw Error('remove'); writes.push(key); data.delete(key); },
  };
  const store = createPreferencesStore({ load: () => loadPreferences(storage), save: (value) => savePreferences(value, storage) });
  return { data, writes, storage, store, failRead: (value) => { failRead = value; }, failWrite: (value) => { failWrite = value; } };
}

test('missing preferences use immutable Dark/English defaults without a write; no-op also writes nothing', async () => {
  const f = fixture();
  await f.store.load();
  assert.deepEqual(f.store.getSnapshot().preferences, DEFAULT_PREFERENCES);
  assert.ok(Object.isFrozen(f.store.getSnapshot().preferences));
  await f.store.update({ appearance: 'dark' });
  await f.store.update({});
  assert.deepEqual(f.writes, []);
});

test('all supported combinations roundtrip using only the dedicated preference key', async () => {
  const f = fixture({ 'momentum:profile:v1': 'untouched' });
  for (const appearance of ['light', 'dark', 'system']) for (const language of ['en', 'ar']) {
    await savePreferences({ appearance, language }, f.storage);
    assert.deepEqual(await loadPreferences(f.storage), { appearance, language });
  }
  assert.deepEqual([...new Set(f.writes)], [PREFERENCES_KEY]);
  assert.equal(f.data.get('momentum:profile:v1'), 'untouched');
});

test('partial v1 missing fields default in memory, never as an automatic migration write', async () => {
  for (const [input, expected] of [[{}, DEFAULT_PREFERENCES], [{ language: 'ar' }, { appearance: 'dark', language: 'ar' }], [{ appearance: 'system' }, { appearance: 'system', language: 'en' }]]) {
    const original = raw(input);
    const f = fixture({ [PREFERENCES_KEY]: original });
    assert.deepEqual(await f.store.load(), expected);
    assert.deepEqual(f.writes, []);
    assert.equal(f.data.get(PREFERENCES_KEY), original);
  }
});

test('malformed, unexpected and future records refuse writes and preserve exact original bytes', async () => {
  const invalid = ['{', 'null', '[]', '{}', raw(null), raw([]), raw({ appearance: null }), raw({ language: 'fr' }), raw({ appearance: 'auto' }), raw({ language: 1 }), raw({ language: 'en', extra: true }), '{"version":1,"preferences":{},"extra":true}', '{"version":1,"preferences":{"__proto__":{}}}'];
  for (const original of [...invalid, raw({}, 2), raw({}, '1')]) {
    const f = fixture({ [PREFERENCES_KEY]: original });
    await assert.rejects(f.store.load());
    assert.equal(f.store.getSnapshot().status, 'load-error');
    await assert.rejects(f.store.update({ language: 'ar' }), hasCode('not-loaded'));
    assert.equal(f.data.get(PREFERENCES_KEY), original);
    assert.deepEqual(f.writes, []);
  }
  assert.throws(() => parsePreferencesStore(raw({}, 9)), hasCode('unsupported-version'));
});

test('read failure blocks changes, explicit retry succeeds without writing defaults', async () => {
  const f = fixture({ [PREFERENCES_KEY]: raw({ appearance: 'system', language: 'ar' }) });
  f.failRead(true);
  await assert.rejects(f.store.load(), hasCode('read-failed'));
  assert.equal(f.store.getSnapshot().error, 'read-failed');
  await assert.rejects(f.store.update({ language: 'en' }), hasCode('not-loaded'));
  f.failRead(false);
  await f.store.load();
  assert.equal(f.store.getSnapshot().error, null);
  assert.equal(f.store.getSnapshot().status, 'ready');
  assert.deepEqual(f.writes, []);
});

test('slow/coalesced initialization refuses writes; successful retryLoad never rereads a saved value', async () => {
  const gate = deferred(); let reads = 0; let writes = 0;
  const store = createPreferencesStore({ load: () => { reads++; return gate.promise; }, save: async () => { writes++; } });
  await assert.rejects(store.update({ language: 'ar' }), hasCode('not-loaded'));
  const first = store.load(); const second = store.load();
  assert.equal(first, second);
  await assert.rejects(store.update({ language: 'ar' }), hasCode('not-loaded'));
  gate.resolve(DEFAULT_PREFERENCES);
  await first;
  await store.update({ language: 'ar' });
  assert.equal((await store.load()).language, 'ar');
  assert.equal(reads, 1); assert.equal(writes, 1);
});

test('queued changes compose save-first and snapshot caller patches at admission', async () => {
  const gate = deferred(); const started = deferred(); const saved = [];
  const store = createPreferencesStore({ load: async () => DEFAULT_PREFERENCES, save: async (value) => { started.resolve(); await gate.promise; saved.push(value); } });
  await store.load();
  const a = store.update({ appearance: 'system' });
  const patch = { language: 'ar' };
  const b = store.update(patch); patch.language = 'en';
  await started.promise;
  assert.deepEqual(store.getSnapshot().preferences, DEFAULT_PREFERENCES);
  assert.equal(store.getSnapshot().saving, true);
  gate.resolve(); await Promise.all([a, b]);
  assert.deepEqual(saved, [{ appearance: 'system', language: 'en' }, { appearance: 'system', language: 'ar' }]);
  assert.deepEqual(store.getSnapshot().preferences, saved[1]);
  assert.equal(store.getSnapshot().saving, false);
});

test('write failure keeps saved selection and error descriptor; retry and later queue items work', async () => {
  const f = fixture(); await f.store.load(); f.failWrite(true);
  await assert.rejects(f.store.update({ appearance: 'light' }), hasCode('write-failed'));
  assert.deepEqual(f.store.getSnapshot().preferences, DEFAULT_PREFERENCES);
  assert.equal(f.store.getSnapshot().error, 'write-failed');
  assert.equal(f.store.getSnapshot().saving, false);
  f.failWrite(false);
  await f.store.update({ appearance: 'light' });
  await f.store.update({ language: 'ar' });
  assert.equal(f.store.getSnapshot().error, null);
  assert.deepEqual(await loadPreferences(f.storage), { appearance: 'light', language: 'ar' });
});

test('a failed queued choice is not merged into a subsequent successful choice', async () => {
  let calls = 0;
  const store = createPreferencesStore({ load: async () => DEFAULT_PREFERENCES, save: async () => { if (++calls === 1) throw Error('failed'); } });
  await store.load();
  const failed = assert.rejects(store.update({ appearance: 'light' }));
  const succeeded = store.update({ language: 'ar' });
  await Promise.all([failed, succeeded]);
  assert.deepEqual(store.getSnapshot().preferences, { appearance: 'dark', language: 'ar' });
});

test('invalid runtime patches/full saves cannot write or get silently omitted', async () => {
  const f = fixture(); await f.store.load();
  for (const patch of [null, [], { language: undefined }, { appearance: false }, { other: 1 }]) {
    await assert.rejects(f.store.update(patch), hasCode('invalid-update'));
    await assert.rejects(savePreferences(patch, f.storage), hasCode('invalid-update'));
  }
  await assert.rejects(savePreferences({ language: 'ar' }, f.storage), hasCode('invalid-update'));
  assert.deepEqual(f.writes, []);
});

test('snapshot subscriptions are stable, save-first, and removable', async () => {
  const f = fixture(); let notifications = 0;
  const stop = f.store.subscribe(() => { notifications++; });
  assert.equal(f.store.getSnapshot(), f.store.getSnapshot());
  await f.store.load(); await f.store.update({ language: 'ar' });
  assert.ok(notifications > 0);
  const before = notifications; stop();
  await f.store.update({ language: 'en' });
  assert.equal(notifications, before);
});

function backupFixture() {
  const records = fullBackupRecords();
  const f = fixture(Object.fromEntries(records.map(({ key, raw }) => [key, raw])));
  const disk = new Map();
  const files = {
    list: async () => [...disk.keys()], read: async (name) => disk.get(name) ?? null,
    write: async (name, value) => { if (disk.has(name)) throw Error('exists'); disk.set(name, value); },
    remove: async (name) => { disk.delete(name); },
  };
  return { ...f, records, disk, service: createBackupService(f.storage, files, hash, persistence) };
}

test('preference writes leave all domain bytes and post-restore award/normalization barriers unchanged', async () => {
  const f = backupFixture();
  persistence.freeze(); persistence.advance(true); persistence.release();
  try {
    await f.store.load();
    await f.store.update({ appearance: 'system', language: 'ar' });
    assert.deepEqual(await f.service.capture(), f.records);
    assert.deepEqual([...new Set(f.writes)], [PREFERENCES_KEY]);
    assert.equal(persistence.automaticAwards(), false);
    assert.equal(persistence.automaticNormalization(), false);
    assert.equal(persistence.active(), 0);
  } finally { persistence.enableUserChanges(); }
});

test('backup v1 export excludes preferences; normal and empty restore preserve exact preference bytes', async () => {
  const f = backupFixture(); await f.store.load(); await f.store.update({ language: 'ar' });
  f.data.set('momentum:preferences:v999', 'future untouched');
  assert.equal(isUserKey(PREFERENCES_KEY), false);
  assert.equal(isUserKey('momentum:preferences:v999'), false);
  const saved = f.data.get(PREFERENCES_KEY);
  const exported = await f.service.exportBackup();
  assert.deepEqual(exported.payload.records, f.records);
  assert.deepEqual(exported.schemaVersions, (await createBackup(f.records, hash)).schemaVersions);
  await f.service.restore(JSON.stringify(exported), f.records);
  await f.service.restore(JSON.stringify(await createBackup([], hash)), f.records);
  assert.equal(f.data.get(PREFERENCES_KEY), saved);
  assert.equal(f.data.get('momentum:preferences:v999'), 'future untouched');
  assert.deepEqual(f.store.getSnapshot().preferences, { appearance: 'dark', language: 'ar' });
  persistence.enableUserChanges();
});

test('startup journal recovery completes independently of a hung or failed preference read', async () => {
  for (const failure of ['hung', 'failed']) {
    const f = backupFixture();
    const old = await createBackup(f.records, hash); const next = await createBackup([], hash);
    const id = 'restore-1794225600000-pref';
    f.disk.set(id + '.before', JSON.stringify(old));
    f.disk.set(id + '.after', JSON.stringify(next));
    f.disk.set(id + '.prepared', canonical({ version: 1, id, before: old.integrity.digest, after: next.integrity.digest }));
    f.data.set(PREFERENCES_KEY, 'corrupt preferences preserved');
    const gate = deferred();
    const store = createPreferencesStore({ load: failure === 'hung' ? () => gate.promise : () => loadPreferences(f.storage) });
    const loading = store.load().catch(() => undefined);
    persistence.freeze();
    try {
      await f.service.recover(); // does not await or initialize preferences
      assert.deepEqual(await f.service.capture(), f.records);
      assert.equal(f.data.get(PREFERENCES_KEY), 'corrupt preferences preserved');
      if (failure === 'hung') assert.equal(store.getSnapshot().status, 'loading');
    } finally { persistence.release(); gate.resolve(DEFAULT_PREFERENCES); await loading; persistence.enableUserChanges(); }
  }
});

test('failed restore rollback and interrupted rollback recovery never touch device preferences', async () => {
  for (const interruptRollback of [false, true]) {
    const f = backupFixture(); await f.store.load(); await f.store.update({ appearance: 'system', language: 'ar' });
    const saved = f.data.get(PREFERENCES_KEY);
    const storage = { ...f.storage, removeItem: async () => { throw Error('apply failure'); } };
    let applying = false;
    storage.setItem = async (key, value) => {
      if (applying && interruptRollback) throw Error('interrupted rollback');
      await f.storage.setItem(key, value);
    };
    // Empty restore removes current domain records. In the interrupted variant,
    // restoration of the before snapshot then fails and must finish at startup.
    applying = true;
    const files = {
      list: async () => [...f.disk.keys()], read: async (name) => f.disk.get(name) ?? null,
      write: async (name, value) => { if (f.disk.has(name)) throw Error('exists'); f.disk.set(name, value); },
      remove: async (name) => { f.disk.delete(name); },
    };
    const service = createBackupService(storage, files, hash, persistence);
    try {
      const replacement = JSON.stringify(await createBackup([], hash));
      if (interruptRollback) {
        await assert.rejects(service.restore(replacement, f.records), RecoveryBlocked);
        assert.equal(persistence.available(), false);
        // New service models startup with functioning storage and retained journals.
        await createBackupService(f.storage, files, hash, persistence).recover();
      } else assert.equal((await service.restore(replacement, f.records)).restored, false);
      assert.deepEqual(await f.service.capture(), f.records);
      assert.equal(f.data.get(PREFERENCES_KEY), saved);
      assert.deepEqual(f.store.getSnapshot().preferences, { appearance: 'system', language: 'ar' });
    } finally { if (!persistence.available()) persistence.release(); persistence.enableUserChanges(); }
  }
});

test('failed preference read cannot release blocked recovery or create default writes', async () => {
  const f = backupFixture(); f.data.set(PREFERENCES_KEY, 'bad');
  f.disk.set('restore-1794225600000-pref.prepared', 'bad journal');
  persistence.freeze();
  try {
    await assert.rejects(f.store.load());
    await assert.rejects(f.service.recover(), RecoveryBlocked);
    assert.equal(persistence.available(), false);
    assert.deepEqual(f.writes, []);
    assert.deepEqual(await f.service.capture(), f.records);
  } finally { persistence.release(); }
});

test('preference save during recovery admission freeze is independent and cannot release the gate', async () => {
  const f = backupFixture(); await f.store.load(); persistence.freeze();
  try {
    await f.store.update({ language: 'ar' });
    assert.equal(persistence.available(), false);
    assert.equal(persistence.active(), 0);
    assert.deepEqual(await f.service.capture(), f.records);
  } finally { persistence.release(); }
});
