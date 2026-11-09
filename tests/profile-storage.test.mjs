import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import {
  applyProfileInput,
  DEFAULT_PROFILE,
  dismissNamePromptIn,
  draftToProfileInput,
  loadProfile,
  parseProfileStore,
  PROFILE_KEY,
  profileToDraft,
  saveProfile,
  shouldShowNamePrompt,
} from '../src/data/profile-storage.ts';
import { mock } from './support/async-storage-mock.mjs';
import { profile } from './support/fixtures.mjs';

const store = (p, version = 1) => JSON.stringify({ version, profile: p });
const NOW = new Date(Date.UTC(2026, 10, 9, 9, 0, 0));

describe('profile storage', () => {
  beforeEach(() => mock.reset());

  test('uses its own versioned key', () => {
    assert.equal(PROFILE_KEY, 'momentum:profile:v1');
  });

  test('nothing saved → default profile with a pending prompt, and nothing is written', async () => {
    const loaded = await loadProfile();
    assert.deepEqual(loaded, DEFAULT_PROFILE);
    assert.equal(shouldShowNamePrompt(loaded), true);
    assert.deepEqual(mock.writes(), []);
  });

  test('round-trips a profile', async () => {
    const p = profile({ avatar: { kind: 'icon', icon: 'book', color: '#5B8DEF' } });
    await saveProfile(p);
    assert.deepEqual(await loadProfile(), p);
  });

  test('a profile without a name round-trips', async () => {
    const p = profile({ namePrompt: 'dismissed' });
    delete p.displayName;
    await saveProfile(p);
    assert.deepEqual(await loadProfile(), p);
  });

  test('future version is refused and never overwritten', async () => {
    const raw = store(profile(), 2);
    mock.seed({ [PROFILE_KEY]: raw });
    await assert.rejects(loadProfile(), /unsupported version 2/);
    assert.equal(mock.get(PROFILE_KEY), raw);
    assert.deepEqual(mock.writes(), []);
  });

  test('a failed read rejects (no fallback to the default)', async () => {
    mock.fail('getItem');
    await assert.rejects(loadProfile(), /Simulated getItem failure/);
  });

  test('corrupt values are refused', () => {
    const bad = [
      'not json',
      '[]',
      JSON.stringify({ version: 1 }),
      store(null),
      store(profile({ displayName: 'a'.repeat(31) })),
      store(profile({ displayName: '  padded ' })),
      store(profile({ displayName: 'bad\u0000name' })),
      store(profile({ displayName: 7 })),
      store(profile({ avatar: { kind: 'photo', uri: 'x' } })),
      store(profile({ avatar: { kind: 'icon', icon: 'book', color: 'blue' } })),
      store(profile({ avatar: { kind: 'icon', icon: '', color: '#5B8DEF' } })),
      store(profile({ namePrompt: 'later' })),
      store(profile({ createdAt: undefined })),
    ];
    for (const raw of bad) assert.throws(() => parseProfileStore(raw), undefined, raw);
  });

  test('unknown icon keys are kept (rendered with a fallback), not rejected', () => {
    const p = profile({ avatar: { kind: 'icon', icon: 'rocket-from-the-future', color: '#5B8DEF' } });
    assert.deepEqual(parseProfileStore(store(p)), p);
  });

  test('saving refuses a profile it could not load back, and writes nothing', async () => {
    await assert.rejects(saveProfile(profile({ displayName: 'x'.repeat(40) })));
    assert.deepEqual(mock.writes(), []);
  });

  test('a failed write rejects', async () => {
    mock.fail('setItem');
    await assert.rejects(saveProfile(profile()), /Simulated setItem failure/);
  });

  test('saving the profile never touches other keys', async () => {
    const existing = {
      'momentum:habits:v2': '{"version":2,"habits":[]}',
      'momentum:goals:v1': '{"version":1,"goals":[]}',
      'momentum:routines:v1': '{"version":1,"routines":[]}',
      'momentum:checkins:v2:2026-11-09': '{"entries":{}}',
      'momentum:backup:pre-habits-v1': '{}',
    };
    mock.seed(existing);
    await saveProfile(profile());
    assert.deepEqual(mock.writes(), [PROFILE_KEY]);
    for (const [key, value] of Object.entries(existing)) assert.equal(mock.get(key), value);
  });
});

describe('profile changes', () => {
  test('saving a name completes the prompt and stamps timestamps', () => {
    const next = applyProfileInput(DEFAULT_PROFILE, { displayName: '  Maya  Lin ', avatar: { kind: 'initials' } }, NOW);
    assert.deepEqual(next, {
      displayName: 'Maya Lin',
      avatar: { kind: 'initials' },
      namePrompt: 'completed',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    assert.equal(shouldShowNamePrompt(next), false);
  });

  test('saving without a name answers a pending prompt (dismissed), so it does not come back', () => {
    const next = applyProfileInput(DEFAULT_PROFILE, { avatar: { kind: 'icon', icon: 'sun', color: '#8B7CF6' } }, NOW);
    assert.equal(next.displayName, undefined);
    assert.equal(next.namePrompt, 'dismissed');
    assert.equal(shouldShowNamePrompt(next), false);
  });

  test('clearing a name later keeps the prompt completed', () => {
    const next = applyProfileInput(profile(), { avatar: { kind: 'initials' } }, NOW);
    assert.equal(next.displayName, undefined);
    assert.equal(next.namePrompt, 'completed');
    assert.equal(next.createdAt, profile().createdAt);
    assert.equal(shouldShowNamePrompt(next), false);
  });

  test('"Not now" dismisses a pending prompt once; otherwise nothing changes', () => {
    const next = dismissNamePromptIn(DEFAULT_PROFILE, NOW);
    assert.equal(next.namePrompt, 'dismissed');
    assert.equal(shouldShowNamePrompt(next), false);
    assert.equal(dismissNamePromptIn(next, NOW), next); // same object → nothing written
    const done = profile();
    assert.equal(dismissNamePromptIn(done, NOW), done);
  });

  test('a dismissed prompt survives a reload', async () => {
    mock.reset();
    await saveProfile(dismissNamePromptIn(DEFAULT_PROFILE, NOW));
    assert.equal(shouldShowNamePrompt(await loadProfile()), false);
  });

  test('draft ↔ input', () => {
    const defaults = { icon: 'sun', color: '#8B7CF6' };
    assert.deepEqual(profileToDraft(DEFAULT_PROFILE, defaults), { name: '', avatarKind: 'initials', ...defaults });
    const iconProfile = profile({ avatar: { kind: 'icon', icon: 'book', color: '#5B8DEF' } });
    assert.deepEqual(profileToDraft(iconProfile, defaults), {
      name: 'Maya Lin',
      avatarKind: 'icon',
      icon: 'book',
      color: '#5B8DEF',
    });
    assert.deepEqual(draftToProfileInput({ name: '   ', avatarKind: 'initials', ...defaults }), {
      avatar: { kind: 'initials' },
    });
    assert.deepEqual(draftToProfileInput({ name: ' Sam ', avatarKind: 'icon', icon: 'run', color: '#4ADE9B' }), {
      displayName: 'Sam',
      avatar: { kind: 'icon', icon: 'run', color: '#4ADE9B' },
    });
  });
});
