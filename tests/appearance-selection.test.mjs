import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createAppearanceEditor } from '../src/utils/appearance-editor.ts';
import { startAppearanceSession } from '../src/utils/appearance-session.ts';
import { createPreferencesStore } from '../src/data/preferences-store.ts';
import { loadPreferences, savePreferences, PREFERENCES_KEY } from '../src/data/preferences-storage.ts';
import { createBackupService } from '../src/data/backup-service.ts';
import { fullBackupRecords } from './support/backup-fixtures.mjs';
import { deferred } from './support/fixtures.mjs';

function fixture(initial = {}) {
  const data = new Map(Object.entries(initial)), writes = [];
  let fail = false, failRead = false, gate = null;
  const storage = {
    getItem: async (key) => { if (failRead) throw Error('read'); return data.get(key) ?? null; },
    getAllKeys: async () => [...data.keys()],
    multiGet: async (keys) => keys.map((key) => [key, data.get(key) ?? null]),
    setItem: async (key, value) => { if (gate) await gate.promise; if (fail) throw Error('disk'); writes.push(key); data.set(key, value); },
  };
  const freshStore = () => createPreferencesStore({ load: () => loadPreferences(storage), save: (value) => savePreferences(value, storage) });
  const store = freshStore();
  const editor = createAppearanceEditor({ getPreferences: store.getSnapshot,
    save: (appearance) => store.update({ appearance }) });
  return { data, writes, storage, store, editor, freshStore,
    fail: (v) => { fail = v; }, failRead: (v) => { failRead = v; }, busy: editor.setBackupBusy,
    pause: () => { gate = deferred(); return gate; } };
}

test('appearance dialog drafts cancel/back without saving; reopen selects the saved value', async () => {
  const f = fixture(); await f.store.load();
  f.editor.open(); f.editor.choose('light');
  assert.equal(f.store.getSnapshot().preferences.appearance, 'dark');
  f.editor.cancel(); assert.equal(f.editor.getSnapshot().open, false);
  f.editor.open(); assert.equal(f.editor.getSnapshot().choice, 'dark');
  assert.deepEqual(f.writes, []);
});

test('all saved appearance modes survive a fresh store/app lifetime without changing language', async () => {
  const f = fixture(); await f.store.load();
  for (const mode of ['light', 'system', 'dark']) {
    f.editor.open(); f.editor.choose(mode); await f.editor.save();
    assert.equal(f.editor.getSnapshot().open, false);
    const restarted = f.freshStore(); await restarted.load();
    assert.deepEqual(restarted.getSnapshot().preferences, { appearance: mode, language: 'en' });
  }
  assert.deepEqual([...new Set(f.writes)], [PREFERENCES_KEY]);
});

test('failed save retains saved choice and draft, supports retry, and survives restart after retry', async () => {
  const f = fixture(); await f.store.load(); f.editor.open(); f.editor.choose('light'); f.fail(true);
  await f.editor.save();
  assert.equal(f.store.getSnapshot().preferences.appearance, 'dark');
  assert.deepEqual(f.editor.getSnapshot(), { open: true, choice: 'light', saving: false, failed: true });
  assert.deepEqual(f.writes, []);
  f.fail(false); await f.editor.save();
  const restarted = f.freshStore(); await restarted.load();
  assert.equal(restarted.getSnapshot().preferences.appearance, 'light');
});

test('rapid draft changes save the final draft once; rapid Save/Back/choice taps cannot race an in-flight write', async () => {
  const f = fixture(); await f.store.load(); f.editor.open();
  for (const mode of ['light', 'system', 'dark', 'light', 'system']) f.editor.choose(mode);
  const gate = f.pause(), saving = f.editor.save();
  await Promise.resolve();
  f.editor.choose('dark'); f.editor.cancel(); await f.editor.save();
  assert.equal(f.editor.getSnapshot().open, true);
  assert.equal(f.editor.getSnapshot().choice, 'system');
  assert.equal(f.store.getSnapshot().preferences.appearance, 'dark');
  gate.resolve(); await saving;
  assert.deepEqual(f.writes, [PREFERENCES_KEY]);
  assert.equal(f.store.getSnapshot().preferences.appearance, 'system');
});

test('backup busy blocks admission, including a dialog opened before backup starts; Cancel stays available', async () => {
  const f = fixture(); await f.store.load(); f.busy(true); f.editor.open();
  assert.equal(f.editor.getSnapshot().open, false);
  f.busy(false); f.editor.open(); f.editor.choose('light'); f.busy(true);
  f.editor.choose('system'); await f.editor.save();
  assert.equal(f.editor.getSnapshot().choice, 'light'); assert.deepEqual(f.writes, []);
  f.editor.cancel(); assert.equal(f.editor.getSnapshot().open, false);
});

