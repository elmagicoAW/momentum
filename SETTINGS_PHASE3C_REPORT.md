# Phase 3C: saved Appearance selector

Implementation-only handoff. Branch `wip/settings-appearance-language`; HEAD remains `df1c93d653faa5ff8a60d9eebfe5aa4087e03f29`. All pre-existing Phase 3B changes were uncommitted at entry and remain uncommitted. No APK build, install/uninstall, device-data clearing, commit, push, branch change, dependency installation or native-config change was performed in this phase.

## Baseline and physical Android evidence

Read the Settings Appearance/Language plan and Phase 2, 3A and 3B delivery reports before editing. Historical reports are preserved, including their original phase gates and subsequently resolved Doctor blocker. The user reports Phase 3B physical Android testing passed: the updated development APK installed over the existing app without data loss, System follows Android appearance live, and explicit Light/Dark stay fixed. That is user-reported evidence for Phase 3B, not a physical test of the new Settings selector.

## Resulting behavior

- Settings > Appearance > Theme opens a Light/Dark/System dialog. The row shows the saved choice; the dialog shows both the saved choice and a draft radio selection with text and checked states.
- Draft changes do not change the app or write storage. Save uses the existing validated preference queue and applies appearance only after storage succeeds. Cancel, Android Back and accessibility escape discard the unsaved draft. During an admitted save, dismissal and further changes are disabled until the write finishes; Saving is announced.
- Missing preferences still use Dark + English in memory without a default write. Successfully saved appearance is rehydrated on the next full app/JS restart and is used in development and release. Preference hydration remains independent of startup recovery: initial Dark may appear briefly before a saved Light/System choice loads. The native dark launch splash remains unchanged.
- The original Phase 3B appearance session still sets explicit native Light/Dark and clears overrides with `auto` for System. Native events publish resolution only; they do not set overrides. Resume reapplies/resamples the selected mode. The selected mode comes exclusively from successfully loaded/saved preferences.
- While preferences load, the Theme row is disabled and shows Loading with an accessible indicator. Failed/corrupt/unsupported preference loads display the existing English error descriptor and Retry loading preferences. A failed load never authorizes overwriting stored preferences. Domain functionality and recovery remain independent.
- Failed saves retain the saved theme, the dialog and its attempted choice, with an error and Retry save. Choosing another draft clears that dialog error. Rapid Save taps cannot admit duplicate writes; the local controller locks synchronously before awaiting the store.
- Opening, choosing and saving are disabled while Data & Backup is busy. An already-open dialog also observes this state; Cancel remains available until a save has actually started. An already-admitted preference write can finish independently because it targets only the backup-excluded preference key.
- The dialog uses radio roles, checked/disabled/busy states, minimum 48dp action buttons, scalable text, a bounded scrollable layout and explicit focus requests on open/close. Android focus restoration waits briefly for the native modal window to close; TalkBack and large-font behavior still require physical QA.
- DEV preview controls return null, have no setter and render no bar. The existing root component/provider identities and ordering are unchanged. The legacy `ThemePreviewProvider` filename/export are retained to avoid a provider-type replacement; it is now the saved-theme authority and contains no preview override.
- English/LTR activation gates and language Settings remain unchanged/read-only. An existing stored Arabic request remains stored but does not activate translations or RTL. Appearance updates patch only appearance and preserve the saved language field.

## Changed files for this phase

Modified:

1. `src/hooks/use-theme-preview.tsx`: replaces the memory-only preview authority with successfully loaded/saved appearance while retaining the Phase 3B native appearance session and stable provider identity.
2. `src/hooks/use-app-theme.ts`: updates the public-hook description for saved appearance.
3. `src/components/dev-theme-preview.tsx`: disables the temporary bar by returning null. Its existing root placement is retained and renders nothing.
4. `src/hooks/use-preferences.tsx`: exposes the existing stable snapshot getter for event-time admission checks; storage/store behavior is unchanged.
5. `src/components/settings/settings-row.tsx`: adds optional disabled support and a standard React ref for focus restoration. Other row variants and enabled link behavior are preserved.
6. `src/app/(tabs)/settings.tsx`: replaces the static Dark row with the selector and removes obsolete dark-only footer copy. Language rows are unchanged.

Added:

7. `src/utils/appearance-editor.ts`: small injectable draft/save controller with synchronous duplicate prevention, load/save/backup admission checks, cancel and retry state. It writes through the existing store only.
8. `src/components/settings/appearance-selector.tsx`: themed accessible dialog, saved-choice row, loading/error/retry UI and backup-busy integration.
9. `tests/appearance-selection.test.mjs`: nine focused editor/store/native-session/isolation tests.
10. `SETTINGS_PHASE3C_REPORT.md`: this report and Android checklist.

`app.json` and `src/components/app-presentation.tsx` still appear modified against HEAD because of Phase 3B; this phase did not change either. `src/utils/appearance-session.ts`, `tests/appearance.test.mjs` and all earlier report files are also preserved from Phase 3B. Existing pure preview helper exports/tests remain as historical regression coverage but are unused by production theme resolution; their old test names do not describe the newly enabled selector. New integration tests cover the saved appearance path.

## Preservation

