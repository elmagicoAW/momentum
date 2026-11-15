import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadSource, hookHarness, settle } from './support/hook-harness.mjs';
import { deferred, tick } from './support/fixtures.mjs';
import { notificationsEn } from '../src/i18n/notifications-en.ts';
import { notificationsAr } from '../src/i18n/notifications-ar.ts';
import { signature, parseDeviceState } from '../src/notifications/engine.ts';
import { notificationTarget, PREFIX } from '../src/notifications/planner.ts';
import { toLocalDateKey } from '../src/utils/date.ts';
import { normalizeNumericInput } from '../src/i18n/format.ts';
import { Palettes } from '../src/constants/palettes.ts';
import { createFormNavigation } from '../src/utils/form-navigation.ts';
import { validSettings, DEFAULT_NOTIFICATION_SETTINGS } from '../src/notifications/model.ts';
const DARK_PALETTE = Palettes.dark, LIGHT_PALETTE = Palettes.light;

function nativeFixture({ granted = false, canAskAgain = true, importance = 3, platform = 'android' } = {}) {
  const calls = []; let permission = { granted, canAskAgain }; let handler;
  const n = { AndroidImportance: { NONE: 0, DEFAULT: 3 }, AndroidNotificationVisibility: { PRIVATE: 0 }, IosAuthorizationStatus: { PROVISIONAL: 3, EPHEMERAL: 4 }, SchedulableTriggerInputTypes: { DATE: 'date' },
    async setNotificationChannelAsync(id, data) { calls.push(['channel', id, data]); },
    async getNotificationChannelAsync() { return { importance }; },
    async setNotificationCategoryAsync(...args) { calls.push(['category', ...args]); },
    async getPermissionsAsync() { calls.push(['read']); return permission; },
    async requestPermissionsAsync() { calls.push(['ask']); return permission = { granted: true, canAskAgain: true }; },
    async getAllScheduledNotificationsAsync() { return [{ identifier: 'some', content: { data: { signature: 'sig' } } }]; },
    async cancelScheduledNotificationAsync(id) { calls.push(['cancel', id]); },
    async scheduleNotificationAsync(request) { calls.push(['schedule', request]); return request.identifier; },
    setNotificationHandler(value) { handler = value; },
  };
  const api = loadSource('src/notifications/native.ts', { 'react-native': { Platform: { OS: platform } }, 'expo-notifications': n,
    '@/i18n/notifications-en': { notificationsEn }, '@/i18n/notifications-ar': { notificationsAr }, './planner': { PREFIX }, './engine': { signature } });
  return { ...api, calls, get handler() { return handler; } };
}
test('native startup reads permission without prompting; explicit opt-in creates a channel before asking', async () => {
  const f = nativeFixture(); assert.equal(await f.nativeDriver.permission(false, 'en'), false); assert.equal(f.calls.some(c => c[0] === 'ask'), false);
  assert.equal(await f.nativeDriver.permission(true, 'ar'), true);
  assert.ok(f.calls.findIndex(c => c[0] === 'channel') < f.calls.findIndex(c => c[0] === 'ask'));
  assert.equal(f.calls.filter(c => c[0] === 'channel').at(-1)[2].name, 'تذكيرات العادات والتذكيرات اللطيفة');
  const categories = f.calls.filter(c => c[0] === 'category').slice(-2);
  assert.equal(categories[0][2][0].buttonTitle, 'فتح العادة'); assert.equal(categories[0][2][0].identifier, 'open');
  assert.equal(categories[0][2][0].options.opensAppToForeground, true);
  assert.equal(categories[1][2][0].buttonTitle, 'فتح اليوم');
});
test('native blocked channel and permanently denied permission never claim delivery or repeat the OS dialog', async () => {
  const channel = nativeFixture({ granted: true, importance: 0 }); assert.equal(await channel.nativeDriver.permission(true, 'en'), false); assert.ok(!channel.calls.some(c => c[0] === 'ask'));
  const blocked = nativeFixture({ canAskAgain: false }); assert.equal(await blocked.nativeDriver.permission(true, 'en'), false); assert.ok(!blocked.calls.some(c => c[0] === 'ask'));
  const web = nativeFixture({ platform: 'web' }); await assert.rejects(web.notificationModule(), /unavailable/); assert.equal(web.calls.length, 0);
});
test('native adapter uses owned one-off best-effort alarms and Open actions, without completion/backup mutations', async () => {
  const f = nativeFixture(); const p = { id: PREFIX + 'one', title: 'User habit', body: 'Gentle copy', date: '2026-11-15', at: 1794733200000, habitId: 'a', kind: 'habit' };
  await f.nativeDriver.schedule(p); const r = f.calls.at(-1)[1];
  assert.equal(r.identifier, p.id); assert.equal(r.trigger.type, 'date'); assert.equal(r.trigger.delivery, 'bestEffort'); assert.equal(+r.trigger.date, p.at); assert.equal(r.trigger.repeats, undefined);
  assert.equal(r.content.categoryIdentifier, 'momentum_habit'); assert.equal(r.content.data.owner, PREFIX);
  await f.nativeDriver.schedule({ ...p, habitId: undefined }); assert.equal(f.calls.at(-1)[1].content.categoryIdentifier, 'momentum_today');
  assert.deepEqual(await f.nativeDriver.list(), [{ id: 'some', signature: 'sig' }]); await f.nativeDriver.cancel(p.id); assert.deepEqual(f.calls.at(-1), ['cancel', p.id]);
  const source = readFileSync('src/notifications/native.ts', 'utf8'); assert.doesNotMatch(source, /getExpoPushToken|getDevicePushToken|saveDay|saveHabits|cancelAllScheduled/);
});

