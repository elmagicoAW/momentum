# Appearance and Language implementation plan

Planning baseline: `cbd23fa` (current HEAD), 9 November 2026. Planning only; no implementation, dependency installation, native configuration changes, commit, or push is authorized by this document.

## 1. Recommended outcome and decisions

- Offer Light, Dark, and System appearance. Resolve System from the live device appearance and react to changes while running or returning from the background. Explicit choices stay fixed.
- Offer English and العربية. Translate application-owned copy throughout the app, including errors, validation, accessibility, recovery, achievements, dates, and navigation. Keep user-authored content unchanged.
- Use typed English/Arabic dictionaries, React context, existing AsyncStorage, and standard `Intl` APIs. No new dependency is needed for explicit in-app language selection or the recommended runtime layout approach.
- Use SDK 58 Expo Router `LocaleProvider` for navigation direction and explicit root content direction for layout. Do not use global `I18nManager.forceRTL` as the normal language-switch mechanism. Validate native tabs and text inputs on the actual Android build before committing to seamless switching.
- Store preferences separately from profile and domain records. Default to **Dark + English** for a missing preference record, preserving this milestone's existing experience. System remains an explicit option; a future change to first-install defaults should be a separate product decision.
- Keep preferences **device-local and excluded from manual backup v1**. Existing backups and recovery journals remain compatible; restoring does not change language or appearance. Explain this in Data & Backup copy.
- Plan one new development APK to change `userInterfaceStyle` from `dark` to `automatic`. Much of the JS work can be tested against the existing APK with Metro, but complete System behavior cannot be certified against the current dark-locked binary.

## 2. Discovery findings

### Runtime, build, and navigation

`package.json` has Expo `~58.0.23`, Expo Router `~58.0.30`, React Native `0.88.1`, TypeScript `~6.0.3`, AsyncStorage `2.2.0`, and installed `expo-system-ui`, `expo-status-bar`, `expo-splash-screen`, and `expo-dev-client`. `expo-localization` and `expo-updates` are not declared. The project uses `package-lock.json`; no Bun lock was found. Use local `npx.cmd --no-install` commands for checks and `npx expo install` for any subsequently approved dependency.

`app.json` declares `userInterfaceStyle: "dark"`, dark root/splash background, `MOMENTUM Dev`, and Android package `com.beeviro1.momentum.dev`. `eas.json` already provides an internal development APK profile. Native directories are absent: retain CNG and never hand-edit generated Android/iOS projects.

`src/app/_layout.tsx` wraps the app in a constant dark Router `ThemeProvider`, then `DataBackupProvider`, Profile, Habits, DailyProgress, Achievements, Goals, and Routines providers. Status bar is permanently light. Root and nested stacks contain explicit `slide_from_right` animations. Preserve the root tab anchor, route identifiers, deep links, return-to-origin behavior, and provider order/dependencies.

`src/components/app-tabs.tsx` uses native tabs with English labels and fixed palette colors. The separate `app-tabs.web.tsx` uses themed primitives and English labels, with physical margins. Both need attention. Native tabs are an explicit Android RTL acceptance gate, not something a JS layout test can prove.

### Theme and styles

`src/constants/theme.ts` contains two overlapping systems: starter `Colors.light/dark` and the actual dark-only `Palette`. `use-theme.ts` uses the starter scheme; native `use-color-scheme.ts` re-exports RN's hook, while its web variant handles hydration. Most product screens bypass these hooks and import `Palette` directly into module-level `StyleSheet.create` calls. Changing a context alone will not update those captured colors.

A discovery search for palette/hex/RGBA usage found 866 matches across 72 source files. This is a migration scope indicator, not 866 distinct defects. White ripples, black/white text, alpha fills, rings, chart tracks, badges, overlays, and user-picked accent colors need classification. `HABIT_COLORS` explicitly describes dark-surface colors; preserve stored hex values and adapt surrounding surfaces/foregrounds rather than rewriting user data.

Animated splash components call `SplashScreen.hideAsync` on layout. `DataBackupProvider` also hides it to display startup/recovery UI. Consolidate readiness coordination without letting a preference read delay recovery indefinitely or cause a black screen.

### Settings, copy, and formatting

`src/app/(tabs)/settings.tsx` has read-only Theme: Dark and App language: English rows, a dark-only footer, and a More languages/Coming later row. `settings-row.tsx` has hardcoded Coming later, a right chevron, right-aligned values, and a white ripple. Convert the two settings to functional selectors and remove obsolete placeholder copy.

