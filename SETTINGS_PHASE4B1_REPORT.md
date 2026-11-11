# Phase 4B-1: Today and shared navigation copy

Implementation-only handoff. Started with a clean working tree on `wip/settings-appearance-language` at checkpoint `2ed299cba1ff9b65408915c7f49ee124fc993389`; branch/HEAD remain unchanged. Read the Phase 4A report, migration plan and typed localization architecture before editing. No Phase 4B-2 work, Arabic/RTL activation, native configuration, dependency installation, APK build, device action, staging, commit or push was performed.

## Scope and coverage

The Today route and its reachable app-owned presentation copy now use semantic fixed keys or complete named-parameter messages. Public language remains **English/LTR** through the unchanged `useLanguage` gate. Language Settings remains read-only English. All Light/Dark/System preferences and theme/provider identities are unchanged.

| Reachable surface | Coverage in this phase |
| --- | --- |
| `app/(tabs)/index.tsx` | Greeting with/without a user name, uppercase English date header, profile accessibility description, progress heading/count/subtitle branches, remaining/save status, habit-load errors and retry, no-habit/rest-day empty states, weekday description, motivation heading/quote/credit |
| `components/today/habit-card.tsx` | Tick schedule fallback, Count value/target/unit display and done accessibility, Checklist required/total summaries, expanded/collapsed hints and done accessibility |
| `components/today/checklist-steps.tsx` | Optional badge and full optional-step accessibility message; user-entered step text is opaque |
| `components/today/progress-ring.tsx` | Display numerator/denominator and rounded percent caption; ratio, animation, rounding and colors remain unchanged |
| `components/today/progress-notices.tsx` | Saving/Saved labels, exact load/save failure instructions, Try again/Retry now actions; admission and save state are unchanged |
| `components/profile/name-prompt-card.tsx` | Title/body, Not now action/hint, Add your name, failed-dismissal retry text; save-first dismissal remains unchanged |
| `components/routines/todays-plan.tsx` | Load/retry visible/accessibility copy, heading, routine-count/Manage message, outside-habit and rest-routine footnotes, row accessibility/hint and compact progress |
| `components/routines/routine-badges.tsx` | Time-of-day labels and Now chip; bucket identity/order/hour thresholds remain unchanged |
| `components/achievements/achievements-summary-card.tsx` | Summary heading/earned count/loading/unavailable/next/progress/complete/view labels, Today encouragement, history/new celebration and dismiss accessibility; ID-keyed display names for the 12 built-in badges |
| Native/web `components/app-tabs*` | All five tab labels; web MOMENTUM brand and Docs label. Route names/hrefs/icons/style factories/transition behavior are unchanged |

Pass-through children were also inspected: `EmptyState` receives translated props and has no additional owned copy; `ProfileAvatar` is decorative and retains raw user initials; `CountControl` receives the localized parent description and retains standard native increment/decrement action identifiers. Those three components did not require source edits. Generic Text/theme wrappers and external-link behavior are unchanged. Nonlinguistic icon/role/state/action identifiers, user strings and list/math separators are not treated as translatable English prose.

## English compatibility and message design