function providerFixture(t) {
  const h = hookHarness(); const calls = []; let nativeResponse; let appChange; let minute; let responseHandler; let foregroundHandler; let load = async () => ({ entries: {} });
  let pending = false; let revision = 0; let ready = true; let frozen = false; let generation = 0; let askFailure = false; let prefsReady = true;
  const visits = []; let tabAction; const state = parseDeviceState(null, Date.now());
  const habits = [tick('a')]; const hab = { habits, status: 'ready', savedSnapshot: () => ({ habits: hab.habits, ready: hab.status === 'ready' }) };
  const daily = { dateKey: toLocalDateKey(new Date()), status: 'ready', drainRevision: 0, persistence: { snapshot: () => ({ pending, revision }) } };
  const AppState = { currentState: 'active', addEventListener: (_name, fn) => { appChange = fn; return { remove() { calls.push('unsubscribe app'); } }; } };
  t.mock.method(globalThis, 'setInterval', fn => { minute = fn; return 123; }); t.mock.method(globalThis, 'clearInterval', () => { calls.push('clear timer'); });
  const engine = { load: async () => state, saveSettings: async settings => ({ ...state, settings }), reconcile: async (input, active, valid, ask) => {
    if (!valid()) return null; calls.push({ input, active, ask }); if (askFailure) throw Error('missing native'); return { state, allowed: true };
  } };
  const api = loadSource('src/hooks/use-notifications.tsx', {
    react: { ...h.react, createContext: () => ({ Provider: 'Provider' }) }, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '@react-native-async-storage/async-storage': {}, 'react-native': { AppState },
    'expo-router': { router: { push: target => visits.push(target) }, useRootNavigationState: () => ({ key: 'ready' }) },
    './use-habits': { useHabits: () => hab }, './use-daily-progress': { useDailyProgress: () => daily },
    './use-data-backup': { useDataBackup: () => ({ busy: !ready }) }, './use-preferences': { usePreferences: () => ({ status: prefsReady ? 'ready' : 'loading' }) }, './use-presentation-language': { usePresentationLanguage: () => 'en' },
    '@/data/persistence-coordinator': { persistence: { generation: () => generation, available: () => !frozen, run: fn => fn() } },
    '@/data/completion-storage': { loadDay: async () => { calls.push('read saved day'); return load(); } }, '@/utils/date': { toLocalDateKey },
    '@/utils/form-navigation': { formNavigation: { requestTab: action => { tabAction = action; } } },
    '@/notifications/engine': { createNotificationEngine: () => engine }, '@/notifications/model': {}, '@/notifications/planner': { notificationTarget, PREFIX },
    '@/notifications/native': { nativeDriver: {}, notificationModule: async () => ({ setNotificationHandler: handler => { foregroundHandler = handler; }, addNotificationResponseReceivedListener: fn => { responseHandler = fn; return { remove() { calls.push('unsubscribe tap'); } }; }, getLastNotificationResponse: () => nativeResponse ?? null, clearLastNotificationResponse: () => { calls.push('clear response'); } }) },
  });
  const render = () => h.render(() => api.NotificationsProvider({ children: 'app' })).props.value;
  return { h, calls, hab, daily, AppState, render, visits, get tabAction() { return tabAction; }, get foregroundHandler() { return foregroundHandler; },
    response(r) { responseHandler(r); }, minute: () => minute(), appChange: () => appChange(),
    set pending(v) { pending = v; }, set revision(v) { revision = v; }, set ready(v) { ready = v; }, set frozen(v) { frozen = v; }, set generation(v) { generation = v; }, set prefsReady(v) { prefsReady = v; },
    set load(v) { load = v; }, set nativeResponse(v) { nativeResponse = v; }, set askFailure(v) { askFailure = v; } };
}
test('provider waits for hydration/recovery and never reads optimistic or failed/pending writes as saved completion', async t => {
  const f = providerFixture(t); f.pending = true; f.render(); await settle(); assert.equal(f.calls.includes('read saved day'), false);
  f.pending = false; f.daily.drainRevision++; f.render(); await settle(); assert.ok(f.calls.includes('read saved day')); assert.equal(f.calls.filter(c => c.input).length, 1);
  f.ready = false; f.render(); await f.render().retry(); assert.equal(f.calls.filter(c => c.input).length, 1);
  f.ready = true; f.prefsReady = false; f.render(); await f.render().retry(); assert.equal(f.calls.filter(c => c.input).length, 1);
  f.prefsReady = true; f.frozen = true; f.render(); await f.render().retry(); assert.equal(f.calls.filter(c => c.input).length, 1); f.h.unmount();
});
test('provider discards saved-day reads after a new pending write, changed habits, changed generation or unmount', async t => {
  for (const stale of ['pending', 'habits', 'generation', 'unmount']) {
    const f = providerFixture(t); const wait = deferred(); f.load = () => wait.promise; f.render(); await settle();
    if (stale === 'pending') f.pending = true;
    if (stale === 'habits') f.hab.habits = [...f.hab.habits];
    if (stale === 'generation') f.generation = 1;
    if (stale === 'unmount') f.h.unmount();
    wait.resolve({ entries: {} }); await settle(); assert.equal(f.calls.filter(c => c.input).length, 0, stale); f.h.unmount();
  }
});
test('resume, minute clock/timezone detection and completed-day drains all reconcile saved snapshots', async t => {
  const f = providerFixture(t); f.render(); await settle(); let count = f.calls.filter(c => c.input).length;
  f.minute(); await settle(); assert.equal(f.calls.filter(c => c.input).length, ++count);
  f.AppState.currentState = 'background'; f.appChange(); await settle(); assert.equal(f.calls.filter(c => c.input).length, ++count); assert.equal(f.calls.filter(c => c.input).at(-1).active, false);
  f.AppState.currentState = 'active'; f.appChange(); await settle(); assert.equal(f.calls.filter(c => c.input).length, ++count);
  f.revision = 1; f.daily.drainRevision++; f.render(); await settle(); assert.equal(f.calls.filter(c => c.input).length, ++count);
  f.h.unmount(); assert.ok(f.calls.includes('unsubscribe app')); assert.ok(f.calls.includes('clear timer'));
});
test('cold and warm notification taps wait for readiness, use form protection and consume duplicate actions once', async t => {
  const f = providerFixture(t); f.ready = false;
  const response = { actionIdentifier: 'open', notification: { request: { identifier: PREFIX + 'a', content: { data: { owner: PREFIX, habitId: 'a' } } } } };
  f.nativeResponse = response; f.render(); await settle(); f.render(); assert.equal(f.tabAction, undefined);
  f.ready = true; f.render(); await settle(); f.render(); assert.ok(f.tabAction); assert.equal(f.visits.length, 0, 'no navigation behind the form guard');
  f.tabAction(); assert.deepEqual(f.visits[0], { pathname: '/(tabs)/habits/[id]', params: { id: 'a' } });
  const firstAction = f.tabAction; f.response({ ...response, actionIdentifier: 'expo.modules.notifications.actions.DEFAULT' }); f.render(); assert.equal(f.tabAction, firstAction);
  f.hab.habits = []; f.response({ ...response, notification: { request: { ...response.notification.request, identifier: PREFIX + 'deleted' } } }); f.render(); f.tabAction(); assert.equal(f.visits.at(-1), '/(tabs)'); f.h.unmount();
});
test('foreground handler suppresses owned reminders over active app only; native failure remains visible and retryable', async t => {
  const f = providerFixture(t); f.render(); await settle();
  const owned = { request: { content: { data: { owner: PREFIX } } } }; assert.equal((await f.foregroundHandler.handleNotification(owned)).shouldShowBanner, false);
  f.AppState.currentState = 'background'; assert.equal((await f.foregroundHandler.handleNotification(owned)).shouldShowBanner, true);
  f.AppState.currentState = 'active'; assert.equal((await f.foregroundHandler.handleNotification({ request: { content: { data: {} } } })).shouldShowBanner, true);
  f.askFailure = true; await f.render().retry(true); assert.equal(f.render().error, true);
  f.askFailure = false; await f.render().retry(); assert.equal(f.render().error, false); f.h.unmount();
});

