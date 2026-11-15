import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { DEFAULT_REMINDER, DEFAULT_NOTIFICATION_SETTINGS as defaults, validReminder, validSettings, validTime, setReminderEnabled } from '../src/notifications/model.ts';
import { planNotifications, inQuietHours, notificationTarget, PREFIX } from '../src/notifications/planner.ts';
import { createNotificationEngine, parseDeviceState, signature, NOTIFICATION_STATE_KEY } from '../src/notifications/engine.ts';
import { parseStore, loadHabits, saveHabits } from '../src/data/habit-storage.ts';
import { NEW_HABIT_DRAFT, habitToDraft, draftToInput, validateHabitDraft } from '../src/utils/habit-validation.ts';
import { applyTick, applyCount, applyStep } from '../src/utils/habit-progress.ts';
import { createBackup, parseBackup, requireRestorable } from '../src/data/backup-format.ts';
import { fullBackupRecords } from './support/backup-fixtures.mjs';
import { mock as storage } from './support/async-storage-mock.mjs';
import { notificationsEn } from '../src/i18n/notifications-en.ts';
import { notificationsAr } from '../src/i18n/notifications-ar.ts';
import { normalizeNumericInput } from '../src/i18n/format.ts';
import { createBackupService } from '../src/data/backup-service.ts';
import { createPersistenceCoordinator } from '../src/data/persistence-coordinator.ts';
import { tick, count, checklist } from './support/fixtures.mjs';

const now = new Date(2026, 10, 15, 8, 0); // Sunday, device local
const habit = (id = 'a', extra = {}) => ({ ...tick(id), reminder: { ...DEFAULT_REMINDER, enabled: true }, ...extra });
const input = (extra = {}) => ({ now, habits: [habit()], today: { entries: {} }, settings: { ...defaults }, lastActive: now.getTime(), language: 'en', issued: {}, ...extra });
const todayPlans = i => planNotifications(i).filter(p => p.date === '2026-11-15');

