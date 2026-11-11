import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { todayCopy, todayMessage, todayNumber, todayRich, todayDate, todayGreeting, todaySchedule, todayRoutineDay, todayBadgeName, todayAchievementProgress, todayMotivation } from '../src/i18n/today.ts';
import { en } from '../src/i18n/en.ts';
import { ar } from '../src/i18n/ar.ts';
import { enMessages } from '../src/i18n/en-messages.ts';
import { todayEnMessages } from '../src/i18n/today-en-messages.ts';
import { todayArMessages } from '../src/i18n/today-ar-messages.ts';
import { catalogIssues, entryParameters, pluralCategories } from '../src/i18n/catalog.ts';
import { NUMERIC_PARAMETERS } from '../src/i18n/types.ts';
import { formatMessage } from '../src/i18n/translate.ts';
import { formatLongDate, getGreeting } from '../src/utils/date.ts';
import { describeSchedule } from '../src/utils/schedule.ts';
import { describeRoutineDay, planForDay } from '../src/utils/routine-progress.ts';
import { getDailyMotivation } from '../src/data/demo-habits.ts';
import { ACHIEVEMENTS } from '../src/data/achievement-definitions.ts';
import { fullBackupRecords } from './support/backup-fixtures.mjs';
import { createBackup, canonical } from '../src/data/backup-format.ts';

const flatten = ({ parts, slotValue }) => parts.join(slotValue);
const baseline = JSON.parse(readFileSync('tests/support/today-presentation-baseline.json', 'utf8'));