test('new numeric controls render localized digits in both palettes and normalize Persian/Arabic input before state', () => {
  for (const language of ['en', 'ar']) for (const palette of [DARK_PALETTE, LIGHT_PALETTE]) {
    let edited; const controls = loadSource('src/components/notifications/controls.tsx', {
      'react-native': { StyleSheet: { create: s => s }, View: 'View', Pressable: 'Pressable' }, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
      '@/components/localized-native': { Text: 'Text', TextInput: 'TextInput' }, '@/hooks/use-app-styles': { useAppStyles: fn => ({ language, scheme: palette === LIGHT_PALETTE ? 'light' : 'dark', styles: fn(palette) }) },
      '@/i18n/format': { normalizeNumericInput }, '@/i18n/app-copy': { appLabel: key => key },
    });
    const field = controls.NumericField({ label: 'clock', value: '09:35', time: true, onChange: v => { edited = v; } }).props.children[1];
    assert.equal(field.props.value, language === 'ar' ? '٠٩:٣٥' : '09:35'); assert.equal(field.props.style.color, palette.text); assert.equal(field.props.style.direction, 'ltr');
    field.props.onChangeText('۱۸:۴۵'); assert.equal(edited, '18:45');
    const toggle = controls.Toggle({ label: 'toggle', value: true, disabled: true, onChange() {} }); assert.equal(toggle.props.disabled, true); assert.equal(toggle.props.accessibilityState.checked, true);
  }
});
test('new notes/reminder controls share the existing draft guard and retain palette/locale presentation boundaries', () => {
  const form = readFileSync('src/components/habits/habit-form.tsx', 'utf8');
  assert.match(form, /useFormNavigation\(JSON.stringify\(draft\) !== JSON.stringify\(originalDraft\)/);
  assert.match(form, /value=\{draft.notes \?\? ''\}/); assert.match(form, /onChangeText=\{text => update\('notes', text\)\}/);
  assert.match(form, /onChange=\{reminder => update\('reminder', reminder\)\}/);
  const provider = readFileSync('src/hooks/use-notifications.tsx', 'utf8'); const ast = ts.createSourceFile('p.tsx', provider, 99, true, 4);
  assert.ok(ast.parseDiagnostics.length === 0); assert.doesNotMatch(provider, /toggleTick|adjustCount|toggleStep|saveDay|saveHabits|restore\(/);
  assert.ok(readFileSync('src/app/(tabs)/settings.tsx', 'utf8').includes("router.push('/notifications')"));
});
test('notification preference form protects drafts, validates ranges and waits for a successful persisted save', async () => {
  const h = hookHarness(); let answer = false; let exits = 0; let operation = deferred(); let calls = 0; let nav;
  const jsx = (type, props) => ({ type, props });
  const flatten = v => Array.isArray(v) ? v.flatMap(flatten) : v && typeof v === 'object' ? [v, ...flatten(v.props?.children)] : [];
  const useGuard = (dirty, close) => {
    const [guard] = h.react.useState(() => createFormNavigation({ confirm: async () => answer, disable() {}, changed() {} }));
    h.react.useLayoutEffect(() => { guard.setDirty(dirty); }, [guard, dirty]);
    h.react.useLayoutEffect(() => { guard.mount(); return () => guard.dispose(); }, [guard]);
    nav = guard;
    return { ...guard, request: () => { void guard.request(close); }, finish: () => guard.finish(close) };
  };
  const api = loadSource('src/app/notifications.tsx', {
    react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'expo-router': { router: { canGoBack: () => true, back: () => exits++ } },
    'react-native': { View: 'View', ScrollView: 'ScrollView', StyleSheet: { create: s => s } }, 'react-native-safe-area-context': { SafeAreaView: 'Safe' },
    '@/components/localized-native': { Text: 'Text' }, '@/components/notifications/controls': { Toggle: 'Toggle', NumericField: 'Numeric', NotificationButton: 'Button', NotificationCopy: 'Copy' },
    '@/components/notifications/permission-notice': { PermissionNotice: 'Permission' }, '@/hooks/use-notifications': { useNotifications: () => ({ state: { settings: DEFAULT_NOTIFICATION_SETTINGS }, save: async () => { calls++; await operation.promise; } }) },
    '@/hooks/use-form-navigation': { useFormNavigation: useGuard }, '@/hooks/use-data-backup': { useDataBackup: () => ({ busy: false }) },
    '@/hooks/use-app-styles': { useAppStyles: fn => ({ styles: fn(Palettes.dark) }) }, '@/i18n/app-copy': { appLabel: key => key },
    '@/notifications/model': { validSettings }, '@/constants/theme': { MaxContentWidth: 700 },
  });
  const form = flatten(api.default()).find(n => n.props?.initial);
  const render = () => flatten(h.render(() => form.type(form.props)));
  const find = (nodes, label) => nodes.find(n => n.props?.label === label);
  let nodes = render(); find(nodes, 'notifications.cap').props.onChange('0'); nodes = render(); assert.equal(nav.protected(), true);
  find(nodes, 'notifications.save').props.onPress(); await settle(); assert.equal(calls, 0); assert.equal(exits, 0);
  find(nodes, 'habits.habit-form.cancel').props.onPress(); await settle(); assert.equal(exits, 0);
  find(nodes, 'notifications.cap').props.onChange('4'); nodes = render(); find(nodes, 'notifications.save').props.onPress(); nodes = render();
  assert.equal(calls, 1); assert.ok(find(nodes, 'notifications.cap').props.disabled); find(nodes, 'notifications.save').props.onPress(); assert.equal(calls, 1);
  operation.reject(Error('disk failed')); await settle(); nodes = render(); assert.equal(exits, 0); assert.equal(find(nodes, 'notifications.cap').props.value, '4'); assert.equal(nav.protected(), true);
  operation = deferred(); find(nodes, 'notifications.save').props.onPress(); operation.resolve(); await settle(); assert.equal(exits, 1); h.unmount();
});
