# MOMENTUM — Smart Habit Notifications and Habit Notes

Date: 2026-11-15. Implementation is ready for code review and Android acceptance; this report does not claim physical notification QA.

## Repository and safety

- Branch remains `wip/settings-appearance-language`.
- HEAD remains `254f052cdee0bd8ccda6ea34e01753a5634f01fe`.
- The checkout was clean before this batch. No branch switch, merge, cherry-pick, reset, clean, staging, commit or push was performed.
- No APK/AAB/native build, emulator/device operation, app installation, data clearing, import, restore or device migration was performed. Restore/recovery tests use in-memory fakes only.
- The user's personal Expo Go data was never accessed. Existing reports and historical preservation fixtures remain intact.

## Read-only review of the notification WIP branch

The existing branch is the remote-tracking ref `origin/feature/notifications-wip`, at `2111e900b5b33158582cc6ce64309e0ff6923687` (`WIP: Add local notifications and reminders`). No local branch was created or checked out. Its three-dot change set contains 35 files, 5,229 insertions and 24 deletions.

Reviewed its Git history, file tree, dependency/config changes, notification plan and relevant implementation/test sources. Useful patterns were:

| Existing WIP implementation | Decision in this batch |
| --- | --- |
| `src/notifications/scheduler.ts`, `permission-check.ts` | Retain the native-adapter boundary, channel-before-permission sequence, read versus request distinction and explicit foreground policy. Replace diagnostics/test notifications and English channel/action copy. |
| `src/notifications/reconcile.ts` | Retain owned identifiers, list-before-change, idempotent reconciliation and failure-injected test patterns. Add persisted reservations and saved-domain/recovery guards. |
| `src/utils/reminder-plan.ts`, `reminder-time.ts`, `reminder-presentation.ts` | Reuse the concepts of pure planning, calendar weekdays and safe target resolution. Replace indefinite daily/weekly repeating triggers with bounded one-off dates for current-day completion cancellation, quiet hours and caps. |
| `src/data/reminder-storage.ts`, `use-reminders.tsx` | Do not import the experimental reminder store or replace current save-first providers. Per-habit settings now belong to the habit's atomic save; device-only motivation/activity/ledger use a separate key. |
| Reminder editors and the large WIP Settings rewrite | Do not copy over the current localized/theme/navigation implementation. Add small localized controls and a separate Settings destination. |
| Five `reminder-*.test.mjs` files | Reuse deterministic planner/fake scheduler/failure-injection approaches. Add tests against the implementation actually shipped in this branch, rather than transplanting stale tests. |

The WIP added `expo-notifications ~58.1.8` and its plugin. Current SDK 58 docs and Expo's installer resolve `~58.1.9`. The old branch also supports routine reminders; that unrelated feature and its Settings overhaul were not imported. No old WIP reminder preferences or old `momentum.h.`/`momentum.r.` alarms are migrated or cancelled by this batch.

## Implemented behavior

### Habit reminders

- New and existing Habit forms have an optional on/off reminder, editable 24-hour time and selected weekdays. Actual delivery days are the intersection of reminder weekdays and the habit's schedule.
- Time input accepts English, Arabic-Indic and Persian digits. Normalization is at the input boundary; persisted time remains ASCII `HH:MM`, weekdays remain numeric.
- Reminder settings save atomically with the habit. Old habits without the optional field remain unchanged on load; opening/cancelling a form does not write a default reminder.
- Create, edit, rename, schedule/time/weekday changes, disabling and delete all invalidate the plan. Saved Tick/Count/Checklist completion removes today's pending reminder; future dates remain scheduled. Partial Count/Checklist progress still qualifies. Undo can restore an unexpired reminder.
- Switching off an incomplete unsaved reminder draft cannot leave hidden invalid fields blocking Save. Valid saved times/weekdays are retained.
- Local Android notifications use SDK 58 date triggers with `delivery: 'bestEffort'`. The engine schedules seven local calendar dates including today, not an indefinite repeating alarm.

### Optional gentle reminders

Settings → Notifications exposes:

