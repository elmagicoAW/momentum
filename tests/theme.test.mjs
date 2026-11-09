import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

import { Palettes, appliedScheme } from '../src/constants/palettes.ts';
import { HABIT_COLORS } from '../src/data/habit-options.ts';
import { contrastRatio, foregroundOnColor, heatmapForeground, readableAccent, withAlpha } from '../src/utils/theme-color.ts';
import { stylesForPalette } from '../src/utils/theme-styles.ts';
import { ACTIVE_PRESENTATION, resolveAppearance } from '../src/utils/presentation.ts';

test('original Dark palette values remain the regression baseline', () => {
  const baseline = {
    background: '#08080D', surface: '#12121A', surfaceRaised: '#1A1A25', border: '#24243A',
    text: '#F4F4F8', textSecondary: '#9A9AB0', textMuted: '#5E5E75',
    accent: '#8B7CF6', accentSoft: 'rgba(139, 124, 246, 0.14)',
    accentBlue: '#5B8DEF', accentBlueSoft: 'rgba(91, 141, 239, 0.14)',
    success: '#4ADE9B', danger: '#F87171', dangerSoft: 'rgba(248, 113, 113, 0.12)',
    ring: '#8B7CF6', ringTrack: '#1F1F2E',
  };
  for (const [key, value] of Object.entries(baseline)) assert.equal(Palettes.dark[key], value, key);
  assert.equal(Palettes.dark.achievementHero, '#171329');
  assert.equal(Palettes.dark.splashBackground, '#208AEF');
});

