import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { loadSource, hookHarness } from './support/hook-harness.mjs';
import { tick, count } from './support/fixtures.mjs';
import { Palettes } from '../src/constants/palettes.ts';
import { todayCopy, todayRich, todaySchedule, todayAchievementProgress, todayBadgeName } from '../src/i18n/today.ts';
import { arabicTodayProgress } from '../src/utils/today-presentation.ts';
import { arabicComposition } from '../src/utils/arabic-composition.ts';
import * as progress from '../src/utils/habit-progress.ts';
import { ACHIEVEMENTS } from '../src/data/achievement-definitions.ts';
import { hasProvisionalEffort } from '../src/utils/achievements.ts';

const jsx = (type, props) => ({ type, props });
const flat = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : [];
const constants = { Spacing: { one: 4, two: 8, three: 16, four: 24, five: 32 }, Radius: {}, BottomTabInset: 80, MaxContentWidth: 800 };
const native = { StyleSheet: { create: value => value, absoluteFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } }, View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView' };
function mocksFor(file, overrides) {
  const tree = ts.createSourceFile(file, readFileSync(file, 'utf8'), 99, true, 4);
  const mocks = {};
  for (const node of tree.statements) if (ts.isImportDeclaration(node)) mocks[node.moduleSpecifier.text] = new Proxy({}, { get: () => () => undefined });
  return { ...mocks, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    '@/components/localized-native': { Text: 'Text', SymbolView: 'Symbol' },
    '@/constants/theme': constants, '@/components/stable-text': { StableText: 'StableText' }, ...overrides };
}
const stylesFor = palette => ({ useAppStyles: factory => ({ palette, styles: factory(palette) }) });

test('Arabic Today keeps ring-first English structure/proportions at ordinary widths, with explicit RTL and a genuine compact fallback', () => {
  const runner = hookHarness(); let language = 'ar'; let fontScale = 1;
  const habit = tick('h'); let record = { entries: {} }; let saveState = 'idle';
  const file = 'src/app/(tabs)/index.tsx';
  const { default: Today } = loadSource(file, mocksFor(file, {
    react: runner.react,
    'react-native': { ...native, useWindowDimensions: () => ({ fontScale }) },
    '@/hooks/use-arabic-composition': { useArabicComposition: () => ({ ...arabicComposition(360, fontScale), active: language === 'ar' }) },
    '@/utils/today-presentation': { arabicTodayProgress },
    '@/hooks/use-app-styles': stylesFor(Palettes.dark),
    '@/hooks/use-language': { useLanguage: () => ({ language }) },
    '@/i18n/today': { todayCopy, todayRich, todayDate: () => '', todayGreeting: () => '', todayMotivation: () => ({ quote: '', author: '' }) },
    '@/hooks/use-current-date': { useCurrentDate: () => new Date(2026, 10, 15) },
    '@/hooks/use-greeting-date': { useGreetingDate: () => new Date(2026, 10, 15) },
    '@/hooks/use-daily-progress': { useDailyProgress: () => ({ dateKey: '2026-11-15', record, status: 'ready', canEdit: true, saveState }) },
    '@/hooks/use-habits': { useHabits: () => ({ habits: [habit], status: 'ready' }) },
    '@/hooks/use-routines': { useRoutines: () => ({ routines: [], status: 'ready' }) },
    '@/hooks/use-profile': { useProfile: () => ({ profile: {}, status: 'ready' }) },
    '@/utils/date': { parseLocalDateKey: () => new Date(2026, 10, 15) },
    '@/utils/habit-progress': progress, '@/utils/schedule': { isScheduledOn: () => true },
    '@/utils/routine-progress': { planForDay: () => ({}) },
    '@/components/today/progress-ring': { ProgressRing: 'Ring' },
    '@/components/today/progress-notices': { ProgressNotices: 'Notices', saveLabel: state => state === 'idle' ? null : todayCopy(language).t(state === 'saving' ? 'common.saving' : 'today.saved') },
  }));
  const card = body => nodes(body).find(node => node.props?.onLayout);
  const initial = card(runner.render(Today));
  assert.equal(flat(initial.props.style).flexDirection, 'row', 'no startup stack-to-row jump');
  initial.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
  let body = runner.render(); let arCard = card(body);
  const ring = nodes(arCard.props.children[0]).find(node => node.type === 'Ring');
  assert.equal(ring.props.size, 148); assert.equal(ring.props.strokeWidth, undefined, 'same 12dp default as English');
  assert.equal(flat(arCard.props.style).padding, 20); assert.equal(flat(arCard.props.style).gap, 24);
  assert.equal(flat(arCard.props.style).direction, 'rtl'); assert.equal(flat(arCard.props.style).flexDirection, 'row');
  const text = arCard.props.children[1]; assert.equal(text.props.children[0].props.children, todayCopy('ar').t('today.dailyProgress'));
  const status = nodes(body).find(node => node.type === 'StableText' && node.props.accessibilityLiveRegion === 'polite');
  const statusAlternatives = status.props.alternatives;
  const progressAlternatives = nodes(arCard).filter(node => node.type === 'StableText').map(node => node.props.alternatives);
  for (const state of ['saving', 'saved', 'saving', 'saved']) {
    saveState = state; body = runner.render();
    assert.deepEqual(nodes(body).find(node => node.type === 'StableText' && node.props.accessibilityLiveRegion === 'polite').props.alternatives, statusAlternatives);
  }
  record = { entries: { h: { type: 'tick', done: true } } }; body = runner.render();
  assert.deepEqual(nodes(card(body)).filter(node => node.type === 'StableText').map(node => node.props.alternatives), progressAlternatives, 'progress height budget does not depend on completion');
  card(body).props.onLayout({ nativeEvent: { layout: { width: 280 } } });
  assert.equal(flat(card(runner.render()).props.style).flexDirection, 'column');
  card(runner.render()).props.onLayout({ nativeEvent: { layout: { width: 350 } } });
  fontScale = 1.6; assert.equal(flat(card(runner.render()).props.style).flexDirection, 'column');
  language = 'en'; body = runner.render();
  const enRing = nodes(body).find(node => node.type === 'Ring');
  assert.equal(enRing.props.size, undefined); assert.equal(enRing.props.strokeWidth, undefined);
  const enCard = nodes(body).find(node => Array.isArray(node.props?.children) && node.props.children[0]?.type === 'Ring');
  assert.equal(flat(enCard.props.style).padding, 20); assert.equal(flat(enCard.props.style).gap, 24);
  runner.unmount();
});