test('loading/error never admit default overwrites; explicit retry hydrates the existing saved choice', async () => {
  const original = JSON.stringify({ version: 1, preferences: { appearance: 'system', language: 'ar' } });
  const f = fixture({ [PREFERENCES_KEY]: original }); f.editor.open();
  assert.equal(f.editor.getSnapshot().open, false);
  f.failRead(true); await assert.rejects(f.store.load()); f.editor.open(); await f.editor.save();
  assert.equal(f.data.get(PREFERENCES_KEY), original); assert.deepEqual(f.writes, []);
  f.failRead(false); await f.store.load(); f.editor.open();
  assert.equal(f.editor.getSnapshot().choice, 'system');
  f.editor.choose('light'); await f.editor.save();
  assert.equal((await loadPreferences(f.storage)).language, 'ar');
});

test('saved preference commits drive fixed/System sessions without optimistic theme application or event feedback', async () => {
  const f = fixture(); await f.store.load();
  let device = 'light', override = 'auto', applied, activeMode, stop;
  const callbacks = new Set(), resumes = new Set(), overrides = [];
  const native = { getColorScheme: () => override === 'auto' ? device : override,
    setColorScheme: (value) => { override = value; overrides.push(value); },
    addChangeListener: (fn) => { callbacks.add(fn); return { remove: () => callbacks.delete(fn) }; } };
  const appState = { addEventListener: (_, fn) => { resumes.add(fn); return { remove: () => resumes.delete(fn) }; } };
  const sync = () => {
    const mode = f.store.getSnapshot().preferences.appearance;
    if (mode === activeMode) return;
    stop?.(); activeMode = mode;
    stop = startAppearanceSession(mode, native, appState, (value) => { applied = value; });
  };
  sync(); const unsubscribe = f.store.subscribe(sync);
  const select = async (mode) => { f.editor.open(); f.editor.choose(mode); await f.editor.save(); };
  try {
    assert.equal(applied, 'dark');
    f.fail(true); await select('light'); assert.equal(applied, 'dark');
    f.fail(false); await f.editor.save(); assert.equal(applied, 'light');
    device = 'dark'; for (const fn of callbacks) fn({ colorScheme: device }); assert.equal(applied, 'light');
    await select('system'); assert.equal(applied, 'dark');
    const count = overrides.length;
    device = 'light'; for (const fn of callbacks) fn({ colorScheme: device }); assert.equal(applied, 'light');
    assert.equal(overrides.length, count);
    device = 'dark'; for (const fn of resumes) fn('active'); assert.equal(applied, 'dark');
    await select('dark'); device = 'light'; for (const fn of callbacks) fn({ colorScheme: device }); assert.equal(applied, 'dark');
    await select('system'); assert.equal(applied, 'light');
    assert.equal(callbacks.size, 1); assert.equal(resumes.size, 1);
  } finally { unsubscribe(); stop(); }
});

test('selector saves leave all domain records and backup v1 payload/schema unchanged', async () => {
  const records = fullBackupRecords();
  const f = fixture(Object.fromEntries(records.map(({ key, raw }) => [key, raw])));
  const hash = async (text) => createHash('sha256').update(text).digest('hex');
  const unusedFiles = { list: async () => [], read: async () => null, write: async () => {}, remove: async () => {} };
  const backup = createBackupService(f.storage, unusedFiles, hash);
  const before = await backup.exportBackup(); await f.store.load();
  for (const mode of ['light', 'system', 'dark']) { f.editor.open(); f.editor.choose(mode); await f.editor.save(); }
  const after = await backup.exportBackup();
  assert.deepEqual(after.payload, before.payload);
  assert.deepEqual(after.schemaVersions, before.schemaVersions);
  // Export timestamps may differ. Raw backup payload and its canonical checksum input are preserved.
  assert.deepEqual(await backup.capture(), records);
  assert.deepEqual([...new Set(f.writes)], [PREFERENCES_KEY]);
});

test('production theme uses saved preferences with no preview override; language subscribes to committed preferences', () => {
  const theme = readFileSync('src/hooks/use-theme-preview.tsx', 'utf8');
  assert.match(theme, /const appearance = preferences.appearance/);
  assert.match(theme, /startAppearanceSession\(appearance,/);
  assert.doesNotMatch(theme, /setPreview|previewAppearance|__DEV__|key=/);
  const dev = readFileSync('src/components/dev-theme-preview.tsx', 'utf8');
  assert.match(dev, /return null/); assert.doesNotMatch(dev, /Pressable|setPreview/);
  const language = readFileSync('src/hooks/use-language.ts', 'utf8');
  assert.match(language, /usePresentationLanguage/);
  assert.match(language, /direction: languageDirection\(language\)/);
});