- Separate opt-ins for unfinished scheduled habits and inactivity; both default off.
- A configurable gentle-reminder time, quiet start/end, global daily cap (1–6, default 3) and inactivity threshold (1–14 local days, default 3).
- A generic, nonjudgmental unfinished-habits invitation, at most once per local date. It requires at least one currently scheduled unfinished habit; known saved completion suppresses it today.
- One inactivity invitation per saved activity anchor, rather than repeating every inactive day. The first configured time at/after the local-day threshold is used, so a time earlier than that threshold's clock time falls on the following day. This single invitation can be outside the seven-date habit horizon.
- Quiet hours skip planned notifications instead of accumulating a burst afterward. Overnight and same-day quiet intervals are supported; start and end must differ.
- The daily cap includes all types, including explicit habit reminders. Earliest planned times win; equal times have stable identifier ordering. Excess candidates are omitted. Generic encouragement does not stack at the exact instant of an explicit habit reminder.
- At most 43 owned pending requests: up to 42 within the seven-date/global-cap budget, plus one later inactivity reminder.

### Permissions, lifecycle and persistence safety

- Permission is read without prompting on startup/resume. Only the explicit Allow button asks the OS. A permanently denied permission does not repeatedly prompt; system app settings can be opened instead.
- Android's localized `momentum_smart_v1` channel is created before requesting permission. A blocked channel is treated as blocked, even when app-level permission is granted. Channel importance is DEFAULT, badges are off and lock-screen visibility defaults to PRIVATE; the OS/user ultimately controls presentation.
- A lazy native adapter keeps missing-module/older-build and unsupported-platform failures contained. Notes and existing app flows remain usable. Native/setup errors are visible in reminder/notification controls, with explicit retry; preferences are retained.
- The engine serializes config, activity, reservation writes and native schedule changes. It lists pending requests before changing them and only cancels identifiers beginning `momentum.smart.v1.`. It never calls cancel-all.
- A durable reservation ledger is written before scheduling. The same habit/date or gentle/date event is not replayed after its reserved time, including after restart or a later time edit. Reservations are conservative evidence of possible delivery, not proof Android displayed a notification.
- Changed alarms retain their OLD reservation until cancellation succeeds. A failed cancellation cannot advance the ledger to a later time and cause an already-fired old alarm to be followed by a duplicate replacement.
- Storage/list/cancel/schedule errors fail closed and remain retryable. A failed cancellation stops that reconciliation before replacement scheduling. Interrupted operations can miss a reminder rather than risk replay; later foreground minute/resume reconciliation retries.
- Reconciliation waits for habit, daily-record and language-preference readiness. It reads today's persisted record only after daily writes drain. Optimistic changes and failed/pending writes are never treated as saved completion.
- Guards recheck pending revisions, habit snapshots, local date, language, recovery admission and persistence generation around awaited work. Backup/recovery freezes admission, and remount/generation changes retire stale work.
- Startup, resume, app-state changes, saved-day drains, habit changes and language changes reconcile. A foreground minute tick refreshes activity, local wall-clock scheduling, timezone and DST changes. Calendar constructors preserve local time across DST; nonexistent spring-forward times are skipped.
- Permission dialogs can take minutes: planning refreshes its timestamp after permission handling, and expired dates are not scheduled for immediate replay.
- While the app is actively visible, owned reminder banners/sounds are suppressed. Unrelated notifications are not suppressed by this policy.

### Notification opening and actions

- Notification body taps and localized Open Habit/Open Today buttons use only owned metadata and an existing habit ID. External URLs/routes in payloads are ignored; deleted/missing targets fall back to Today.
- Cold-start navigation waits for hydrated sources and navigation readiness. Repeated action responses are consumed once and the stored response is cleared.
- Existing form navigation protection handles notification navigation. Readiness and the latest habit snapshot are checked again after a deferred navigation confirmation.
- Done and Remind Later were evaluated but intentionally not implemented. Tick, Count and Checklist have different completion semantics; background handlers must not bypass the sole daily-progress writer, pending saves or recovery guards. Open Habit leaves all changes in the existing persisted app flow.

### Habit notes and compatibility