- Preserved the actual current English wording, including straight apostrophes in “Today's Habits,” “Today's plan,” and “Let's build some momentum today.” Three unused seed values were aligned with that existing UI. Existing singular English wording such as `1 of 1 habits`, `1 of 1 steps`, `perfect day` and `finished perfect week` remains unchanged rather than being editorially corrected during migration.
- Today-specific numeric formatting keeps the original ungrouped English values (`1234`, not `1,234`), spaces around Count slashes, compact ring/plan slashes and percentage wording. The established default formatter still groups English numbers; only the Today adapter selects the compatibility policy. Numeric message parameters remain validated numbers. Arabic uses the established Arabic-Indic display policy.
- Full named messages replace conditional English fragments. Seven new plural messages include all Arabic zero/one/two/few/many/other forms. Counts, names, status/action labels and summaries can be reordered by the catalog. User names, units, descriptions, routine titles and checklist labels remain literal; interpolation never evaluates their braces or `$&` text.
- `LocalizedInline` renders no new native View. A collision-safe named text slot preserves the existing nested Text styling for the profile name/newline, saved status, Manage/Retry action and ring denominator. Its slot is restricted to string parameters by TypeScript. Original style factories for all 11 migrated UI modules match a checkpoint-derived baseline exactly; no geometry or palette edits were made.
- English date/greeting presentation delegates to the existing helpers, preserving uppercase month/day format and hour thresholds. Only future Arabic rendering uses a lazily created Gregorian Arabic header formatter. The rest-day weekday still derives from the provider's local date key. Date arithmetic, midnight ownership and ISO/local machine keys are unchanged.
- Schedule presentation delegates to the existing English description and preserves Monday-first display order. Arabic labels explicitly describe the existing Monday–Friday and Saturday/Sunday groups rather than assuming a different regional workweek. All 128 weekday combinations are tested.
- Existing daily quote selection is still called unchanged. Only a known built-in quote/credit pair is mapped to catalog resources at display time; unknown text is returned unchanged. English quotes/attributions match for an entire year. Proper author names remain as before, with “Unknown” localized in Arabic. Attribution accuracy was not re-researched or changed; Arabic translations remain draft copy requiring native review.
- Badge names are mapped by existing IDs only in the summary/celebration presentation. Unknown IDs/names fall back unchanged. The summary's existing display clamp and metric units are preserved; no achievement evaluation, award, acknowledgement, criteria, threshold or storage logic changed.

## Shared components and affected routes

No other screen route file was edited. Shared presentation changes also appear in:

- **Routine detail** (`app/routine/[id].tsx`): HabitCard/ChecklistSteps, ProgressRing, ProgressNotices and TimeChip. The parent route's other English copy and its default-English `saveLabel` call remain future migration work.
- **Settings**: the shared AchievementsSummaryCard has migrated presentation but identical current English output. Appearance/Language controls are untouched.
- **Achievements screen**: only its existing shared AchievementCelebration adopts the localized display names/count/dismiss copy. Full AchievementCard, badge criteria/details and data-note UI remain untranslated.
- **Routine lists/details**: existing TimeChip consumers receive translated labels from the same closed English gate. Routine list/form/detail route copy is not otherwise migrated.
- **Every tab**: native/web tab labels use the unchanged English gate while route identities, targets, icons and state remain fixed.

These are deliberately isolated shared-component effects, not full migrations of Settings, Routines, Habits or Achievements. Arabic remains unavailable until all required surfaces and RTL acceptance gates are separately completed.

## Catalog and inventory state

Added **69 fixed bilingual labels** and **36 named bilingual messages**, including **seven plural messages**. Total resources are now **216 fixed labels** and **62 parameterized messages**. The paired Today resource modules make this feature scope reviewable independently of later migrations.

`LOCALIZATION_COPY_INVENTORY.json` was regenerated with the unchanged canonical-LF hash helper. It now records **163 source files**, **22 route/layout roots**, **156 conservatively reachable files**, and **1,355 candidates across 111 files**. This coarse inventory also counts semantic lookup keys as prose-like strings; the count is not a metric for untranslated copy. Targeted AST coverage checks find no hardcoded app-owned visible JSX/copy attributes in the 11 migrated modules. The artifact's reproduction and normalized hashes pass the existing consistency test.

The existing Phase 4A inventory/plan/report numbers remain historical snapshots; those documents were not overwritten.

## Changed files

Modified existing files (19):

