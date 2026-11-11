import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { sourceTextHash } from '../scripts/source-text-hash.mjs';
import test from 'node:test';
import { en } from '../src/i18n/en.ts';
import { ar } from '../src/i18n/ar.ts';
import { enMessages } from '../src/i18n/en-messages.ts';
import { arMessages } from '../src/i18n/ar-messages.ts';
import { catalogIssues, entryParameters, templateParameters, pluralCategories } from '../src/i18n/catalog.ts';
import { createTranslator, formatMessage, translateMessage, LocalizationError } from '../src/i18n/translate.ts';
import { PresentationError, errorMessage, operationErrorMessage } from '../src/i18n/errors.ts';
import { formatNumber, formatPercent, formatLocalDate, formatLocalMonth, formatLocalWeekday, formatLocalDateRange, normalizeNumericInput, pluralCategory } from '../src/i18n/format.ts';
import { fullBackupRecords } from './support/backup-fixtures.mjs';
import { canonical, createBackup } from '../src/data/backup-format.ts';
import { ACHIEVEMENTS } from '../src/data/achievement-definitions.ts';
import { daysBetween, startOfWeek, toLocalDateKey } from '../src/utils/date.ts';
import { parseCountTarget, validateHabitDraft, NEW_HABIT_DRAFT } from '../src/utils/habit-validation.ts';

test('expanded fixed labels and message catalogs have exact key/parameter parity and full Arabic cardinal forms', () => {
  assert.deepEqual(catalogIssues(), []);
  assert.ok(Object.keys(en).length > 100); assert.ok(Object.keys(enMessages).length > 20);
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ar).sort());
  for (const [key, entry] of Object.entries(enMessages)) {
    assert.deepEqual(entryParameters(entry), entryParameters(arMessages[key]), key);
    if (typeof entry !== 'string') assert.deepEqual(Object.keys(arMessages[key]).sort(), [...pluralCategories].sort(), key);
  }
});

test('catalog validator catches missing/extra keys, renamed parameters, empty forms and malformed interpolation', () => {
  const missing = { ...ar }; delete missing['common.save'];
  assert.ok(catalogIssues(en, missing).some((issue) => issue.includes('key-parity')));
  assert.ok(catalogIssues(en, { ...ar, extra: 'x' }).some((issue) => issue.includes('key-parity')));
  assert.ok(catalogIssues(en, ar, enMessages, { ...arMessages, 'today.progress': '{complete} / {total}' }).some((issue) => issue.includes('parameter-parity')));
  assert.ok(catalogIssues(en, ar, enMessages, { ...arMessages, 'habits.count': { one: '', other: '{count}' } }).some((issue) => issue.includes('plural-forms')));
  assert.ok(catalogIssues(en, ar, enMessages, { ...arMessages, 'today.progress': '{completed' }).some((issue) => issue.includes('invalid-template')));
  assert.throws(() => templateParameters('Bad {name'), /placeholder/);
});

test('named interpolation reorders arguments and preserves literal user content without recursive evaluation', () => {
  const strict = createTranslator({ strict: true });
  const name = 'اسم 🧪 {count} $& <b>name</b>\n';
  const params = Object.freeze({ name, greeting: 'مرحبًا' });
  assert.equal(strict.message('ar', 'today.greetingNamed', params), `مرحبًا، ${name}`);
  assert.equal(formatMessage('en', 'today.progress', { total: 5, completed: 2 }), '2 of 5 habits');
  assert.equal(params.name, name);
  assert.equal(templateParameters('{name} {name} {count}').join(), 'count,name');
});

test('all six Arabic cardinal categories use complete grammatical messages; English stays one/other', () => {
  const counts = [0, 1, 2, 3, 11, 100];
  assert.deepEqual(counts.map((count) => pluralCategory('ar', count)), ['zero', 'one', 'two', 'few', 'many', 'other']);
  assert.deepEqual(counts.map((count) => formatMessage('ar', 'habits.count', { count })), [
    'لا توجد عادات', 'عادة واحدة', 'عادتان', '٣ عادات', '١١ عادة', '١٠٠ من العادات',
  ]);
  assert.equal(formatMessage('en', 'habits.count', { count: 0 }), '0 habits');
  assert.equal(formatMessage('en', 'habits.count', { count: 1 }), '1 habit');
  assert.equal(formatMessage('en', 'habits.count', { count: 2 }), '2 habits');
  assert.equal(pluralCategory('ar', 1.5), 'other');
  assert.equal(pluralCategory('ar', 0.0001), 'other');
  for (const [key, entry] of Object.entries(enMessages)) if (typeof entry !== 'string') {
    for (const language of ['en', 'ar']) for (const count of [...counts, 1.5]) {
      const rendered = formatMessage(language, key, { count });
      assert.ok(rendered.trim()); assert.doesNotMatch(rendered, /\{count\}/);
    }
  }
});