A SHA-256 inventory of **75 pre-existing files** was captured before edits: every `src/data/` file, every existing test/support file, every existing root Markdown report/plan, and `app.json`, `eas.json`, `package.json`, `package-lock.json`. Final comparison showed **zero changed files** in that inventory. The new test/report were added without replacing earlier evidence.

Root navigation/provider tree, routing identifiers, native configuration, identity/signing, dependencies, domain providers/storage, backup v1 schemas/allowlist/checksum/recovery journals, and achievement coordination are unchanged. Preference writes target only `momentum:preferences:v1`; no domain generation/admission/award/normalization APIs are invoked by the selector. No real device records were accessed or changed by the agent's checks.

## Exact validation

| Command | Final result |
| --- | --- |
| `npm.cmd test` | Exit 0; **232 tests**, 18 suites; **232 passed**, 0 failed/cancelled/skipped/todo; **3930.3425 ms** |
| `npx.cmd --no-install tsc --noEmit` | Exit 0; no diagnostics |
| `npx.cmd --no-install expo lint` | Exit 0; no errors or warnings |
| External Expo Doctor **1.21.6**, `--verbose` | Exit 0; **20/20 checks passed. No issues detected!** |
| `git diff --check` | Exit 0; no whitespace errors; existing LF-to-CRLF advisories only |
| SHA-256 preservation inventory | 75 pre-existing files checked; zero changed |

Doctor used the previously working external CLI, with no installation:

```powershell
node 'C:\Users\Beeviro1\AppData\Local\Temp\momentum-doctor-7441495e4de54f8a984e89e2e3e35524\node_modules\expo-doctor\bin\expo-doctor.js' 'D:\Projects\momentum' --verbose
```

The suite retains its expected achievement save/retry failure-injection diagnostic. Initial checks caught current RN ref typing/compiler-ref-rule issues and an unsupported Text `focusable` prop; these were corrected before the final passing TypeScript/lint results. No lint rules were suppressed.

Nine new tests cover cancel/reopen without writes; all modes across fresh store lifetimes; failed save and retry; rapid drafts and duplicate Save/Back taps during a delayed write; backup-busy admission; load failure/retry and language retention; saved commits driving fixed/System native sessions with no optimistic application or feedback writes; all-domain/backup-v1 payload/schema isolation; and source guards against preview or language activation. Existing tests continue covering preference byte preservation through restore, rollback/recovery, corrupt/future records and persistence barriers.

Tests use isolated storage/lifecycle ports and source assertions. They do not mount the native modal, prove TalkBack focus behavior, or constitute physical Phase 3C acceptance. Backup export timestamps may differ; tests compare the raw domain records, payload and schema rather than requiring identical full export checksums across timestamps.

## Android manual QA checklist

Use the existing user-tested automatic-appearance MOMENTUM Dev APK with Metro. **No new native rebuild is required for this JS-only phase.** Do not reinstall, clear data or uninstall anything to run this checklist.

1. Record the existing habits/progress/goals/routines/profile/achievements as a baseline. Confirm the DEV bar is gone, language remains English, and existing navigation/Back works.
2. Open Settings > Theme. Confirm the saved choice is shown on the row and in the dialog. Select another radio choice, then Cancel. Reopen and repeat with Android Back: the original saved choice and appearance must remain unchanged.
3. Save Light. Confirm the dialog closes only after successful save and all tabs, pushed screens, forms, alerts and status/navigation chrome use Light where supported. Toggle Android Light/Dark: the app remains Light. Repeat for explicit Dark.
4. Save System from each explicit mode while Android is in the opposite mode. Confirm the previous override releases. Toggle Android appearance while visible, through Quick Settings, and while backgrounded, then resume. The row must continue to show System while the resolved UI follows Android.
5. For each of Light, Dark and System: fully close/force-stop and relaunch the app without clearing data. After preferences hydrate, confirm the saved choice and theme return. Repeat System with Android Light and Dark. Account for the preserved dark native splash/initial loading frame; there must be no stuck dark theme after hydration.
6. Rapidly change draft choices before saving. Rapidly tap Save/Back: only one admitted save should occur, no oscillation/reload, and the final saved choice should match the admitted draft. Verify navigation stacks, scroll positions and unsaved form state are retained across switches.
7. With TalkBack, verify the trigger announces the saved choice, the dialog heading receives focus, choices announce radio/checked/disabled states, Saving/errors are announced, and closing returns focus to the Theme row. Test accessibility escape, large font/display scaling, narrow screen/landscape constraints where applicable, and scrolling to Save/Cancel.
8. Verify Theme controls are unavailable during Data & Backup activity, including a dialog that was already open. Confirm restoring/importing/exporting still works as previously approved, without changing saved appearance or language. Compare domain state and backup v1 payloads before/after appearance changes; preserve all recovery evidence.
9. Load/save-failure and retry paths are covered by injected automated tests. If physical failure injection is desired, use an explicitly approved disposable test environment; do not corrupt real preferences, fill the phone's storage or clear user data. Expect old saved appearance to remain on save failure, a retryable draft to remain open, and load errors to block writes while retaining original bytes.
10. Confirm language Settings is still read-only English, no Arabic/RTL activation occurs, and all existing user data/achievements remain intact. Return the device to the user's desired saved appearance at the end.

Implementation is ready for review. Phase 3C physical selector/accessibility QA remains pending; no further phase, APK build, installation or publication is authorized by this report.