test('reminder/settings validation rejects invalid times, empty/duplicate weekdays, unsafe caps and future shapes', () => {
  for (const time of ['24:00', '9:00', '12:60', '٠٩:٠٠', '', null]) assert.equal(validTime(time), false);
  assert.ok(validTime('23:59'));
  for (const days of [[], [1, 1], [7], [-1], ['1']]) assert.equal(validReminder({ ...DEFAULT_REMINDER, days }), false);
  assert.ok(validReminder(DEFAULT_REMINDER)); assert.ok(validSettings(defaults));
  for (const change of [{ dailyCap: 0 }, { dailyCap: 7 }, { dailyCap: 1.5 }, { inactiveDays: 15 }, { inactiveDays: 0 }, { quietEnd: defaults.quietStart }, { unfinished: 'yes' }]) assert.equal(validSettings({ ...defaults, ...change }), false);
});
test('turning off an incomplete reminder draft stays saveable without changing valid saved configuration', () => {
  const off = setReminderEnabled({ enabled: true, time: '2:', days: [] }, false); assert.ok(validReminder(off)); assert.equal(off.enabled, false);
  const configured = { enabled: true, time: '16:45', days: [1, 3] }; assert.deepEqual(setReminderEnabled(configured, false), { ...configured, enabled: false });
  assert.equal(configured.enabled, true); assert.deepEqual(configured.days, [1, 3]);
});
test('default reminders and gentle reminders are opt-in, with seven local habit dates and no past replay', () => {
  assert.equal(DEFAULT_REMINDER.enabled, false); assert.equal(defaults.unfinished, false); assert.equal(defaults.inactivity, false);
  assert.equal(planNotifications(input({ habits: [tick('old')] })).length, 0);
  const plans = planNotifications(input()); assert.equal(plans.length, 7); assert.equal(new Set(plans.map(p => p.id)).size, 7);
  assert.equal(plans[0].date, '2026-11-15'); assert.equal(plans.at(-1).date, '2026-11-21');
  assert.ok(plans.every(p => new Date(p.at).getHours() === 9 && p.at > now.getTime()));
  assert.equal(todayPlans(input({ now: new Date(2026, 10, 15, 9, 0) })).length, 0);
});
test('habit weekdays intersect its schedule; disabling a reminder does not affect domain scheduling', () => {
  const h = habit('a', { schedule: { kind: 'weekdays', days: [0, 2] }, reminder: { enabled: true, time: '10:00', days: [1, 2] } });
  assert.deepEqual(planNotifications(input({ habits: [h] })).map(p => p.date), ['2026-11-17']);
  assert.equal(planNotifications(input({ habits: [{ ...h, reminder: { ...h.reminder, enabled: false } }] })).length, 0);
});
test('Tick, Count and Checklist completion cancels only today; partial progress still qualifies', () => {
  const habits = [habit('tick'), { ...count('count', 2), reminder: { ...DEFAULT_REMINDER, enabled: true } }, { ...checklist('check'), reminder: { ...DEFAULT_REMINDER, enabled: true } }];
  let record = { entries: {} };
  record = applyTick(record, habits[0]); record = applyCount(record, habits[1], 1);
  assert.deepEqual(todayPlans(input({ habits, today: record })).map(p => p.habitId), ['check', 'count']);
  record = applyCount(record, habits[1], 1);
  for (const step of habits[2].tracking.steps.filter(s => !s.optional)) record = applyStep(record, habits[2], step.id);
  const plans = planNotifications(input({ habits, today: record })); assert.equal(plans.filter(p => p.date === '2026-11-15').length, 0);
  assert.equal(plans.filter(p => p.date === '2026-11-16').length, 3);
});
test('quiet hours use a half-open interval across midnight and daytime; reminders are skipped, not bunched', () => {
  for (const t of ['22:00', '23:59', '00:00', '07:59']) assert.equal(inQuietHours(t, '22:00', '08:00'), true);
  for (const t of ['08:00', '21:59']) assert.equal(inQuietHours(t, '22:00', '08:00'), false);
  assert.equal(inQuietHours('12:00', '10:00', '13:00'), true); assert.equal(inQuietHours('13:00', '10:00', '13:00'), false);
  assert.equal(planNotifications(input({ habits: [habit('night', { reminder: { enabled: true, time: '23:00', days: [0] } })] })).length, 0);
});
test('one global daily cap includes habit, unfinished and inactivity reminders and elapsed reservations', () => {
  const i = input({ habits: [habit('a'), habit('b'), habit('c')], settings: { ...defaults, unfinished: true, inactivity: true, inactiveDays: 1, dailyCap: 2 }, lastActive: new Date(2026, 10, 10).getTime() });
  const plans = planNotifications(i); for (const date of new Set(plans.map(p => p.date))) assert.ok(plans.filter(p => p.date === date).length <= 2);
  const id = `${PREFIX}habit.2026-11-15.old`;
  assert.equal(todayPlans({ ...i, issued: { [id]: { at: now.getTime() - 1, date: '2026-11-15' } } }).length, 1);
  assert.ok(plans.length <= 43);
});
test('changing time after an elapsed reservation never repeats that same habit event today', () => {
  const i = input(); const [p] = planNotifications(i);
  const later = { ...i, now: new Date(2026, 10, 15, 10), habits: [habit('a', { reminder: { ...DEFAULT_REMINDER, enabled: true, time: '11:00' } })], issued: { [p.id]: { at: p.at, date: p.date } } };
  assert.equal(todayPlans(later).length, 0);
});
test('unfinished encouragement requires an unfinished scheduled habit; zero habits never produces a nudge', () => {
  const i = input({ settings: { ...defaults, unfinished: true } });
  assert.equal(todayPlans(i).filter(p => p.kind === 'unfinished').length, 1);
  assert.equal(todayPlans({ ...i, today: applyTick({ entries: {} }, i.habits[0]) }).length, 0);
  assert.equal(planNotifications({ ...i, habits: [], settings: { ...i.settings, inactivity: true } }).length, 0);
});
test('a gentle encouragement never stacks at the exact time of an explicit habit reminder', () => {
  const plans = todayPlans(input({ settings: { ...defaults, unfinished: true, time: '09:00' } }));
  assert.equal(plans.length, 1); assert.equal(plans[0].kind, 'habit');
});
test('inactivity is one notification per saved activity anchor, including a threshold beyond seven days', () => {
  const i = input({ settings: { ...defaults, inactivity: true, inactiveDays: 14 } });
  const p = planNotifications(i).filter(p => p.kind === 'inactivity'); assert.equal(p.length, 1); assert.equal(p[0].date, '2026-11-29');
  const later = { ...i, now: new Date(2026, 11, 30), issued: { [p[0].id]: { at: p[0].at, date: p[0].date } } };
  assert.equal(planNotifications(later).filter(p => p.kind === 'inactivity').length, 0);
});
test('Arabic notification copy is exact, keeps user names literal and never includes private notes', () => {
  const [p] = planNotifications(input({ language: 'ar', habits: [habit('a', { name: 'Mixed اسم {name}', notes: 'SECRET NOTES' })] }));
  assert.equal(p.title, 'Mixed اسم {name}'); assert.equal(p.body, 'بعض الوقت لعادتك، إن كان يناسبك.');
  assert.doesNotMatch(JSON.stringify(p), /SECRET NOTES/);
  assert.deepEqual(Object.keys(notificationsAr).sort(), Object.keys(notificationsEn).sort());
  for (const text of Object.values(notificationsAr)) { assert.match(text, /[\u0600-\u06ff]/); assert.doesNotMatch(text, /\?{2,}|�/); }
  assert.equal(notificationsAr['notifications.openHabit'], 'فتح العادة');
});
test('deep links whitelist owned data and existing habit IDs, falling back to Today for deleted/invalid targets', () => {
  assert.equal(notificationTarget({ url: 'https://evil.example' }, [habit()]), null);
  assert.equal(notificationTarget(null, [habit()]), null);
  assert.deepEqual(notificationTarget({ owner: PREFIX, habitId: 'a', url: '/data-backup' }, [habit()]), { pathname: '/(tabs)/habits/[id]', params: { id: 'a' } });
  assert.equal(notificationTarget({ owner: PREFIX, habitId: 'deleted' }, [habit()]), '/(tabs)');
});
test('calendar scheduling preserves local hours in UTC, Cairo and DST transitions, skipping nonexistent times', () => {
  const script = `import assert from 'node:assert/strict';import {planNotifications} from './src/notifications/planner.ts';import {DEFAULT_NOTIFICATION_SETTINGS as s} from './src/notifications/model.ts';
    for(const [m,d] of [[2,7],[9,31]]){const n=new Date(2026,m,d,8);const p=planNotifications({now:n,habits:[{id:'a',name:'A',schedule:{kind:'daily'},tracking:{type:'tick'},reminder:{enabled:true,time:'09:00',days:[0,1,2,3,4,5,6]}}],today:{entries:{}},settings:s,lastActive:+n,language:'en',issued:{}});assert.equal(p.length,7);assert.ok(p.every(v=>new Date(v.at).getHours()===9));}
    const n=new Date(2026,2,8,0);const p=planNotifications({now:n,habits:[{id:'a',name:'A',schedule:{kind:'daily'},tracking:{type:'tick'},reminder:{enabled:true,time:'02:30',days:[0]}}],today:{entries:{}},settings:{...s,quietStart:'12:00',quietEnd:'13:00'},lastActive:+n,language:'en',issued:{}});if(process.env.TZ==='America/New_York')assert.equal(p.length,0);`;
  for (const TZ of ['UTC', 'Africa/Cairo', 'America/New_York']) execFileSync(process.execPath, ['--import', './tests/support/register.mjs', '--input-type=module', '-e', script], { env: { ...process.env, TZ }, stdio: 'pipe' });
});

