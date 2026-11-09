# Phase 3A: Light/Dark theme infrastructure

Scope completed: semantic palettes, dynamic app-owned UI styling, and internal development preview. Public presentation remains **Dark + English**. System appearance, Arabic/RTL activation, and working Settings selectors remain closed. No dependency installation, native config changes, APK build, commit, or push.

## Preservation and safety

The initial working tree contained all uncommitted Phase 1/2 work: the modified root layout, the three planning/test/delivery documents, the Phase 2 components/storage/hooks/catalog/helpers, and its two test files. These were inspected before changes. The theme foundation was extended where needed; a SHA-256 comparison against a temporary start-of-phase inventory verified that **all pre-existing documentation, every `src/data/` file, existing tests, `app.json`, package files, and `eas.json` remained byte-for-byte unchanged**. The temporary migration scripts/inventory were removed after verification.

`use-data-backup.tsx` has presentation-only edits: theme/style hooks and a style factory. Its boot, freeze/drain/recovery, replacement, generations, result/error handling, and overlay admission behavior remain unchanged. All other domain providers, storage, validation, calculation, normalization and achievement-coordination logic are untouched. Backup v1 envelope, schema manifest, allowlist, checksum, raw records and recovery journals are unchanged. Existing and Phase 2 safety tests still pass.

The user reports the Phase 2 physical Android smoke test passed. No physical Android session was performed by this agent for Phase 3A.

## Theme architecture

- `src/constants/palettes.ts` defines immutable, structurally identical Light/Dark semantic palettes. All original `Palette` Dark values are preserved exactly, as are the existing special achievement/plan colors, ripples, and native JS splash background. Light provides neutral surfaces, readable text/status/accent colors, stronger control boundaries, contrasting button foregrounds, and distinct chart tracks.
- The old static `Palette` export is removed. `Colors` compatibility names derive from these same palettes; `useTheme`, shared themed components, the web tab header and badge all follow the applied app theme rather than their own device-scheme choice.
- `ThemePreviewProvider` is the stable applied-theme authority. It reads the existing saved request and live device scheme for diagnostic/request resolution only. The release gate still ignores them. `appliedScheme` always returns the closed gate's Dark value outside development; the only Light path is an in-memory dev preview.
- `useAppTheme` reads that context. The provider computes requested appearance once and memoizes context by applied/requested values, avoiding a separate device-appearance subscription in each UI component.
- `useAppStyles` caches each module's pure stylesheet factory once per immutable palette. A switch selects cached styles and dynamic foregrounds; it does not key/remount providers, screens, tabs, forms, or navigation. Existing memoized domain computations retain their domain-only dependencies.
- The root remains Preferences → ThemePreview → AppPresentation → recovery gate → unchanged domain provider chain. Root/nested stack backgrounds, Router Light/Dark base themes, status-bar icon contrast, and native root background now follow the applied palette. `LocaleProvider` remains in place with the closed English/LTR gate. No global appearance or RTL override was added.
- Native tabs use palette-aware backgrounds/indicator/icon/label colors. Light also specifies a suitable native ripple; Dark leaves the previous native ripple default intact. Route IDs, screen transition choices, anchors and Back behavior are unchanged.

## Surface migration and color audit

Today, all habit tracking/control/form variants, goals/status/date/link/consistency views, routine plans/order/forms/badges, insights/periods/charts/heatmaps/detail panels, settings/profile/achievements, backup previews/results, recovery/loading/errors, and shared UI now obtain palette-dependent styles inside components. Pure status/alpha helpers receive their palette/fallback explicitly rather than capturing a module constant.

Text-entry selection colors follow the palette. `keyboardAppearance` is supplied where supported; Android keyboard/OS appearance is still OS/native-owned. Solid app-accent controls use `onAccent`, independently of page background. Saved-color checks choose contrasting text, and light-mode saved-color text/icons/progress bars derive readable foregrounds without editing stored swatches/content. Heatmap foregrounds account for alpha-composited fills, and the legend shares its displayed chart color.

