# Phase 4D — Arabic RTL visual corrections

Implemented for review on `wip/settings-appearance-language`, HEAD `2ed299cba1ff9b65408915c7f49ee124fc993389`. Existing uncommitted Phase 4B/4C work remains in place. The user reports that Arabic copy and native tab ordering work; this change addresses the reported visual defects. Screenshots were described in the request but were not attached in this turn, so no pixel-level screenshot verification is claimed.

## Findings and exact changes

**Shared RTL policy.** Phase 4C's directionStyles injected RTL direction into every style and converted physical left/right and ring borders. This coupled semantic layout to numeric/rotated geometry. It now converts only horizontal margin/padding to logical start/end. It leaves direction, flex order, absolute coordinates, borders, transforms and text alignment to their owners. There is no blanket row reversal or style mirroring.

**Text and input.** The stable localized Text boundary resolves start/end alignment once, preserves centering/justification, removes Arabic letter spacing, and increases explicitly specified line boxes when needed for Arabic glyph height. Arabic prose can wrap instead of being silently cut by an English line-count constraint; intrinsic text widths can shrink within cards. English line limits/style alignment remain unchanged. TextInput retains its value, events, refs and automatic mixed-script bidi behavior; only presentation alignment changes. No normalization or directional controls are inserted into saved/input values.

**Numbers.** New NumericText recognizes numeric-only runs and isolates the whole formatted ratio/percentage with Unicode LRI/PDI in Arabic. Its display base is LTR; a complete Arabic or mixed-script sentence falls back to the ordinary paragraph boundary. It does not reverse digits or isolate individual numerator/denominator fragments. English display strings are unchanged. Accessible labels continue to use their complete original messages rather than concatenated visual fragments. Canonical number formatting, calculations, raw records and backup output are untouched.

**Today.** Progress card width is measured using onLayout, with window width as the initial fallback. Arabic switches to a full-width vertical text block below the ring on compact cards or larger font scale. The full daily-progress sentence and subtitle remain visible. The numeric/rotated ring explicitly retains LTR geometry and its original clockwise arcs. Arabic ring counts use one bounded numeric run with font fitting, and the caption has a bounded centered text region. No domain progress calculation changes.

**Habits and metadata.** Habit and Insight row bodies have explicit shrink/min-width constraints. Arabic metadata and descriptions wrap. Remaining module-level picker/confirmation labels now use getters, fixing English labels captured before switching to Arabic. Stored tracking IDs and user-entered names remain unchanged.

**Goals.** Percent values use NumericText; the Arabic consistency headline can wrap with a gap instead of fighting the percentage for width. Goal header text can shrink properly. The English stylesheet declarations remain the regression baseline.

**Insights.** Arabic overview tiles, habit metrics and weekly-review stats have full-width responsive bases and wrapping parents. Important values use NumericText, and prose captions/labels expand. This deliberately uses more vertical space rather than clipping key values. Existing colors/contrast and aggregation are unchanged.

**Settings.** Arabic link/info rows group label and value vertically in a flexible body, keeping icon first and directional chevron last in semantic row order. Values no longer compete with the label under the old 55% constraint. English retains its original label/value sibling arrangement. Native tabs, chevron selection, route identity and Back logic are unchanged.

**Other surfaces.** Audited form controls, profile/routine metadata, calendar/period controls, dialogs, headers and fixed icon/graph geometry. Arabic form Save controls can grow vertically while retaining their touch minimum. Appearance and Language modals receive direction explicitly on their backdrop, rather than relying on the removed style injection. Shared text/input fixes cover migrated Profile, Achievements, backup/recovery notices and other forms without remounts. Native Alert/share/picker presentation remains OS-owned; app-owned translated warning/button messages and safety behavior are unchanged.

