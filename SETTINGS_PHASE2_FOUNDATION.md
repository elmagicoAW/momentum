# Phase 2 foundation delivery

Scope: safe device-local preferences and presentation infrastructure only. No selectors or whole-app theme/localization migration. No dependency, native config, APK, commit, or push changes.

## Preserved work and Phase 1 evidence

At the start, git showed modified `src/app/_layout.tsx`, plus untracked `src/components/dev-rtl-spike.tsx`, `SETTINGS_APPEARANCE_LANGUAGE_PLAN.md`, and `RTL_SPIKE_ANDROID_TESTING.md`. Both documents were preserved without edits.

The user reported that the physical Android Phase 1 spike passed runtime RTL/LTR switching, native tab reordering, navigation/Back, mixed Arabic/English input, and return to LTR without a reload. The global diagnostic remained `native: ltr`. Treat this as user-reported device evidence; retain native/gesture and opposite-device-locale edge cases for later QA. The old testing document remains the historical spike procedure, not instructions for a toolbar still in this version.

## Behavior and architecture

The root now has `PreferencesProvider → AppPresentation → DataBackupProvider → unchanged domain-provider chain`. Neither new wrapper is keyed by preferences or domain generations. `AppPresentation` incorporates the verified Router `LocaleProvider` plus a content direction view. The original dark Router theme values are preserved in that bridge.

`src/utils/presentation.ts` deliberately pins the applied scheme/language/direction to **dark/en/ltr**. `useAppTheme` exposes stored appearance and a requested scheme (including device scheme resolution), but returns the existing dark palette as the applied palette. `useLanguage` exposes stored language/requested direction, but its applied locale and translator remain English. Even a valid preseeded Arabic/light record cannot activate unfinished screens. No global appearance/RTL setters, reloads, or working Settings selectors were added. Existing starter theme hooks/screens are not migrated in this phase.

Preferences hydrate independently after mount. Children render immediately; startup recovery does not await preferences and no splash/recovery code was changed. Errors remain typed status/error codes in `usePreferences`, with `retryLoad` available for a later UI. There is intentionally no new visible preference-error panel or controls in this phase.

## Storage contract

`momentum:preferences:v1` stores `{ "version": 1, "preferences": { "appearance": "dark", "language": "en" } }` with appearance light/dark/system and language en/ar.

- Missing key returns immutable Dark/English defaults without writing.
- A v1 preference object may omit a known field: that field defaults in memory only. Unexpected fields, malformed envelopes, invalid present values, and unknown versions fail and remain untouched.
- Failed or pending load refuses saves. Explicit retry coalesces concurrent initialization attempts. Once successfully loaded, retryLoad returns current saved state without rereading; restore never replaces this excluded key, so it does not require a generation-driven reload.
- A separate serialized save-first queue composes partial updates from the last saved value. Failed saves keep the saved choice and do not poison later work. Caller patches are copied at admission; snapshots and preference objects are frozen. No-op saves do not write.
- The queue does not import domain persistence, acquire domain leases, advance generations, enable awards/normalization, or reset domain data. Updates target only the dedicated key. Future selectors should additionally disable their controls while backup operations are busy; no such controls are exposed now.
- Backup v1 allowlists, envelopes, schema manifests, checksum/journal logic and all domain storage files remain unchanged. Tests prove exclusion and exact preference-byte retention through ordinary/empty restore, rollback, interrupted rollback recovery, and frozen recovery admission.

## Localization foundation limits

The initial typed catalog has only preference error messages and Retry in English and Arabic, with exact-key type and test coverage. Error descriptors can be translated when displayed rather than storing translated errors in state. Formatting helpers provide localized numbers/percentages, Arabic plural categories, and Gregorian local-date display. They do not change local date keys, weekday ordering, domain arithmetic, numeric-input parsing, existing validation strings, or user content.

Named interpolation, complete product catalogs, Arabic copy review, all-screen localization, light palette design, dynamic native appearance, accessibility/layout conversion, and language/theme controls remain later-phase work. No claim of whole-app Arabic or light-theme readiness is made.

## Changed files

- Modified: `src/app/_layout.tsx`.
- Added presentation bridge: `src/components/app-presentation.tsx`.
- Added persistence: `src/data/preferences-storage.ts`, `src/data/preferences-store.ts`.
- Added hooks: `src/hooks/use-preferences.tsx`, `src/hooks/use-app-theme.ts`, `src/hooks/use-language.ts`.
- Added locale infrastructure: `src/i18n/en.ts`, `ar.ts`, `types.ts`, `translate.ts`, `format.ts`.
- Added presentation gate/resolvers: `src/utils/presentation.ts`.
- Added tests: `tests/preferences.test.mjs`, `tests/presentation-foundation.test.mjs`.
- Removed the temporary, previously untracked `src/components/dev-rtl-spike.tsx` and its root wrapper after incorporating LocaleProvider in the bridge.
- Added this report: `SETTINGS_PHASE2_FOUNDATION.md`.

## Verification

| Command | Final result |
| --- | --- |
| `npm.cmd test` | Exit 0; 206 tests, 18 suites, 206 passed, 0 failed/cancelled/skipped/todo; reported duration 2186.8742 ms |
| `npx.cmd --no-install tsc --noEmit` | Exit 0, no diagnostics |
| `npx.cmd --no-install expo lint` | Exit 0, no diagnostics |
| `npx.cmd --no-install expo-doctor` | Exit 0; 20/20 checks passed, no issues detected |
| `git diff --check` | Exit 0, no whitespace errors; Git reports its LF-to-CRLF working-copy advisory |

An initial TypeScript run found a loader callback signature mismatch, which was corrected before the final checks. Existing achievement failure-injection tests print their expected save/retry diagnostic; the suite passes. The 21 added tests include strict record validation, defaults/no writes, runtime patch checks, subscriptions, coalesced hydration, concurrent requests, failed-write retry/queue recovery, byte-for-byte domain isolation, backup/recovery isolation, dictionary parity, requested-versus-applied presentation, plural rules and display formatting.

Tests use the existing Node harness and in-memory storage/journal fixtures; they do not access the Android app's actual records. Mounted React/native recovery and provider lifetime are not exercised by that harness. The stable wrapper placement and lack of render gates were inspected; a physical smoke test of the new root is still appropriate.

## Remaining QA and release boundary

No new APK is needed for Phase 2: only JS/TypeScript changed and all native modules were already installed. Use the existing MOMENTUM Dev APK with Metro. Confirm the toolbar is gone, existing records/screens remain usable, the app stays dark/English, Android Back retains its prior behavior, and restart does not introduce a preference-loading screen. Do not clear data or reinstall to test this.

System appearance still needs the separately approved future automatic native configuration/build. Whole-app RTL still needs native/gesture/device-locale edge-case QA despite the successful spike. Arabic date/number rendering on Hermes and future input normalization need physical validation when enabled. The Phase 2 root has not been physically exercised by this agent.

The next phase is not authorized by this delivery. Leave the presentation gate closed and wait for review before migrating themes, translations, or selectors.