- Habit forms/details now display an editable Personal notes field, separate from description. In the current app the habit detail destination is its edit form, so notes are visible and editable there.
- Notes are optional strings. New edits allow up to 2,000 UTF-16 code units and reject C0/DEL controls except newline/tab. Mixed Arabic/English, emoji, newlines and whitespace are preserved verbatim; notes are plain text, not evaluated markup.
- The parser accepts omitted notes and retains existing string notes without automatic trimming, truncation or migration. Oversized pre-existing text can still be loaded/exported; editing requires satisfying the form limit. Invalid typed data fails closed rather than being silently deleted.
- The habit store remains `momentum:habits:v2`, version 2. Old v1 habits still follow the existing compatibility path. No raw historical records, completions, goals, routines, achievements or presentation preferences were changed by this feature.
- **Backup v1 is unchanged:** envelope, checksum, manifest, allowlist, schema-version reporting and recovery protocol retain their original contracts. Notes and per-habit reminders travel inside the existing raw habit record. Both old archives without these optional fields and new archives with them are accepted.
- In-memory export → empty restore → import → recovery tests confirm exact raw habit/history preservation and retention of notes/reminders. No actual device backup was read or restored.
- Device-only settings, last-activity timestamps and delivery reservations use `momentum:notification-device:v1`, outside backup v1's allowlist. They stay on the receiving device across restore; OS permission is never transferred in a backup. Restored habit metadata is reconciled after existing recovery completes.
- Downgrading to an older app that does not understand optional notes/reminders can discard them on a later habit save. New archives should not be round-tripped through such an older app. This is a forward/downgrade limitation, not a change to backup v1.

## Native changes and rebuild requirements

Installed with `./node_modules/.bin/expo.cmd install expo-notifications`, not a manual dependency-version guess.

- Direct addition: `expo-notifications ~58.1.9` (resolved 58.1.9).
- Installer added six packages and updated three existing resolutions. The existing resolutions changed only where required by that dependency: `@expo/image-utils` 0.12.6 → 0.12.7, `@expo/require-utils` 58.0.5 → 58.0.6, and `expo-constants` 58.0.15 → 58.0.16. Added transitive packages are `expo-application`, `abort-controller`, `event-target-shim`, `badgin` and the nested `@expo/env`, plus the notification module itself.
- Added the notification config plugin with color `#8B7CF6` and **`enableRemoteNotifications: false`**. SDK 58 otherwise enables the iOS APNs entitlement by default; this batch explicitly avoids that. Background remote notifications remain disabled.
- The module's Android manifest declares `POST_NOTIFICATIONS` and `RECEIVE_BOOT_COMPLETED`. No exact-alarm permission was added or requested. No Google services file, remote token registration, account, server, EAS credential or cloud service was introduced.
- Existing app identity, scheme, icon, splash, package name, signing/build profiles and other configuration remain unchanged. No custom notification icon asset was added; validate the native fallback icon visually.
- **A future MOMENTUM Dev native rebuild is required to guarantee the new native module/plugin exists in the installed binary.** A JavaScript reload/OTA alone cannot add a missing native module. No build was run here. Any later install must preserve the existing Dev application identity/signing and data; do not uninstall or use the personal Expo Go data for acceptance.

