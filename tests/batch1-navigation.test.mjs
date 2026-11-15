import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createFormNavigation, formNavigation } from '../src/utils/form-navigation.ts';
import { deferred } from './support/fixtures.mjs';
import { hookHarness, loadSource, settle } from './support/hook-harness.mjs';

test('Cancel/Back/tab exit share one confirmation; rejection retains guard and approval replays once', async () => {
  let confirmation = deferred(); let asks = 0; let disables = 0; const actions = [];
  const guard = createFormNavigation({ confirm: () => { asks++; return confirmation.promise; }, disable: () => disables++, changed() {} });
  guard.setDirty(true);
  const first = guard.request(() => actions.push('back'));
  await guard.request(() => actions.push('tab'));
  assert.equal(asks, 1); assert.equal(guard.begin(), false, 'cannot save behind a discard dialog');
  confirmation.resolve(false); await first;
  assert.deepEqual(actions, []); assert.equal(guard.protected(), true);
  confirmation = deferred(); const approved = guard.request(() => actions.push('cancel'));
  confirmation.resolve(true); await approved;
  assert.deepEqual(actions, ['cancel']); assert.equal(disables, 1); assert.equal(guard.protected(), false);
  await guard.request(() => actions.push('duplicate')); assert.deepEqual(actions, ['cancel']);
});

test('saving/deleting lock even clean forms synchronously; failures reopen; success and stale completion are safe', async () => {
  let disables = 0; let exits = 0;
  const guard = createFormNavigation({ confirm: async () => true, disable: () => disables++, changed() {} });
  assert.equal(guard.begin(), true); assert.equal(guard.begin(), false);
  assert.equal(guard.protected(), true);
  await guard.request(() => exits++); assert.equal(exits, 0);
  guard.failed(); assert.equal(guard.protected(), false);
  guard.setDirty(true); guard.begin(); guard.finish(() => exits++);
  assert.equal(exits, 1); assert.equal(disables, 1);
  const stale = createFormNavigation({ confirm: async () => true, disable: () => disables++, changed() {} });
  stale.begin(); stale.dispose(); stale.finish(() => exits++);
  assert.equal(exits, 1, 'unmounted operation must not navigate');
});

test('discard result after unmount never navigates, and registry cleanup cannot remove a newer form', async () => {
  const confirm = deferred(); let exits = 0;
  const first = createFormNavigation({ confirm: () => confirm.promise, disable() {}, changed() {} }); first.setDirty(true);
  const removeFirst = formNavigation.register(first, action => { void first.request(action); });
  formNavigation.requestTab(() => exits++); first.dispose(); removeFirst();
  const second = createFormNavigation({ confirm: async () => false, disable() {}, changed() {} }); second.setDirty(true);
  const removeSecond = formNavigation.register(second, () => {}); removeFirst();
  assert.equal(formNavigation.protected(), true); confirm.resolve(true); await settle(); assert.equal(exits, 0);
  removeSecond(); assert.equal(formNavigation.protected(), false);
});

test('actual hook wires removal replay, focused tab exit, busy blocking and cleanup', async () => {
  const runner = hookHarness(); let dirty = true; let removal; let disabled = 0; let closed = 0; let tab = 0;
  let answer = false;
  const { useFormNavigation } = loadSource('src/hooks/use-form-navigation.ts', {
    react: runner.react,
    'expo-router': {
      useFocusEffect: callback => runner.react.useEffect(callback, [callback]),
      usePreventRemove: (prevent, callback) => { removal = { prevent, callback }; return () => disabled++; },
    },
    '@/i18n/app-copy': { appLabel: key => key }, '@/utils/confirm': { confirmDestructive: async () => answer },
    '@/utils/form-navigation': { createFormNavigation, formNavigation },
  });
  let nav = runner.render(() => useFormNavigation(dirty, () => closed++));
  assert.equal(removal.prevent, true);
  removal.callback({ repeat: () => closed++ }); await settle(); runner.render(); assert.equal(closed, 0);
  assert.equal(nav.begin(), true); nav = runner.render();
  formNavigation.requestTab(() => tab++); await settle(); assert.equal(tab, 0);
  nav.failed(); runner.render(); answer = true;
  formNavigation.requestTab(() => tab++); await settle(); runner.render();
  assert.equal(closed, 1); assert.equal(tab, 1); assert.equal(disabled, 1); assert.equal(removal.prevent, false);
  runner.unmount(); assert.equal(formNavigation.protected(), false);
  dirty = false;
});

const jsx = (type, props) => ({ type, props });
const tree = value => Array.isArray(value) ? value.flatMap(tree) : value && typeof value === 'object' ? [value, ...tree(value.props?.children)] : [];
function componentMocks(file, overrides) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), 99, true, 4);
  const mocks = {};
  for (const statement of source.statements) if (ts.isImportDeclaration(statement)) {
    mocks[statement.moduleSpecifier.text] = new Proxy({}, { get: () => () => undefined });
  }
  return Object.assign(mocks, overrides);
}