Copy is spread across JSX, providers, utilities, metadata, alerts, and storage/backup errors. Examples that cannot be solved by translating screens alone:

- `src/utils/date.ts`: English day/month arrays, greetings, and formatted ranges mixed with essential date arithmetic.
- `src/components/insights/format.ts`: English singular/plural helper and percentages; `src/utils/insights.ts`: English statuses, missing-step labels, and period labels embedded in derived objects.
- `src/utils/{habit,goal,routine,profile}-validation.ts`: English field errors; `routine-list.ts` and storage/providers expose operational errors.
- `src/utils/confirm.ts`: hardcoded native Cancel text.
- `src/data/habit-options.ts`: English icon/color labels with stable stored keys/hex values.
- `src/data/achievement-definitions.ts`: 12 achievement names, groups, criteria, details; achievement IDs and metrics are stable domain identifiers.
- `src/data/backup-format.ts`: English preview summaries, warnings, and errors. Backup service/native adapters/runtime checks and `use-data-backup.tsx` supply visible recovery/result text before normal screens exist.

A physical-direction/animation search found 166 matches across 54 files, including benign safe-area edges and English prose. Audit actual styles and icons individually; do not globally replace text or mirror everything.

### Storage and backup safety

Existing storage modules use versioned `momentum:*` keys with strict parsers. `createValueStore` is save-first and serialized: failed/slow/corrupt reads cannot be overwritten by defaults; failed writes leave the last saved state intact. It also uses `persistence-coordinator` admission leases and generations.

`DataBackupProvider` freezes persistence during boot recovery, blocks domain providers until ready, and remounts children by generation after replacement/recovery. The coordinator also controls automatic normalization/achievement awards after restore. These protections must remain intact.

`backup-keys.ts` explicitly allows only domain/profile/achievement/history/migration families. `backup-format.ts` verifies an exact `schemaVersions` object, exact metadata structure, raw records, and checksum. `backup-service.ts` captures and replaces only allowlisted keys, writes and verifies recovery files, drains in-flight mutations, and verifies exact snapshots. Simply adding a preferences family or schemaVersions member would break old files, including journals required at startup.

## 3. Architecture

### Preferences storage and lifecycle

Create `src/data/preferences-storage.ts` with `momentum:preferences:v1` and an envelope `{ version: 1, preferences: { appearance: 'light' | 'dark' | 'system', language: 'en' | 'ar' } }`.

- Missing key: return in-memory Dark/English without writing. There is no existing preference record to migrate and no need to change profile/domain schemas.
- Validate enums, envelope version, and field types. Define a deliberate v1 policy for missing individual fields (default those fields in memory); reject invalid present values and unknown future versions. Do not silently repair/write unknown records.
- On read failure/corruption, render with safe in-memory defaults and expose a localized retry/error state; disable preference saves until a successful read. Keep domain functionality available. Never clear AsyncStorage or reset domain data to recover a preference error.
- Use save-first serialized commits; save a single whole preference record per change. Disable duplicate taps while saving, show the saved choice only after success, retain the previous selection on failure, and provide retry. Concurrent appearance/language updates must compose from the last saved whole record.
- Match `createValueStore` semantics, but do not blindly instantiate it above the recovery gate: its admission barrier is frozen at boot, and its lifetime captures a domain generation. Also, its `commit` enables domain normalization/awards. A presentation preference must not enable those after restore.
- Recommended: extract/reuse the serialization/save-first core with an explicit independent storage policy, or implement a small preferences-specific queue with equivalent tests. Preferences are outside backup replacement and never call `enableUserChanges`/`enableAwards`. Read-only hydration can run outside the domain barrier. Block preference controls during backup activity via `useDataBackup().busy`; admitted preference writes target only the excluded key and cannot invalidate raw domain snapshots.

Create `src/hooks/use-preferences.tsx` as a stable provider above `DataBackupProvider`, so recovery UI can use the chosen language/theme and restore remounts do not reset preferences. Do not key this provider, domain providers, or the navigator by theme/language.

Suggested root structure: PreferencesProvider → presentation bridge (theme + locale) → ThemeProvider/LocaleProvider → DataBackupProvider → existing domain provider chain → routes. Recovery overlays consume presentation contexts directly. Keep startup recovery unconditional; preference initialization errors must not prevent it from running.

Bound the visual startup wait, not the underlying storage operation: show a themed/loading fallback after a short limit and never grant writes because a timeout elapsed. Ignore obsolete loads using tokens. Resolve persisted preferences before the first normal app frame where possible; synchronize the splash overlay and recovery screen with readiness. A fixed native splash can remain dark as a documented launch surface; the animated JS overlay must use the active palette.

