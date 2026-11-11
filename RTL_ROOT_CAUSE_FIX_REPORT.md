# RTL root-cause fix — ready for physical review

Implemented on `wip/settings-appearance-language` without staging, committing, pushing, switching branches, building or accessing a device. Existing Phase 4B–4E work was inspected and retained. This is the authorized alignment/Today/achievements correction, not another screen-wide redesign.

## Rechecked evidence

Installed packages: Expo `58.0.23`, React Native `0.88.1`. The SDK 58 documentation and installed native implementation were reviewed before editing.

- `node_modules/react-native/ReactCommon/react/renderer/components/text/ParagraphShadowNode.cpp:81` obtains paragraph direction from the Text node's Yoga direction.
- `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/text/TextLayoutManager.kt:191–235` resolves alignment using paragraph direction and first-strong script direction. In this implementation, `left`/`start` select the paragraph's starting edge; `right`/`end` select its opposite edge. For an RTL paragraph, passing `right` therefore places text at physical left. This holds for both Arabic-first and Latin-first text after the native script-direction compensation.
- `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/text/TextAttributeProps.kt:531–544` explicitly maps `start` to right gravity and `end` to left gravity when RTL. However, `AndroidTextInputShadowNode.cpp:164–193` constructs input fragments without ParagraphShadowNode's Yoga-to-paragraph-direction assignment. Input cannot safely share the Text adapter on that assumption; its existing behavior is preserved separately.
- The previous shared wrapper resolved Arabic default/logical-start intent to the physical string `right` before Android interpreted it again. The source-supported mismatch explains correct RTL card/tab order coexisting with left-aligned glyphs. A wrapper test asserting the string `right` did not validate native placement.
- Native tabs receive their own direction through `src/components/app-tabs.tsx`. Router context, tab ordering, root presentation, Back/navigation logic and I18nManager are unchanged by this fix. `direction-styles.ts` remains a spacing-only helper.

These are findings from the checked-out SDK implementation. The installed APK's compiled native version and actual pixel placement were not inspected; no new physical success is claimed.