test('Today and tab JSX have no remaining app-owned hardcoded copy in visible text or copy attributes', () => {
  for (const { file } of baseline.files) {
    const source = readFileSync(file, 'utf8');
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxText(node)) assert.doesNotMatch(node.text, /[A-Za-z\u0600-\u06ff]/, `${file}: hardcoded visible text`);
      if (ts.isJsxAttribute(node) && ['title', 'description', 'actionLabel', 'accessibilityLabel', 'accessibilityHint'].includes(node.name.getText(tree))) {
        assert.ok(!node.initializer || !ts.isStringLiteral(node.initializer), `${file}: hardcoded ${node.name.getText(tree)}`);
        if (node.initializer && ts.isJsxExpression(node.initializer)) assert.ok(!ts.isTemplateExpression(node.initializer.expression), `${file}: concatenated description`);
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  // Pass-through/opaque children: no owned copy is hidden behind a generic prop or native action name.
  for (const file of ['src/components/habits/empty-state.tsx', 'src/components/profile/profile-avatar.tsx', 'src/components/today/count-control.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /<Text[^>]*>\s*[A-Za-z]/, file);
  }
});

test('original styles and navigation route identifiers/targets are preserved from checkpoint 2ed299c', () => {
  for (const item of baseline.files) {
    const tree = ts.createSourceFile(item.file, readFileSync(item.file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const styles = [], navigation = [];
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(tree) === 'StyleSheet.create') {
        styles.push(createHash('sha256').update(node.getText(tree).replace(/\r\n/g, '\n')).digest('hex'));
      }
      if (ts.isJsxAttribute(node) && ['name', 'href', 'anchor'].includes(node.name.getText(tree)) && node.initializer && ts.isStringLiteral(node.initializer)) {
        navigation.push([node.name.getText(tree), node.initializer.text]);
      }
      ts.forEachChild(node, visit);
    }
    visit(tree); assert.deepEqual(styles, item.styles, item.file); assert.deepEqual(navigation, item.navigation, item.file);
  }
  assert.doesNotMatch(readFileSync('src/components/localized-inline.tsx', 'utf8'), /<View|<Pressable/);
});

test('English Today labels, notices, empty states and tab labels preserve exact wording and punctuation', () => {
  const { t, m } = todayCopy('en');
  const expected = {
    'today.habits': "Today's Habits", 'today.plan': "Today's plan", 'today.getStarted': "Let's build some momentum today.",
    'today.loadHabits.title': "Couldn't load your habits", 'today.loadHabits.body': "Your saved data hasn't been changed. Try again, or restart the app.",
    'today.loadProgress': 'Couldn’t load today’s saved progress, so changes are paused. Your saved data is untouched.',
    'today.saveProgress': 'Couldn’t save your latest changes. They’re kept here and will be retried automatically — keep the app open until it says Saved.',
    'today.prompt.title': 'Make Momentum yours', 'today.prompt.body': "Add the name you'd like to see here. You can change it any time in Settings.",
    'today.prompt.failed': "Couldn't save that. Try again.", 'today.retry': 'Try again', 'today.saved': 'Saved', 'common.saving': 'Saving…',
    'navigation.today': 'Today', 'navigation.habits': 'Habits', 'navigation.goals': 'Goals', 'navigation.insights': 'Insights',
    'navigation.settings': 'Settings', 'navigation.docs': 'Docs', 'navigation.brand': 'MOMENTUM',
  };
  for (const [key, text] of Object.entries(expected)) assert.equal(t(key), text, key);
  assert.equal(m('today.noneOnDay', { day: 'Monday' }), 'None of your habits are scheduled for Monday. Enjoy the rest, or adjust a schedule.');
  assert.equal(m('today.progress', { completed: 1, total: 1 }), '1 of 1 habits'); // Original wording retained.
  assert.equal(m('today.remainingCount', { count: 1 }), '1 left');
  assert.equal(m('today.countValueUnit', { value: 1234, target: 9999, unit: 'glasses 🧪' }), '1234 / 9999 glasses 🧪');
  assert.equal(m('today.checklistProgress', { completed: 1, total: 1 }), '1 of 1 steps');
  assert.equal(m('today.checklistMixedProgress', { requiredDone: 1, requiredTotal: 2, done: 2, steps: 3 }), '1 of 2 required · 2 of 3 total');
});

test('full named messages retain rich text slot positions, newline, punctuation and literal names', () => {
  const name = 'اسم {count} $& \u0000slot\u0000';
  assert.equal(flatten(todayRich('en', 'today.greetingLine', { greeting: 'Good morning', name }, 'name')), `Good morning,\n${name}`);
  assert.equal(flatten(todayRich('en', 'today.remainingSaved', { count: 2, status: 'Saving…' }, 'status')), '2 left · Saving…');
  assert.equal(flatten(todayRich('en', 'today.plan.loadError', { action: 'Retry' }, 'action')), 'Couldn’t load routines · Retry');
  assert.equal(flatten(todayRich('en', 'today.ringCounter', { completed: 1, denominator: '/2' }, 'denominator')), '1/2');
  assert.equal(flatten(todayRich('ar', 'today.greetingLine', { greeting: 'صباح الخير', name }, 'name')), `صباح الخير،\n${name}`);
  assert.equal(todayMessage('en', 'today.optionalStepA11y', { name }), `${name}, optional`);
});

test('routine plan English counts, footnotes and accessibility match all prior branches', () => {
  const { m } = todayCopy('en');
  for (const count of [1, 2, 1000]) {
    assert.equal(m('today.plan.summary', { completed: 1, count, action: 'Manage' }), `1 of ${count} ${count === 1 ? 'routine' : 'routines'} done · Manage`);
    assert.equal(m('today.plan.outside', { count }), `+${count} ${count === 1 ? 'habit' : 'habits'} due today not in a routine — see below.`);
    assert.equal(m('today.plan.restNames', { names: 'A, B', count }), `A, B ${count === 1 ? 'has' : 'have'} nothing due today.`);
  }
  for (const state of ['empty', 'rest', 'todo', 'partial', 'complete']) {
    const day = { state, done: 1, total: 2 };
    assert.equal(todayRoutineDay('en', day), describeRoutineDay(day));
  }
  assert.equal(m('today.plan.rowNowA11y', { name: 'My routine', summary: '1 of 2 done' }), 'My routine, suggested now, 1 of 2 done');
});

test('greetings, English dates and schedule descriptions retain existing time/day semantics', () => {
  for (let hour = 0; hour < 24; hour++) {
    const date = new Date(2026, 10, 11, hour);
    assert.equal(todayGreeting('en', date), getGreeting(date));
    assert.equal(todayDate('en', date), formatLongDate(date).toUpperCase());
    assert.ok(todayGreeting('ar', date).trim());
  }
  for (let mask = 0; mask < 128; mask++) {
    const schedule = { kind: 'weekdays', days: Array.from({ length: 7 }, (_, day) => day).filter((day) => mask & (1 << day)) };
    assert.equal(todaySchedule('en', schedule), describeSchedule(schedule));
    const before = JSON.stringify(schedule); todaySchedule('ar', schedule); assert.equal(JSON.stringify(schedule), before);
  }
  assert.equal(todaySchedule('en', { kind: 'daily' }), 'Every day');
  assert.match(todayDate('ar', new Date(2026, 10, 11)), /١١/);
});

test('built-in quote selection, English text and author identity remain unchanged for a full year', () => {
  const quotes = new Set();
  for (let day = 1; day <= 365; day++) {
    const original = getDailyMotivation(new Date(2026, 0, day, 12));
    quotes.add(original.quote); assert.deepEqual(todayMotivation('en', original), original);
    assert.match(todayMotivation('ar', original).quote, /[\u0600-\u06ff]/);
    if (original.author !== 'Unknown') assert.equal(todayMotivation('ar', original).author, original.author);
  }
  assert.equal(quotes.size, 7);
  const user = { quote: 'User-authored text {count}', author: 'User' };
  assert.equal(todayMotivation('ar', user), user);
});

test('achievement summary translates ID-keyed presentation only and preserves English progress clamp/units', () => {
  const metrics = { checkins: 200, activeDays: 2, streak: 4, types: 1, perfectDays: 1, perfectWeeks: 0 };
  const evaluation = { metrics };
  const units = { checkins: 'check-ins', activeDays: 'different days', streak: 'scheduled check-ins on one habit', types: 'tracking types', perfectDays: 'perfect day', perfectWeeks: 'finished perfect week' };
  const before = JSON.stringify(ACHIEVEMENTS);
  for (const badge of ACHIEVEMENTS) {
    assert.equal(todayBadgeName('en', badge), badge.name);
    assert.equal(todayAchievementProgress('en', badge, evaluation), `${Math.min(badge.target, metrics[badge.metric])} / ${badge.target} ${units[badge.metric]}`);
    assert.notEqual(todayBadgeName('ar', badge), badge.name);
  }
  assert.equal(JSON.stringify(ACHIEVEMENTS), before);
  assert.equal(todayBadgeName('ar', { id: 'unknown-id', name: 'Keep this name' }), 'Keep this name');
  for (const count of [1, 3]) {
    assert.equal(todayMessage('en', 'today.achievement.found', { count }), `${count} ${count === 1 ? 'achievement found' : 'achievements found'} in your history`);
    assert.equal(todayMessage('en', 'today.achievement.confirmed', { count }), `${count} new ${count === 1 ? 'achievement' : 'achievements'} confirmed`);
  }
});

test('Today Arabic keys have parameter parity, all plural categories and complete rendered sentences', () => {
  assert.deepEqual(catalogIssues(), []);
  for (const [key, entry] of Object.entries(todayEnMessages)) {
    assert.deepEqual(entryParameters(entry), entryParameters(todayArMessages[key]), key);
    if (typeof entry !== 'string') assert.deepEqual(Object.keys(todayArMessages[key]).sort(), [...pluralCategories].sort(), key);
    for (const count of [0, 1, 2, 3, 11, 100]) {
      const params = Object.fromEntries(entryParameters(entry).map((name) => [name, NUMERIC_PARAMETERS.includes(name) ? 3 : 'اسم {literal}']));
      if ('count' in params) params.count = count;
      assert.doesNotMatch(todayMessage('ar', key, params), /\{(?:count|completed|total|target|value|status|action|progress|summary)\}/, key);
    }
  }
  const forms = [0, 1, 2, 3, 11, 100].map((count) => todayMessage('ar', 'today.remainingCount', { count }));
  assert.deepEqual(forms, ['لم تتبق عادات', 'تبقت عادة واحدة', 'تبقت عادتان', 'تبقت ٣ عادات', 'تبقت ١١ عادة', 'تبقى ١٠٠ من العادات']);
});

test('Today number compatibility is scoped; the default infrastructure still uses grouped numbers', () => {
  assert.equal(todayNumber('en', 1234), '1234');
  assert.equal(todayMessage('en', 'today.remainingCount', { count: 1234 }), '1234 left');
  assert.equal(formatMessage('en', 'habits.count', { count: 1234 }), '1,234 habits');
  assert.match(todayNumber('ar', 1234), /١/);
  assert.equal(todayMessage('en', 'today.percentDone', { percent: 50 }), '50% done');
});

test('presentation leaves domain records, plan facts and the exact backup v1 body/checksum untouched', async () => {
  const records = fullBackupRecords();
  const hash = async (text) => createHash('sha256').update(text).digest('hex');
  const backup = await createBackup(records, hash), before = canonical(backup), raw = JSON.stringify(records);
  const plan = planForDay([], [], new Date(2026, 10, 11), undefined, 'morning');
  const planBefore = JSON.stringify(plan);
  for (const language of ['en', 'ar']) for (const [key, entry] of Object.entries(todayEnMessages)) {
    const params = Object.fromEntries(entryParameters(entry).map((name) => [name, NUMERIC_PARAMETERS.includes(name) ? 3 : 'User اسم {name}']));
    todayMessage(language, key, Object.freeze(params));
  }
  assert.equal(JSON.stringify(plan), planBefore); assert.equal(JSON.stringify(records), raw); assert.equal(canonical(backup), before);
  const { integrity, ...body } = backup; assert.equal(await hash(canonical(body)), integrity.digest);
  assert.equal(backup.backupVersion, 1);
});
