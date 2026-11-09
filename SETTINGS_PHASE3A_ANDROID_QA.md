# Phase 3A Android Light/Dark QA

Use the **existing MOMENTUM Dev APK**, connected with `npx.cmd --no-install expo start --dev-client`. Do not rebuild, reinstall, uninstall, or clear MOMENTUM/Expo data. Physical Phase 3A results are pending.

## Setup and state retention

1. Wait for normal startup verification. Confirm default Dark + English, existing records intact, Settings Theme/Language rows still read-only, and no RTL probe remains.
2. Use the development preview bar to switch Dark → Light → Dark without Reload, edits triggering Fast Refresh, or restarting the app. Confirm all five native tabs, current selection and tap targets update colors. The bar adds vertical space/top safe area; it is not proposed production UI.
3. On an open habit/goal/routine/profile editor, type an unsaved draft, move the cursor, scroll, and toggle repeatedly with the keyboard open. Confirm draft, focus/cursor where the keyboard permits, scroll position, selected calendar date/month, tab selection and navigation history remain. Do not Save; cancel/discard afterward.
4. Repeat on an expanded Checklist, expanded achievement details, alternate insights period/chart mode and selected heatmap day. Confirm local component state survives. Opening Achievements can perform its existing seen/acknowledgment behavior; skip it if that normal write is unwanted on the current dataset.
5. Android Back/hardware/gesture and on-screen Back should preserve the originating tab and nested route. Check Today → routine → Back, Habits → Routines → routine → Back, goal detail and insights habit detail in both palettes. No splash/loading replay should accompany a palette switch.
6. Return to Dark before ending the session. A deliberate new JS runtime should reset preview to Dark. Fast Refresh may preserve preview state. No preference record should be created merely by toggling; do not confuse ordinary pre-existing startup/foreground normalization with preview writes.

## Surface matrix (inspect both palettes)

| Surface | Cases to inspect |
| --- | --- |
| Today | Greeting/profile prompt, rings at empty/partial/full, Tick checked/unchecked, Count steppers at limits, Checklist expanded/optional/done, routine plan/Now chips, save/load notices |
| Habits | List/empty/error/loading, icons in every stored swatch, detail/edit/new, tracking picker, weekdays, Count inputs, checklist steps/order, validation, archive/delete/cancel controls |
| Goals | Active/paused/completed pills, list filters/empty state, habit links/missing habits, consistency bars/provisional/unknown data, date/calendar selected/today/unavailable states, errors |
| Routines | List/empty/error, routine detail, mini bars, Today plan highlights, time buckets, icon/swatch preview, linked habit order controls, missing links, editor errors |
| Insights | Summary tiles, current/previous periods, weekly/monthly bars and gaps, all heatmap alpha levels/legends, selected/today/unreadable/rest/future cells, details/check marks, data notes |
| Profile/Settings | Summary/avatar initials/custom colors, name input/clear button, icon and color selection, hints/validation; all settings/privacy/about/data summary rows and chevrons |
| Achievements | Summary/hero, unread celebration, locked/earned cards, progress bars, filters, expanded evidence and history notes; allow existing acknowledgment effects only deliberately |
| Data & Backup | Read-only overview and preview when appropriate, warnings/acknowledgment, notices, unavailable/runtime errors, buttons/spinners. Avoid Restore merely to test colors on valuable data |
| Shared/navigation | Tab backgrounds/labels/icons/ripples/selection, stack backgrounds during push/pop, status icons, pressed/disabled states, keyboard cursor/selection, links and root background around transitions |

For each surface, inspect text/icon readability, border visibility, foreground on filled controls, scroll reachability, clipping, long user-authored text and large font/display scaling. Test TalkBack selection/disabled states and make sure status remains understandable without color. Check saved custom very light/dark colors as well as built-in swatches using existing records or unsaved form previews; do not rewrite stored colors to fix contrast.

Take matching Dark screenshots for the existing baseline. The original blue logo artwork, Dark palette values, geometry and wording should match apart from dev toolbar spacing, shared starter primitives adopting the single app palette, explicit input selection treatment, and contrast correction for unusually dark/light custom-color checkmarks. In Light, check that numeric labels, legend, fill and selected outline agree; no old purple/dark surface should remain unintentionally.

## Recovery/error coverage without risking live data

Recovery/loading/error surfaces now share dynamic styles, and their persistence/control flow was not changed. If a naturally occurring blocked/recovering state is available, inspect it in the currently selected preview; the overlay hides/disables preview controls while busy and should remain modal. Because preview is memory-only and there is no production theme setting, an already-blocked cold start defaults to Dark. Do not corrupt or delete journals on the real installation just to obtain a Light screenshot.

Use existing isolated backup test procedures/fixtures on a separately authorized disposable test environment for interrupted-restore/blocked-Light visual scenarios. Automated tests cover recovery/rollback semantics, not physical recovery screenshots. Record unexercised states honestly. Saving/sharing/replacing real data is not required for this palette review.

## Expected native limits / Phase 3B

The current binary is dark-locked. During Light preview, OS alerts, document/save/share screens, keyboard, native launch splash, navigation bars or activity transitions may remain Dark. App-owned surfaces and status-bar icons are the Phase 3A target. Do not classify an OS dialog as an untranslated/unmigrated React surface, and do not assume the native Light/System path passed merely because React views changed.

Full System appearance, automatic configuration and any native launch configuration changes require separate Phase 3B approval and a new APK. A future build must retain package ID/signing and install over existing data. No such changes or build are part of this phase.

## Result log

Record device/model, Android version, existing APK/build ID, tested JS revision, default device appearance, font/display scaling, screenshots, state-retention results, native chrome mismatches and any console warning. Mark each matrix row Pass/Fail/Not exercised for Light and Dark. Inherited Dark muted text/subtle borders have documented contrast gaps; numeric token checks do not certify full visual accessibility.

Stop after review of these results. Do not activate selectors, System, Arabic or RTL while testing Phase 3A.
