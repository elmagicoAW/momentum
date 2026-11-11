# Phase 3B implementation and Android review

Baseline: clean `wip/settings-appearance-language` at `df1c93d`. Read Phase 3A report and Appearance/Language plan before implementation. Implementation only; no build, APK installation, data clearing, branch change, commit, or push performed.

## Changed files

- `app.json`: only `userInterfaceStyle` changes from `dark` to `automatic`. Dev name, scheme, Android package, EAS project linkage, owner, icons, background, and splash remain unchanged. `eas.json` and signing configuration are untouched.
- `src/utils/appearance-session.ts`: injectable appearance session; fixed choices set native Light/Dark, System clears the override with RN 0.88 `auto` before sampling. Appearance events only publish resolution; they never set overrides. Resume reapplies the selected mode and samples again. Session teardown removes both subscriptions and ignores late callbacks. Missing system scheme falls back to Dark. Web's absent native override API is supported.
- `src/hooks/use-theme-preview.tsx`: connects that session to the existing stable theme context. Native appearance mode depends on the gated preview choice, never on the resolved scheme. Native override resets on provider unmount. Public requests remain gated; default and release remain Dark. Stored preference resolution is diagnostic only, and a System request while fixed preview is active reflects the app override rather than an independent OS reading.
- `src/components/dev-theme-preview.tsx`: memory-only Dark → Light → System → Dark cycle, displaying selected and resolved modes. Existing development/recovery/backup-busy gates remain intact. No save or reload.
- `src/components/app-presentation.tsx`: updates the native-background comment for this phase. Existing palette-driven Router themes, status-bar icon contrast, and native root background remain the integration points.
- `tests/appearance.test.mjs`: six focused tests for fixed modes, live System/resume, repeated transitions/listener cleanup, release gating, web compatibility, and config preservation.
- `SETTINGS_PHASE3B_REPORT.md`: this implementation record and manual QA instructions.

No root/provider tree or keys change. Domain providers, storage, backup v1, recovery journals, achievements, public Settings rows, language/default preferences, locale direction, and localization foundation are untouched. No dependency was added. No device data was accessed or mutated by these checks.

## Native integration and limits

RN Appearance applies the chosen mode to native controls. Existing Expo StatusBar uses explicit contrasting icons; SystemUI updates root background. Router themes, stack content and native tabs follow the same palette without keyed remounts. Android edge-to-edge navigation chrome is left to the existing native theme/window implementation: installed RN `WindowUtil.kt` derives navigation icon contrast from native UI mode where supported. No unsupported navigation-bar background API or new navigation dependency is introduced. This is source evidence, not proof of live navigation-bar updates on a device; gesture and three-button behavior remain acceptance gates. Android keyboard appearance is IME-owned. Native launch splash stays the original dark splash intentionally; a brief dark launch before Light/System is expected.

Expo config introspection exited 0. Android resource `expo_system_ui_user_interface_style` resolves to `automatic`; MainActivity retains `uiMode` in `configChanges`; package is `com.beeviro1.momentum.dev`; splash resources and dark activity background remain preserved. iOS resolves `UIUserInterfaceStyle: Automatic`. No native directories were generated. The introspection-only iOS placeholder bundle identifier is not a newly configured shipping identity.

A separately authorized native rebuild is required to embed automatic appearance. The old dark-locked binary cannot certify full System behavior. No build/install is authorized or performed here. Future installation must retain package and existing signing credentials and replace the existing app without uninstalling or clearing data.

## Verification

| Check | Result |
| --- | --- |
| `npm.cmd test` | Exit 0; 223 tests, 18 suites; 223 passed; 0 failed/cancelled/skipped/todo; 3580.1715 ms |
| `npx.cmd --no-install tsc --noEmit` | Exit 0; no diagnostics |
| `npx.cmd --no-install expo lint` | Exit 0; no errors or warnings |
| `npx.cmd --no-install expo config --type introspect --json` | Exit 0; native results inspected as above |
| Expo Doctor | Exit 1 before checks; CLI tooling failure, no passing check count available |
| `git diff --check` | Exit 0; no whitespace errors (LF-to-CRLF advisories only) |

The suite retains the expected failure-injection save/retry console diagnostic. Tests exercise the production session through injected native/lifecycle ports; they do not mount native controls or demonstrate no Android activity recreation. Provider identity is preserved structurally, but device regression testing remains required.

Initial `--no-install expo-doctor` could not find a cached CLI. A subsequent network-backed attempt was interrupted by the server restart; it is not a passing Doctor result. PowerShell's temporary introspection JSON had a BOM; parsing with `ConvertFrom-Json` succeeded. Temporary check artifacts are removed before handoff.

Final Doctor attempts: `npx.cmd --yes expo-doctor` exited 1 with `Cannot find module '@expo/env'` in the npm temporary CLI. Retrying with process-local `NODE_PATH` pointing to existing project dependencies exited 1 with `TypeError: (0, e.boolish) is not a function`. A separate temporary `npx.cmd --yes --package=expo-doctor --package=@expo/env expo-doctor` environment also exited 1 with missing `@expo/env`. No app dependencies or lockfile were changed to work around CLI packaging. Doctor remains an explicit validation blocker requiring a working CLI environment; no claim of full validation or Android acceptance is made.

## Android steps after separately approved rebuild/install

1. Record device/Android version, navigation mode, APK identity and signing match. Record existing habits, progress, routines, goals, profile and achievement state; retain an existing backup. Replace over the existing app only when separately authorized.
2. Cold launch with Android Light and Dark. Public app starts Dark + English in each case, Settings selectors remain read-only, and original splash is preserved. Check startup/recovery surfaces and no crash or black screen.
3. Connect the development build to Metro. Tap the DEV bar to Light, then Dark through the cycle. Toggle Android appearance while each fixed preview is selected: app surfaces/native controls stay fixed. Inspect status icons, alerts, share/document UI and keyboard behavior.
4. Select System. Change Android appearance while visible (including Quick Settings), then while backgrounded; resume. Selected mode stays System, resolved label and UI follow the OS. Repeat Light → System and Dark → System under the opposite OS mode; check the old native override is released. Repeat rapidly; watch for flicker, oscillation and activity recreation.
5. Repeat in gesture and three-button navigation. Inspect system navigation contrast, status bar, native tabs, pushed screens and Back return routes. Check forms/scroll position/unsaved text survive switches. Verify all five tabs, details, recovery/loading/backup overlays, achievements and chart contrast using the Phase 3A QA matrix.
6. Verify backup busy disables the preview control. Compare domain state before/after presentation changes; exporting backup v1 should preserve its schema and domain contents. Do not clear data or alter recovery evidence. Existing backup/recovery tests pass, but device data preservation has not been physically tested here.
7. Restart the JS runtime: preview resets Dark and English remains unchanged. Fast Refresh may preserve preview state. Return to Dark before ending review.

References checked: [SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo color themes](https://docs.expo.dev/develop/user-interface/color-themes/), [SystemUI](https://docs.expo.dev/versions/v58.0.0/sdk/system-ui/), [system bars](https://docs.expo.dev/develop/user-interface/system-bars/), [RN Appearance](https://reactnative.dev/docs/appearance), [RN AppState](https://reactnative.dev/docs/appstate), and installed RN 0.88/web/native window sources.
