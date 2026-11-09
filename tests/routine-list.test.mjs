import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { MAX_HABITS_PER_ROUTINE, MAX_ROUTINES } from '../src/data/routine-storage.ts';
import { addRoutine, deleteRoutineFrom, moveId, moveRoutineIn, updateRoutineIn } from '../src/utils/routine-list.ts';
import { routineDraftToInput, validateRoutineDraft } from '../src/utils/routine-validation.ts';
import { routine } from './support/fixtures.mjs';

const NOW = new Date(2026, 10, 9, 8, 30);
const input = (extra = {}) => ({
  title: '  Morning Routine  ',
  description: '   ',
  icon: 'sun',
  color: '#8B7CF6',
  timeOfDay: 'morning',
  habitIds: ['h1', 'h2', 'h1'],
  ...extra,
});

describe('routine list changes', () => {
  test('add trims text, drops empty description and duplicate IDs, appends at the end', () => {
    const { next, result } = addRoutine([routine('r0', [])], input(), NOW);
    assert.equal(next.length, 2);
    assert.equal(next[1], result);
    assert.equal(result.title, 'Morning Routine');
    assert.equal('description' in result, false);
    assert.deepEqual(result.habitIds, ['h1', 'h2']);
    assert.match(result.id, /^r_/);
    assert.equal(result.createdAt, NOW.toISOString());
  });

  test('add enforces the routine limit', () => {
    const full = Array.from({ length: MAX_ROUTINES }, (_, i) => routine(`r${i}`, []));
    assert.throws(() => addRoutine(full, input(), NOW), /up to 20 routines/);
  });

  test('update keeps id and createdAt; unknown id throws', () => {
    const list = [routine('r1', ['h1'])];
    const { next } = updateRoutineIn(list, 'r1', input({ habitIds: ['h2'] }), NOW);
    assert.equal(next[0].id, 'r1');
    assert.equal(next[0].createdAt, list[0].createdAt);
    assert.equal(next[0].updatedAt, NOW.toISOString());
    assert.deepEqual(next[0].habitIds, ['h2']);
    assert.throws(() => updateRoutineIn(list, 'nope', input(), NOW), /no longer exists/);
  });

  test('update rejects too many habits', () => {
    const ids = Array.from({ length: MAX_HABITS_PER_ROUTINE + 1 }, (_, i) => `h${i}`);
    assert.throws(() => updateRoutineIn([routine('r1', [])], 'r1', input({ habitIds: ids }), NOW), /up to 20 habits/);
  });

  test('delete removes only the routine', () => {
    const list = [routine('r1', ['h1']), routine('r2', ['h1'])];
    assert.deepEqual(deleteRoutineFrom(list, 'r1').next, [list[1]]);
    assert.throws(() => deleteRoutineFrom(list, 'nope'));
  });

  test('move swaps neighbours; at an edge it returns the same list (no write)', () => {
    const list = [routine('a', []), routine('b', []), routine('c', [])];
    assert.deepEqual(moveRoutineIn(list, 'b', -1).next.map((r) => r.id), ['b', 'a', 'c']);
    assert.deepEqual(moveRoutineIn(list, 'b', 1).next.map((r) => r.id), ['a', 'c', 'b']);
    const top = moveRoutineIn(list, 'a', -1);
    assert.equal(top.next, list);
    assert.equal(top.result, false);
    assert.equal(moveRoutineIn(list, 'c', 1).next, list);
  });

  test('moveId reorders habit IDs within a routine', () => {
    assert.deepEqual(moveId(['h1', 'h2', 'h3'], 'h3', -1), ['h1', 'h3', 'h2']);
    assert.deepEqual(moveId(['h1', 'h2'], 'h1', -1), ['h1', 'h2']);
  });
});

describe('routine form validation + stale-reference cleanup', () => {
  const draft = (extra = {}) => ({ ...input({ description: '' }), ...extra });

  test('title is required and limited to 40 characters', () => {
    assert.ok(validateRoutineDraft(draft({ title: '   ' }), new Set()).title);
    assert.ok(validateRoutineDraft(draft({ title: 'x'.repeat(41) }), new Set()).title);
    assert.equal(validateRoutineDraft(draft({ title: 'x'.repeat(40) }), new Set()).title, undefined);
  });

  test('description limited to 140 characters', () => {
    assert.ok(validateRoutineDraft(draft({ description: 'x'.repeat(141) }), new Set()).description);
  });

  test('only existing habits count toward the 20-habit limit', () => {
    const ids = Array.from({ length: 21 }, (_, i) => `h${i}`);
    assert.ok(validateRoutineDraft(draft({ habitIds: ids }), new Set(ids)).habitIds);
    // One of them was deleted → 20 real habits → allowed.
    assert.equal(validateRoutineDraft(draft({ habitIds: ids }), new Set(ids.slice(1))).habitIds, undefined);
  });

  test('saving drops IDs of deleted habits and keeps order', () => {
    const result = routineDraftToInput(draft({ habitIds: ['h3', 'gone', 'h1'] }), new Set(['h1', 'h3']));
    assert.deepEqual(result.habitIds, ['h3', 'h1']);
  });
});