test('Light and Dark have exact semantic parity, stable immutable identities, and valid color values', () => {
  assert.deepEqual(Object.keys(Palettes.light).sort(), Object.keys(Palettes.dark).sort());
  assert.ok(Object.isFrozen(Palettes));
  for (const palette of Object.values(Palettes)) {
    assert.ok(Object.isFrozen(palette));
    for (const value of Object.values(palette)) assert.match(value, /^(#[a-f\d]{6}|rgba\([\d., ]+\))$/i);
  }
  const original = JSON.stringify(Palettes);
  for (let i = 0; i < 20; i++) { appliedScheme(i % 2 ? 'light' : 'dark', true); }
  assert.equal(JSON.stringify(Palettes), original);
});

test('public presentation stays Dark/English regardless of requested appearance or dev preview in release', () => {
  for (const requested of ['dark', 'light', 'system']) for (const device of ['dark', 'light', null]) {
    assert.ok(['light', 'dark'].includes(resolveAppearance(requested, device)));
    for (const preview of [null, 'light', 'dark']) assert.equal(appliedScheme(preview, false), 'dark');
  }
  assert.equal(appliedScheme(null, true), 'dark');
  assert.equal(appliedScheme('light', true), 'light');
  assert.equal(appliedScheme('dark', true), 'dark');
  assert.deepEqual(ACTIVE_PRESENTATION, { scheme: 'dark', language: 'en', direction: 'ltr' });
});

test('main text, secondary text and semantic status text meet normal-text contrast on core surfaces', () => {
  for (const palette of Object.values(Palettes)) for (const background of ['background', 'surface', 'surfaceRaised']) {
    for (const foreground of ['text', 'textSecondary', 'accent', 'accentBlue', 'danger', 'success']) {
      assert.ok(contrastRatio(palette[foreground], palette[background]) >= 4.5, `${foreground}/${background}`);
    }
  }
  // The old dark muted token and subtle borders are intentionally not relabeled as AA compliant.
  for (const background of ['background', 'surface', 'surfaceRaised']) {
    assert.ok(contrastRatio(Palettes.light.textMuted, Palettes.light[background]) >= 4.5);
    assert.ok(contrastRatio(Palettes.light.controlBorder, Palettes.light[background]) >= 3);
  }
});

test('filled buttons and achievement highlights have contrasting foregrounds', () => {
  for (const palette of Object.values(Palettes)) {
    assert.ok(contrastRatio(palette.onAccent, palette.accent) >= 4.5);
    assert.ok(contrastRatio(palette.onSuccess, palette.success) >= 4.5);
    assert.ok(contrastRatio(palette.achievementTotal, palette.achievementHero) >= 4.5);
    assert.ok(contrastRatio(palette.achievementEyebrow, palette.achievementHero) >= 4.5);
    assert.ok(contrastRatio(palette.achievementEncouragement, palette.achievementSummary) >= 4.5);
  }
});

const colors = [...HABIT_COLORS.map((option) => option.value), '#FFFFFF', '#000000', '#FF0000', '#FFFFCC', '#123456'];
const composite = (color, alpha, background) => '#' + [1, 3, 5].map((offset) =>
  Math.round(parseInt(color.slice(offset, offset + 2), 16) * alpha + parseInt(background.slice(offset, offset + 2), 16) * (1 - alpha))
    .toString(16).padStart(2, '0')).join('');

test('saved swatches remain intact and light foregrounds contrast on neutral and tinted surfaces', () => {
  const original = JSON.stringify(HABIT_COLORS);
  for (const color of colors) {
    assert.equal(readableAccent(color, Palettes.dark), color);
    const foreground = readableAccent(color, Palettes.light);
    for (const background of ['background', 'surface', 'surfaceRaised']) {
      assert.ok(contrastRatio(foreground, Palettes.light[background]) >= 4.5, color);
      assert.ok(contrastRatio(foreground, composite(color, 0.14, Palettes.light[background])) >= 4.5, `${color} on tint`);
    }
  }
  assert.equal(JSON.stringify(HABIT_COLORS), original);
  assert.equal(readableAccent('unknown', Palettes.light), Palettes.light.accent);
});

test('checks on arbitrary saved color fills choose a readable foreground', () => {
  for (const color of colors) assert.ok(contrastRatio(foregroundOnColor(color), color) >= 4.5, color);
  assert.equal(foregroundOnColor('invalid'), Palettes.dark.background);
});

test('heatmap labels contrast at all alpha levels in Light and preserve original Dark labels', () => {
  for (const color of colors) for (const alpha of [0.25, 0.3, 0.6, 1]) {
    const baseline = alpha === 1 ? Palettes.dark.background : Palettes.dark.text;
    assert.equal(heatmapForeground(color, alpha, Palettes.dark, baseline), baseline);
    const foreground = heatmapForeground(color, alpha, Palettes.light, baseline);
    const background = composite(color, alpha, Palettes.light.surface);
    assert.ok(contrastRatio(foreground, background) >= 4.5, `${color}/${alpha}`);
  }
});

test('alpha fallbacks use the caller palette and clamp transparent/opaque endpoints', () => {
  assert.equal(withAlpha('invalid', 0.5, Palettes.light.accent), Palettes.light.accent + '80');
  assert.equal(withAlpha('#123456', -1, Palettes.dark.accent), '#12345600');
  assert.equal(withAlpha('#123456', 2, Palettes.dark.accent), '#123456ff');
});

test('style factories cache separately per palette and keep identities through repeated switches', () => {
  let calls = 0;
  const factory = (palette) => { calls++; return { screen: { backgroundColor: palette.background } }; };
  const dark = stylesForPalette(factory, Palettes.dark);
  const light = stylesForPalette(factory, Palettes.light);
  for (let i = 0; i < 50; i++) {
    assert.equal(stylesForPalette(factory, Palettes.dark), dark);
    assert.equal(stylesForPalette(factory, Palettes.light), light);
  }
  assert.equal(calls, 2);
  assert.equal(dark.screen.backgroundColor, Palettes.dark.background);
  assert.equal(light.screen.backgroundColor, Palettes.light.background);
});

function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? sources(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}

test('UI source audit prevents stale module palette imports, module styles and new literal surface colors', () => {
  for (const file of sources('src').filter((file) => file.endsWith('.tsx'))) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /import\s*\{[^}]*\bPalette\b[^}]*\}\s*from\s*['"]@\/constants\/theme/, file);
    // Blue Expo gradient artwork is intentionally identical in both modes.
    const withoutArtwork = source.replace(/`linear-gradient\(180deg, #3C9FFE, #0274DF\)`/, 'ARTWORK');
    assert.doesNotMatch(withoutArtwork, /#[a-f\d]{6}\b|rgba\(/i, file);
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(tree) === 'StyleSheet.create' && /\bPalette\./.test(node.getText(tree))) {
        let fn = node.parent;
        while (fn && !ts.isArrowFunction(fn) && !ts.isFunctionDeclaration(fn)) fn = fn.parent;
        assert.ok(fn, `${file}: theme-dependent StyleSheet captured at module scope`);
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
});
