# Phase 4E — focused Arabic layout redesign

Implemented for review on `wip/settings-appearance-language`, against checkpoint `b696fe2105b684edc4400f38022a9302d130d349`. The working tree was clean at inspection; the checkpointed Phase 4B/4C/4D implementation, tests and reports remain intact. All Phase 4E changes are unstaged and uncommitted.

The user's device observations motivated this redesign. No screenshots were attached to this request, and no device/emulator was accessed, so this report does not claim visual or physical Android acceptance.

## Diagnosis and composition rules

Phase 4D removed unsafe global mirroring, but several of its local remedies damaged hierarchy: almost every handset stacked Today's large ring above its text; Insights forced every metric into a full-width row; Settings put a horizontally flexible label into a vertical column without resetting its flex. These produced excess height and disconnected content. Native screen boundaries also need an explicit content direction rather than relying on direction inheritance across native navigation hosts.

The new `arabicComposition` tokens are applied explicitly by the relevant screens/cards, only in Arabic. They do not traverse or transform arbitrary stylesheet objects. A normal `row` in an explicitly RTL surface places its first semantic child at the right; no additional `row-reverse` is applied. Text uses a logical start edge; numeric runs keep their own LTR bidi isolation. Icons, content and trailing actions are assigned by each component's existing semantic child order.

Normal-width headings retain a title block and trailing action. Below 360 dp, or above 1.25 font scale, selected compositions reflow vertically rather than squeezing Arabic into narrow columns. Text columns retain intrinsic height with `flexBasis: auto`, can shrink horizontally and have no minimum width. Spacing uses gaps and the existing logical-spacing boundary. Palette colors, touch behavior and stylesheet declarations remain unchanged.

## Surface-specific changes

- **Today:** Arabic now has its own progress composition: a right-aligned label, full daily-progress sentence and supporting status form one text block; a smaller 112 dp ring sits at the trailing left side. Compact/large-type layouts put that text block first, with a 96 dp ring below. This replaces the old 148 dp ring-first stack and removes the measurement-state update loop. Counts, subtitles, ring geometry and completion calculations are unchanged. The Arabic sentence is now `أكملت {completed} من {total} من عاداتك اليوم.` English wording and its original ring/text branch are retained. Explicit RTL direction anchors the rest of the Today content at the screen boundary.
- **Habits:** title/count and Add Habit form an intentional RTL header, with compact reflow. Habit cards explicitly group leading icon on the right, shrinking title/description/metadata body, and trailing navigation affordance on the left. Title and metadata share a start edge; user-entered content is passed through unchanged. The shared Habit form gets an explicit Arabic screen boundary without changes to form state or handlers.
- **Goals:** the title/action header uses the same deliberate compact behavior. Filter chips keep their semantic order in RTL; Arabic label and count have separate, adjacent layout slots, with the whole count isolated as a numeric run. Cards explicitly own RTL direction and the title/status row; supporting descriptions wrap from the same start edge. Existing consistency ratios, percent isolation and progress calculations remain intact. Goal form changes are restricted to its Arabic content boundary.
- **Insights:** overview tiles return to a two-column grid on normal handset widths, with no imposed minimum height and a right-aligned label/value/caption hierarchy. They become full width for compact/large-type layouts. Habit metrics and weekly-review statistics form compact equal-width groups normally, expanding vertically only at the responsive threshold. Labels wrap within their own group instead of forcing every metric into a full-width region. Numeric values remain whole-run isolated; overview numbers can now align to the start edge without changing their bidi direction. Aggregation, chronology, charts and data producers are untouched.
- **Settings:** each Arabic link row has a leading right icon, a label/value column sharing a right edge, and a trailing left chevron. Labels no longer have vertical `flex: 1`; values use the column width instead of an opposing edge. Row spacing is explicit. Long informational paragraphs keep their icon top-aligned. The Language row now uses a globe/language icon, correcting the copied moon/theme icon in both languages. The English sibling arrangement and all selector/save/cancel/busy behavior are retained.
- **Shared forms:** Habit, Goal, Routine and Profile forms receive explicit Arabic content direction at their native screen boundary. Their input values, automatic mixed-script writing direction, event handlers, validation, Save/Cancel state and persistence are unchanged.