### Appearance

Extend `src/constants/theme.ts` with a shared `AppPalette` shape and complete light/dark palettes. Keep the current dark values as the regression reference. Add semantic tokens for foreground-on-accent, disabled states, ripple, overlays, warning, chart grid/heatmap levels, and other audited uses. Keep geometry/font constants scheme-independent.

Create `src/hooks/use-app-theme.tsx`, exposing saved appearance, resolved scheme, and palette. Use RN's live `useColorScheme`; `system` resolves from it, with deterministic dark fallback if unavailable. Do not cache a scheme once at module import. If using RN `Appearance.setColorScheme` for native alerts/pickers, use the installed RN 0.88 API and restore `'auto'` for System; the hook can reflect app overrides, so verify explicit → System clears the override and does not form a feedback loop. Test the native result rather than treating JS surface changes as proof.

Use the active Router light/dark base theme imported from `expo-router`, overriding its semantic colors. Update status-bar icon contrast, root view background through already-installed `expo-system-ui`, stack content, tabs, loading indicators, keyboard appearance where supported, and all modal/error/recovery surfaces.

Move palette-dependent styles into pure `createStyles(palette)` factories cached by palette identity, or combine static layout styles with a small dynamic color layer. Pass palette to pure helpers such as alpha fallbacks. Avoid mutable global palettes, module-level snapshots, inline recreation of every style, and a second competing theme source. Migrate starter themed primitives/hooks to the same resolved scheme.

Verify normal text contrast (4.5:1), large text/icons and control boundaries, selected/unselected states, danger/success/warning, charts, and all saved accent colors on both backgrounds. Do not depend on color alone for completion or status.

### Localization

Create `src/i18n/en.ts`, `ar.ts`, `types.ts`, `translate.ts`, `format.ts`, and `errors.ts`, plus `src/hooks/use-language.ts` derived from preferences.

- Typed semantic keys grouped by common, navigation, settings, today, habits, goals, routines, insights, profile, achievements, backup, validation, and accessibility. Arabic must satisfy the English key structure and parameter contracts.
- Translation functions use named parameters and full sentences, not English fragments joined in JSX. Implement a small tested plural helper using `Intl.PluralRules`: Arabic needs zero/one/two/few/many/other, English one/other. Avoid shipping a general template engine; use typed functions for complex messages.
- Production fallback to English prevents blank UI, but missing keys/parameters must fail catalog tests and warn in development. Native Arabic review is a release gate; automated translation/key coverage cannot certify wording.
- Store error codes/message descriptors and parameters in state, not translated strings. Render them with the current translator so existing errors and success notices update on a switch. Unknown underlying errors receive a localized safe generic message; do not expose raw native/English `Error.message` by default.
- Preserve `RecoveryBlocked` type checks and recovery control flow when adding error codes. Stage error descriptor conversion at presentation boundaries; avoid changing backup integrity logic to translate its UI.
- Convert validation results to typed descriptors and update form renderers/tests together, retaining all existing limits and validation decisions. Destructive confirmations receive translated Cancel and action labels. Already-open OS dialogs may retain the language in which they were opened; subsequent dialogs use the new language.
- Separate formatting from date arithmetic. Keep local date keys ASCII `YYYY-MM-DD`, ISO timestamps, Monday-first weeks, schedule weekday IDs, and all aggregation semantics unchanged. Use explicit locale and Gregorian calendar for UI dates; Arabic must not silently switch the goals calendar to Hijri.
- Use `Intl.NumberFormat`, percent/date formatting, and plural rules with deterministic locale choices (English `en`, Arabic `ar`, explicit Gregorian dates). Pick Arabic digit presentation consistently; normalize Arabic-Indic and Eastern Arabic-Indic digits at numeric-input boundaries before existing validators, without altering stored numbers or loosening bounds. Keep backup raw JSON/checksum/version/IDs machine-readable and untranslated.
- Return semantic facts from insights/domain computations where feasible; localize labels at render time. Include locale in memo dependencies only when a memo genuinely builds display text. Do not rebuild history indexes or reevaluate achievements just to change language.
- Do not translate or rewrite user habit names/descriptions/count units/checklist steps, goal/routine text, profile names, historical snapshots, or unknown stored achievement IDs. Translate built-in option labels by stable ID. Inspect demo habits separately: preserve any existing saved demo text; localize an unsaved seed's presentation only if it can be done without changing seed IDs/history or making language switch persist data.

### RTL and switching

