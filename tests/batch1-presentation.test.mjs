import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeNumericInput } from '../src/i18n/format.ts';
import { parseCountTarget } from '../src/utils/habit-validation.ts';
import { getGreeting, toLocalDateKey } from '../src/utils/date.ts';
import { todayGreeting } from '../src/i18n/today.ts';
import { appNumber } from '../src/i18n/app-copy.ts';
import { applyPresentationLanguage } from '../src/utils/presentation.ts';
import { hookHarness, loadSource } from './support/hook-harness.mjs';
import { createTranslator } from '../src/i18n/translate.ts';
import { arMessages } from '../src/i18n/ar-messages.ts';
import { enMessages } from '../src/i18n/en-messages.ts';

const jsx = (type, props) => ({ type, props });
const tree = value => Array.isArray(value) ? value.flatMap(tree) : value && typeof value === 'object' ? [value, ...tree(value.props?.children)] : [];

test('Arabic discard labels preserve their exact intended Unicode text', () => {
  const translator = createTranslator({ strict: true });
  assert.equal(translator.label('ar', 'forms.discardTitle'), 'تجاهل التغييرات؟');
  assert.equal(translator.label('ar', 'forms.discardMessage'), 'لم تُحفظ تغييراتك بعد.');
  assert.equal(translator.label('ar', 'forms.discard'), 'تجاهل');
});

test('Arabic Goal explanation preserves the full intended sentence and interpolated date', () => {
  const expected = 'يبدأ الحساب من {date}، ولا يسبق بداية كل عادة المثبتة بتاريخ إنشائها أو تسجيل محفوظ أقدم. نستخدم العادات المرتبطة حاليًا وجداولها الحالية؛ لا تُحفظ تواريخ الربط السابقة أو الجداول السابقة أو فترات الإيقاف المؤقت، لذا تبقى أيام الإيقاف ضمن الحساب. يظل اليوم مؤقتًا حتى ينتهي.';
  assert.equal(arMessages['goals.consistency.explanation'], expected);
  assert.equal(createTranslator({ strict: true }).message('ar', 'goals.consistency.explanation', { date: '١٥ نوفمبر ٢٠٢٦' }),
    'يبدأ الحساب من ١٥ نوفمبر ٢٠٢٦، ولا يسبق بداية كل عادة المثبتة بتاريخ إنشائها أو تسجيل محفوظ أقدم. نستخدم العادات المرتبطة حاليًا وجداولها الحالية؛ لا تُحفظ تواريخ الربط السابقة أو الجداول السابقة أو فترات الإيقاف المؤقت، لذا تبقى أيام الإيقاف ضمن الحساب. يظل اليوم مؤقتًا حتى ينتهي.');
});

test('English Goal explanation preserves both possessive apostrophes and exact rendered copy', () => {
  const expected = 'Counted from {date}, but never before each habit’s evidenced start (creation or an earlier saved entry). Uses this goal’s current linked habits and their current schedules; historical link dates, schedules and pause intervals are not recorded. Paused days remain included. Today stays provisional until the day ends.';
  assert.equal(enMessages['goals.consistency.explanation'], expected);
  assert.equal(createTranslator({ strict: true }).message('en', 'goals.consistency.explanation', { date: 'November 15, 2026' }),
    'Counted from November 15, 2026, but never before each habit’s evidenced start (creation or an earlier saved entry). Uses this goal’s current linked habits and their current schedules; historical link dates, schedules and pause intervals are not recorded. Paused days remain included. Today stays provisional until the day ends.');
});

