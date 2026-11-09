import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { ACHIEVEMENTS_KEY, emptyAchievements, loadAchievements, saveAchievements, parseAchievements, mergeAchievementAwards, acknowledgeAchievements } from '../src/data/achievement-storage.ts';
import { loadCompletionHistory } from '../src/data/completion-storage.ts';
import { evaluateAchievements } from '../src/utils/achievements.ts';
import { mock } from './support/async-storage-mock.mjs';
import { tick } from './support/fixtures.mjs';

const NOW = new Date('2026-11-09T12:00:00.000Z');
const evaluation = () => evaluateAchievements([tick('a')], { days: new Map([['2026-11-06', { entries: { a: { type: 'tick', done: true } } }]]), unreadableDays: [] }, '2026-11-09');
const collection = () => mergeAchievementAwards(emptyAchievements(), evaluation(), NOW);
const raw = (value, version = 1) => JSON.stringify({ version, ...value });

describe('achievement storage', () => {
  beforeEach(() => mock.reset());
  test('missing key returns empty without any write; isolated key round-trips', async () => {
    assert.deepEqual(await loadAchievements(), emptyAchievements()); assert.deepEqual(mock.writes(), []);
    await saveAchievements(collection()); assert.deepEqual(await loadAchievements(), collection());
    assert.deepEqual(mock.writes(), [ACHIEVEMENTS_KEY]);
  });
  test('recognition is actual creation timestamp; evidence is separate and never overwritten on backfill', () => {
    const c = collection(); const first = c.awards['first-checkin'];
    assert.equal(first.awardedAt, NOW.toISOString()); assert.equal(first.evidenceThrough, '2026-11-06'); assert.equal(first.source, 'backfill');
    assert.equal(Object.hasOwn(first, 'unlockedAt'), false);
    assert.equal(mergeAchievementAwards(c, evaluation(), new Date('2027-01-01')), c);
  });
  test('deletion, schedule changes, unreadable history and clock rollback never revoke persisted awards', () => {
    const c = collection();
    for (const e of [evaluateAchievements([], { days: new Map(), unreadableDays: [] }, '2026-11-10'), evaluateAchievements([tick('a')], { days: new Map(), unreadableDays: ['2026-11-06'] }, '2026-11-01')]) {
      assert.equal(mergeAchievementAwards(c, e, NOW), c);
    }
  });
  test('acknowledgement is idempotent and ignores IDs without awards', () => {
    const c = collection(); const next = acknowledgeAchievements(c, ['first-checkin', 'first-checkin', 'not-awarded']);
    assert.deepEqual(next.seenBadgeIds, ['first-checkin']);
    assert.equal(acknowledgeAchievements(next, ['first-checkin']), next);
  });
  test('corrupt/future stores reject reads and preserve raw bytes', async () => {
    for (const value of ['bad json', '[]', raw(collection(), 2), raw({ awards: {}, seenBadgeIds: ['missing'] })]) {
      mock.seed({ [ACHIEVEMENTS_KEY]: value });
      await assert.rejects(loadAchievements()); assert.equal(mock.get(ACHIEVEMENTS_KEY), value);
    }
    assert.deepEqual(mock.writes(), []);
  });
  test('strict validation covers incompatible rules, dates, evidence and acknowledgements', () => {
    for (const change of [
      { ruleVersion: 2 }, { awardedAt: '2026-02-30T12:00:00.000Z' }, { awardedAt: 'yesterday' }, { evidenceThrough: '2026-02-30' },
      { source: 'invented' }, { evidence: { metric: -1, windowEnd: '2026-11-06' } },
      { evidence: { metric: 1.5, windowEnd: '2026-11-06' } }, { evidence: { metric: 1, windowEnd: '2026-11-07' } },
      { evidence: { metric: 1, windowStart: '2026-11-07', windowEnd: '2026-11-06' } },
    ]) {
      const c = collection(); c.awards['first-checkin'] = { ...c.awards['first-checkin'], ...change };
      assert.throws(() => parseAchievements(raw(c)), undefined, JSON.stringify(change));
    }
    const c = collection(); c.seenBadgeIds = ['first-checkin', 'first-checkin'];
    assert.throws(() => parseAchievements(raw(c)));
  });
  test('structurally valid unknown badge IDs survive parsing, awards and acknowledgements', () => {
    const c = collection(); c.awards['future-badge'] = { ...c.awards['first-checkin'], ruleVersion: 7 };
    const parsed = parseAchievements(raw(c));
    assert.deepEqual(parsed, c); assert.deepEqual(acknowledgeAchievements(parsed, ['future-badge']).awards, c.awards);
  });
  test('failed reads/writes propagate; invalid saves write nothing', async () => {
    mock.fail('getItem'); await assert.rejects(loadAchievements()); mock.fail('getItem', false);
    mock.fail('setItem'); await assert.rejects(saveAchievements(collection())); mock.fail('setItem', false);
    await assert.rejects(saveAchievements({ awards: {}, seenBadgeIds: ['missing'] })); assert.deepEqual(mock.writes(), []);
  });
  test('legacy v1 is Tick only, v2 wins, corrupt v2 never falls back, original history stays untouched', async () => {
    mock.seed({
      'momentum:completions:v1:2026-11-01': JSON.stringify(['a']),
      'momentum:completions:v1:2026-11-02': JSON.stringify(['a']),
      'momentum:checkins:v2:2026-11-02': JSON.stringify({ version: 2, entries: { a: { type: 'count', value: 1, target: 8 } } }),
      'momentum:completions:v1:2026-11-03': JSON.stringify(['a']),
      'momentum:checkins:v2:2026-11-03': 'corrupt',
      'momentum:checkins:v2:2026-11-04': JSON.stringify({ version: 3, entries: {} }),
    });
    const before = mock.snapshot();
    const history = await loadCompletionHistory();
    const e = evaluateAchievements([tick('a')], history, '2026-11-09');
    assert.equal(e.metrics.checkins, 1); assert.deepEqual(e.types, ['tick']); assert.equal(e.notes.unreadableDays, 2);
    assert.deepEqual(mock.snapshot(), before); assert.deepEqual(mock.writes(), []);
  });
});
