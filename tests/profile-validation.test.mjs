import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  initialsFor,
  isValidStoredName,
  nameLength,
  normalizeName,
  sameProfileDraft,
  validateProfileDraft,
} from '../src/utils/profile-validation.ts';

const draft = (extra = {}) => ({ name: '', avatarKind: 'initials', icon: 'sun', color: '#8B7CF6', ...extra });

describe('profile name validation', () => {
  test('normalizes whitespace and control characters', () => {
    assert.equal(normalizeName('  jean-luc   picard '), 'jean-luc picard');
    assert.equal(normalizeName('Ma\nya\t Lin'), 'Ma ya Lin');
    assert.equal(normalizeName('   '), '');
  });

  test('length is counted in code points', () => {
    assert.equal(nameLength('🙂🙂'), 2);
    assert.equal(nameLength('Émile'), 5);
  });

  test('stored names must be normalized and 1–30 code points', () => {
    assert.equal(isValidStoredName('Maya'), true);
    assert.equal(isValidStoredName('🙂'.repeat(30)), true);
    assert.equal(isValidStoredName('a'.repeat(31)), false);
    assert.equal(isValidStoredName(''), false);
    assert.equal(isValidStoredName(' Maya'), false);
    assert.equal(isValidStoredName('Ma\u0007ya'), false);
    assert.equal(isValidStoredName(42), false);
  });

  test('initials', () => {
    assert.equal(initialsFor('maya'), 'M');
    assert.equal(initialsFor('Maya Lin'), 'ML');
    assert.equal(initialsFor('  jean-luc  picard '), 'JP');
    assert.equal(initialsFor('Émile'), 'É');
    assert.equal(initialsFor('🙂 Sam'), '🙂S');
    assert.equal(initialsFor('Anna Maria Lopez'), 'AL');
    assert.equal(initialsFor(''), null);
    assert.equal(initialsFor(undefined), null);
  });

  test('draft validation', () => {
    assert.deepEqual(validateProfileDraft(draft()), {});
    assert.deepEqual(validateProfileDraft(draft({ name: `  ${'a'.repeat(30)}  ` })), {});
    assert.ok(validateProfileDraft(draft({ name: 'a'.repeat(31) })).name);
    assert.ok(validateProfileDraft(draft({ avatarKind: 'icon', color: 'red' })).avatar);
    assert.ok(validateProfileDraft(draft({ avatarKind: 'icon', icon: '' })).avatar);
  });

  test('whitespace-only edits and hidden icon fields are not changes', () => {
    assert.equal(sameProfileDraft(draft({ name: 'Maya' }), draft({ name: ' Maya ' })), true);
    assert.equal(sameProfileDraft(draft(), draft({ icon: 'book' })), true); // icon unused for initials
    assert.equal(sameProfileDraft(draft({ avatarKind: 'icon' }), draft({ avatarKind: 'icon', icon: 'book' })), false);
    assert.equal(sameProfileDraft(draft({ name: 'Maya' }), draft({ name: 'Mia' })), false);
  });
});