for (const kind of ['habit', 'goal', 'routine']) test(`${kind} form waits for mutation before leaving; rapid taps, rejected/deferred saves and deletes retain safe navigation`, async () => {
  const file = `src/components/${kind}s/${kind}-form.tsx`; const runner = hookHarness();
  let operation = deferred(); let calls = 0; let exits = 0; let active = true; let entered = false;
  const navigation = {
    begin: () => { if (entered) return false; entered = true; return true; },
    active: () => active, failed: () => { entered = false; },
    finish: (action = () => exits++) => { if (active) action(); }, request() {},
  };
  const named = kind[0].toUpperCase() + kind.slice(1) + 'Form';
  const mocks = componentMocks(file, {
    react: runner.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { StyleSheet: { create: s => s }, View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView' },
    '@/hooks/use-form-navigation': { useFormNavigation: () => navigation },
    '@/hooks/use-arabic-composition': { useArabicComposition: () => ({ active: false }) },
    '@/hooks/use-app-styles': { useAppStyles: () => ({ palette: {}, styles: {}, scheme: 'dark' }) },
    '@/hooks/use-habits': { useHabits: () => ({ habits: [], status: 'ready' }) },
    '@/i18n/app-copy': { appLabel: key => key, appMessage: key => key, displayError: (_error, fallback) => fallback },
    [`@/utils/${kind}-validation`]: {
      validateHabitDraft: () => ({}), validateGoalDraft: () => ({}), validateRoutineDraft: () => ({}),
      hasErrors: () => false, hasGoalErrors: () => false, hasRoutineErrors: () => false,
      draftToInput: value => value, goalDraftToInput: value => value, routineDraftToInput: value => value,
    },
  });
  const Form = loadSource(file, mocks)[named];
  const draft = { name: '', title: '', description: '', habitIds: [], scheduleKind: 'daily', days: [], trackingType: 'tick', steps: [] };
  const props = { initialDraft: draft, submitLabel: 'SAVE', todayKey: '2026-11-15', onCancel: () => exits++, onDeleted: () => exits++,
    onSubmit: async () => { calls++; await operation.promise; }, onDelete: async () => { calls++; await operation.promise; return true; } };
  const render = () => runner.render(() => Form(props));
  const button = (body, type) => tree(body).find(n => n.props?.onPress && tree(n).some(child => type === 'save' ? child.props?.children === 'SAVE' : String(child.props?.children).includes('delete')));
  let body = render(); const save = button(body, 'save'); assert.ok(save, `${kind} save control`);
  const saving = save.props.onPress(); save.props.onPress(); assert.equal(calls, 1, 'same-frame duplicate locked synchronously');
  operation.reject(Error('synthetic save failure')); await saving; body = render(); assert.equal(exits, 0);
  operation = deferred(); const deletingFailed = button(body, 'delete').props.onPress();
  assert.equal(calls, 2); operation.reject(Error('synthetic delete failure')); await deletingFailed;
  body = render(); assert.equal(exits, 0, 'delete failure retains editor');
  operation = deferred(); const retry = button(body, 'save').props.onPress(); operation.resolve(); await retry; assert.equal(exits, 1);
  runner.unmount();
});

for (const kind of ['habit', 'goal', 'routine']) test(`${kind} draft changes/reverts, canceled deletion and late save/delete completion execute without losing edits or stealing navigation`, async () => {
  for (const action of ['save', 'delete', 'save-success', 'delete-success']) {
    const runner = hookHarness(); const file = `src/components/${kind}s/${kind}-form.tsx`;
    let dirty; let active = true; let exits = 0; let entered = false; let cancelDelete = true;
    const operation = deferred();
    const navigation = { begin: () => { if (entered) return false; entered = true; return true; }, active: () => active,
      failed: () => { entered = false; }, finish: (exit = () => exits++) => exit(), request: () => {} };
    const mocks = componentMocks(file, {
      react: runner.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
      'react-native': { StyleSheet: { create: s => s }, View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView' },
      '@/hooks/use-form-navigation': { useFormNavigation: changed => { dirty = changed; return navigation; } },
      '@/hooks/use-arabic-composition': { useArabicComposition: () => ({ active: false }) },
      '@/hooks/use-app-styles': { useAppStyles: () => ({ palette: {}, styles: {}, scheme: 'light' }) },
      '@/hooks/use-habits': { useHabits: () => ({ habits: [], status: 'ready' }) },
      '@/components/localized-native': { TextInput: 'Input', Text: 'Text' },
      '@/i18n/app-copy': { appLabel: key => key, appMessage: key => key, displayError: (_e, f) => f },
      [`@/utils/${kind}-validation`]: { validateHabitDraft: () => ({}), validateGoalDraft: () => ({}), validateRoutineDraft: () => ({}),
        hasErrors: () => false, hasGoalErrors: () => false, hasRoutineErrors: () => false,
        draftToInput: v => v, goalDraftToInput: v => v, routineDraftToInput: v => v },
    });
    const Form = loadSource(file, mocks)[kind[0].toUpperCase() + kind.slice(1) + 'Form'];
    const props = { initialDraft: { name: '', title: '', description: '', habitIds: [], steps: [], days: [], scheduleKind: 'daily', trackingType: 'tick' },
      submitLabel: 'SAVE', onCancel() {}, onDeleted: () => { exits++; }, onSubmit: () => operation.promise,
      onDelete: () => cancelDelete ? Promise.resolve(false) : operation.promise.then(() => true) };
    const render = () => runner.render(() => Form(props));
    let body = render(); assert.equal(dirty, false);
    const input = tree(body).find(n => n.type === 'Input'); assert.ok(input);
    input.props.onChangeText('Changed'); body = render(); assert.equal(dirty, true);
    tree(body).find(n => n.type === 'Input').props.onChangeText(''); body = render(); assert.equal(dirty, false);
    const find = type => tree(body).find(n => n.props?.onPress && tree(n).some(child => type === 'save' ? child.props?.children === 'SAVE' : String(child.props?.children).includes('delete')));
    await find('delete').props.onPress(); body = render(); assert.equal(entered, false, 'canceled confirmation unlocks'); assert.equal(exits, 0);
    cancelDelete = false; const running = find(action.startsWith('save') ? 'save' : 'delete').props.onPress();
    if (!action.endsWith('success')) { active = false; runner.unmount(); }
    operation.resolve(); await running;
    assert.equal(exits, action.endsWith('success') ? 1 : 0, `${action} completion navigates only while mounted`);
    runner.unmount();
  }
});

test('all six route mutation callbacks leave navigation to guarded forms; routine deletion keeps its original destination', () => {
  for (const file of ['src/app/(tabs)/habits/new.tsx', 'src/app/(tabs)/habits/[id].tsx', 'src/app/(tabs)/goals/new.tsx', 'src/app/(tabs)/goals/[id].tsx', 'src/app/routine/new.tsx', 'src/app/routine/edit/[id].tsx']) {
    const source = readFileSync(file, 'utf8'); const ast = ts.createSourceFile(file, source, 99, true, 4);
    let callbacks = 0;
    function visit(node) {
      if (ts.isJsxAttribute(node) && ['onSubmit', 'onDelete'].includes(node.name.getText(ast))) {
        callbacks++;
        assert.doesNotMatch(node.getText(ast), /close(?:HabitEditor|GoalEditor|RoutineEditor|AfterRoutineDeleted)\(\)/, file);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast); assert.ok(callbacks > 0, file);
    if (file.includes('routine/edit')) assert.match(source, /onDeleted=\{closeAfterRoutineDeleted\}/);
  }
});

test('native tabs disable all triggers and replay only prevented presses; web intercepts before selecting', () => {
  let protectedForm = true; let request; const visits = [];
  const Trigger = () => {}; Trigger.Label = 'Label'; Trigger.Icon = 'Icon';
  const NativeTabs = () => {}; NativeTabs.Trigger = Trigger;
  const { default: AppTabs } = loadSource('src/components/app-tabs.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/hooks/use-app-theme': { useAppTheme: () => ({ palette: {}, scheme: 'light' }) },
    '@/hooks/use-language': { useLanguage: () => ({ t: key => key, direction: 'rtl' }) },
    'expo-router/native-tabs': { NativeTabs }, 'expo-router': { router: { navigate: href => visits.push(href) } },
    '@/hooks/use-form-navigation': { useFormTabProtection: () => protectedForm },
    '@/utils/form-navigation': { formNavigation: { requestTab: action => { request = action; } } },
  });
  const triggers = AppTabs().props.children;
  assert.equal(triggers.length, 5); assert.ok(triggers.every(n => n.props.disabled));
  triggers[2].props.listeners.tabPress({ data: { isPrevented: false } }); assert.equal(request, undefined);
  triggers[2].props.listeners.tabPress({ data: { isPrevented: true } }); assert.deepEqual(visits, []);
  request(); assert.deepEqual(visits, ['/goals']); protectedForm = false;
  assert.ok(AppTabs().props.children.every(n => !n.props.disabled));
  const webFile = 'src/components/app-tabs.web.tsx';
  const web = loadSource(webFile, componentMocks(webFile, {
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { StyleSheet: { create: s => s } },
    'expo-router': { router: { navigate: href => visits.push(href) } },
    '@/utils/form-navigation': { formNavigation: { protected: () => true, requestTab: action => { request = action; } } },
  }));
  let prevented = false; let direct = false;
  web.TabButton({ destination: '/settings', onPress: () => { direct = true; } }).props.onPress({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true); assert.equal(direct, false); request(); assert.equal(visits.at(-1), '/settings');
});