function fixture() {
  let raw = null; let allowed = true; let writesFail = false; let listFail = false; let cancelFail = false; let scheduleFail = false;
  let clock = now.getTime(); const pending = new Map(); const calls = [];
  const driver = {
    async permission(ask, language) { calls.push(['permission', ask, language]); return allowed; },
    async list() { if (listFail) throw Error('list'); return [...pending].map(([id, signature]) => ({ id, signature })); },
    async cancel(id) { calls.push(['cancel', id]); if (cancelFail) throw Error('cancel'); pending.delete(id); },
    async schedule(p) { calls.push(['schedule', p.id]); if (scheduleFail) throw Error('schedule'); pending.set(p.id, signature(p)); },
  };
  const engine = createNotificationEngine({ read: async () => raw, write: async value => { calls.push(['write']); if (writesFail) throw Error('disk'); raw = value; }, driver, now: () => clock });
  return { engine, driver, pending, calls, get raw() { return raw; }, set raw(v) { raw = v; }, set allowed(v) { allowed = v; }, set writesFail(v) { writesFail = v; }, set listFail(v) { listFail = v; }, set cancelFail(v) { cancelFail = v; }, set scheduleFail(v) { scheduleFail = v; }, set clock(v) { clock = v; } };
}
const reconcile = (f, changes = {}, active = false, valid = () => true, ask = false) => {
  const { settings: _s, lastActive: _a, issued: _i, ...i } = input(changes);
  return f.engine.reconcile(i, active, valid, ask);
};
test('device settings absent/read are non-writing; corrupt/future records are not overwritten', async () => {
  const f = fixture(); assert.equal((await f.engine.load()).settings.inactivity, false); assert.equal(f.raw, null);
  for (const raw of ['bad', '{}', JSON.stringify({ ...parseDeviceState(null, +now), version: 2 }), JSON.stringify({ ...parseDeviceState(null, +now), issued: { foreign: { at: +now, date: '2026-11-15' } } })]) {
    f.raw = raw; await assert.rejects(f.engine.load()); await assert.rejects(reconcile(f)); await assert.rejects(f.engine.saveSettings(defaults)); assert.equal(f.raw, raw);
  }
});
test('reconciliation is idempotent and serialized across startup/resume/rapid changes, preserving foreign requests', async () => {
  const f = fixture(); f.pending.set('foreign', 'untouched');
  await Promise.all([reconcile(f), reconcile(f), reconcile(f)]);
  assert.equal(f.pending.size, 8); assert.equal(f.calls.filter(c => c[0] === 'schedule').length, 7); assert.equal(f.pending.get('foreign'), 'untouched');
  const firstSchedule = f.calls.findIndex(c => c[0] === 'schedule'); assert.ok(f.calls.slice(0, firstSchedule).some(c => c[0] === 'write'));
});
test('rename/time/locale edits replace native content; disable, delete and schedule changes cancel obsolete requests', async () => {
  const f = fixture(); await reconcile(f);
  await reconcile(f, { language: 'ar', habits: [habit('a', { name: 'اسم', reminder: { ...DEFAULT_REMINDER, enabled: true, time: '11:00' } })] });
  assert.equal(f.pending.size, 7); assert.ok([...f.pending.values()].every(s => s.includes('اسم') && s.includes('بعض الوقت')));
  await reconcile(f, { habits: [habit('a', { schedule: { kind: 'weekdays', days: [0] } })] }); assert.equal(f.pending.size, 1);
  await reconcile(f, { habits: [habit('a', { reminder: DEFAULT_REMINDER })] }); assert.equal(f.pending.size, 0);
  await reconcile(f); await reconcile(f, { habits: [] }); assert.equal(f.pending.size, 0);
});
test('successful persisted completion cancels today but leaves future slots; undo before delivery restores once', async () => {
  const f = fixture(); await reconcile(f);
  await reconcile(f, { today: applyTick({ entries: {} }, habit()) }); assert.equal(f.pending.size, 6);
  await reconcile(f); assert.equal(f.pending.size, 7);
});
test('permission denial/revocation cancels only owned requests and does not alter habits or opt-in settings', async () => {
  const f = fixture(); const habits = [habit()]; const before = structuredClone(habits);
  f.pending.set('foreign', 'keep'); await reconcile(f, { habits }); f.allowed = false;
  const result = await reconcile(f, { habits }, false, () => true, true);
  assert.equal(result.allowed, false); assert.equal(f.pending.size, 1); assert.deepEqual(habits, before);
  assert.equal(JSON.parse(f.raw).settings.unfinished, false);
  assert.ok(f.calls.some(c => c[0] === 'permission' && c[1] === true));
});
test('failed listing or ledger write prevents blind native changes; successful retry recovers', async () => {
  const f = fixture(); f.listFail = true; await assert.rejects(reconcile(f)); assert.equal(f.raw, null);
  f.listFail = false; f.writesFail = true; await assert.rejects(reconcile(f)); assert.equal(f.pending.size, 0);
  f.writesFail = false; await reconcile(f); assert.equal(f.pending.size, 7);
});
test('failed cancellation does not schedule a replacement; retry replaces without duplicates', async () => {
  const f = fixture(); await reconcile(f); const countBefore = f.calls.filter(c => c[0] === 'schedule').length;
  f.cancelFail = true; await assert.rejects(reconcile(f, { language: 'ar' })); assert.equal(f.calls.filter(c => c[0] === 'schedule').length, countBefore);
  f.cancelFail = false; await reconcile(f, { language: 'ar' }); assert.equal(f.pending.size, 7);
});
test('a failed time-change cancellation retains the old delivery reservation across its fire time', async () => {
  const f = fixture(); await reconcile(f); const [id, oldSignature] = [...f.pending][0]; const oldAt = JSON.parse(oldSignature).at;
  f.cancelFail = true;
  const changed = { habits: [habit('a', { reminder: { ...DEFAULT_REMINDER, enabled: true, time: '11:00' } })] };
  await assert.rejects(reconcile(f, changed)); assert.equal(JSON.parse(f.raw).issued[id].at, oldAt);
  f.pending.delete(id); f.cancelFail = false; const later = new Date(2026, 10, 15, 10); f.clock = +later;
  await reconcile(f, { ...changed, now: later }); assert.equal(f.pending.has(id), false);
});
test('failed scheduling keeps the durable reservation and retries once, without falsely reporting success', async () => {
  const f = fixture(); f.scheduleFail = true; await assert.rejects(reconcile(f)); assert.equal(f.pending.size, 0); assert.ok(Object.keys(JSON.parse(f.raw).issued).length);
  f.scheduleFail = false; await reconcile(f); await reconcile(f); assert.equal(f.pending.size, 7);
});
test('stale/pending/recovery generation guards can prevent all operations or stop after an awaited native call', async () => {
  const f = fixture(); assert.equal(await reconcile(f, {}, false, () => false), null); assert.equal(f.calls.length, 0);
  let checks = 0; await reconcile(f, {}, false, () => ++checks < 3); assert.equal(f.pending.size, 0); assert.equal(f.raw, null);
});
test('activity rescheduling cancels an old inactivity anchor and device config writes are save-first', async () => {
  const f = fixture(); await f.engine.saveSettings({ ...defaults, inactivity: true }); await reconcile(f);
  assert.equal([...f.pending.keys()].filter(id => id.includes('inactivity')).length, 1);
  const later = new Date(+now + 60000); f.clock = +later; await reconcile(f, { now: later }, true);
  assert.equal(JSON.parse(f.raw).lastActive, +later); assert.ok([...f.pending.keys()].filter(id => id.includes('inactivity')).every(id => id.endsWith(String(+later))));
  const saved = f.raw; f.writesFail = true; await assert.rejects(f.engine.saveSettings({ ...defaults, dailyCap: 6 })); assert.equal(f.raw, saved);
});
test('elapsed delivery ledger survives process restart and settings edits without replay', async () => {
  const f = fixture(); await reconcile(f); const raw = f.raw;
  const g = fixture(); g.raw = raw; g.clock = +new Date(2026, 10, 15, 10); await g.engine.saveSettings({ ...defaults, dailyCap: 6 });
  await reconcile(g, { now: new Date(2026, 10, 15, 10), habits: [habit('a', { reminder: { ...DEFAULT_REMINDER, enabled: true, time: '12:00' } })] });
  assert.ok([...g.pending.keys()].every(id => !id.includes('2026-11-15')));
});
test('a slow permission dialog refreshes wall time and never schedules an expired reminder immediately', async () => {
  const f = fixture(); f.driver.permission = async () => { f.clock = +new Date(2026, 10, 15, 10); return true; };
  await reconcile(f); assert.ok([...f.pending.keys()].every(id => !id.includes('2026-11-15'))); assert.equal(f.pending.size, 6);
});
test('queued device preference saves snapshot caller input at admission', async () => {
  const f = fixture(); const settings = { ...defaults, dailyCap: 4 }; const saved = f.engine.saveSettings(settings); settings.dailyCap = 6;
  assert.equal((await saved).settings.dailyCap, 4);
});

