import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import { loadRoutines, parseRoutineStore, ROUTINES_KEY, saveRoutines } from '../src/data/routine-storage.ts';
import { mock } from './support/async-storage-mock.mjs';
import { routine } from './support/fixtures.mjs';

const store = (routines, version = 1) => JSON.stringify({ version, routines });

describe('routine storage', () => {
  beforeEach(() => mock.reset());

  test('uses its own versioned key', () => {
    assert.equal(ROUTINES_KEY, 'momentum:routines:v1');
  });

  test('nothing saved → empty list, and nothing is written', async () => {
    assert.deepEqual(await loadRoutines(), []);
    assert.deepEqual(mock.writes(), []);
  });

  test('round-trips routines in order', async () => {
    const list = [routine('r1', ['h1', 'h2']), routine('r2', [], { timeOfDay: 'evening', description: 'Wind down' })];
    await saveRoutines(list);
    assert.deepEqual(await loadRoutines(), list);
  });

  test('saving routines never touches habits, goals or check-in keys', async () => {
    const existing = {
      'momentum:habits:v2': '{"version":2,"habits":[]}',
      'momentum:goals:v1': '{"version":1,"goals":[]}',
      'momentum:checkins:v2:2026-11-09': '{"version":2,"entries":{"h1":{"type":"tick","done":true}}}',
      'momentum:completions:v1:2026-11-01': '["h1"]',
    };
    mock.seed(existing);
    await saveRoutines([routine('r1', ['h1'])]);
    assert.deepEqual(mock.writes(), [ROUTINES_KEY]);
    for (const [key, value] of Object.entries(existing)) assert.equal(mock.get(key), value);
  });

  test('missing timeOfDay reads as anytime; duplicate habit IDs are collapsed', () => {
    const raw = routine('r1', ['h1', 'h1', 'h2']);
    delete raw.timeOfDay;
    const [parsed] = parseRoutineStore(store([raw]));
    assert.equal(parsed.timeOfDay, 'anytime');
    assert.deepEqual(parsed.habitIds, ['h1', 'h2']);
  });

  const corrupt = {
    'invalid JSON': '{nope',
    'wrong shape': '[]',
    'future version': store([routine('r1', [])], 2),
    'unknown timeOfDay': store([routine('r1', [], { timeOfDay: 'night' })]),
    'non-string habit ID': store([routine('r1', [42])]),
    'missing title': store([{ ...routine('r1', []), title: undefined }]),
    'duplicate routine IDs': store([routine('r1', []), routine('r1', [])]),
  };
  for (const [name, raw] of Object.entries(corrupt)) {
    test(`strict parsing rejects ${name} (and load throws instead of returning [])`, async () => {
      assert.throws(() => parseRoutineStore(raw));
      mock.seed({ [ROUTINES_KEY]: raw });
      await assert.rejects(loadRoutines());
      assert.equal(mock.get(ROUTINES_KEY), raw, 'corrupt data is left exactly as it was');
    });
  }

  test('a storage read failure throws', async () => {
    mock.fail('getItem');
    await assert.rejects(loadRoutines(), /Simulated getItem failure/);
  });
});