Remaining literal colors are intentional: original habit/profile option swatches and demo records, the unchanged blue Expo logo gradient artwork in native/CSS assets, and pure contrast-helper constants. The app-owned JS splash surface is themed; native launch artwork/config is unchanged.

Contrast tests verify primary/secondary/status/accent text on core surfaces, Light muted text and control boundaries, filled-button foregrounds, achievement highlights, saved-color foregrounds on neutral/tinted surfaces, and heatmap levels. These are numeric token checks, not a blanket visual accessibility certification. Inherited Dark `textMuted` is approximately **2.74:1 on `surfaceRaised`**; inherited subtle Dark control borders are approximately **1.14:1** there. They remain as requested for Dark visual regression preservation. Those legacy gaps, disabled opacity, small labels, anti-aliasing and native render behavior need review before activation; do not describe the entire Dark UI as AA compliant.

## Internal preview

In a development build connected to Metro, a **DEV · dark preview · tap for light · not saved** bar appears above the app. It switches only palette context. It has no storage mutations, reloads, domain calls, language toggles or production controls. It is behind the existing recovery gate and disabled while backup activity is busy. Its 44dp control/top safe area reduces available screen height; account for that in regression screenshots. Release builds render no preview controls and reject the override even if its state were set programmatically.

The preview starts Dark on a new JS runtime; Fast Refresh can preserve its React state. Return to Dark before ending tests. No app-data clear, uninstall, or APK replacement is needed.

## Verification

| Command | Final result |
| --- | --- |
| `npm.cmd test` | Exit 0; **217 tests**, 18 suites; 217 passed, 0 failed/cancelled/skipped/todo; reported duration 2619.7793 ms |
| `npx.cmd --no-install tsc --noEmit` | Exit 0, no diagnostics |
| `npx.cmd --no-install expo lint` | Exit 0, no errors or warnings |
| `npx.cmd --no-install expo-doctor` | Exit 0; **20/20 checks passed**, no issues detected |
| `git diff --check` | Exit 0, no whitespace errors; Git emitted its LF-to-CRLF working-copy advisories |

The existing expected failure-injection save/retry console diagnostic remains in the passing test suite. Eleven new theme tests cover baseline colors, palette parity/immutability, the closed release gate, contrast, arbitrary saved colors, heatmap alpha, explicit alpha fallback, stylesheet identity caching through repeated switches, and a source audit guarding against module-level palette captures/new hardcoded surface colors.

During development, checks caught missing palette bindings and a saved red foreground that did not contrast enough on tinted backgrounds. Those were fixed and the complete checks above passed afterward. Pure/source tests do not mount native tabs/forms or demonstrate absence of native flicker/remounts on a device.

## Phase 3B boundary and remaining risk

**No new APK is needed for Phase 3A's JS palettes and internal preview.** The installed SDK 58 modules already provide the APIs used here.

The existing Android binary is still configured `userInterfaceStyle: dark`. Full System behavior and coordinated native Light appearance cannot be certified until the separately approved native configuration/build work. Native dialogs/share/document UI, Android keyboard, navigation-bar treatment, launch splash and OS/activity transitions can remain dark during Light preview. Status-bar icons and app-owned backgrounds are updated, but native chrome needs real device QA. Do not work around this by adding global overrides, changing app config, or building an APK in Phase 3A.

Phase 3B must separately review automatic native appearance, system bars/native controls, native launch surfaces, rebuild/install-over-existing-data validation, and live device appearance events. Later activation must still keep provider identities stable and wait for physical theme/contrast approval. No RTL/language activation is included; retain native/gesture/device-locale edge cases from the earlier successful RTL spike.

See `SETTINGS_PHASE3A_ANDROID_QA.md` for the manual matrix. Preserve Phase 2's successful smoke test as baseline evidence, but do not treat it as approval of the new Light surfaces.

## Complete Phase 3A file inventory

This list compares against the inspected start-of-phase working tree, so it includes updates to untracked Phase 2 files as well as tracked app files. Existing documents and Phase 2 tests/storage/catalogs not listed here were preserved.

### Modified existing files (75)

