# Phase 1: temporary Android runtime RTL spike

## Later evidence reconciliation (Phase 4C)

The user has confirmed that Phase 1 was physically tested on their Android device: native tab reordering, navigation/Back, mixed Arabic/English input, and returning to LTR worked without reload. The historical Pending entries below were not updated at the time and must not be treated as evidence of unsupported runtime RTL. The confirmation does not supply a device/build identifier or establish every opposite-device-language matrix entry. The completed Phase 4C integration still needs its own physical QA; no new physical success is claimed here.

Baseline: `cbd23fa`. Scope: feasibility only. Physical Android results are **pending**; no device session was available/exercised during this change. Passing static checks is not evidence that native tabs mirror correctly.

## Changes and safety

Initial working tree contained only untracked `SETTINGS_APPEARANCE_LANGUAGE_PLAN.md`; it was preserved without modification.

Temporary runtime edits, exhaustively:

1. `src/app/_layout.tsx`: import `DevRtlSpike` and wrap the existing profile/domain-provider subtree with it, inside `DataBackupProvider`. No provider was reordered or keyed, and recovery code was not edited.
2. `src/components/dev-rtl-spike.tsx`: new Android-only `__DEV__` toolbar and in-memory direction/text probe. Uses Expo Router `LocaleProvider` plus content `View.style.direction`. Starts LTR. Release builds, iOS, and web return children without the toolbar, locale override, or extra native view. Existing dark palette and English app copy remain.
3. This document: `RTL_SPIKE_ANDROID_TESTING.md`.

There are no storage imports/writes, global RTL setters, reload calls, route changes, new native props/dependencies, configuration changes, or native builds in the spike. No commits or pushes. Recovery remains outside the temporary direction wrapper; its blocking/applying overlay keeps precedence. Toolbar controls are disabled when `useDataBackup().busy` is true.

Direction and probe text are React state only. A real JS restart resets them; Fast Refresh may retain them. Switching direction does not key/remount the navigator or providers. Normal application code still performs its existing startup/foreground operations; the spike neither disables nor changes those. It adds no domain mutation of its own. Avoid save/check-in/restore actions while gathering read-only feasibility evidence.

## Start on the existing APK

1. Keep the already-installed **MOMENTUM Dev** APK. Do not install, uninstall, clear data, rebuild, or use Expo Go for this test.
2. From this workspace run `npx.cmd --no-install expo start --dev-client`. Connect the existing development client using its launcher/recent server or the development-client QR code. Use the same network/server connection procedure as the completed Android milestone.
3. The initial Metro connection loads the changed JavaScript. After that, test runtime toggles **without** Reload, Fast Refresh edits, activity recreation, or app restart between toggles.
4. Wait for ordinary data verification/startup to finish. A compact **DEV RTL spike** toolbar should appear above the existing app. It consumes some vertical space and can add extra top safe-area spacing; this is temporary test UI, not a proposed production layout.
5. Confirm the app is dark, the selected control is English LTR, and current records are visible. The Settings rows still say Dark/English: they are deliberately not functional settings in this phase.

## Runtime test sequence

1. Tap **Show probe**. Note the current route and `content/router: ltr`. Type a recognizable mixed string such as `Hello مرحبا 123 اختبار` in the temporary field. This field cannot save to domain storage.
2. Tap **العربية RTL**. Expect `content/router: rtl`, A/start on the right and B/end on the left, with the probe field right-aligned. The same typed string must remain. Toggle back to English LTR, then repeat several times. The route must not change, and the splash/loading sequence must not replay.
3. Keep the probe visible as a route/state reference. Visit each native tab in both directions. Record visible tab order, selected highlight, icon placement, label placement, tap target correctness, and whether the selected tab stays selected when toggling. Existing English labels are intentional; Arabic app translations are not included.
4. From Habits, open an existing habit, toggle while its detail/editor is already open, and use Android Back to return to the list. If inspecting an existing editable field, note its value/cursor before toggling; do not save. Discard any draft changes through the app's normal cancel flow.
5. Open New Habit or New Goal without saving. Type a temporary mixed Arabic/English draft, move the cursor, switch direction with the keyboard visible, and inspect shaping, selection, keyboard avoidance, and state retention. Cancel/discard afterward. The toolbar's own field is the safest input test if you prefer not to touch an editor at all.
6. If an existing routine is available, open it from Today's plan and Back to Today; separately open it via Habits → Routines and Back to that list. Repeat in each direction. Confirm the selected originating tab and its nested stack survive toggles.
7. Inspect a goal detail and Insights habit detail if data is available. Toggle while open, then test Android hardware/gesture Back and the custom on-screen Back control independently. Note transition direction on subsequent pushes and pops.
8. Do not open Achievements solely as a read-only probe: its normal existing acknowledgment behavior can mark badges seen. Do not export/import/restore, acknowledge badges, complete/undo habits, archive/delete, or save editor changes for this spike. If existing app behavior writes on normal startup/foreground, that is independent of the direction toggle.
9. Hide the probe to inspect more screen area. Return to English LTR before ending the session. Optionally do a single deliberate JS restart afterward to confirm the in-memory choice resets; distinguish this reset test from the no-reload runtime tests.