test('stable copy measures alternatives at equal width, takes their maximum height, and hides only reservation text from accessibility', () => {
  const { StableText } = loadSource('src/components/stable-text.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native, '@/components/localized-native': { Text: 'Text' },
  });
  const alternatives = ['Short', 'A considerably longer status'];
  for (const visible of [true, false]) {
    const body = StableText({ children: 'Current', alternatives, textStyle: { fontSize: 14 }, visible, accessibilityLiveRegion: 'polite' });
    const [reservation, display] = body.props.children;
    assert.equal(reservation.props.importantForAccessibility, 'no-hide-descendants');
    assert.equal(reservation.props.accessibilityElementsHidden, true); assert.equal(reservation.props.pointerEvents, 'none');
    assert.equal(reservation.props.style.flexDirection, 'row'); assert.equal(reservation.props.style.opacity, 0);
    assert.ok(reservation.props.children.every(node => node.props.style.width === '100%' && node.props.style.flexShrink === 0));
    assert.equal(flat(display.props.style).position, 'absolute'); assert.equal(display.props.children, 'Current');
    assert.equal(display.props.accessibilityElementsHidden, !visible);
    assert.equal(display.props.accessibilityLiveRegion, visible ? 'polite' : undefined);
    assert.equal(flat(body.props.style).height, undefined, 'no fixed-height large-text clipping');
  }
});