SDK 58's current localization guide explicitly supports `LocaleProvider` from `expo-router` for runtime navigation direction. The installed package exports it. Use `direction={language === 'ar' ? 'rtl' : 'ltr'}` and set app content direction separately with an explicit root `direction`. For web set the appropriate `dir`/language attributes with SSR-safe defaults and update after hydration. Keep a single authoritative language/direction value.

Recommended approach: app-controlled runtime direction, independent of device language. Test English on an Arabic device as carefully as Arabic on an English device, because SDK 58 defaults global RTL support to device detection. Read `I18nManager.isRTL` only for diagnostics/adapter decisions; do not treat it as the selected app language. Explicitly verify native components that still consult the global value.

- Prefer logical padding/margin/start/end positioning; explicitly align text by app language. Use flex shrinking/wrapping and adequate Arabic line height; remove inappropriate letter spacing from Arabic headings. Use system fonts initially and test Arabic shaping, diacritics, emoji, mixed content, and large font scale before adding a font asset.
- Use inherited content direction for rows. Do not combine automatic RTL flow with indiscriminate `row-reverse`, `scaleX(-1)`, or left/right swapping. Test absolute positions, rings, checklist controls, drag/reorder buttons, and count steppers individually.
- Mirror only directional back/forward/chevron/reorder semantics. Preserve check marks, clocks, brands, trash, plus/minus meanings, and artwork. Define a shared directional icon helper. Revisit hardcoded `slide_from_right` in root and tab stacks: select direction-aware transitions or documented navigator defaults; keep bottom-entry forms vertical.
- Calendar columns, weekday headers, period arrows, heatmap labels, bars, and touch targets must agree. Keep date identity and week calculations intact. Choose and document a consistent chronological chart orientation; do not reverse data arrays merely because labels are Arabic. Test accessibility traversal and visible order together.
- Mixed user content should retain natural text direction; filenames, raw JSON, storage keys, ISO dates, and technical identifiers need explicit LTR presentation or bidirectional isolation. Do not persist bidi markers into user data. Inputs retain selection, cursor position, keyboard usability, and unsaved text.
- Same-screen theme/language changes should rerender presentation without remounting providers or wiping navigation/form state. Open selectors only from Settings; disable while saving/restoring, preserve focus, expose radio roles/selected state and localized announcements, allow Back/cancel, and return focus to the triggering row.

Alternative evaluated: global `I18nManager.allowRTL/forceRTL` + restart. RN documents these changes as persisted and effective on the next application start; RN cautions against production forcing. It can align global/native layout but introduces app restarts, draft loss, global/device-language coupling, and rollback complexity. Do not add `expo-updates` solely for its reload example; it is absent here. A Metro refresh is not a reliable substitute for a verified native direction restart.

Fallback gate: if runtime direction fails native tabs/gestures on RN 0.88.1, do not ship a half-RTL UI. First investigate SDK-supported per-navigator/native direction behavior. If unavoidable, prepare a separate restart-based design with save/drain checks, clear Apply/restart messaging, one-shot mismatch detection, loop prevention, cold-start verification, and rollback of global RTL flags. Obtain approval for that changed UX/native scope before implementation. No restart should occur during restore/recovery or pending domain saves.

## 4. File inventory and proposed edits

All paths below are relative to the repository. Directory groups mean every listed existing file must be audited; each touched surface gets translation, theme, and RTL review together.