Implementation references reviewed: [SDK 58](https://docs.expo.dev/versions/v58.0.0/), [React Native text styles](https://reactnative.dev/docs/text-style-props), [layout props](https://reactnative.dev/docs/layout-props), and [Unicode bidi isolation](https://www.unicode.org/reports/tr9/). Unicode isolation is a rendering boundary only.

## Files

New: `src/utils/rtl-presentation.ts`, `tests/rtl-visual.test.mjs`, this report.

Shared fixes: `src/utils/direction-styles.ts`, `src/components/localized-native.tsx`.

Screen/card fixes: `src/app/(tabs)/index.tsx`, `src/components/today/progress-ring.tsx`, `src/components/habits/habit-row.tsx`, `src/components/goals/goal-card.tsx`, `src/components/goals/consistency-summary.tsx`, `src/components/insights/stat-tile.tsx`, `habit-insight-row.tsx`, `weekly-review-card.tsx`, and `src/components/settings/settings-row.tsx`.

Metadata getters were audited across app/components, including Habit tracking/day choices, confirmation type labels and trend options. Form render overrides affect Habit/Goal/Routine/Profile forms. Modal direction affects Appearance/Language selectors. No storage/domain/preferences/recovery source changes were introduced by Phase 4D; pre-existing changes to those files belong to earlier phases and remain preserved.

Updated regression: `tests/language-activation.test.mjs` now expects text alignment to remain outside the spacing helper. `LOCALIZATION_COPY_INVENTORY.json` was regenerated. Only this task's two disposable edit scripts and validation log were removed after validation; earlier reports/fixtures were retained.

## Exact validation

| Check | Result |
| --- | --- |
| Full tests | Exit 0: **281 tests, 18 suites, 281 pass, 0 fail/cancelled/skipped/todo; 6166.2283 ms** |
| TypeScript | Exit 0; no diagnostics |
| Expo lint | Exit 0; no warnings/errors |
| Inventory | Consistent with independent in-memory generation: **179 source files, 22 roots, 172 reachable, 117 candidate files, 1489 candidates** |
| `git diff --check` | Exit 0; existing LF/CRLF advisories only |
| External compatible Expo Doctor 1.21.6, `--verbose` | Exit 1: **19/20**, same dependency patch recommendations only |

Six focused tests cover geometry/spacing isolation, alignment, complete numeric runs versus mixed user text, compact/large-type progress behavior, key screen layout boundaries and live metadata return to English. Existing tests for missing Intl, theme contrast, save-first preferences/language, domain calculations, backup v1/checksum/recovery and historical stylesheet declarations pass.

Doctor used the existing external CLI under `C:\Users\Beeviro1\AppData\Local\Temp\momentum-doctor-7441495e4de54f8a984e89e2e3e35524\node_modules\expo-doctor\bin\expo-doctor.js`. Nothing was installed or suppressed. Installed -> recommended versions:

```text
@expo/ui           58.0.27 -> ~58.0.28
expo               58.0.23 -> ~58.0.24
expo-constants     58.0.15 -> ~58.0.16
expo-crypto        58.0.7  -> ~58.0.8
expo-dev-client    58.0.18 -> ~58.0.19
expo-font          58.0.11 -> ~58.0.12
expo-linking       58.0.16 -> ~58.0.17
expo-router        58.0.30 -> ~58.0.31
expo-sharing       58.0.22 -> ~58.0.23
expo-splash-screen 58.0.13 -> ~58.0.14
expo-status-bar    58.0.4  -> ~58.0.5
expo-symbols       58.0.4  -> ~58.0.5
expo-web-browser   58.0.7  -> ~58.0.8
```

## Risks and pending Android QA

These fixes are verified by code/tests, not physical rendering. Android font fallback, extreme font sizes, numeric-isolate speech and opposite device-language behavior require device checks. Wrapping makes Arabic cards taller; this is intentional. Existing operation receipts already held as strings can retain their previous language until retry/next operation, as documented in Phase 4C. No native rebuild is required for these JS presentation changes.

1. Reload the existing Dev client. At small width and normal/large system font, check Today sentence/caption/counts (zero, one, multi-digit), ring geometry and no clipping.
2. In Arabic, inspect Habit type/day labels after switching from English without reload. Check long mixed-script names/descriptions and row icon/chevron positions; edit/cancel without losing the draft.
3. Check Goal percentages/ratios (0%, 83%, 100%, multi-digit counts), headings and linked names. Check Insights tiles, all weekly stats, long captions and history/calendar labels for complete values and consistent reading order.
4. Check Settings icon-label-value-chevron order, long data summary values, both selectors and Android Back. Check Profile/Routine/Habit/Goal Save controls, dialogs and warnings with large text; use TalkBack for labels and isolated numbers.
5. Switch back to English and verify original layouts/number ordering. Repeat Arabic/English with Light, Dark and System and after resume/restart. Verify native tab ordering/navigation, saved language and existing synthetic data/achievements remain intact. Do not restore, clear data or remove recovery copies.

No dependency/native configuration changes, APK work, device reset/restore, commit, push, branch switch or release work occurred. Stop for review and physical QA.