test('Tick completion and Count presses keep geometry stable in both languages/themes and preserve action arguments', () => {
  for (const language of ['en', 'ar']) for (const palette of [Palettes.light, Palettes.dark]) {
    const runner = hookHarness(); const calls = [];
    const file = 'src/components/today/habit-card.tsx';
    const { HabitCard } = loadSource(file, mocksFor(file, {
      react: runner.react, '@/hooks/use-app-styles': stylesFor(palette),
      '@/hooks/use-language': { useLanguage: () => ({ language }) }, '@/i18n/today': { todayCopy, todaySchedule },
      '@/data/completion-storage': { COUNT_VALUE_MAX: 9999 }, '@/utils/habit-progress': progress,
      '@/utils/theme-color': { readableAccent: color => color }, '@/components/today/count-control': { CountControl: 'CountControl' },
    }));
    const habit = tick('h'); const props = { habit, record: { entries: {} }, onToggleTick: h => calls.push(h), onAdjustCount: (h, delta) => calls.push([h, delta]) };
    const render = p => { const element = HabitCard(p); return element.type(element.props); };
    const unchecked = render(props); const checked = render({ ...props, record: { entries: { h: { type: 'tick', done: true } } } });
    for (const pressed of [true, false]) {
      const before = flat(unchecked.props.style({ pressed })); const after = flat(checked.props.style({ pressed }));
      assert.equal(before.transform, undefined); assert.equal(after.transform, undefined);
      for (const key of ['padding', 'borderWidth', 'gap', 'flexDirection', 'alignItems']) assert.equal(before[key], after[key]);
    }
    unchecked.props.onPress(); assert.equal(calls[0], habit);
    const counter = { ...count('c', 10), tracking: { type: 'count', target: 10, unit: 'pages صفحات' } };
    const snapshots = [];
    for (const value of [0, 9, 10, 11, 9999]) {
      const card = render({ ...props, habit: counter, record: { entries: { c: { type: 'count', value, target: 10 } } } });
      const slot = nodes(card).find(node => node.type === 'StableText');
      const icon = nodes(card).find(node => node.type === 'Symbol' && node.props.name.android === 'check_circle');
      assert.ok(icon, 'completion marker footprint is always present'); assert.equal(icon.props.size, 14); assert.equal(icon.props.style.flexShrink, 0);
      assert.equal(icon.props.style.opacity, value >= 10 ? 1 : 0);
      snapshots.push(slot.props.alternatives);
      const control = nodes(card).find(node => node.type === 'CountControl'); control.props.onAdjust(1);
      assert.deepEqual(calls.at(-1), [counter, 1]);
      assert.equal(flat(card.props.style).borderWidth, 1);
    }
    assert.ok(snapshots.every(snapshot => JSON.stringify(snapshot) === JSON.stringify(snapshots[0])));
    const controlFile = 'src/components/today/count-control.tsx';
    const { CountControl } = loadSource(controlFile, mocksFor(controlFile, {
      '@/hooks/use-app-styles': stylesFor(palette), '@/data/completion-storage': { COUNT_VALUE_MAX: 9999 }, '@/utils/theme-color': { readableAccent: color => color },
    }));
    const controls = CountControl({ value: 9, label: 'Count', color: '#888888', disabled: false, onAdjust: delta => calls.push(delta) });
    const buttons = controls.props.children;
    for (const button of buttons) {
      const idle = flat(button.props.style({ pressed: false })); const pressed = flat(button.props.style({ pressed: true }));
      assert.equal(pressed.transform, undefined); assert.equal(pressed.width, idle.width); assert.equal(pressed.height, idle.height);
    }
    buttons[1].props.onPress(); assert.equal(calls.at(-1), 1);
    controls.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }); assert.equal(calls.at(-1), -1);
    runner.unmount();
  }
});

test('Today achievements retain saved next-badge copy during pending saves and reserve provisional encouragement without premature announcements', () => {
  for (const language of ['en', 'ar']) {
    let status = 'ready'; let record = { entries: {} };
    const habits = [tick('h')]; const evaluation = { metrics: Object.fromEntries(ACHIEVEMENTS.map(badge => [badge.metric, 0])) };
    const collection = { awards: {}, seenBadgeIds: [] }; const before = JSON.stringify(collection);
    const file = 'src/components/achievements/achievements-summary-card.tsx';
    const { AchievementsSummaryCard } = loadSource(file, mocksFor(file, {
      '@/hooks/use-app-styles': stylesFor(Palettes.dark), '@/hooks/use-language': { useLanguage: () => ({ language }) },
      '@/i18n/today': { todayCopy, todayAchievementProgress, todayBadgeName },
      '@/data/achievement-definitions': { ACHIEVEMENTS },
      '@/hooks/use-achievements': { useAchievements: () => ({ collection, storeReady: true, status, evaluation, acknowledge: () => assert.fail('render must not acknowledge') }) },
      '@/hooks/use-daily-progress': { useDailyProgress: () => ({ status: 'ready', record, dateKey: '2026-11-15' }) },
      '@/hooks/use-habits': { useHabits: () => ({ habits, status: 'ready' }) },
      '@/utils/achievements': { hasProvisionalEffort },
    }));
    const initial = AchievementsSummaryCard({ today: true });
    const nextCopy = body => nodes(body).filter(node => node.type === 'Text').map(node => node.props.children).filter(text => typeof text === 'string');
    const reserved = nodes(initial).find(node => node.type === 'StableText'); assert.equal(reserved.props.visible, false);
    record = { entries: { h: { type: 'tick', done: true } } }; status = 'waiting';
    const waiting = AchievementsSummaryCard({ today: true });
    assert.deepEqual(nextCopy(waiting), nextCopy(initial), 'no summary line disappears during a save');
    const active = nodes(waiting).find(node => node.type === 'StableText'); assert.equal(active.props.visible, true);
    assert.deepEqual(active.props.alternatives, reserved.props.alternatives);
    status = 'ready'; assert.deepEqual(nextCopy(AchievementsSummaryCard({ today: true })), nextCopy(initial));
    assert.equal(nodes(AchievementsSummaryCard({})).some(node => node.type === 'StableText'), false, 'Settings receives no encouragement spacer');
    assert.equal(JSON.stringify(collection), before, 'no award or acknowledgement changes');
  }
});