`NumericText` gains an optional start/center/end alignment choice. It still isolates only complete numeric displays; mixed-script prose/user names fall back to normal text. English receives no new numeric style or Unicode controls. The existing shared Text/TextInput policy, RTL spacing helper, native tabs, screen transitions and Back targets are unchanged.

## Floating gear: exact owner and safe handling

The overlay is Expo DevMenu's native floating tools button, not an app card, Settings tab icon or Appearance preview. Installed SDK source identifies its owner:

- `node_modules/expo-dev-menu/android/src/debug/java/expo/modules/devmenu/fab/MovableFloatingActionButton.kt`
- `node_modules/expo-dev-menu/android/src/debug/java/expo/modules/devmenu/modules/DevMenuModule.kt`: `ExpoDevMenu.setToolsButtonVisible`, updating the developer menu's `showFab` preference.

`DevQaTools` mounts once alongside the existing development controls, appended after the existing provider subtree so its sibling positions remain unchanged. In Android development only, it obtains the optional `ExpoDevMenu` native module and requests `setToolsButtonVisible(false)`. It awaits/catches the native result; an absent module/method safely skips the request. This avoids the public JS wrapper discarding the returned native promise. Shake/developer-menu access remains available. No app preferences, navigation, domain data or reload APIs are involved. Release and iOS paths do nothing.

The installed SDK exposes the API, so this change does not require native configuration or a new APK. The particular installed APK's capability and actual gear disappearance must still be checked physically. An older binary lacking the method remains usable but may retain its gear; a rejected native call logs a bounded development diagnostic rather than breaking startup. This updates only DevMenu's own debug visibility setting.

