import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { previewAppearance, startAppearanceSession } from '../src/utils/appearance-session.ts';

function fixture() {
  let device = 'light', override = 'auto';
  const listeners = new Set(), states = new Set(), writes = [], values = [];
  const native = {
    getColorScheme: () => override === 'auto' ? device : override,
    setColorScheme(value) { override = value; writes.push(value); },
    addChangeListener(fn) { listeners.add(fn); return { remove: () => listeners.delete(fn) }; },
  };
  const appState = { addEventListener(_, fn) { states.add(fn); return { remove: () => states.delete(fn) }; } };
  return { native, appState, writes, values, listeners, states,
    start: (mode) => startAppearanceSession(mode, native, appState, (s) => values.push(s)),
    device(value, notify = true) { device = value; if (notify) for (const fn of listeners) fn({ colorScheme: value }); },
    resume() { for (const fn of states) fn('active'); },
  };
}

test('explicit modes stay fixed through OS events and resume, without event feedback writes', () => {
  for (const mode of ['light', 'dark']) {
    const f = fixture(), stop = f.start(mode);
    for (const device of ['dark', 'light', null]) f.device(device);
    assert.deepEqual(f.writes, [mode]);
    f.resume();
    assert.ok(f.values.every((s) => s === mode));
    assert.deepEqual(f.writes, [mode, mode]);
    stop();
  }
});

test('System clears fixed overrides, follows live events and refreshes missed changes on resume', () => {
  const f = fixture();
  let stop = f.start('dark'); stop();
  stop = f.start('system');
  assert.equal(f.values.at(-1), 'light');
  f.device('dark'); assert.equal(f.values.at(-1), 'dark');
  f.device('light', false); f.resume(); assert.equal(f.values.at(-1), 'light');
  f.device(null); assert.equal(f.values.at(-1), 'dark');
  assert.deepEqual(f.writes, ['dark', 'auto', 'auto']);
  stop();
  assert.equal(f.listeners.size, 0); assert.equal(f.states.size, 0);
  const count = f.values.length;
  f.device('light'); f.resume(); assert.equal(f.values.length, count);
});

test('repeated fixed/System transitions release listeners and do not retain an old override', () => {
  const f = fixture();
  for (const mode of ['light', 'system', 'dark', 'system', 'light', 'system']) {
    const stop = f.start(mode);
    assert.equal(f.values.at(-1), mode === 'system' ? 'light' : mode);
    assert.equal(f.listeners.size, 1); assert.equal(f.states.size, 1);
    stop();
  }
});

test('release ignores every preview and development defaults Dark', () => {
  for (const value of [null, 'light', 'dark', 'system']) assert.equal(previewAppearance(value, false), 'dark');
  assert.equal(previewAppearance(null, true), 'dark');
  for (const value of ['light', 'dark', 'system']) assert.equal(previewAppearance(value, true), value);
});

test('web without a native override API still resolves fixed modes and live System', () => {
  const f = fixture();
  delete f.native.setColorScheme;
  let stop = f.start('dark'); assert.equal(f.values.at(-1), 'dark'); stop();
  stop = f.start('system'); assert.equal(f.values.at(-1), 'light');
  f.device('dark'); assert.equal(f.values.at(-1), 'dark'); stop();
});

test('native config unlocks appearance while preserving Dev identity and splash', () => {
  const { expo } = JSON.parse(readFileSync(new URL('../app.json', import.meta.url)));
  assert.equal(expo.userInterfaceStyle, 'automatic');
  assert.equal(expo.name, 'MOMENTUM Dev');
  assert.equal(expo.android.package, 'com.beeviro1.momentum.dev');
  assert.equal(expo.extra.eas.projectId, '38bb19b4-9b46-444e-b928-2618fcc66e31');
  assert.equal(expo.backgroundColor, '#08080D');
  assert.deepEqual(expo.plugins[1], ['expo-splash-screen', {
    backgroundColor: '#08080D', image: './assets/images/splash-icon.png', imageWidth: 76,
  }]);
});