If Android allows it, repeat the sequence with an Arabic device language, and then restore the original device language. Changing the **device** language may recreate the activity; do not count that event as a successful runtime toggle. Do not enable Android developer “Force RTL layout direction,” which would confound this app-controlled test.

## Limits and interpretation

- `native: ltr/rtl` is the read-only global `I18nManager.isRTL` value, not the selected mode. It is expected to stay unchanged when toggling. A mismatch with `content/router` is intentional: the purpose is to see whether the existing native components obey local direction despite device/global defaults.
- Installed Router exports `LocaleProvider`. Installed `react-native-screens` Android TabsHost documents and implements direction through `style.direction`, defaulting to inherited direction. Router's Android native-tabs adapter does not itself explicitly pass the locale direction to that host. The root content direction is therefore the mechanism under test; source compatibility does not prove propagation through the actual native screen hierarchy.
- Router's supported runtime locale API controls navigation direction; root content direction separately controls Yoga layout. Native widgets, OS dialogs/keyboard, and components that consult device/global direction may still behave differently. Opposite-device-language testing is essential before approving this architecture for production.
- Hardcoded `slide_from_right`, custom back/chevron symbols, physical margins, text alignment, and all existing user/app copy are unchanged. Record these gaps, but do not treat a fixed custom icon or explicit animation as proof that LocaleProvider is unsupported. This spike deliberately separates observing current behavior from a full RTL UI conversion.
- Probe input alignment is explicitly changed; its text retention does not prove existing inputs align automatically. Test existing inputs separately. No font, number parsing, Arabic validation, or localization system is included.
- Recovery overlays are intentionally outside the spike and are not RTL test surfaces here. Theme/System support remains out of scope and the existing APK is still dark-locked.
- The toolbar reduces usable height. Distinguish keyboard/spacing effects caused by that toolbar from existing layout problems.

## Results and decision gate

Automated checks after implementation:

| Command | Result |
| --- | --- |
| `npm.cmd test` | Exit 0; 185 tests, 18 suites, 185 passed, 0 failed/cancelled/skipped/todo; reported test duration 2084.2307 ms |
| `npx.cmd --no-install tsc --noEmit` | Exit 0; no diagnostics |
| `npx.cmd --no-install expo lint` | Exit 0; no diagnostics |
| `git diff --check` | Exit 0; no whitespace errors; Git emitted its LF→CRLF working-copy advisory |

The suite prints an intentionally injected `daily failure` save/retry diagnostic from existing achievement-coordination tests; the tests pass. Existing tests cover pure/storage/navigation models, not mounted Android native tabs. No test dependency or shallow implementation-mirroring test was added for this temporary UI.

Fill in during physical testing:

| Observation | English device | Arabic device |
| --- | --- | --- |
| APK/build ID, Android version/model | Pending | Pending |
| Runtime A/B row and content direction | Pending | Pending |
| Native tab order/selection/tap targets | Pending | Pending |
| Open route and draft survive toggles | Pending | Pending |
| Nested/root Android Back and return-to-origin | Pending | Pending |
| Input shaping/cursor/keyboard behavior | Pending | Pending |
| Explicit versus navigator-controlled transitions | Pending | Pending |
| Native/global direction mismatch effects | Pending | Pending |
| Crash/warnings/unexpected remount | Pending | Pending |

Current finding: the spike is implementable using installed JS APIs without a navigation replacement or native change. **Runtime Android feasibility is not yet certified.** Stop for review of device results before any further implementation.

If native tabs fail to inherit local direction, report that as the Phase 1 blocker with device/build/steps. A possible next, separately reviewed spike is the installed native-tabs `unstable_nativeProps` → host direction adapter, after checking exact SDK 58 support. It preserves navigation architecture but is an unstable API and is not added here. Otherwise investigate an upstream Router/screens fix compatible with the current native binary. If a fix requires a new APK or restart/global direction approach, report that scope change for approval. Do not silently replace native tabs with JS tabs or add global RTL setters.

## Clean reversal

Remove the `DevRtlSpike` import and its opening/closing wrapper tags from `src/app/_layout.tsx`, leaving the provider subtree as it was. Remove only `src/components/dev-rtl-spike.tsx` and, optionally, this testing document. Preserve `SETTINGS_APPEARANCE_LANGUAGE_PLAN.md` and any later unrelated work. No stored preference/global RTL flag was created, so reversal needs no storage cleanup. Reload JavaScript only after ending the runtime test session.

Sources checked: [SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/), [Expo documentation corrections/index](https://docs.expo.dev/llms.txt), [runtime locale and content direction guidance](https://docs.expo.dev/guides/localization/), [SDK 58 native tabs](https://docs.expo.dev/versions/v58.0.0/sdk/router/native-tabs/), and [RN layout direction](https://reactnative.dev/docs/layout-props#direction). Native behavior still requires the physical acceptance test above.