test('CountFields executes localized UI conversion before the existing ASCII filter/range validator', () => {
  const runner = hookHarness(); let target; let unit;
  const { CountFields } = loadSource('src/components/habits/count-fields.tsx', {
    react: runner.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', StyleSheet: { create: value => value } },
    '@/components/localized-native': { Text: 'Text', TextInput: 'Input' },
    '@/i18n/app-copy': { appLabel: value => value }, '@/i18n/format': { normalizeNumericInput },
    '@/hooks/use-app-styles': { useAppStyles: () => ({ styles: {}, palette: {}, scheme: 'light' }) },
    '@/constants/theme': { Radius: {}, Spacing: {} }, '@/utils/habit-validation': { UNIT_MAX_LENGTH: 16 },
  });
  const body = runner.render(() => CountFields({ target: '', unit: '', editable: true, onTargetChange: value => { target = value; }, onUnitChange: value => { unit = value; } }));
  const inputs = tree(body).filter(node => node.type === 'Input');
  for (const [input, expected] of [['٨', '8'], ['۱۲۳۴', '1234'], ['1٢۳4', '1234'], ['۹۹۹۹۹', '9999'], ['٠', '0'], ['', ''], ['abc٨!', '8'], ['12.٣', '123']]) {
    inputs[0].props.onChangeText(input); assert.equal(target, expected);
    assert.equal(parseCountTarget(target), expected && Number(expected) > 0 ? Number(expected) : null);
  }
  inputs[1].props.onChangeText('٨ صفحات'); assert.equal(unit, '٨ صفحات', 'user unit text is never normalized');
  assert.equal(parseCountTarget('٨'), null, 'domain validator remains ASCII-only');
  assert.equal(parseCountTarget('10000'), null); assert.equal(parseCountTarget('0'), null);
  runner.unmount();
});

test('greeting clock updates across boundaries and resume, retaining domain date keys and bilingual copy', () => {
  const runner = hookHarness(); const RealDate = globalThis.Date;
  let now = new RealDate(2026, 10, 15, 11, 59); let timer; let listener; let removed = false; let cleared = false;
  const originalInterval = globalThis.setInterval; const originalClear = globalThis.clearInterval;
  try {
    globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [now.getTime()])); } };
    globalThis.setInterval = (callback, ms) => { assert.equal(ms, 30_000); timer = callback; return 17; };
    globalThis.clearInterval = id => { assert.equal(id, 17); cleared = true; };
    const { useGreetingDate } = loadSource('src/hooks/use-greeting-date.ts', {
      react: runner.react, 'react-native': { AppState: { addEventListener: (_event, callback) => { listener = callback; return { remove: () => { removed = true; } }; } } },
      '@/utils/date': { getGreeting },
    });
    const before = runner.render(useGreetingDate); assert.equal(getGreeting(before), 'Good morning');
    for (const [hour, label] of [[12, 'Good afternoon'], [18, 'Good evening'], [4, 'Good night'], [5, 'Good morning']]) {
      now = new RealDate(2026, 10, 15, hour, 0);
      if (hour === 18) listener('active'); else timer();
      const date = runner.render(); assert.equal(getGreeting(date), label);
      assert.equal(todayGreeting('en', date), label); assert.match(todayGreeting('ar', date), /[\u0600-\u06ff]/);
      assert.equal(toLocalDateKey(date), '2026-11-15');
    }
    now = new RealDate(2026, 10, 15, 5, 30); const same = runner.render(); timer(); assert.equal(runner.render(), same, 'no needless within-period publication');
    runner.unmount(); assert.ok(removed && cleared);
  } finally { globalThis.Date = RealDate; globalThis.setInterval = originalInterval; globalThis.clearInterval = originalClear; }
});

test('visible trend numbers use current language display formatting without changing numeric bar heights', () => {
  const runner = hookHarness();
  const points = [{ key: 'p', label: 'period', rate: .42, done: 42, finished: 100, isCurrent: false }];
  const { TrendBars } = loadSource('src/components/insights/trend-bars.tsx', {
    react: runner.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { create: value => value } },
    '@/components/localized-native': { Text: 'Text' }, '@/components/localized-inline': { LocalizedInline: 'Inline' },
    '@/i18n/app-copy': { appNumber, appLabel: key => key, appMessage: key => key, appRich: () => ({}) },
    '@/hooks/use-app-styles': { useAppStyles: () => ({ styles: {} }) },
    '@/components/insights/format': { formatRate: String }, '@/constants/theme': { Radius: {} },
    '@/utils/insights': { trend: () => ({ points, average: .42, best: .42 }) },
  });
  try {
    for (const [language, number] of [['en', '42'], ['ar', '٤٢']]) {
      applyPresentationLanguage(language);
      const body = runner.render(() => TrendBars({ index: {} }));
      assert.ok(tree(body).some(node => node.type === 'Text' && node.props.children === number));
      assert.ok(tree(body).some(node => Array.isArray(node.props?.style) && node.props.style.some(style => style?.height === 50.4)));
      assert.equal(points[0].rate, .42);
    }
  } finally { applyPresentationLanguage('en'); runner.unmount(); }
});