SDK/API references reviewed: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [SDK 58 DevMenu](https://docs.expo.dev/versions/v58.0.0/sdk/dev-menu/), [Expo documentation index](https://docs.expo.dev/llms.txt), plus the installed SDK/native implementation.

## Exact final validation

| Check | Result |
| --- | --- |
| `npm.cmd test` | Exit 0: **286 tests, 18 suites, 286 pass, 0 fail/cancelled/skipped/todo; 9800.0726 ms** |
| `npx.cmd --no-install tsc --noEmit` | Exit 0; no diagnostics |
| `npx.cmd --no-install expo lint` | Exit 0; no warnings/errors |
| Inventory regeneration, then independent in-memory generation/deep comparison | Exact match: **182 source files, 22 route roots, 175 reachable files, 118 candidate files, 1492 candidates** |
| `git diff --check` | Exit 0; no whitespace errors. Git emitted 21 LF/CRLF advisories; line-ending settings were not changed. |
| Existing external Expo Doctor **1.21.6**, `--verbose`, with network access | Exit 1: **19/20 checks pass**, only the same 13 SDK patch recommendations below |

Five new targeted tests exercise responsive composition, conditional screen/form boundaries, language icon ownership, executable NumericText behavior, and executable optional DevMenu behavior. Numeric cases include Arabic percentages, ratios, signs, dashes, English identity and mixed Arabic/English names. DevMenu cases cover Android debug, iOS, release, absent module, missing method and rejected native call. Existing Phase 4D source-boundary assertions now expect the new compositions. Historical stylesheet/English-copy preservation, missing-Intl, appearance, save-first language/preferences, navigation, domain/achievement and backup v1/checksum/recovery regressions all pass.

The first sandboxed Doctor attempt could not access Expo's schema service (`EACCES`). The completed network-enabled run used the existing compatible CLI at:

`C:\Users\Beeviro1\AppData\Local\Temp\momentum-doctor-7441495e4de54f8a984e89e2e3e35524\node_modules\expo-doctor\bin\expo-doctor.js`

No dependencies were installed, upgraded or suppressed. The final Doctor result is a warning/failing exit, not a 20/20 pass. All schema, peer dependency, native support package, duplicate, directory and other checks passed. Installed → recommended:

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

## Changed files and preservation

New files:

- `src/utils/arabic-composition.ts`
- `src/hooks/use-arabic-composition.ts`
- `src/components/dev-qa-tools.tsx`
- `tests/arabic-composition.test.mjs`
- `PHASE4E_ARABIC_LAYOUT_REPORT.md`

Modified files:

- `src/app/(tabs)/index.tsx`
- `src/app/(tabs)/habits/index.tsx`
- `src/app/(tabs)/goals/index.tsx`
- `src/app/(tabs)/insights/index.tsx`
- `src/app/(tabs)/settings.tsx`
- `src/app/_layout.tsx` (one null-rendering debug helper; provider nesting/keys unchanged)
- `src/components/habits/habit-row.tsx`
- `src/components/habits/habit-form.tsx`
- `src/components/goals/goal-card.tsx`
- `src/components/goals/goal-form.tsx`
- `src/components/insights/stat-tile.tsx`
- `src/components/insights/habit-insight-row.tsx`
- `src/components/insights/weekly-review-card.tsx`
- `src/components/settings/settings-row.tsx`
- `src/components/settings/language-selector.tsx` (icon only)
- `src/components/profile/profile-form.tsx`
- `src/components/routines/routine-form.tsx`
- `src/components/localized-native.tsx` (numeric alignment option only)
- `src/i18n/ar-messages.ts` (one Arabic progress sentence)
- `tests/rtl-visual.test.mjs`
- `LOCALIZATION_COPY_INVENTORY.json`

No changes to domain/storage/backup/recovery/achievement logic, preference schema or save authority, appearance authority, English resources, native configuration, package manifests/lockfiles or dependencies. No user-authored values are rewritten. Only the task-created `phase4e-edit.mjs`, `phase4e-forms.mjs` and `phase4e-test.log` disposable artifacts were removed after inspection/validation. Existing reports/fixtures were retained. No APK/build/install/device/reset/restore/commit/push/branch action was performed.

## Remaining risks and Android screenshot checklist

Automated checks exercise presentation decisions and compatibility boundaries; they do not render Android pixels or prove visual quality. Arabic font metrics, horizontal chip initial scroll placement, very long names/units, split-screen widths, large accessibility fonts, native menu visibility and TalkBack order require physical review. These are QA items, not claimed successes. Existing runtime-safe number/date/plural fallbacks remain unchanged.

1. **Today, Arabic:** capture the whole first viewport with existing habits visible. Check right-anchored greeting, compact text/ring balance, complete sentence/status, no gear overlay; repeat with large text or a narrow window for text-first stacking.
2. **Habits and Goals, Arabic:** capture list headers and mixed Arabic/English card names. Check right icon/title/metadata sequence, trailing affordances, Add actions, initial filter order, isolated chip counts, goal percentage/ratio order and linked-habit footer wrapping.
3. **Insights, Arabic:** capture overview and weekly/habit metrics. Check compact two-column overview/grouped statistics normally, right-aligned labels/values, complete captions, no clipped values or unexplained tall gaps. Repeat at large text.
4. **Settings, Arabic:** capture label/value/icon/chevron rows and Language dialog. Check globe icon, common right text edge, paragraph icon alignment, complete Save/Cancel/retry controls and accessibility focus/order. Check Profile and one Habit/Goal/Routine form with mixed input; cancel edits.
5. **Appearance:** compare key Arabic screenshots in Light and Dark, then confirm System follows Android. Check contrast and focus visibility.
6. **English return/reopen:** switch back, confirm original English compositions, native tab order/Back and saved language/appearance after reopening. Verify existing synthetic habits/goals/routines/history remain present. No data reset or restore is required.

Implementation is ready for review and physical Android visual QA; no release work was started.