test('strict runtime validation rejects missing, extra, unsafe or mistyped parameters and unknown keys', () => {
  const strict = createTranslator({ strict: true });
  const fails = (fn, code) => assert.throws(fn, (error) => error instanceof LocalizationError && error.code === code);
  fails(() => strict.message('en', 'today.progress', { completed: 1 }), 'missing-parameter');
  fails(() => strict.message('en', 'habits.count', { count: 1, unused: 2 }), 'unexpected-parameter');
  for (const count of [NaN, Infinity, -1, '2', {}, null]) fails(() => strict.message('ar', 'habits.count', { count }), 'invalid-parameter');
  fails(() => strict.message('en', 'today.progress', []), 'missing-parameter');
  fails(() => strict.message('en', 'accessibility.profileNamed', { name: 1 }), 'invalid-parameter');
  fails(() => strict.label('en', 'toString'), 'missing-key');
  fails(() => strict.label('fr', 'common.save'), 'invalid-language');
  fails(() => strict.descriptor('en', { key: 'common.save', params: { count: 1 } }), 'unexpected-parameter');
});

test('production fallback uses English or a safe generic message; diagnostics do not expose parameters', () => {
  const diagnostics = [];
  const translator = createTranslator({ labels: { en, ar: {} }, messages: { en: enMessages, ar: {} }, onDiagnostic: (code) => diagnostics.push(code) });
  assert.equal(translator.label('ar', 'common.save'), 'Save');
  assert.equal(translator.message('ar', 'habits.count', { count: 3 }), '3 habits');
  assert.equal(translator.message('ar', 'accessibility.profileNamed', { unexpected: 'PRIVATE NAME' }), en['errors.unexpected']);
  assert.equal(translator.label('ar', 'unknown'), en['errors.unexpected']);
  assert.ok(!JSON.stringify(diagnostics).includes('PRIVATE NAME'));
  const malformed = createTranslator({ messages: { en: enMessages, ar: { ...arMessages, 'today.progress': 'Bad {typo}' } } });
  assert.equal(malformed.message('ar', 'today.progress', { completed: 1, total: 2 }), '1 of 2 habits');
  const missingForm = createTranslator({ messages: { en: enMessages, ar: { ...arMessages, 'habits.count': { one: '{count} عادة', other: '{count} عادة' } } } });
  assert.equal(missingForm.message('ar', 'habits.count', { count: 3 }), '3 habits');
});

test('typed error descriptors render at presentation time and never echo unknown native errors', () => {
  const descriptor = { key: 'errors.recordUnreadable', params: { date: '2026-11-11' } };
  const error = new PresentationError(descriptor); descriptor.params.date = 'MUTATED';
  assert.ok(Object.isFrozen(error.descriptor)); assert.ok(Object.isFrozen(error.descriptor.params));
  assert.match(translateMessage('en', errorMessage(error)), /2026-11-11/);
  assert.match(translateMessage('ar', errorMessage(error)), /2026-11-11/);
  assert.equal(errorMessage(new Error('C:/private/user-name secret token')).key, 'errors.unexpected');
  assert.equal(errorMessage({ descriptor: { key: 'common.delete' } }).key, 'errors.unexpected');
  assert.equal(operationErrorMessage('save').key, 'errors.save');
});

test('display policy explicitly uses Gregorian dates and Arabic-Indic display digits without timezone shifts', () => {
  assert.equal(formatNumber('en', 1234.5), '1,234.5');
  assert.equal(formatNumber('ar', 1234.5), new Intl.NumberFormat('ar-EG', { numberingSystem: 'arab' }).format(1234.5));
  assert.equal(formatPercent('en', 0.834), '83%');
  assert.ok(formatPercent('ar', 0.834).includes('٨٣'));
  assert.equal(formatLocalDate('en', '2028-02-29'), 'February 29, 2028');
  assert.ok(formatLocalDate('ar', '2028-02-29').includes('٢٠٢٨'));
  assert.equal(formatLocalMonth('en', '2026-12-31'), 'December 2026');
  assert.equal(formatLocalWeekday('en', '2026-11-09'), 'Monday');
  assert.equal(formatLocalDateRange('en', '2026-12-31', '2027-01-01'), 'December 31, 2026 – January 1, 2027');
  assert.equal(formatLocalDateRange('en', '2026-11-11', '2026-11-11'), formatLocalDate('en', '2026-11-11'));
  assert.throws(() => formatLocalDate('ar', '2026-02-30'), RangeError);
  assert.throws(() => formatLocalDateRange('en', '2027-01-01', '2026-12-31'), RangeError);
  for (const value of [NaN, Infinity]) assert.throws(() => formatNumber('ar', value), RangeError);
  assert.equal(toLocalDateKey(startOfWeek(new Date(2026, 10, 11))), '2026-11-09');
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
});

test('optional digit normalization is display/input-boundary only and does not loosen current validation', () => {
  const text = ' ٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹ +١٫٥ -۲.٣ ';
  assert.equal(normalizeNumericInput(text), ' 0123456789 0123456789 +1٫5 -2.3 ');
  assert.equal(parseCountTarget('٨'), null); // Existing validator is intentionally unchanged.
  assert.equal(parseCountTarget(normalizeNumericInput('٨')), 8);
  assert.notEqual(validateHabitDraft({ ...NEW_HABIT_DRAFT, name: '' }).name, undefined);
});