| Area | Exact existing paths / files | Required work |
| --- | --- | --- |
| Root/navigation | `src/app/_layout.tsx`; `src/app/(tabs)/_layout.tsx`; `src/app/(tabs)/habits/_layout.tsx`; `src/app/(tabs)/goals/_layout.tsx`; `src/app/(tabs)/insights/_layout.tsx`; `src/components/app-tabs.tsx`, `app-tabs.web.tsx` | Stable preference/presentation providers, Router theme and locale, native labels/colors, transitions, startup/status bars |
| Today | `src/app/(tabs)/index.tsx`; all files in `src/components/today/`; `src/components/routines/todays-plan.tsx`; `src/components/profile/name-prompt-card.tsx` | Greeting/date, progress, counts, checklist accessibility, warnings/retries, today's routine plan |
| Habits | `src/app/(tabs)/habits/index.tsx`, `[id].tsx`, `new.tsx`, `routines.tsx`; all files in `src/components/habits/` | List/detail/create/edit/archive/delete, empty/error/loading states, tracking/schedule/icon/color/checklist forms |
| Goals | `src/app/(tabs)/goals/index.tsx`, `[id].tsx`, `new.tsx`; all files in `src/components/goals/` | Statuses, goal actions, links, target-date calendar, consistency summaries and errors |
| Routines | `src/app/routine/[id].tsx`, `new.tsx`, `edit/[id].tsx`; all files in `src/components/routines/` | Timing labels, badges, habit order, missing links, return navigation and forms |
| Insights | `src/app/(tabs)/insights/index.tsx`, `habit/[id].tsx`; all files in `src/components/insights/`; `src/utils/insights.ts`; `src/hooks/use-insights.ts` | Period labels, chart/calendar axes, detail panels, weekly review, status/unknown history explanations and cached text |
| Settings/profile | `src/app/(tabs)/settings.tsx`; `src/app/profile/edit.tsx`; all files in `src/components/settings/` and `src/components/profile/` | Working selectors; translated summaries/privacy/about/version text; profile form/avatar accessibility |
| Achievements | `src/app/achievements.tsx`; all files in `src/components/achievements/`; `src/data/achievement-definitions.ts` | Translate names/groups/criteria/details, locked/unlocked/unread labels and evidence; preserve IDs/award records |
| Backup/recovery | `src/app/data-backup.tsx`; `src/hooks/use-data-backup.tsx`; `src/data/backup-format.ts`, `backup-service.ts`, `backup-runtime-check.ts`, `backup-native-loader.ts`, `backup-native-implementation.ts`, `backup-io.ts`, `backup-files.ts`, `backup-files.native.ts`, `backup-files.web.ts` | All app-owned preview/error/success/recovery/file-operation copy; safe descriptor mapping; preserve wire format and journal behavior |
| Theme/shared UI | `src/constants/theme.ts`; `src/hooks/use-theme.ts`, `use-color-scheme.ts`, `use-color-scheme.web.ts`; `src/components/themed-text.tsx`, `themed-view.tsx`, `hint-row.tsx`, `placeholder-screen.tsx`, `ui/collapsible.tsx`, `animated-icon.tsx`, `animated-icon.web.tsx`, `animated-icon.module.css`, `external-link.tsx`, `web-badge.tsx`; `src/global.css` | One theme authority; shared text/layout conventions; splash/web copy, physical styles, colors and link accessibility |
| Validation/options/date | `src/utils/habit-validation.ts`, `goal-validation.ts`, `routine-validation.ts`, `profile-validation.ts`, `routine-list.ts`, `date.ts`, `schedule.ts`, `confirm.ts`; `src/data/habit-options.ts`, `demo-habits.ts` | Message descriptors, plural/date formatting, localized option labels and seed policy; retain validation/domain semantics |
| Provider/error sweep | `src/hooks/use-profile.tsx`, `use-habits.tsx`, `use-goals.tsx`, `use-routines.tsx`, `use-daily-progress.tsx`, `use-completion-history.ts`, `use-achievements.tsx`; `src/data/*-storage.ts`, `list-store.ts`, `value-store.ts`, `save-queue.ts`, `persistence-coordinator.ts`, `achievement-coordinator.ts` | Trace every error reaching UI; translate at boundary without changing synchronization, storage parsers, or award logic |
| Navigation utilities | `src/utils/navigation.ts`, `routine-navigation.ts`; existing navigation tests | Preserve destinations, anchors, Android Back and return-to-origin behavior |
| Native/config/docs | `app.json`; `ANDROID_DEV_BUILD_PLAN.md`; `README.md` | Approved future automatic appearance config and documented rebuild/QA; retain identity/signing |

New files proposed:

- `src/data/preferences-storage.ts`
- `src/hooks/use-preferences.tsx`, `use-app-theme.tsx`, `use-language.ts`
- `src/i18n/en.ts`, `ar.ts`, `types.ts`, `translate.ts`, `format.ts`, `errors.ts`
- `src/components/settings/preference-selector.tsx` (reusable accessible modal/radio list, no new route required)
- `src/components/ui/directional-icon.tsx` and `src/utils/layout-direction.ts` (centralize audited direction semantics; avoid building an unnecessary component framework)
- `tests/preferences-storage.test.mjs`, `preferences-store.test.mjs`, `localization.test.mjs`, `localized-format.test.mjs`, `appearance.test.mjs`, `preferences-backup.test.mjs`
- `SETTINGS_APPEARANCE_LANGUAGE_ANDROID_TESTS.md` with evidence/results during implementation.

No package/package-lock changes are expected for the recommended path. Do not refactor unrelated features. An unused starter component can stay unused, but audit its reachable copy rather than assuming all shared components appear in the product.

## 5. Backup policy and compatibility

