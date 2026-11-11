import assert from 'node:assert/strict';
import test from 'node:test';

import { en } from '../src/i18n/en.ts';
import { ar } from '../src/i18n/ar.ts';
import { translate, translateMessage } from '../src/i18n/translate.ts';
import { preferenceErrorMessage } from '../src/i18n/types.ts';
import { formatLocalDate, formatNumber, formatPercent, pluralCategory } from '../src/i18n/format.ts';
import { ACTIVE_PRESENTATION, resolveAppearance, languageDirection } from '../src/utils/presentation.ts';
import { toLocalDateKey } from '../src/utils/date.ts';

test('foundation catalogs have exact key parity and nonempty translations', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ar).sort());
  for (const key of Object.keys(en)) for (const language of ['en', 'ar']) assert.ok(translate(language, key).trim());
  for (const code of ['invalid-record', 'unsupported-version', 'read-failed', 'write-failed', 'not-loaded', 'invalid-update']) {
    const descriptor = preferenceErrorMessage(code);
    assert.equal(translateMessage('en', descriptor), en[descriptor.key]);
    assert.equal(translateMessage('ar', descriptor), ar[descriptor.key]);
  }
});

test('requested appearance and direction can resolve without enabling unfinished presentation', () => {
  assert.equal(resolveAppearance('system', 'light'), 'light');
  assert.equal(resolveAppearance('system', 'dark'), 'dark');
  assert.equal(resolveAppearance('system', null), 'dark');
  assert.equal(resolveAppearance('light', 'dark'), 'light');
  assert.equal(resolveAppearance('dark', 'light'), 'dark');
  assert.equal(languageDirection('ar'), 'rtl');
  assert.equal(languageDirection('en'), 'ltr');
  assert.deepEqual(ACTIVE_PRESENTATION, { scheme: 'dark', language: 'en', direction: 'ltr' });
});

test('Arabic plural infrastructure covers all six categories, English one/other', () => {
  assert.deepEqual([0, 1, 2, 3, 11, 100].map((count) => pluralCategory('ar', count)), ['zero', 'one', 'two', 'few', 'many', 'other']);
  assert.equal(pluralCategory('en', 1), 'one'); assert.equal(pluralCategory('en', 2), 'other');
});

test('localized display numbers/percent/date leave local machine keys and Gregorian year unchanged', () => {
  assert.equal(formatNumber('en', 1234), '1,234');
  assert.equal(formatPercent('en', 0.834), '83%');
  assert.ok(formatNumber('ar', 1234).length > 0);
  const key = toLocalDateKey(new Date(2026, 11, 31));
  assert.equal(key, '2026-12-31');
  assert.equal(formatLocalDate('en', key), 'December 31, 2026');
  const localized = formatLocalDate('ar', key);
  assert.ok(localized.includes(new Intl.NumberFormat('ar-EG', { numberingSystem: 'arab', useGrouping: false }).format(2026)));
  assert.equal(key, '2026-12-31');
  assert.throws(() => formatLocalDate('ar', '2026-02-30'), RangeError);
});