1. `src/app/(tabs)/index.tsx`
2. `src/components/app-tabs.tsx`
3. `src/components/app-tabs.web.tsx`
4. `src/components/today/habit-card.tsx`
5. `src/components/today/checklist-steps.tsx`
6. `src/components/today/progress-ring.tsx`
7. `src/components/today/progress-notices.tsx`
8. `src/components/profile/name-prompt-card.tsx`
9. `src/components/routines/todays-plan.tsx`
10. `src/components/routines/routine-badges.tsx`
11. `src/components/achievements/achievements-summary-card.tsx`
12. `src/i18n/en.ts`
13. `src/i18n/ar.ts`
14. `src/i18n/en-messages.ts`
15. `src/i18n/ar-messages.ts`
16. `src/i18n/types.ts` — shares the numeric parameter registry between types/runtime and adds the numeric fields used by the migrated messages.
17. `src/i18n/translate.ts` — optional number-format callback; default translation behavior is preserved.
18. `tests/localization.test.mjs` — existing catalog-wide tests now generate all declared named parameters for plural messages with multiple parameters; no assertions or test cases removed.
19. `LOCALIZATION_COPY_INVENTORY.json`

Added files (10):

1. `src/i18n/today-en.ts`
2. `src/i18n/today-ar.ts`
3. `src/i18n/today-en-messages.ts`
4. `src/i18n/today-ar-messages.ts`
5. `src/i18n/today.ts` — pure feature display adapters, scoped numeric policy and rich message slot helper.
6. `src/components/localized-inline.tsx`
7. `tests/today-localization.test.mjs` — 11 focused tests.
8. `tests/support/today-localization-typecheck.ts` — compiled positive/negative parameter/slot contracts, never executed by the app.
9. `tests/support/today-presentation-baseline.json` — source-derived style/navigation baseline from `2ed299c`; no user data.
10. `SETTINGS_PHASE4B1_REPORT.md`

## Preservation and validation

A raw SHA-256 baseline covered **221 existing source/test/script/report/config files** before edits. Final comparison found exactly the 19 intended modified files listed above, **202 existing files unchanged**, and zero missing files. All `src/data/`, `src/utils/`, `src/hooks/`, root/navigation layouts, Settings/Appearance components, theme constants, package/lock/native/EAS config and prior reports are unchanged. No source-hash helper/Git line-ending settings changed.

| Check | Exact final result |
| --- | --- |
| Full `npm.cmd test` | Exit 0; **257 tests**, 18 suites; **257 passed**, 0 failed/cancelled/skipped/todo; **5551.4025 ms** |
| `npx.cmd --no-install tsc --noEmit` | Exit 0; no diagnostics; includes new Today message/rich-slot type contracts |
| `npx.cmd --no-install expo lint` | Exit 0; no errors or warnings |
| `git diff --check` | Exit 0; no whitespace errors; standard LF-to-CRLF advisories only |
| Localization inventory consistency | Passed in full suite: deterministic regeneration, all source hashes, route-root coverage; 163 files / 22 roots / 1,355 candidates |
| External Expo Doctor **1.21.6**, `--verbose` | Exit 1; **19/20 checks passed**, solely the continuing 13 SDK patch recommendations below |

Doctor invocation used the already installed external compatible CLI, without dependency installation:

```powershell
node 'C:\Users\Beeviro1\AppData\Local\Temp\momentum-doctor-7441495e4de54f8a984e89e2e3e35524\node_modules\expo-doctor\bin\expo-doctor.js' 'D:\Projects\momentum' --verbose
```

| Package | Installed | Doctor recommends |
| --- | --- | --- |
| `@expo/ui` | 58.0.27 | ~58.0.28 |
| `expo` | 58.0.23 | ~58.0.24 |
| `expo-constants` | 58.0.15 | ~58.0.16 |
| `expo-crypto` | 58.0.7 | ~58.0.8 |
| `expo-dev-client` | 58.0.18 | ~58.0.19 |
| `expo-font` | 58.0.11 | ~58.0.12 |
| `expo-linking` | 58.0.16 | ~58.0.17 |
| `expo-router` | 58.0.30 | ~58.0.31 |
| `expo-sharing` | 58.0.22 | ~58.0.23 |
| `expo-splash-screen` | 58.0.13 | ~58.0.14 |
| `expo-status-bar` | 58.0.4 | ~58.0.5 |
| `expo-symbols` | 58.0.4 | ~58.0.5 |
| `expo-web-browser` | 58.0.7 | ~58.0.8 |