References reviewed: [SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo documentation index](https://docs.expo.dev/llms.txt), [React Native text styles](https://reactnative.dev/docs/text-style-props), [View/onLayout](https://reactnative.dev/docs/view#onlayout). Versioned RN documentation URLs were unavailable through the documentation tool; the installed 0.88.1 native source supplies the specific alignment evidence above. Android alignment does not rely on `writingDirection`, which the public text-style documentation identifies as iOS-specific.

## Changes

**Shared alignment boundary.** `textAlignment` now distinguishes caller intent from native encoding. `start`/`end` resolve using presentation language; explicit physical `left`/`right` are honored rather than mirrored again. For Arabic on Android, the resulting physical edge is encoded as native logical `start`/`end` using the actual paragraph direction. Center/justify are preserved. English props retain their previous resolutions on every platform; iOS/web use physical edge values.

| Intent/context | Physical target | Android prop |
| --- | --- | --- |
| Arabic default/start/right, RTL paragraph | Right | `start` |
| Arabic end/left, RTL paragraph | Left | `end` |
| Arabic numeric start, explicit LTR numeric paragraph | Right | `end` |
| Center | Center | `center` |

The localized Text boundary makes Arabic paragraph direction explicit, while honoring a caller's explicit LTR paragraph island. This makes native encoding deterministic instead of guessing inherited direction across native screen/artwork boundaries. English receives no added direction style. NumericText uses an explicit LTR paragraph and the existing whole-run LRI/PDI isolation, with edge alignment encoded for that paragraph; it does not reverse digits or change mixed user text. TextInput uses the separate `inputTextAlignment` function, retaining the exact prior alignment resolutions for every language/explicit-alignment combination, its value/ref/events and automatic script handling. Existing Arabic wrapping, line-height and letter-spacing policy is otherwise retained. No global RTL flags, reloads, provider keys or remount logic were added.

**Today header.** Arabic header direction and a 12 dp gap are explicit. Its shrinking text column stretches date/greeting to a common logical start edge; the corrected native text boundary then places glyphs at physical right. The avatar remains the trailing left action. English styles and hierarchy remain unchanged.

**Measured progress.** The Arabic progress card measures its own outer width with `onLayout`, not device width. The pure `arabicTodayProgress` helper subtracts 32 dp padding and 2 dp border, then reserves a 112 dp ring, 16 dp gap and a text budget of `176 × max(1, fontScale)` dp. If that budget does not fit, the text takes the full card width with a 96 dp ring below. Unknown width starts stacked safely. A width-only state update ignores changes smaller than 0.5 dp; height changes cannot feed back into the layout decision. Window dimensions supply font scale only for this decision. The horizontal text column has a bounded flexible basis; the stacked column retains intrinsic height.

Above 1.25 font scale, the full Arabic percentage caption moves below the circle, where it can grow vertically. The fixed artwork's numeric counter uses a maximum font multiplier of 1.2 and minimum fitting scale of 0.5; the full count sentence outside the artwork remains scalable. Ring calculations, arcs, animation and LTR geometry are unchanged. English retains its original 148 dp ring/text branch and caption behavior. The text-budget threshold is a layout heuristic, not a claim of measured Arabic glyph widths; physical QA remains required.

**Achievements summary.** Arabic receives one header row containing a shrinking eyebrow/title column on the right and trailing navigation chevron on the left. The existing SymbolView boundary mirrors the canonical right chevron exactly once. The count is a full-width sentence, followed by a separate right-starting decorative badge strip, then next-achievement copy and action. Count/icons no longer compete in a wrapping `space-between` row. The English JSX grouping and northeast affordance remain intact. Earned/recent/next calculations, sorting, IDs, acknowledgement, encouragement and navigation callbacks are unchanged. This shared summary is used on Today and Settings; the Arabic grouping applies consistently in both places.

**Arabic wording.** Only `today.progress` changes to `أكملت {completed} من أصل {total} اليوم.` It remains a complete named-parameter message under the daily-progress heading. English resources, numeric values and user data are unchanged.

## Exact final validation

| Check | Result |
| --- | --- |
| `npm.cmd test` | Exit 0: **291 tests, 18 suites; 291 pass, 0 fail/cancelled/skipped/todo; 9832.7442 ms** |
| `npx.cmd --no-install tsc --noEmit` | Exit 0; no diagnostics |
| `npx.cmd --no-install expo lint` | Exit 0; no warnings/errors |
| Localization inventory regeneration + independent in-memory deep comparison | Exact match: **183 sources, 22 route roots, 176 reachable files, 118 candidate files, 1502 candidates** |
| `git diff --check` | Exit 0; no whitespace errors. Existing LF/CRLF advisories only; Git line-ending settings were not changed. |
| Compatible external Expo Doctor **1.21.6**, `--verbose` | Exit 1: **19/20 checks pass**, only the existing 13 SDK patch recommendations below |

Five new tests cover the source-verified Android alignment contract/reference model; executable Text/Input/NumericText prop handling with mocked native components; measured width/font-scale progress decisions; executable Arabic/English achievement grouping and render-time data isolation; and exact Arabic/English progress messages. Earlier Phase 4D/E assertions were updated to the corrected contract. The Android algorithm model and mocked component trees do **not** execute Kotlin, Yoga or Android text measurement and do not prove physical rendering. Existing missing-Intl, appearance, language persistence, navigation, English-copy/style preservation, achievement/domain and backup v1/checksum/recovery tests pass.

One initial focused run failed because the new test incorrectly expected English `4 of 4 habits done`; the actual preserved resource is `4 of 4 habits`. Only the test expectation was corrected. The final full result above includes that correction.

Doctor used the existing external CLI, with network access, without installing or suppressing anything:

`C:\Users\Beeviro1\AppData\Local\Temp\momentum-doctor-7441495e4de54f8a984e89e2e3e35524\node_modules\expo-doctor\bin\expo-doctor.js`

All other Doctor checks passed, including config schema, peer dependencies, native support packages, duplicates and directory metadata. Installed → recommended versions:

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

## Exact changed files for this fix

Modified relative to the inspected Phase 4E working tree:

- `src/utils/rtl-presentation.ts`
- `src/components/localized-native.tsx`
- `src/app/(tabs)/index.tsx`
- `src/components/today/progress-ring.tsx`
- `src/components/achievements/achievements-summary-card.tsx`
- `src/i18n/ar-messages.ts`
- `tests/rtl-visual.test.mjs`
- `tests/arabic-composition.test.mjs`
- `LOCALIZATION_COPY_INVENTORY.json`

New:

- `src/utils/today-presentation.ts`
- `tests/rtl-root-cause.test.mjs`
- `RTL_ROOT_CAUSE_FIX_REPORT.md`

At task start, 293 existing Git-visible project files were fingerprinted. Nine existing files changed within the authorized scope; no pre-existing file was removed. Other existing Phase 4E files and all earlier reports remain byte-identical to the starting working tree. The task-created `rtl-root-cause-tests.tmp.log` was removed after recording final results. No personal backups or extra migration scripts were created.

No domain/storage/preferences/appearance authority, achievement definitions/calculations, backup/recovery, navigation or native/dependency configuration changes were made. No device data was read or changed. These JavaScript-only changes introduce no native rebuild requirement.

## Short Android retest checklist

1. **Arabic Today, default text size:** capture greeting/date, progress and achievements in one or two screenshots. Check common physical-right text edges, avatar on the left, natural progress sentence, correct ratio order and centered ring text.
2. **Narrow window and large text:** verify the measured card switches to full-width summary when needed, count/status remain complete, ring counter fits and large percentage caption appears below the circle. Resize back and check stable return to a row without oscillation.
3. **Achievements on Today and Settings:** check right title/eyebrow, left chevron, standalone earned count, grouped badge strip, next summary and action. Open/Back and any existing celebration dismissal must behave as before.
4. **Shared text safety:** briefly inspect Arabic Settings, Habits/Goals/Insights and one mixed Arabic/English input. Check centered labels and numeric values, unchanged input value/cursor behavior, native tab order and Back. Repeat key Today/Settings checks in Light/Dark/System.
5. **English return/reopen:** confirm original English header/progress/achievements composition, saved language/appearance persistence and existing synthetic data. No reset, restore or APK build is needed for this retest.

Physical visual acceptance is pending new Android screenshots/testing. In particular, actual font metrics, glyph wrapping, native paragraph behavior in the installed binary and accessibility order cannot be certified by the Node tests.
