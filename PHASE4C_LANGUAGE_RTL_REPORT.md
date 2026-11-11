# Phase 4C — implemented English/Arabic selection and runtime RTL/LTR

Implementation is complete for review on `wip/settings-appearance-language`, HEAD `2ed299cba1ff9b65408915c7f49ee124fc993389`. All changes remain unstaged/uncommitted. No native configuration, dependencies, APK, device data, branch, commit or push changes were made. Existing Phase 4B work was continued in place.

## Corrected historical evidence

The user confirmed that Phase 1 physically passed native tab reordering, navigation/Back, mixed Arabic/English input and return to LTR without reload. The old Pending checklist was stale. RTL_SPIKE_ANDROID_TESTING.md now records this clarification. The earlier blocker assessment retained below is superseded. This completed integration has **not** yet received physical QA; no new physical success is claimed.

## Delivered behavior

- Accessible English/العربية Language selector with saved choice, Save/Cancel, Android Back/accessibility escape, loading/read retry, failed-save retry, focus restoration and backup-busy protections. Synchronous editor admission blocks duplicate saves and changes during a save.
- The validated preferences store continues to merge/serialize patches, retaining appearance and other fields. One production callback applies language only after successful hydration or durable write. Failed writes leave the applied language unchanged. No default writes, domain leases or preference resets were added.
- A single subscribed presentation authority drives useLanguage, shared copy/Android-safe formatters, style consumers and native text/input wrappers. Initial loading uses safe English; a validated saved Arabic preference applies after hydration without gating/remounting domain providers. Failed reads retain the current/default presentation and require retry before editing.
- Stable LocaleProvider/root direction and explicit typed Android native-tab host direction. Explicit horizontal stack animations and custom directional arrows follow the selected direction. Navigation keys/routes/Back targets are unchanged. No global I18nManager setters, automatic restart, reload or new provider key is used.
- Shared Text/TextInput consumers subscribe to language. Default alignment follows language while centered styles remain centered. Inputs retain automatic bidi writing direction and pass value/change/ref props through unchanged. User names, notes, steps, units, numeric parsing, raw identifiers and backup v1 contents are not rewritten.
- Cached RTL style copies use logical start/end spacing/positions/borders and local modal direction. Original palette styles remain intact; English retains its original style objects. Existing appearance/session behavior is preserved.
- Weekday names, date presets and calendar headings resolve current language. Weekly-review labels/achievement sentences and trend labels resolve on access over already-calculated facts, preserving history indexes, rates and business calculations. Today schedule formatting now branches on schedule facts rather than comparing translated English labels.
- Fifty-seven UI modules using external copy helpers have a documented `use no memo` boundary so React Compiler cannot cache constant-argument copy across language changes. Explicit domain/history memos remain intact. This is a scoped compiler escape hatch; hook-bound copy helpers would permit revisiting it later. [React directive documentation](https://react.dev/reference/react-compiler/directives/use-no-memo) was checked.

SDK 58 documentation and installed Router/screens source support this JavaScript approach. [Expo localization guidance](https://docs.expo.dev/guides/localization/) separates navigator and content direction. Installed TabsHost accepts direction through native style, forwarded by Router's `unstable_nativeProps`. No native rebuild requirement was found.

## Final validation

| Check | Result |
| --- | --- |
| Full `npm.cmd test` | Exit 0; **275 tests, 18 suites, 275 pass, 0 fail/cancelled/skipped/todo; 6326.8287 ms** |
| TypeScript `--noEmit` | Exit 0; no diagnostics |
| Expo lint | Exit 0; no warnings/errors |
| Inventory regeneration and independent in-memory comparison | Consistent: **178 sources, 22 roots, 171 reachable, 117 candidate files, 1487 candidates** |
| `git diff --check` | Exit 0; existing LF/CRLF advisories only |
| Compatible external Expo Doctor 1.21.6 | Exit 1; **19/20**, same 13 recommended SDK patch versions, listed in the historical section below; no new peer/native/config/duplicate issues |

New tests cover hydration, persistence through a fresh store, cancel, backup-busy admission, failed save/retry, duplicate rapid saves, preserved System appearance, language/direction/copy/weekday updates, input pass-through and style isolation. Existing missing-PluralRules/NumberFormat/DateTimeFormat/all-Intl catalog tests, domain/achievements and backup v1/checksum/recovery tests pass.

Old read-only-language assertions were updated to the authorized active-language contract. Historical preservation fixtures remain retained, with explicit exceptions for five production files deliberately changed for activation. Stylesheet and core business/backup AST tests remain enabled. No Android/TalkBack success is inferred from Node tests.

## Files and limits

New production files: `src/components/settings/language-selector.tsx`, `src/components/localized-native.tsx`, `src/hooks/use-presentation-language.ts`, `src/utils/language-editor.ts`, `src/utils/direction-styles.ts`, `src/i18n/language-en.ts`, `src/i18n/language-ar.ts`. New regression file: `tests/language-activation.test.mjs`.

Integration edits: preferences store/provider, presentation authority, useLanguage/useAppTheme/useAppStyles, Settings, native tabs/root stack, schedule metadata, Today schedule formatting, Insights display getters, date picker/calendar headings and catalog composition. Existing app/component primitive imports now use stable localized wrappers; the consumer list is appended below. Updated tests: appearance-selection, localization and Phase 4B preservation. Updated evidence: this report, RTL spike note and main inventory. Prior Phase 4B reports and fixtures remain retained.

No native rebuild is needed for these JS changes. Physical checks remain necessary for opposite-device-language behavior, native tabs/gestures, keyboard/cursor, TalkBack focus, large text and RTL absolute positioning. Arabic wording still needs native linguistic review. Translated error/status strings already held in open component state can retain their previous language until the next operation/retry; their safety meaning is unchanged. No automatic restart/reload is required by the implementation.

## Android QA checklist — pending

1. Open Language in the existing Dev client; choose Arabic then Cancel/Android Back. Nothing should apply. Save Arabic; confirm copy/tabs/layout switch in place and current tab/route/drafts survive. Switch back to English repeatedly.
2. Check duplicate rapid Save taps and read/save failure retry with controlled test faults if available. Data & Backup busy must block edits. Do not restore/reset real data to test this.
3. Fully close/reopen; confirm language and Light/Dark/System persist independently. Test live Android appearance and resume in both languages.
4. Visit all tabs, forms, Profile, Achievements, Settings and backup preview. Check arrows, calendar/date correspondence, transitions and both on-screen/Android Back returning to the originating tab.
5. Keep mixed `Hello مرحبا 123` text and a form draft open during switching; verify cursor/selection, keyboard, numeric fields and large text. Repeat with English/Arabic device language where practical, without Force RTL developer settings.
6. Use TalkBack for saved selection, radio choices, Save/Cancel, focus restoration and retry announcements. Confirm synthetic data/awards and backup preview contents remain intact. Do not clear data or restore a backup.

## Historical preflight (superseded; retained for traceability)

Phase 4C is **not implemented or activated**. This is an investigation and baseline-validation report, not a completion claim. Branch remains `wip/settings-appearance-language`; HEAD remains `2ed299cba1ff9b65408915c7f49ee124fc993389`. All existing uncommitted Phase 4B source, tests, reports and inventories were preserved. This report is the only file added in this turn.

## Unresolved Android feasibility gate

Read PHASE4B_COMPLETE_REPORT.md, SETTINGS_APPEARANCE_LANGUAGE_PLAN.md, RTL_SPIKE_ANDROID_TESTING.md, app.json, preferences/presentation/i18n code and installed Router/screens direction implementations. The user's reported Phase 4B physical QA is recorded as passed for the existing English/LTR app. It does not establish runtime RTL behavior on the installed binary.

The RTL spike report explicitly says **“Runtime Android feasibility is not yet certified”** and its English-device/Arabic-device result matrix is entirely Pending. The plan specifically calls native tabs an Android RTL acceptance gate and requires validating native components which may follow global/device direction rather than the selected app direction.

The missing evidence is whether changing app-controlled content/Router direction in the existing development APK correctly mirrors native tabs and preserves selected tab, route, open drafts, mixed input/cursor and Back behavior on both English and Arabic device settings. This environment has not exercised that phone or inspected its installed native binary. A Node test or repository configuration cannot supply this evidence.

This is **an unverified feasibility condition, not an observed RTL failure**. No evidence found establishes that a rebuild is necessary. SDK 58 enables RTL support by default; absence of an expo-localization plugin does not prove a missing native capability. No dependency/native change is proposed merely to duplicate that default.

## Runtime findings

- Expo SDK ~58.0.23, React Native 0.88.1. [SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/) and [Expo localization guide](https://docs.expo.dev/guides/localization/) were checked. Router LocaleProvider supports runtime navigation direction; content direction is configured separately.
- Installed `expo-router/build/LocaleProvider.js` changes navigation context. The app already has a stable LocaleProvider and root View direction bridge. Both are currently deliberately LTR.
- Installed `expo-router/build/native-tabs/NativeTabsView.android.js` forwards unstable_nativeProps to its host adapter. Installed `react-native-screens/src/components/tabs/host/TabsHost.android.tsx` accepts direction and applies it in native-component style. This is a plausible existing-binary route, not physical proof of correct native tab behavior.
- The previous spike investigated inherited direction. If that fails on the installed APK, an explicit supported host-direction adapter should be evaluated before considering a rebuild. Do not silently replace native tabs or remount the navigator to force an update.
- [React Native I18nManager](https://reactnative.dev/docs/i18nmanager) documents that global allowRTL/forceRTL changes persist and take effect on a subsequent application start. They are not a reliable immediate-switch mechanism. No global flags, automatic reloads, restart loops or provider keys were added.

## Remaining implementation after feasibility is established

The public Language row remains read-only and ACTIVE_PRESENTATION remains English/LTR. No language writes or device operations occurred.

Required work still includes: save-first Language editor admission/cancel/retry/backup-busy behavior; a single reactive active-language authority after validated hydration/write; invalidation of cached labels and memoized presentation strings without recomputing domain facts; RTL-aware text/input defaults, logical spacing, custom arrows and explicit stack animations; native-tab direction; and startup/failure/rapid-change regression tests. Changing only useLanguage would leave app-copy's pinned authority and module-level/memoized labels stale, so that partial activation was not made.

If runtime direction works, prefer the stable LocaleProvider/content-direction path with no restart. If it does not, first investigate the installed host-direction API. A restart-based fallback would need explicit safe apply/defer behavior, pending-save/recovery protection, one-shot mismatch detection, draft preservation policy and cold-start verification. A generic Metro reload must not be represented as a certified native RTL restart.

## Exact baseline validation performed in this turn

These results validate the preserved Phase 4B tree, **not Phase 4C behavior**:

| Check | Result |
| --- | --- |
| `npm.cmd test` | Exit 0; 273 tests, 18 suites, 273 pass; 0 fail/cancelled/skipped/todo; 7712.6766 ms |
| `npx.cmd --no-install tsc --noEmit` | Exit 0, no diagnostics |
| `npx.cmd --no-install expo lint` | Exit 0, no diagnostics |
| Inventory regenerated in memory and compared to saved JSON | Exit 0, consistent; 171 sources, 22 roots, 164 reachable files, 112 candidate files, 1411 candidates; no inventory write |
| `git diff --check` | Exit 0; no whitespace errors |
| Existing external Expo Doctor 1.21.6 `--verbose` | Exit 1; 19/20, same 13 recommended SDK patch versions only |

Doctor used the previously working external CLI under `C:\Users\Beeviro1\AppData\Local\Temp\momentum-doctor-7441495e4de54f8a984e89e2e3e35524\node_modules\expo-doctor\bin\expo-doctor.js`, targeting this project. Nothing was installed, upgraded or suppressed. Recommendations (installed -> expected):

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

## Android evidence needed to unblock

Use the existing APK and a temporary nonpersistent runtime-direction probe as described in RTL_SPIKE_ANDROID_TESTING.md; that report describes a historical probe, not a currently enabled production feature.

1. Toggle local Router/content LTR/RTL without reload; record tab order, selected tab, label/icon positions and tap targets.
2. Keep an unsaved mixed Arabic/English draft open; toggle repeatedly and verify text, cursor/selection, keyboard and route survive.
3. Push/pop nested and root screens; verify custom Back and Android Back return to the originating tab and correct transitions.
4. Repeat against English and Arabic device-language defaults. Distinguish OS activity recreation from runtime switching. Do not enable Android's Force RTL developer setting.
5. Do not clear data, restore a backup, reinstall, remount domain providers or change global RTL flags for this probe.

No APK, dependency installation, native configuration change, data clearing/reset/restore, staging, commit, push, branch switch or release work was performed. Stop pending the unresolved native runtime direction evidence; no native rebuild requirement is asserted.

## Phase 4C primitive/compiler consumer files

- src/app/(tabs)/goals/index.tsx
- src/app/(tabs)/goals/new.tsx
- src/app/(tabs)/goals/[id].tsx
- src/app/(tabs)/goals/_layout.tsx
- src/app/(tabs)/habits/index.tsx
- src/app/(tabs)/habits/new.tsx
- src/app/(tabs)/habits/routines.tsx
- src/app/(tabs)/habits/[id].tsx
- src/app/(tabs)/habits/_layout.tsx
- src/app/(tabs)/index.tsx
- src/app/(tabs)/insights/habit/[id].tsx
- src/app/(tabs)/insights/index.tsx
- src/app/(tabs)/insights/_layout.tsx
- src/app/(tabs)/settings.tsx
- src/app/achievements.tsx
- src/app/data-backup.tsx
- src/app/profile/edit.tsx
- src/app/routine/edit/[id].tsx
- src/app/routine/new.tsx
- src/app/routine/[id].tsx
- src/app/_layout.tsx
- src/components/achievements/achievement-card.tsx
- src/components/achievements/achievement-data-notes.tsx
- src/components/achievements/achievements-summary-card.tsx
- src/components/app-tabs.web.tsx
- src/components/goals/consistency-summary.tsx
- src/components/goals/date-picker.tsx
- src/components/goals/goal-card.tsx
- src/components/goals/goal-form.tsx
- src/components/goals/habit-link-picker.tsx
- src/components/goals/status-picker.tsx
- src/components/habits/checklist-editor.tsx
- src/components/habits/color-picker.tsx
- src/components/habits/count-fields.tsx
- src/components/habits/empty-state.tsx
- src/components/habits/habit-form.tsx
- src/components/habits/habit-row.tsx
- src/components/habits/icon-picker.tsx
- src/components/habits/tracking-type-picker.tsx
- src/components/habits/weekday-picker.tsx
- src/components/insights/data-notes.tsx
- src/components/insights/day-detail-panel.tsx
- src/components/insights/habit-insight-row.tsx
- src/components/insights/heatmap-calendar.tsx
- src/components/insights/period-nav.tsx
- src/components/insights/stat-tile.tsx
- src/components/insights/trend-bars.tsx
- src/components/insights/weekly-review-card.tsx
- src/components/localized-inline.tsx
- src/components/placeholder-screen.tsx
- src/components/profile/name-prompt-card.tsx
- src/components/profile/profile-avatar.tsx
- src/components/profile/profile-form.tsx
- src/components/routines/routine-badges.tsx
- src/components/routines/routine-card.tsx
- src/components/routines/routine-form.tsx
- src/components/routines/routine-habit-order.tsx
- src/components/routines/routines-entry-card.tsx
- src/components/routines/time-of-day-picker.tsx
- src/components/routines/todays-plan.tsx
- src/components/settings/appearance-selector.tsx
- src/components/settings/language-selector.tsx
- src/components/settings/profile-summary-card.tsx
- src/components/settings/settings-row.tsx
- src/components/settings/settings-section.tsx
- src/components/themed-text.tsx
- src/components/today/checklist-steps.tsx
- src/components/today/count-control.tsx
- src/components/today/habit-card.tsx
- src/components/today/progress-notices.tsx
- src/components/today/progress-ring.tsx
- src/components/ui/collapsible.tsx