Recommendation: appearance and language are device presentation preferences, excluded from backup v1. The user can independently choose them on each install. Rename explanatory UI wording as needed to say which data is included; the existing `all-user-data` wire identifier remains untouched for compatibility.

- Leave `backupVersion`, `schemaVersions`, `isUserKey`, checksum canonicalization, parser limits, allowlists, replacement/deletion, and journal format unchanged.
- Verify `momentum:preferences:v1` is ignored on capture and survives ordinary, empty, failed, rolled-back, and recovered restores byte-for-byte. Test unknown future preference keys are also excluded.
- Old backups import exactly as before. New backups remain consumable by the stable version because they have unchanged metadata and raw domain schemas. Presentation strings must not enter raw records.
- A language/theme switch must not create demo habits, alter migration precedence, change progress/history, mark achievements seen, award badges, enable normalization, or change domain timestamps. Capture exact raw domain records before/after to demonstrate this.
- Recovery uses the current device preferences even while domain data is blocked. Its fallback messages must be understandable when preference hydration fails. Saving a recovery copy remains possible in both languages and themes.

If preference portability is later approved, design a separate versioned backup extension. The current parser compares the entire schema manifest exactly; adding an optional field is not automatically backward compatible. A future reader must accept the legacy v1 manifest and journal snapshots, explicitly validate the new format, define missing-preferences restore behavior, and defer applying restored presentation until replacement verification completes. Do not combine that format migration with this settings milestone.

## 6. APK versus Metro matrix

| Change | Existing development APK / Metro | New APK? |
| --- | --- | --- |
| Dictionaries, selectors, preference AsyncStorage, palette conversion | JS-only; test immediately | No |
| Router `LocaleProvider` and content direction using installed packages | JS-level approach; verify actual Android native behavior | No dependency/config rebuild inherently required |
| Complete device-following System appearance | Current config is dark-locked; JS preview is insufficient | **Yes:** `userInterfaceStyle: automatic` and inspect generated config |
| Root/status-bar updates with installed modules | JS runtime changes | No, provided existing APK contains declared modules |
| New native modules, including `expo-localization`, if later chosen | Missing modules cannot be supplied by Metro | Yes |
| `expo-localization` supportedLocales/plugin changes or native RTL flags | Native config | Yes |
| Native splash assets/background variants or bundled native font config | Build-time assets/config | Yes |

SDK 58 enables RTL support by default according to current Expo guidance. Do not assume an older `extra.supportsRTL` recipe is required or add a localization plugin just to duplicate defaults. Inspect the resolved configuration/installed APK before asserting its native RTL flags. The actual installed APK was not introspected during planning; repository config and declared dependencies are evidence of intent, not proof of its contents.

For the approved future rebuild: use `npx eas-cli@latest build --platform android --profile development`. Keep package ID and signing credentials unchanged and install over the existing app without uninstalling/clearing data. Verify signing compatibility first. Do not create native directories by hand. Do not claim native config updates can ship through Metro or OTA. Per-app Android OS language settings are outside this explicit two-language selector scope; adding supportedLocales later requires defining precedence with the saved in-app choice.

## 7. Phased implementation and exit gates

1. **Baseline and RTL spike.** Record clean HEAD and a verified backup, seed representative tick/count/checklist/history/goals/routines/awards/profile data, and record raw domain snapshots. Prototype the SDK 58 locale/content-direction approach only after approval. Exercise English/Arabic against both device languages, native tabs, stack transitions, gestures, text inputs, and Back. Exit: runtime approach demonstrated or a revised restart design explicitly approved.
2. **Preferences and presentation foundation.** Add strict storage, save-first queue, provider, dictionaries/error descriptors, theme tokens, locale formatting, and startup coordination. Wire stable Router theme/locale and recovery fallback. Keep selectors internal/unexposed until their whole-app behavior is ready. Exit: persistence/error/race tests pass and restore behavior is unchanged.
3. **Complete theme migration.** Convert shared components then Today, habits, goals, routines, insights, settings/profile/achievements, and recovery/backup UI. Preserve current Dark/English visuals. Prepare approved automatic native config and rebuild. Exit: all screens work in both palettes, System tracks Android live and after resume, no fixed dark islands or unreadable accent states.
4. **Complete localization and RTL migration.** Migrate complete feature slices including validation, alerts, accessibility, and data/provider errors, not just visible headings. Finish dates/plurals, icons/layout/calendars and native navigation. Review Arabic terminology and all achievement explanations. Exit: catalog parity, no unintended English, no data changes, device-language cross-matrix passes.
5. **Enable settings UI.** Replace informational rows with functional selectors; native-language language labels, saved selection, saving/failure states, radio semantics, cancel/Back/focus handling. Verify changes on existing open screens and after restart. Remove dark-only/Coming later claims. Exit: choices represent saved state, no drafts lost and no forced remount/reload on normal changes.
6. **Regression and delivery.** Run existing suite plus targeted new tests, lint/typecheck, SDK/config checks, Android QA, and compare domain raw bytes. Review only the intended diff. Document exact tested APK/commit/devices and unresolved limits. Implementation completion requires real Android evidence; desktop unit tests alone do not close the native acceptance gates.