References reviewed before API implementation: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [SDK 58 Notifications API/configuration](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/), [Expo documentation index](https://docs.expo.dev/llms.txt), and installed 58.1.9 TypeScript/plugin/Android-manifest sources.

## Exact validation results

| Check | Actual final result |
| --- | --- |
| `npm.cmd test` | Exit 0: **366 tests, 18 suites, 366 passed, 0 failed, 0 cancelled, 0 skipped, 0 TODO**. Final run duration reported by Node: 18,815.1807 ms. |
| New focused coverage | **47 new tests** across `notifications-notes.test.mjs` and `notifications-integration.test.mjs`; the pre-existing 319 tests also pass. |
| `./node_modules/.bin/tsc.cmd --noEmit` | Exit 0, no diagnostics. |
| `EXPO_NO_CACHE=1` and `./node_modules/.bin/expo.cmd lint --no-cache` | Exit 0, no warnings/errors. |
| Localization inventory regeneration | `node scripts/audit-localization.mjs --write` completed. |
| Fresh inventory versus checked-in JSON | Deep equality passed: sourceFiles 200, routeRoots 23, reachableFiles 193, candidateFiles 128, candidates 1577. |
| `git -c safe.directory=C:/Projects/momentum diff --check` | Exit 0; no whitespace errors. Git emits LF→CRLF working-copy conversion advisories on existing affected files. |
| Expo Doctor | Not run: neither local executable/package nor a PATH executable is available. No Doctor dependency was downloaded/installed. |
| Additional read-only dependency check | `EXPO_OFFLINE=1 ./node_modules/.bin/expo.cmd install --check`: exit 0, `Dependencies are up to date`; also warns `Dependency validation is unreliable in offline-mode`. This does not replace Doctor. |

The dependency installation reported **10 moderate npm advisories**. No automatic audit fix or unrelated dependency upgrade was attempted; their production impact still needs separate assessment. Expected existing test failure-injection diagnostics are not test failures.

During development, checks caught the authorized config/storage preservation mismatch, a plugin-index assumption, React ref/dependency lint issues, an outdated inventory, and two test-harness mistakes. These were corrected; none remain failing. The original `phase4b-preservation-baseline.json` was not regenerated. A separate reviewed fixture pins only four changed protected files (app config, package manifests/lock and habit storage). Additional assertions prove all other native configuration, package declarations and unrelated lock entries are unchanged. Backup/recovery/calculation AST protections remain intact.

## Exact changed files

Modified:

1. `app.json` — local-only notification plugin.
2. `package.json` — essential SDK-compatible dependency.
3. `package-lock.json` — installer-resolved notification dependency tree.
4. `src/app/_layout.tsx` — notification provider inside recovery/domain providers.
5. `src/app/(tabs)/settings.tsx` — Notifications destination.
6. `src/components/habits/habit-form.tsx` — optional notes and reminder draft controls.
7. `src/data/habit-storage.ts` — optional-field parsing/preservation.
8. `src/utils/habit-validation.ts` — notes/reminder drafts and validation.
9. `src/i18n/en.ts` — new English catalog inclusion.
10. `src/i18n/ar.ts` — new Arabic catalog inclusion.
11. `LOCALIZATION_COPY_INVENTORY.json` — current reachable-source inventory.
12. `tests/phase4b-complete.test.mjs` — four explicitly pinned authorized preservation replacements.

Added:

13. `src/app/notifications.tsx` — guarded notification preference form.
14. `src/components/notifications/controls.tsx` — themed/localized accessible controls.
15. `src/components/notifications/habit-reminder-field.tsx` — per-habit controls.
16. `src/components/notifications/permission-notice.tsx` — permission/status/retry controls.
17. `src/hooks/use-notifications.tsx` — saved-data/lifecycle/recovery/navigation coordination.
18. `src/i18n/notifications-en.ts` — English labels/content.
19. `src/i18n/notifications-ar.ts` — Arabic labels/content.
20. `src/notifications/model.ts` — validation/defaults/types.
21. `src/notifications/planner.ts` — pure bounded local-calendar planner and safe targets.
22. `src/notifications/engine.ts` — serialized durable reconciliation.
23. `src/notifications/native.ts` — SDK 58 native adapter.
24. `tests/notifications-notes.test.mjs` — planner, failures, storage and backup coverage.
25. `tests/notifications-integration.test.mjs` — executable native/provider/form/control tests.
26. `tests/support/notifications-notes-preservation.json` — reviewed preservation evidence.
27. `MOMENTUM_NOTIFICATIONS_NOTES_REPORT.md` — this handoff.

## Android acceptance checklist — pending, synthetic Dev data only

After a separately authorized native rebuild/update, without uninstalling or clearing either app:

1. Launch MOMENTUM Dev: existing synthetic habits/history/preferences survive; startup never prompts for permission. Deny/allow via the explicit button, test permanent denial/system app settings and a blocked notification channel.
2. Create/edit a Tick reminder a few minutes ahead on a due weekday. Test disabled and excluded weekdays, overnight quiet boundaries and a low cap. Verify one notification; repeat rapid toggles, background/resume and locale changes without duplicates. Verify the native small icon and lock-screen privacy.
3. Complete Tick, reach a Count target and finish required Checklist steps before delivery. Confirm saved completion cancels today's reminder, partial progress does not, and undo before delivery restores only one. A failed save must not be represented as confirmed completion.
4. Change name/time/weekdays/habit schedule and delete a synthetic habit with pending reminders. Confirm obsolete alarms stop and future dates remain appropriate. Do not change the real device clock as a casual test.
5. Test body/Open Habit/Open Today taps from background and cold start, a deleted target, repeated taps, and an unsaved Habit/Goal/Routine draft. Cancellation retains the draft; an approved exit navigates once. Confirm no notification action writes completion directly.
6. Opt into gentle reminders, choose a non-quiet time and cap, verify neutral English/Arabic content and no simultaneous generic reminder on an explicit habit reminder. Test inactivity over the configured interval and reopening before it expires; it should re-anchor rather than send a repeated daily inactivity campaign.
7. Review English/Arabic, LTR/RTL, mixed-script notes, Arabic/Persian numeric input, Light/Dark/System, large fonts, TalkBack, keyboard scrolling and narrow screens. Edit notes, cancel, save and restart; description and history remain separate/intact.
8. Background, swipe away, reboot, battery saver/Doze and resume: record actual delivery delays, permission/channel behavior and rescheduling. If a synthetic test environment permits timezone/DST testing, verify the refreshed local times after resume. Do not claim force-stop delivery or closed-app timezone reconciliation.

Backup/restore acceptance in this batch is automated and in-memory. Any future device restore test requires separate authorization and a disposable synthetic test installation; this checklist does not authorize restoring, migrating or clearing either existing app.

## Remaining gaps and practical limits

- Physical Android delivery, action presentation, Arabic/large-font layouts, notification icon, OEM battery behavior and reboot behavior are **not yet accepted** for this batch. Existing physical acceptance for the earlier Today/jitter fixes does not cover notifications or notes.
- Android ultimately decides delivery. Quiet hours and caps govern requested schedule times/reservations, not a guarantee against OS-delayed delivery during quiet hours or delayed alarms arriving close together. Already-delivered tray items are not automatically dismissed on completion.
- There is no perpetual background condition evaluator. When JavaScript is terminated, scheduled reminders cannot inspect changed completion, locale, time zone, quiet settings or actual inactivity. Future-day unfinished reminders are plans based on currently known schedules, not live assertions. Open/resume reconciles; habit plans expire after the bounded horizon if the app is never reopened.
- Timezone/manual clock changes while closed can leave old absolute timestamps until resume. Minute polling covers active use; last-activity sampling is approximate within that cadence. The ledger retains eight days of elapsed ordinary reservations plus the current inactivity anchor, so extreme manual clock rewinds beyond retention are outside its duplicate-history guarantee.
- Strict closed-app conditional evaluation would need a separately designed native/background mechanism under OS restrictions. A backend alternative would also need authorized data synchronization, accounts/push infrastructure and privacy work. Neither was added, and neither would guarantee delivery after Android force-stop or user disabling notifications.
- Reservation accounting intentionally errs toward fewer notifications after interrupted/failed scheduling. A reserved but never displayed alarm may consume today's cap. Settings changes and activity are save-first; notification failures do not undo a successfully saved habit.
- If a previous experimental WIP build scheduled old-prefix alarms in this same Android package, this batch does not migrate its preferences or cancel those alarms. Check that circumstance separately during Dev acceptance; do not clear app data as a workaround.
- Device motivation preferences/ledger are deliberately not portable in backup v1. Per-habit reminder metadata and notes are portable; restored metadata can become eligible for local scheduling once existing permission and recovery readiness allow it.
- iOS has a compatible guarded path but no physical acceptance. Web exposes unavailable notification status while keeping notes/core app usable. There are no Done, snooze, routine reminders, custom notification artwork, background tasks, cloud sync or remote push in this batch.

Stop point: implementation and checks complete; changes remain uncommitted for review.