All other Doctor checks passed, including required peers, native support packages, config schema and duplicate dependencies. Nothing was upgraded or excluded to suppress this warning. The expected achievement save/retry failure-injection diagnostic remains in the passing test suite.

Tests cover exact English samples/branches (including large ungrouped counts), fixed copy/accessibility coverage, style factories and route targets, named rich slots, Arabic key/parameter/plural parity, 128 schedule combinations, 24 greeting hours, a full year's quote selection/credits, all 12 summary badge names, display progress clamping and synthetic domain/plan/backup v1 body/checksum isolation. Existing appearance, preference, restore/rollback/recovery and language-gate tests also pass. Tests do not mount native UI or access real device records.

## Remaining surfaces and risks

- Full Habits, Goals, Routines, Insights, Profile editor, Settings, AchievementCard/criteria/details/data notes, Backup and recovery overlays remain later migration work. Global startup/recovery and provider error producers are unchanged; they are not classified as completed Today features.
- The targeted source audit checks visible JSX and copy attributes; dynamic/helper coverage additionally relies on the enumerated adapters and compatibility tests. It is not a blanket claim that the entire app is localized.
- Arabic resources are draft, including translated motivation quotations. Native Arabic review, attribution/editorial review, Hermes Intl behavior, text shaping, screen-reader output and RTL/device-locale cases remain future gates. English wording and credits were preserved, not corrected or re-attributed.
- Style/route checks provide strong source evidence but do not prove identical native line wrapping, TalkBack grouping, focus or snapshot appearance. Physical English regression QA remains pending for this phase. No claim of Android or web visual acceptance is made.
- No native rebuild is required: this is JS/TypeScript presentation work with existing native modules/config. Use the current development APK with Metro for QA. No APK was built or installed here.

## Android QA checklist (English/LTR only)

1. Use existing user data without reinstalling/clearing anything. Confirm Language remains read-only English and no Arabic/RTL/DEV language control is exposed. Verify Light/Dark/System switching and persistence still work.
2. Compare Today in Light/Dark/System with the checkpoint screenshots: uppercase date, named greeting newline/style, anonymous greeting punctuation, progress ring/denominator/percent, labels, numbers, spacing and motivation quote/credit. Include a large Count value to confirm no newly inserted grouping commas.
3. Exercise Tick, Count and Checklist (required plus optional steps) and collapse/expand. Check names, descriptions, units, titles, colors and step text remain unchanged. Verify edit-disabled/loading/error behavior and saved progress remain consistent across restart.
4. Check no-habit, no-habits-due/rest-day, normal/provisional progress and visible Saved/Saving states. For load/save-failure UI use an approved disposable/failure-injection environment; do not corrupt or clear real data. Verify exact notices and retry actions.
5. Review Today's plan with one/multiple routines, outside habits, rest routines and the Now chip. Check count/Manage styling, titles and progress; tap row/Manage and verify Back returns to the originating Today tab.
6. Check first-run name prompt and its Not now/Add your name actions; use a safe existing test profile rather than resetting real preferences. Verify saved prompt dismissal, failure feedback and name display. Inspect Today achievement summary, next progress, earned/complete states, and both history/new celebration cases; acknowledgement behavior must remain as before.
7. With TalkBack, verify profile, Tick/Count/Checklist controls, optional-step labels, expanded hints, routine descriptions, retry, celebration dismissal and tab labels retain readable full English messages and correct checked/disabled/expanded state. Rich name/action/denominator styling must not split speech unexpectedly.
8. Verify all five native tabs, stack state and Back behavior. Spot-check Routine detail's shared habit/ring/notices, routine list/detail time chips, Settings' achievement summary and Achievements' shared celebration for unchanged English copy and styles.
9. Test narrow widths and large font/display scaling for greeting, saved-status, plan Manage/Retry, footnotes and summaries. Confirm controls remain reachable, user text is literal, no replacement-character/hidden marker appears, and all data remains intact.

Stop after Phase 4B-1 for review. No Arabic/RTL activation or Phase 4B-2 implementation is authorized by this report.