## 8. Automated verification

Use the existing Node test harness (`tests/support/register.mjs`, fixtures, AsyncStorage mock); do not introduce Jest just for pure preference/formatting logic. Inspect aliases/mocks and extend them only as necessary.

- Storage: missing/default no-write, valid roundtrip, partial-field policy, malformed JSON, unknown version/enum, read failure, load retries/stale loads, serialized mixed changes, save failure then retry, duplicate/no-op saves. Domain errors must not be swallowed.
- Theme: explicit choices vs live System including null fallback, repeated dark/light events, explicit → System clearing native override, stable palette identities, palette shape parity. Cover pure resolution logic; verify actual native events manually.
- Localization: exact key/parameter parity; all Arabic plural categories with 0, 1, 2, 3, 11, 100 and representative values; interpolation; error descriptors; missing-key behavior; date/week/year boundaries, Gregorian Arabic output, no local-day shifts; normalized input digits retain existing limits.
- Safety: preference switches leave raw domain bytes unchanged; do not call award/normalization enabling; preference provider survives backup generation changes; failed load never writes defaults. Exercise preview/export/empty restore/rollback/startup journal recovery with selected preferences. Continue all existing backup corruption/checksum/interruption/runtime cases.
- Existing habits/goals/routines/profile/progress/achievement/navigation tests must still pass. Update assertions only for deliberate message-descriptor interfaces, preserving underlying behavior and conditions. Do not weaken tests just to accommodate translated copy.
- Search all source for JSX text, string templates, accessibility props, Alert/button labels, placeholder/default messages, Error messages reaching UI, palette imports, hex/RGBA, physical styles, and fixed animations. Classify technical strings, user data, and intentional brand exceptions. A regex is an audit aid, not proof of translation completeness.
- If the current harness cannot test mounted context/navigation updates, keep pure tests and document manual coverage; add focused render tests only if there is an already-supported setup or a separately justified test dependency.

Commands during implementation: `npx.cmd --no-install expo lint`, `npx.cmd --no-install tsc --noEmit`, `npm test`, `npx.cmd --no-install expo-doctor`, and read-only `npx.cmd --no-install expo config --type introspect` when validating approved native config. Avoid running prebuild as a discovery shortcut that creates native files.

Planning baseline: lint and TypeScript checks were run successfully with no diagnostics. The full test suite and physical Android QA were not run for this documentation-only task; the gates above remain required for implementation.

## 9. Android manual QA checklist

- [ ] Export and verify a real backup before installing the new APK. Install as an update over MOMENTUM Dev; verify all existing data remains. Record APK/build ID and Android version.
- [ ] Test all six language/appearance combinations, plus System with Android light and dark. Repeat at narrow widths and large Android font/display scaling; inspect modals, scroll reachability, safe areas and keyboard avoidance.
- [ ] Switch Android appearance while app is visible, then while backgrounded; test explicit choices ignore device changes and System resumes following after a fixed choice. Check status/navigation bars, native alerts, tab indicators, loading/recovery screens and cold start.
- [ ] English → Arabic → English repeatedly without Metro reload. Repeat on Arabic-device/English-app and English-device/Arabic-app. Verify tabs, icons, screen titles, content direction, transitions, Back gestures/hardware Back, deep links, root tab anchor, and return to the originating tab.
- [ ] Open selectors and cancel with Back/outside tap; test rapid taps, saving indicator, failure/retry, selected announcements, focus restoration, screen-reader order and TalkBack pronunciation. Native language names must remain recognizable.
- [ ] Cold-start, force-stop/relaunch, and restart phone after each saved preference. Simulate preference read/write failure and unsupported record without clearing domain data; safe defaults/retry appear and failed values are not falsely selected.
- [ ] Create/edit/archive/delete each habit tracking type, schedules, count units and checklist steps; complete/undo check-ins and retry failed saves. Arabic and mixed English names, emoji, Arabic-Indic counts, long descriptions and optional steps stay usable.
- [ ] Goal dates/status/habit links; routine create/edit/order/delete/time buckets/missing habits; profile name/avatar/save/cancel all work. Unsaved form text and open detail state survive presentation rerenders and tab revisits.
- [ ] Today greeting/date/progress, midnight rollover, insights periods/heatmaps/detail panels/chart axes and missing-history notes render correctly without changing calculations. Calendar labels match selected dates in RTL.
- [ ] Every achievement name/group/criterion/detail/evidence/unread state translates. Switching never creates awards or marks them read. Saved badge IDs/timestamps remain unchanged.
- [ ] Export/share/save/cancel/preview/import a pre-milestone v1 backup in both languages; empty restore warning remains explicit. Restore keeps device preferences. Test failed replacement, rollback, interrupted restore and blocked startup recovery with the existing milestone procedures.
- [ ] Compare domain raw storage before/after settings-only operations; backup file structure/checksum remains compatible. Validate no automatic seed/migration/achievement change occurs as a side effect.
- [ ] Inspect Android share/save document UI: system-owned strings follow OS settings and cannot all be translated by app dictionaries. All app-owned explanations/actions remain localized.
- [ ] Smoke-test iOS and web direction/theme/hydration paths when available; report untested platforms honestly rather than inferring Android success proves them.