test('local Gregorian display dates retain the same key in positive, negative and DST timezones', () => {
  const program = `
    import { formatLocalDate } from './src/i18n/format.ts';
    import { parseLocalDateKey, toLocalDateKey } from './src/utils/date.ts';
    const key = '2026-12-31';
    console.log(JSON.stringify({ key: toLocalDateKey(parseLocalDateKey(key)), display: formatLocalDate('en', key) }));
  `;
  for (const timezone of ['UTC', 'Africa/Cairo', 'America/New_York', 'Pacific/Kiritimati']) {
    const result = JSON.parse(execFileSync(process.execPath, ['--import', './tests/support/register.mjs', '--input-type=module', '-e', program], {
      encoding: 'utf8', env: { ...process.env, TZ: timezone },
    }));
    assert.deepEqual(result, { key: '2026-12-31', display: 'December 31, 2026' }, timezone);
  }
});

test('rendering all catalogs preserves user records, achievement IDs and exact backup v1 bytes/checksum', async () => {
  const records = fullBackupRecords();
  const hash = async (text) => createHash('sha256').update(text).digest('hex');
  const backup = await createBackup(records, hash), before = canonical(backup);
  const ids = ACHIEVEMENTS.map((item) => item.id);
  const original = JSON.stringify(records);
  const strict = createTranslator({ strict: true });
  for (const language of ['en', 'ar']) {
    for (const key of Object.keys(en)) strict.label(language, key);
    for (const [key, entry] of Object.entries(enMessages)) {
      const params = Object.fromEntries(entryParameters(entry).map((name) => [name,
        ['count', 'completed', 'total', 'position', 'limit', 'minimum', 'maximum'].includes(name) ? 3 : 'User {content} اسم']));
      strict.message(language, key, params);
    }
  }
  assert.equal(JSON.stringify(records), original); assert.equal(canonical(backup), before);
  const { integrity, ...body } = backup;
  assert.equal(await hash(canonical(body)), integrity.digest);
  assert.deepEqual(ACHIEVEMENTS.map((item) => item.id), ids);
  assert.equal(backup.backupVersion, 1); assert.equal(backup.format, 'momentum.local-backup');
});

test('Arabic stays gated, Language stays read-only, and Appearance uses saved preferences', () => {
  const language = readFileSync('src/hooks/use-language.ts', 'utf8');
  assert.match(language, /language: ACTIVE_PRESENTATION.language/); assert.match(language, /direction: ACTIVE_PRESENTATION.direction/);
  const settings = readFileSync('src/app/(tabs)/settings.tsx', 'utf8');
  assert.match(settings, /variant="info"[\s\S]*?label="App language"[\s\S]*?value="English"/);
  assert.match(settings, /<AppearanceSelector/);
  const theme = readFileSync('src/hooks/use-theme-preview.tsx', 'utf8');
  assert.match(theme, /const appearance = preferences.appearance/);
  assert.doesNotMatch(theme, /setPreview|key=/);
});

test('copy inventory is reproducible, covers every route root and retains source evidence for producer review', () => {
  const inventory = JSON.parse(readFileSync('LOCALIZATION_COPY_INVENTORY.json', 'utf8'));
  const regenerated = JSON.parse(execFileSync(process.execPath, ['scripts/audit-localization.mjs'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
  assert.deepEqual(inventory, regenerated);
  assert.equal(inventory.summary.routeRoots, inventory.files.filter((item) => item.file.startsWith('src/app/')).length);
  for (const item of inventory.files) {
    assert.equal(sourceTextHash(readFileSync(item.file, 'utf8')), item.sourceSha256);
    if (item.file.startsWith('src/app/')) assert.equal(item.reachable, true);
  }
  for (const file of ['src/utils/insights.ts', 'src/data/backup-format.ts', 'src/data/achievement-definitions.ts', 'src/hooks/use-data-backup.tsx', 'src/utils/habit-validation.ts']) {
    assert.ok(inventory.files.find((item) => item.file === file).candidates.length > 0, file);
  }
});

test('source hashes equate LF, CRLF and mixed endings but preserve meaningful content and whitespace', () => {
  const lf = 'const name = "اسم 🧪";\n  const count = 1;\n';
  const crlf = lf.replace(/\n/g, '\r\n');
  const mixed = lf.replace('\n', '\r\n');
  assert.equal(sourceTextHash(lf), sourceTextHash(crlf));
  assert.equal(sourceTextHash(lf), sourceTextHash(mixed));
  assert.equal(sourceTextHash(lf), createHash('sha256').update(lf, 'utf8').digest('hex'));
  for (const different of [lf.replace('1', '2'), lf.trimEnd(), lf.replace('  const', ' const'), '\uFEFF' + lf, lf.replace(/\n/g, '\r')]) {
    assert.notEqual(sourceTextHash(lf), sourceTextHash(different));
  }
});