- `src/app/(tabs)/goals/[id].tsx`
- `src/app/(tabs)/goals/_layout.tsx`
- `src/app/(tabs)/goals/index.tsx`
- `src/app/(tabs)/habits/[id].tsx`
- `src/app/(tabs)/habits/_layout.tsx`
- `src/app/(tabs)/habits/index.tsx`
- `src/app/(tabs)/habits/routines.tsx`
- `src/app/(tabs)/index.tsx`
- `src/app/(tabs)/insights/_layout.tsx`
- `src/app/(tabs)/insights/habit/[id].tsx`
- `src/app/(tabs)/insights/index.tsx`
- `src/app/(tabs)/settings.tsx`
- `src/app/_layout.tsx`
- `src/app/achievements.tsx`
- `src/app/data-backup.tsx`
- `src/app/profile/edit.tsx`
- `src/app/routine/[id].tsx`
- `src/app/routine/edit/[id].tsx`
- `src/components/achievements/achievement-card.tsx`
- `src/components/achievements/achievement-data-notes.tsx`
- `src/components/achievements/achievements-summary-card.tsx`
- `src/components/animated-icon.tsx`
- `src/components/app-presentation.tsx`
- `src/components/app-tabs.tsx`
- `src/components/app-tabs.web.tsx`
- `src/components/goals/consistency-summary.tsx`
- `src/components/goals/date-picker.tsx`
- `src/components/goals/goal-card.tsx`
- `src/components/goals/goal-form.tsx`
- `src/components/goals/habit-link-picker.tsx`
- `src/components/goals/status-picker.tsx`
- `src/components/habits/checklist-editor.tsx`
- `src/components/habits/color-picker.tsx`
- `src/components/habits/count-fields.tsx`
- `src/components/habits/empty-state.tsx`
- `src/components/habits/habit-form.tsx`
- `src/components/habits/habit-row.tsx`
- `src/components/habits/icon-picker.tsx`
- `src/components/habits/tracking-type-picker.tsx`
- `src/components/habits/weekday-picker.tsx`
- `src/components/insights/data-notes.tsx`
- `src/components/insights/day-detail-panel.tsx`
- `src/components/insights/format.ts`
- `src/components/insights/habit-insight-row.tsx`
- `src/components/insights/heatmap-calendar.tsx`
- `src/components/insights/period-nav.tsx`
- `src/components/insights/stat-tile.tsx`
- `src/components/insights/trend-bars.tsx`
- `src/components/insights/weekly-review-card.tsx`
- `src/components/placeholder-screen.tsx`
- `src/components/profile/name-prompt-card.tsx`
- `src/components/profile/profile-avatar.tsx`
- `src/components/profile/profile-form.tsx`
- `src/components/routines/routine-badges.tsx`
- `src/components/routines/routine-card.tsx`
- `src/components/routines/routine-form.tsx`
- `src/components/routines/routine-habit-order.tsx`
- `src/components/routines/routines-entry-card.tsx`
- `src/components/routines/time-of-day-picker.tsx`
- `src/components/routines/todays-plan.tsx`
- `src/components/settings/profile-summary-card.tsx`
- `src/components/settings/settings-row.tsx`
- `src/components/settings/settings-section.tsx`
- `src/components/themed-text.tsx`
- `src/components/themed-view.tsx`
- `src/components/today/checklist-steps.tsx`
- `src/components/today/count-control.tsx`
- `src/components/today/habit-card.tsx`
- `src/components/today/progress-notices.tsx`
- `src/components/today/progress-ring.tsx`
- `src/components/web-badge.tsx`
- `src/constants/theme.ts`
- `src/hooks/use-app-theme.ts`
- `src/hooks/use-data-backup.tsx`
- `src/hooks/use-theme.ts`

### New source/test files (7)

- `src/components/dev-theme-preview.tsx`
- `src/constants/palettes.ts`
- `src/hooks/use-app-styles.ts`
- `src/hooks/use-theme-preview.tsx`
- `src/utils/theme-color.ts`
- `src/utils/theme-styles.ts`
- `tests/theme.test.mjs`

### New documentation

- SETTINGS_PHASE3A_THEME_REPORT.md
- SETTINGS_PHASE3A_ANDROID_QA.md

No earlier file was deleted.