## 10. Risks and rollback

| Risk | Prevention / response |
| --- | --- |
| Incomplete palette/text migration | Feature-by-feature inventory, source audit, screenshots, Arabic review and full surface QA before exposing selectors |
| Native tabs/input direction differs from content | Early real-device spike and opposite-device-language matrix; do not silently accept partial RTL |
| Double mirroring / clipping / Arabic shaping | Logical styles, directional-icon allowlist, explicit chart/calendar decisions, large text and mixed-content testing |
| Theme switch resets state or triggers writes | Stable providers/keys, dynamic styles, presentation-only dependencies, raw-byte and award-state comparisons |
| Recovery startup depends on preferences | Independent non-destructive hydration with fallback, unconditional recovery boot, themed/localized overlays above domain providers |
| Strict backup schema incompatibility | Exclude preferences; keep schema metadata and journal parsing unchanged; regression-test old journals/files |
| Existing APK cannot follow device appearance | Rebuild with automatic native style; retain same application identity/signing and install without data clearing |
| Misleading translated success/error | Typed descriptor state and original error classes, preserve unknown-data warnings and destructive action semantics |

Implement in small reviewable commits after approval, with Dark/English as the safe reference and no destructive data migrations. Roll back presentation changes via ordinary reviewed revert commits; leave the independent preference key intact (stable baseline ignores it). No reset, uninstall, storage clear, or domain-format downgrade is needed. A rollback must be tested against current data and retained recovery files.

If an APK change must be rolled back, prefer a forward replacement build with compatible version/signing over an Android downgrade. Automatic appearance config is safe to retain with fixed-dark JS if necessary. If a global RTL fallback was ever introduced, rollback additionally needs to reset its persisted global flags and verify a full restart; this is a reason to prefer runtime direction. Never delete active recovery evidence as part of rollback.

## 11. Documentation consulted

The package major was checked before API planning. These primary sources were fetched during discovery; installed Router exports were also inspected for `LocaleProvider` availability. Recheck the matching SDK docs before implementation if versions change.

- [Expo SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/) and [Expo documentation index/corrections](https://docs.expo.dev/llms.txt).
- [Expo color themes](https://docs.expo.dev/develop/user-interface/color-themes/) — automatic configuration and Android system UI requirement.
- [SDK 58 SystemUI](https://docs.expo.dev/versions/v58.0.0/sdk/system-ui/) — build-time native appearance configuration versus runtime root background.
- [Expo localization guide](https://docs.expo.dev/guides/localization/) — SDK 58 default RTL behavior, runtime Router direction, and separate content direction; also standard Intl formatting guidance.
- [SDK 58 Localization](https://docs.expo.dev/versions/v58.0.0/sdk/localization/) — optional native locale module/plugin, not required for explicit local dictionary selection.
- [SDK 58 Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/) and [native tabs](https://docs.expo.dev/versions/v58.0.0/sdk/router/native-tabs/) — existing navigation integration; continue importing navigation APIs from Expo Router.
- [React Native Appearance](https://reactnative.dev/docs/appearance) — live scheme observation and current app override reset values.
- [React Native I18nManager](https://reactnative.dev/docs/i18nmanager) — global RTL persistence/restart limitations and directional-layout cautions.

Approval is required before starting any phase that changes application code, dependencies, or native configuration. This plan does not authorize a build, commit, or push.