test('old v1/v2 habits load without automatic notes/reminder fields or new writes', async () => {
  storage.reset(); const old = tick('old'); const raw = JSON.stringify({ version: 2, habits: [old] }); storage.seed({ 'momentum:habits:v2': raw });
  const list = await loadHabits(); assert.equal(list[0].notes, undefined); assert.equal(list[0].reminder, undefined); assert.deepEqual(storage.writes(), []); assert.equal(storage.get('momentum:habits:v2'), raw);
  const { tracking: _tracking, ...v1 } = old; assert.deepEqual(parseStore(JSON.stringify({ version: 1, habits: [v1] }), 1)[0].tracking, { type: 'tick' });
});
test('notes preserve mixed-script multiline text and whitespace through draft, saved storage and reload', async () => {
  storage.reset(); const h = habit('notes', { description: 'Short', notes: '  تأملات شخصية\nMixed 🌿 notes\t  ' });
  const draft = habitToDraft(h); assert.equal(draft.notes, h.notes); assert.deepEqual(validateHabitDraft(draft), {});
  const saved = { ...h, ...draftToInput(draft) }; await saveHabits([saved]); const [loaded] = await loadHabits();
  assert.equal(loaded.notes, h.notes); assert.equal(loaded.description, 'Short'); assert.deepEqual(loaded.reminder, h.reminder);
  assert.equal(loaded.id, h.id); assert.equal(loaded.createdAt, h.createdAt);
});
test('notes validation bounds UI input without silently truncating records or rewriting old text', () => {
  const draft = { ...NEW_HABIT_DRAFT, name: 'Notes', notes: 'ن'.repeat(2000) }; assert.deepEqual(validateHabitDraft(draft), {});
  assert.ok(validateHabitDraft({ ...draft, notes: 'x'.repeat(2001) }).notes);
  assert.ok(validateHabitDraft({ ...draft, notes: 'hidden\0text' }).notes);
  assert.equal(validateHabitDraft({ ...draft, notes: 'line\nnext\tcolumn' }).notes, undefined);
  const h = habit('long', { notes: 'x'.repeat(2500) }); assert.equal(parseStore(JSON.stringify({ version: 2, habits: [h] }), 2)[0].notes.length, 2500);
  assert.equal(draftToInput({ ...draft, notes: '' }).notes, undefined);
  assert.throws(() => parseStore(JSON.stringify({ version: 2, habits: [habit('bad', { notes: 42 })] }), 2));
});
test('Arabic-Indic and Persian clock/numeric entry normalize only at the UI boundary to ASCII config', () => {
  assert.equal(normalizeNumericInput('٠٩:٣٥'), '09:35'); assert.equal(normalizeNumericInput('۱۸:۴۵'), '18:45');
  const r = { ...DEFAULT_REMINDER, time: normalizeNumericInput('۱۸:۴۵') }; assert.ok(validReminder(r)); assert.equal(JSON.parse(JSON.stringify(r)).time, '18:45');
});
test('backup v1 preserves new optional notes/reminders, old archives and exact other raw/history/preference records', async () => {
  const hash = async text => createHash('sha256').update(text).digest('hex');
  for (const addNotes of [false, true]) {
    const records = fullBackupRecords(); const original = structuredClone(records);
    if (addNotes) { const r = records.find(r => r.key === 'momentum:habits:v2'); const data = JSON.parse(r.raw); data.habits[0].notes = 'ملاحظات 🌿\nExact text'; data.habits[0].reminder = { ...DEFAULT_REMINDER, enabled: true }; r.raw = JSON.stringify(data); }
    const backup = await createBackup(records, hash); assert.equal(backup.backupVersion, 1); const parsed = await parseBackup(JSON.stringify(backup), hash); assert.equal(requireRestorable(parsed).restorable, true);
    assert.deepEqual(parsed.payload.records, records);
    for (const r of original.filter(r => r.key !== 'momentum:habits:v2')) assert.equal(parsed.payload.records.find(v => v.key === r.key).raw, r.raw);
    assert.equal(parseStore(parsed.payload.records.find(r => r.key === 'momentum:habits:v2').raw, 2)[0].notes, addNotes ? 'ملاحظات 🌿\nExact text' : undefined);
  }
  assert.throws(() => requireRestorable({ payload: { records: [{ key: NOTIFICATION_STATE_KEY, raw: '{}' }] } }));
});
test('native config adds only the essential notification plugin and no exact-alarm or cloud configuration', () => {
  const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
  assert.deepEqual(app.plugins.filter(p => Array.isArray(p) && p[0] === 'expo-notifications'), [['expo-notifications', { color: '#8B7CF6', enableRemoteNotifications: false }]]);
  assert.equal(app.android.package, 'com.beeviro1.momentum.dev'); assert.equal(app.scheme, 'momentum-dev');
  assert.equal(app.android.permissions, undefined); assert.equal(app.android.googleServicesFile, undefined);
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')); assert.equal(pkg.dependencies['expo-notifications'], '~58.1.9');
});
test('in-memory backup restore/recovery keeps exact notes, reminder settings and independent device preferences', async () => {
  const hash = async s => createHash('sha256').update(s).digest('hex'); const records = fullBackupRecords();
  const r = records.find(r => r.key === 'momentum:habits:v2'); const h = JSON.parse(r.raw); h.habits[0].notes = 'ملاحظات\nPrivate 🌿'; h.habits[0].reminder = { ...DEFAULT_REMINDER, enabled: true }; r.raw = JSON.stringify(h);
  const data = new Map(records.map(r => [r.key, r.raw])); data.set(NOTIFICATION_STATE_KEY, 'device state unchanged'); data.set('momentum:preferences:v1', 'presentation unchanged'); const disk = new Map();
  const barrier = createPersistenceCoordinator();
  const service = createBackupService({ getAllKeys: async () => [...data.keys()], multiGet: async keys => keys.map(k => [k, data.get(k) ?? null]), setItem: async (k, v) => { data.set(k, v); }, removeItem: async k => { data.delete(k); } },
    { list: async () => [...disk.keys()], read: async k => disk.get(k) ?? null, write: async (k, v) => { disk.set(k, v); }, remove: async k => { disk.delete(k); } }, hash, barrier);
  const exported = await service.exportBackup(); assert.equal(exported.backupVersion, 1); assert.deepEqual(exported.payload.records, records);
  await service.restore(JSON.stringify(await createBackup([], hash)), records);
  await service.restore(JSON.stringify(exported), []); assert.deepEqual(await service.capture(), records);
  barrier.freeze(); await service.recover(); barrier.release(); assert.equal(data.get(NOTIFICATION_STATE_KEY), 'device state unchanged'); assert.equal(data.get('momentum:preferences:v1'), 'presentation unchanged');
  assert.equal(parseStore(data.get('momentum:habits:v2'), 2)[0].notes, 'ملاحظات\nPrivate 🌿');
});
test('reviewed preservation updates permit only optional habit fields and the notification dependency/plugin', () => {
  const fixture = JSON.parse(readFileSync('tests/support/notifications-notes-preservation.json', 'utf8'));
  assert.equal(fixture.checkpoint, '254f052cdee0bd8ccda6ea34e01753a5634f01fe');
  assert.deepEqual(Object.keys(fixture.protectedFiles).sort(), ['app.json', 'package-lock.json', 'package.json', 'src/data/habit-storage.ts']);
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')); delete pkg.dependencies['expo-notifications']; assert.deepEqual(pkg, fixture.beforePackage);
  const app = JSON.parse(readFileSync('app.json', 'utf8')); app.expo.plugins = app.expo.plugins.filter(p => !Array.isArray(p) || p[0] !== 'expo-notifications'); assert.deepEqual(app, fixture.beforeApp);
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const unchanged = Object.fromEntries(Object.entries(lock.packages).filter(([k]) => k && !fixture.allowedLockChanges.includes(k)).sort(([a], [b]) => a.localeCompare(b)));
  assert.equal(createHash('sha256').update(JSON.stringify(unchanged)).digest('hex'), fixture.unchangedLockHash);
});
