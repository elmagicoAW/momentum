# MOMENTUM full product and technical audit

Audit date: 15 November 2026. Repository: `C:\Projects\momentum`.

## Executive assessment

MOMENTUM has implemented feature screens and substantial persistence/recovery safeguards. It is **not ready for Android production release**. The checked-out application is explicitly MOMENTUM Dev; only a development-client APK build profile exists. Current automated verification is not completely green: 290 of 291 tests pass, with one preservation-baseline failure. Physical acceptance of the latest shared Android text-alignment fix remains outstanding.

This was a source/configuration/documentation audit with local, non-destructive checks and synthetic in-memory probes. No app was launched, device contacted, backup opened, account inspected, dependency installed, native directory generated, or build requested. No personal data was read or changed. The only requested repository addition is this report. Real habits remain in Expo Go; MOMENTUM Dev has separate synthetic data. Nothing in this report authorizes transferring or replacing either dataset.

### Top 10 concrete actions remaining

1. **Close the latest physical Android Arabic acceptance gate.** On the existing synthetic MOMENTUM Dev environment, verify the shared Text fix, Today progress, achievement summary, inputs, tabs and Back in both directions, all themes and large text. Record the JS revision and installed binary separately.
2. **Repair the failing preservation check deliberately.** Investigate `tests/phase4b-complete.test.mjs:114` and its protected-file baseline; account for CRLF checkout differences and the remaining normalized `ACHIEVEMENTS_PLAN.md` mismatch. Do not blindly regenerate expected hashes.
3. **Define production identity and artifact profiles.** Preserve the Dev variant; choose the final package/scheme/name, add a standalone internal release APK profile and production AAB profile, and establish versionCode/app-version/signing policy. No build is authorized by this audit.
4. **Complete synthetic Android export/restore/recovery acceptance.** Exercise native file providers, cancellation, sharing, invalid import, interrupted restore and recovery only in a disposable synthetic environment. Never perform these destructive cases against Expo Go's real data.
5. **Fix Arabic numeric input and remaining presentation inconsistencies.** Normalize Arabic-Indic/Persian digits at the Count target input boundary before ASCII validation; use the shared text presentation boundary for recovery/actions; format trend percentages consistently.
6. **Resolve Goals consistency semantics and refresh gaps.** Decide how newly created/newly linked habits affect earlier goal days; align the displayed explanation and calculations. Refresh history on date rollover and successful finished-date saves.
7. **Protect Habit/Goal/Routine drafts and in-flight actions.** Add coherent dirty-state discard handling and navigation protection, including Android Back and cross-tab exits; verify async save/delete completion cannot navigate unexpectedly after departure.
8. **Close accessibility and compact-layout gaps.** Correct dark muted-text/control contrast; verify TalkBack, focus, chart cells, large text and compact routine progress. The Today-specific responsive fix does not cover every ring/prose row.
9. **Validate a standalone release candidate.** Test cold startup without Metro/network, persisted preferences, background/resume, midnight, rapid check-ins, system bars and data retention. Inspect the actual merged permissions/backup policy and signing metadata.
10. **Establish a reproducible release evidence package.** Run available Expo Doctor without changing dependencies, resolve SDK recommendations in a separately authorized batch, retain green test/type/lint/inventory results, and replace starter README/release guidance with actual support/privacy/distribution instructions.

## 1. Actual repository state and audit boundaries

| Item | Observed state |
| --- | --- |
| Branch | `wip/settings-appearance-language`, matches expected |
| HEAD | `038107a`, matches expected |
| Commit subject | `WIP: preserve Phase 4E and RTL alignment fix pending Android QA` |
| Initial working tree | Clean; no tracked/untracked changes reported |
| Package manager evidence | `package-lock.json`, lockfile version 3; no `bun.lock` observed |
| Framework | Manifest Expo `~58.0.23`, React Native `0.88.1`, React `19.3.0`, Router `~58.0.30`, TypeScript `~6.0.3` |
| Native source directories | Neither `android/` nor `ios/` exists; CNG configuration applies |
| Source inventory | 183 TS/TSX sources, 22 route roots, 176 conservatively reachable sources |
| Storage | AsyncStorage; per-entity stores and per-day check-ins; file-backed restore journals |
| Tests | Node built-in runner, TS loader hooks, in-memory AsyncStorage mock; selected component/native mocks and source assertions |

Git initially refused access because the repository owner differs from the current Windows user. Read-only commands subsequently used `git -c safe.directory=C:/Projects/momentum ...`. No global/local Git configuration was changed. No checkout, reset, clean, staging, commit or push occurred.

The 22 route roots include five layout files and 17 screen files. The application has **five tabs**, not a separate Profile tab: Today, Habits, Goals, Insights and Settings. Profile is a root-stack editor opened from Today/Settings. Routines are reached from Habits and Today's plan. Appearance and Language are Settings dialogs, not additional routes.

Inspected materials include route files and navigation helpers; forms and tracking components; providers and store queues; backup schema, runtime/native adapters and recovery service; preference/theme/language infrastructure; Insights/Goal/Routine/Achievement calculations; package/config/ignore files; test definitions/fixtures; localization inventories; all root plan/report headings and relevant implementation, limitation and acceptance sections. Static import reachability is conservative and is not runtime coverage.

### Historical reports reconciled with current evidence

- `SETTINGS_PHASE3C_REPORT.md` records **user-reported earlier Phase 3B physical success** for in-place Dev update, System following Android live and fixed Light/Dark. That is relevant historical evidence, not an audit-run test or approval of every current selector/screen.
- `PHASE4BCD_CHECKPOINT_REPORT.md` records **user-reported earlier Arabic/tab/navigation/language persistence acceptance**. Earlier pending spike/Phase 4C notes must be read with that later correction.
- `RTL_ROOT_CAUSE_FIX_REPORT.md` and current commit explicitly leave **the newest alignment/Today/achievements fix pending physical review**. Earlier acceptance does not cover it.
- `LATEST_ANDROID_BUILD_REPORT.md` describes an older successful development APK. Its old workspace, HEAD and passing test counts do not certify this checkout or a production artifact. Cloud status and certificates were not queried again.
- Backup and achievement device-testing documents describe acceptance cases, not proof that all those cases passed. This audit found no complete current-revision acceptance record for them.
- Some historic phase language is obsolete: language is now active, appearance is saved, and app config is automatic. Current code takes precedence over historical closed-gate statements.

## 2. Findings and priority definitions

**P0** means a release/no-go gate, including missing evidence for high-impact operations; it does not imply a demonstrated catastrophic code bug. **P1** means essential correctness/usability/release work. **P2** means optional improvement or an explicitly accepted limitation. Evidence classes: **verified** from current source/checks; **risk** inferred from code without native reproduction; **acceptance gap** requiring device/artifact evidence; **decision** requiring a product policy.

| ID | Priority / evidence | Finding and action |
| --- | --- | --- |
| A01 | P0 / verified | Current config and sole build profile produce MOMENTUM Dev, not a production candidate. Define isolated variants, standalone profiles, versioning and credential ownership before release. |
| A02 | P0 / acceptance gap | Latest shared Android alignment change affects many screens and has no current physical acceptance. Execute the RTL matrix below before accepting the feature as complete. |
| A03 | P0 / acceptance gap | Native backup/restore/recovery safety is covered by mocks/failure injection but not demonstrated end-to-end here. Gate release of replacement functionality on synthetic native acceptance. |
| A04 | P1 / verified | Test suite fails one preservation test. Restore a trustworthy portable baseline and a green suite before calling the checkpoint validated. |
| A05 | P1 / verified | Arabic Count target digits are stripped by `/\D/g`. Accept localized digit entry through a narrow input conversion without changing storage/wire formats. |
| A06 | P1 / verified + decision | Goal consistency counts current linked habits from goal start even before those habits existed. Decide intended denominator and document/reconcile its difference from Insights. |
| A07 | P1 / source-backed risk | Goals list/editor omit history reload triggers for midnight and delayed finished-day save completion. Refresh on relevant date/revision changes, avoiding partial-save snapshots. |
| A08 | P1 / verified | Habit/Goal/Routine forms lack Profile's unsaved-navigation guard. Cancel/Back can discard drafts; hardware/tab navigation is not blocked merely by disabling visible save/cancel controls. |
| A09 | P1 / verified | Dark muted text and control borders have inadequate contrast on core raised surfaces. Correct active text/control tokens and check disabled/selected/chart states separately. |
| A10 | P1 / verified gap + visual risk | `use-data-backup.tsx` recovery UI and shared Action labels use raw RN Text, bypassing the corrected Arabic wrapper and its wrapping/line-height policy. Bring them into the same presentation contract and test blocked startup. |
| A11 | P1 / acceptance gap | Standalone offline startup, actual release permissions/OS backup policy, final signing and update compatibility are unverified. Inspect the final artifact and test independently of Metro. |
| A12 | P1 / verified presentation gap | Trend bar numbers use raw `${pct}` while other Arabic values use localized digits. Format these values consistently; retain calculation values unchanged. |
| A13 | P1 / risk | Routine detail keeps a fixed 120dp ring beside prose; it does not use Today's measured-width Arabic composition. Test compact/large-font layouts and adapt if text becomes unusable. |
| A14 | P1 / readiness gap | Privacy/support/store materials and production operational instructions are absent from the inspected project. Prepare accurate local-data/export/device-backup disclosures and release documentation. |
| A15 | P2 / verified | Greeting reads a date object deliberately held unchanged within a day; it can retain a morning greeting after noon/resume. Use a time-sensitive greeting input without refreshing domain dates unnecessarily. |
| A16 | P2 / risk | Full-history reads, dense per-day indexes, map-rendered ScrollViews and per-goal date loops can become expensive at scale. Benchmark synthetic long-history datasets before introducing optimizations. |
| A17 | P2 / decision | Schedule history, goal link/paused intervals and deleted-habit browsing are not fully historical models. Keep limitations visible; versioning/archive/backdated editing are future features unless explicitly required for launch. |
| A18 | P2 / verified | Expo starter branding/artwork remains in icon/splash assets and JS startup overlay. Choose approved MOMENTUM branding; this is release polish, not a demonstrated functional failure. |

## 3. Reachable screens and major flows

All rows below describe inspected wiring and behavior, **not a physical walkthrough**. No reachable placeholder tab or obvious dead primary button was found in the static route/action review.

| Surface / route | Implemented behavior and safeguards | Remaining concerns / acceptance |
| --- | --- | --- |
| Today `/` | Scheduled habits, Tick toggle, Count +/- and Checklist steps share one DailyProgress provider. Progress ring counts each completed habit once; routine plan and achievement summary navigate to real screens. Empty/load/error/retry states exist. | A02; progress header can show provisional zero/empty values before load, so verify they are not read as final results. Test save failures, rapid taps, midnight and first launch. Greeting A15. |
| Habits `/habits` | Real list, create/edit actions, routine entry, empty/error/retry states; create disabled until list readiness. | Long lists render in ScrollView. No search/archive/reordering is not automatically a release defect. |
| New/edit habit `/habits/new`, `/habits/[id]` | Name/description limits, weekdays validation, count range 1–9999, unit limit, required checklist step validation, color/icon choices. Save-first; failures retain form. Delete confirms and preserves history. Tracking-type change warns when today's progress exists and requires daily readiness. | A05, A08. Verify keyboard visibility, checklist order/optional steps, type-change current-day reset and failure ordering. Delete relationship notes depend on currently available Goals/Routines lists; do not assume those counts are complete after load errors. |
| Goals `/goals` | All/active/paused/completed filters, manual statuses, linked-habit consistency, empty/error handling and create/edit navigation. | A06/A07. Habits read failure makes consistency unavailable but offers weaker recovery guidance than direct retry. |
| New/edit goal `/goals/new`, `/goals/[id]` | Title/description/date validation; target cannot precede start; existing past target can remain. Habit linking waits for habits to load, preventing accidental link erasure. Delete preserves habits/history. | A08. Failed history load produces unavailable consistency; editor lacks explicit direct history retry. Native Back and cross-tab behavior need acceptance. |
| Routines `/habits/routines` | List, create, detail and saved up/down reordering. Limit checks, save failure notice, empty and habit-load states exist. | Uses `daily.record` for progress without distinguishing daily loading/error in list cards; an unavailable record can temporarily look like zero completed. Label unknown progress explicitly if encountered. |
| New/edit routine `/routine/new`, `/routine/edit/[id]` | Title/description validation, preferred time, color/icon, existing habit selection and order; safe link filtering. Empty routines intentionally allowed. Delete pops stale detail/editor through helper. | A08. Creating a habit from linking flow warns that form closes unsaved; a draft-preserving detour is optional but the warning does not replace general Back protection. |
| Routine detail `/routine/[id]` | Same HabitCard and daily writer as Today; shared habit appears complete across multiple routines without double-counting. Not-due members are contextual, not trackable. Deleted members are disclosed. Edit/Back and missing-record fallbacks exist. | A13; load/error zero-progress ambiguity. Verify origin-preserving Back from Today and Habits and after deleting a routine. |
| Insights `/insights` | Overview, calendar/day details, weekly navigation, trends and per-habit links. Read-only calculations, history/habit errors and retry. | A12/A16/A17; native rendering/accessibility remains untested. Current daily read failure is represented as unknown but Insights does not directly offer daily reload. |
| Habit history `/insights/habit/[id]` | Current/best streak, all-time/month rates, calendar, data notes and edit-habit navigation. Missing habit message preserves stored history. | Cross-tab Edit uses `router.navigate`; return behavior depends on tab history and warrants native Back testing. Deleted habit history has no dedicated browser. |
| Settings `/settings` | Profile and achievement summaries, saved theme/language selectors, counts, privacy information, version, real export/import entry points. Both backup links intentionally open the same screen. | No literal Coming Later row in current hub. Privacy policy/support destination absent; production identity still Dev. |
| Profile `/profile/edit` | Optional name/initials/icon/color, validation, preview, save failure/retry; dirty confirmation using `usePreventRemove`. Load failure and Back fallback exist. | Use as navigation-safety reference, but verify Back during in-flight save and emoji/combining-mark name length/initials on device. |
| Achievements `/achievements` | Twelve stable badges, all/earned/locked filters, progress and data notes, persisted awards and acknowledgement/celebration handling. Width/font-scale card branching exists. | Earlier device checklist remains relevant; latest summary composition A02. Test read/save/acknowledgement failures, no repeated celebration after restart and honest incomplete-history messaging. |
| Data & Backup `/data-backup` | Export snapshot, save/share, import preview comparing current/incoming data, explicit acknowledgement and replacement confirmation, recovery save/share/removal actions. Unavailable runtime state is visible. | A03/A10/A11. Actual file-provider behavior is unverified. Hardware Back during ordinary picker/export is not equivalent to restore's global block; test cancellation and reentry. |
| Appearance/Language dialogs | Save-first draft selection; Save/Cancel/Back, loading/read retry, failed-save retry, radio states, focus requests, backup-busy checks and synchronous duplicate-save protection. | Confirm TalkBack focus restoration, native modal direction and retained screen/data state across switches. Hydration intentionally allows initial Dark/English before saved preferences arrive. |
| Startup/recovery overlay | Checks filesystem/hash availability and recovery before domain providers mount; blocks editing when evidence cannot be verified; Retry and save/share verified recovery copy. | A10. Fail-closed startup is intentional safety behavior, not permission to reset data. Provide tested recovery support instructions. |

Layouts use root Stack plus nested tab stacks, with hidden native headers and custom controls. Navigation helpers include fallback targets for deep links and special routine deletion handling. Some Href casts compensate for Windows typed-route generator output; a passing typecheck cannot establish runtime deep-link correctness. Validate each new/edit/detail route by direct synthetic deep link, missing ID and Android Back. No global RTL reload or navigator-key switch was found in language activation.

`src/components/placeholder-screen.tsx` still contains Coming soon, but the regenerated import graph marks it **unreachable**. Other unreachable leftovers are hint-row, collapsible, web-badge, two color-scheme hooks and i18n/errors. Removing them is housekeeping, not proof of missing product screens. Likewise a TextInput placeholder is not placeholder functionality.

## 4. Persistence, recovery and data integrity

### Positive evidence

- Habits/Goals updates serialize, derive from last saved data and publish after successful persistence. Routines/Profile use extracted list/value stores with the same save-first approach. Failed reads block writes instead of replacing data with empty defaults.
- Daily progress has a sole optimistic writer. Its queue serializes/coalesces full per-date records, retains pending values across midnight and retries failures with backoff. Saved status means successful disk write, not merely a tap.
- Count/checklist historical completion uses saved targets/required-step snapshots; today's definitions are normalized separately. Optional checklist steps do not prevent required completion.
- Legacy habit migration retains original keys and makes a pre-habits backup before demo reconstruction. Fresh empty installs do not seed demonstration habits automatically. Corrupt current schema is not silently replaced by an older fallback.
- Backup uses a scoped user-key allowlist, byte/depth/record bounds, duplicate-key rejection, SHA-256 integrity and schema inspection. Unknown versions/corrupt incoming data block ordinary activation; readable raw data can still be losslessly archived.
- Export freezes admission and drains accepted domain writes. Restore validates input, rejects stale previews, keeps before/after snapshots, verifies writes, records prepared/committed/settled state and either verifies the resulting generation or blocks editing. Automated failure-injection coverage is substantial.
- Restore remounts domain providers by generation; retired stores cannot continue old writes. Preference persistence is deliberately separate. Backup v1 excludes appearance/language; that is disclosed in selector UI and is not accidental data omission.

### Limits and risks requiring honest handling

1. Pending optimistic taps are memory-resident until AsyncStorage succeeds. If the process is killed during persistent write failure, that unsaved latest state is not guaranteed durable. Retries while alive and background attempts are valuable but cannot guarantee process-death recovery. Keep pending/error notices visible and test synthetic force-stop scenarios.
2. Multi-key AsyncStorage replacement is not a native transaction. The journal is the safety mechanism. Do not describe restore as inherently atomic; keep fail-closed recovery and all generation/drain tests.
3. Native journals and portable exports are **unencrypted**. SHA-256 detects changes; it does not authenticate a sender or keep contents private. User-chosen providers/sharing can send files outside the device. UI already discloses this.
4. Completed recovery snapshots persist until explicit removal. Shared temporary JSON is cleaned only on a later share after seven days. This is a retention characteristic to document, not evidence of automatic upload.
5. Backup maximums are finite: 8 MiB file, 1 MiB per raw record, 4 MiB record payload, 20,000 records and nesting depth 32. Growth beyond these limits aborts without truncation. Test realistic long histories and define a support path rather than recommending clearing records.
6. Goal/date and other parsers have different strictness from UI validation. For example `parseGoalStore` validates date syntax but does not enforce every UI invariant, such as target >= start or non-empty bounded title. Backup inspection reuses these parsers. This permits structurally accepted but semantically odd external data; hardening must preserve existing raw data and distinguish archival export from safe activation.
7. Developer warnings include caught error objects in several persistence paths. No arbitrary raw-record logging was identified in these inspected paths, but native error messages can include provider paths. Review production logging/redaction; do not attach backups or private logs to release evidence.

No real backup was exported/imported or inspected. Synthetic tests do not establish whether the user's real Expo Go history is complete, readable, or portable to a future production installation. That must remain a separate, explicitly authorized migration project.

## 5. Calculations and cross-feature behavior

### Shared completion, routines and achievements

Tick/Count/Checklist share completion helpers. A completed Count contributes one habit completion, not its raw count. Required checklist steps determine completion; optional steps remain informational. Routines derive ordered membership and today-only progress from the same records; overlapping routines do not add extra habits to Today/Goals/Insights totals. Preferred time sorts/highlights routines and does not lock them or schedule notifications.

Achievements evaluate saved evidence with pending-write, date, habit-readiness and revision guards. Permanent awards are save-first; acknowledgements persist separately; award evidence and recognition date are distinguished. Unknown IDs survive parsing. Existing awards are not revoked by deletion or schedule changes. Today's encouragement is provisional rather than a permanent award derived from optimistic taps. These properties have automated tests; foreground, midnight, interruption and TalkBack behavior still require native acceptance.

### Insights

The index classifies before-start, unscheduled/extra, unreadable/unknown, done, pending, partial and missed days. Finished-day rates exclude today and unreadable days from numerator and denominator; today is separate. Streaks count scheduled opportunities, skip rest days and avoid breaking a run for unfinished today. Current schedules are applied retrospectively because schedules are not versioned. Deleted-habit history is retained in storage but omitted from current-habit analytics and disclosed in data notes.

This is a coherent documented model, not proof of original historical schedules. A schedule edit can change old denominators/streak interpretations while saved target/step snapshots remain unchanged. Keep that distinction visible. Direct numerical fixture coverage for Goal consistency and the full Insights calculation matrix is weaker than the extensive achievement/backup/localization tests; source/AST preservation assertions cannot substitute for formula tests.

### Verified Goals discrepancy and freshness risks

`src/utils/goal-progress.ts:91–105` loops from the goal start and tests current schedule without checking habit creation/start evidence. A read-only synthetic probe used a goal starting 10 November, a daily habit created 14 November and today 15 November, with no saved check-ins:

| Calculation | Observed finished denominator |
| --- | --- |
| Goal consistency | 5 scheduled check-ins (10–14 November) |
| Insights for the same habit | 1 finished check-in (14 November) |

This is confirmed behavior and matches the goal helper's broad current-window description; whether it is acceptable is a product decision. It can penalize a user for days before the habit existed. Linking a habit later similarly applies it retroactively because link-effective dates are not stored. Goal pause intervals are not stored and remain counted. Recommended first fix: agree the minimum start-evidence rule, align copy and add numerical tests; link/pause interval history can be deferred with clear disclosure.

Goals list and editor call `useCompletionHistory()` with no reload key. Insights passes `todayKey`. The history hook reloads on focus/reload-key/explicit attempt, not on successful daily queue drain. Therefore a Goal screen held focused over midnight can move the date boundary without reading newly finished data; a delayed yesterday save can also leave the fetched history stale until refocus. This is source-backed risk, not a physically reproduced race. Refresh using date and successful finished-write revisions; do not introduce scans for every optimistic tap.

## 6. English/Arabic, direction, layout and accessibility

### What is established

- English/Arabic typed catalogs, named parameters, all six Arabic cardinal forms, Gregorian presentation dates, localized display digits and missing-Intl fallbacks exist. The current tests exercise catalog parity, safe interpolation, runtime fallbacks and data-format preservation.
- Inventory regeneration and independent in-memory deep comparison **exactly match** the checked-in JSON: 183 sources, 22 route roots, 176 reachable, 118 candidate files, 1,502 candidates. Inventory candidates include technical/error strings; this is not a count of untranslated user-facing defects.
- Root LocaleProvider/View direction and native tab direction follow saved language without global I18nManager mutation. Theme/language changes preserve domain-provider identities.
- The recent shared Text boundary explicitly handles Android paragraph direction and start/end encoding; NumericText isolates whole numeric runs in LTR islands. TextInput intentionally uses a separate adapter. Tests model/mock this contract and do not execute Android Yoga/Kotlin glyph layout.
- Arabic Text removes line limits, resets letter spacing and provides more line height when caller font/line-height values are supplied. This reduces truncation but can increase row height everywhere, including surfaces that previously assumed a single line.
- Cached weekly and monthly labels are getter-based. A synthetic language switch confirmed that an already-created review/trend object resolves Arabic labels on access. No stale-label defect was found there; do not add unnecessary recalculation solely because a memo exists.

### Concrete remaining localization issues

**Count input:** `src/components/habits/count-fields.tsx:52` strips non-ASCII digits, while `parseCountTarget` accepts ASCII digits only. Synthetic input `٨` becomes `""`. Persian digits are affected too. Convert supported localized digits to ASCII before filtering and preserve canonical numeric storage. Do not loosen backup/ID/date validation globally.

**Recovery boundary:** `src/hooks/use-data-backup.tsx:6` imports raw Text. Its startup/recovery prose and Action labels do not receive the fixed shared Text direction, wrapping or Arabic line-height policy. Translation exists; visual alignment remains a separate gap, especially important when recovery is the only available UI.

**Trend numerals:** `src/components/insights/trend-bars.tsx:50` uses raw percentage digits. Arabic accessibility text uses the formatter while the visible number does not. Also review intentional machine metadata (backup ISO timestamps/version/filenames) as LTR islands rather than translating their raw data.

**Locale policy decisions:** weekday/weekend shortcuts use Monday–Friday and Saturday/Sunday; calendars/weeks start Monday. Arabic does not automatically change these business/calendar conventions. These can ship if explicit and intentional; an Egypt-specific Friday/Saturday shortcut or configurable week start is a separate product decision, not an automatic translation correction.

### Accessibility/responsiveness findings

Current palette calculation independently reproduces Dark `textMuted` on `surfaceRaised` at **2.7363:1**, and `controlBorder` on that surface at **1.1396:1**. Existing tests require stronger Light contrast but preserve these Dark values. Active captions/placeholders/control boundaries need correction and visual checking. This audit does not certify WCAG conformance.

Good patterns include semantic roles, disabled/selected/checked states, many 44/48dp controls, accessible count increment/decrement, announcements, scrollable selectors, SafeAreaViews and maximum content widths. Remaining native work: TalkBack traversal in mirrored rows, chart labels/selection, modal focus restore, meaningful validation focus, large text, keyboard obscuration, and color-independent meaning. Calendar cells and compact chips should be measured on actual small screens; not every visual grid can offer separate 48dp targets at narrow widths.

Today Arabic progress now measures card width and font scale, and moves prose outside the ring when needed. Routine detail still uses a fixed horizontal ring/text layout. English Today retains its original fixed composition. Neither has blanket compact/large-font acceptance. Arabic removes `numberOfLines` globally; assess unexpectedly tall list/filter/title rows and mixed-script filenames/units, rather than restoring truncation without review.

Startup/ring animations exist, but no app-level reduced-motion handling was found by source search. This is an accessibility follow-up; check what installed animation defaults already honor before adding overrides.

### Required current-revision physical matrix

Use synthetic data only. Record device/model, Android version, installed Dev build identity, JS checkpoint, font/display scale, language/theme and Pass/Fail/Not exercised evidence.

1. Arabic Today: common physical-right greeting/date edges, left avatar, correct progress sentence and ratio order; compact and large-font stacking without oscillation.
2. Achievements summary on Today and Settings: right title, left chevron, separate count/badge strip/next action; collection filters, celebration dismissal and Back.
3. Habits/Goals/Routines forms: mixed Arabic/Latin names, punctuation, Arabic digits, optional steps, keyboard cursor/selection, multiline descriptions and validation.
4. Insights: calendar weekday order, month/week navigation, ratios, percentage digits, trend labels, empty/unknown/unreadable states.
5. Arabic Settings dialogs and recovery overlay: wrapping, text edges, TalkBack focus, Back/cancel, busy/read/write failure states.
6. Arabic -> English -> reopen: retained data, language, theme and correct native tab order; test all three appearance modes including OS changes and resume.
7. Repeat key flows on narrow width/large text and gesture/three-button navigation. Screenshots establish visual results; interaction assertions need an accompanying result log.

## 7. Appearance and startup

Preferences are independent, validated, serialized and applied only after read/save success. Defaults are Dark/English in memory; missing settings do not trigger a default write. Corrupt/future values block preference edits until successful retry while domain recovery remains independent.

ThemePreviewProvider is now the saved-theme authority despite its historical name. Explicit Light/Dark override native appearance; System clears the override before sampling and subscribes to appearance/resume changes. Router theme, palette, StatusBar and native root background follow the selected scheme. The old Dev preview component returns null. These are positive source findings.

Startup is deliberately not gated on preference hydration. A dark native launch surface and initial Dark/English app presentation may appear before saved Light/Arabic loads. Treat the flash as a known behavior to accept or refine, not as proven preference loss. AnimatedSplashOverlay hides the splash on layout and uses Expo starter logo assets; the recovery provider can hide the native splash to show verification/blocking UI. The displayed launch sequence, image failure behavior and system-bar contrast need release-binary testing.

Appearance/language updates do not key-remount domain providers. Restore intentionally does. Test switching theme/language while a draft, scroll position or routine is open; no source guarantee replaces native state-retention evidence.

## 8. Android production readiness, privacy and security

### Identity, variants and artifacts

`app.json` currently sets name `MOMENTUM Dev`, scheme `momentum-dev`, package `com.beeviro1.momentum.dev`, version `1.0.0`, portrait orientation and automatic appearance. `eas.json` defines only `development`, with `developmentClient: true`, internal distribution and APK output. There is no production/preview profile, explicit app-version source policy or configured Android versionCode in app config.

A separately authorized release batch should define the final production package/name/scheme while preserving the Dev variant. A production package is a separate application data sandbox: it does not automatically inherit Expo Go or Dev records. Do not solve signing/install issues by uninstalling either existing app.

For direct device distribution/testing, plan a **standalone release-mode APK** without a development client; for Google Play, plan an **AAB** and store-track testing. Expo documents AAB as the default store build format and explicit APK configuration for direct installation. See [Expo Android artifact guidance](https://docs.expo.dev/build-reference/apk/) and [version management](https://docs.expo.dev/build-reference/app-versions/). A release build still requires explicit authorization after configuration review; this audit creates no artifacts.

Signing evidence in the old build report concerns Dev credentials, not final production ownership or installed certificate continuity. Establish account access, protected keystore/upload-key custody, Play signing choice and incrementing versionCode policy. Verify final certificate/package/version metadata before any later approved installation. No credential values are reproduced here.

### Branding/native config

The configured icon/adaptive foreground/splash images were visually inspected. They retain the Expo starter chevron-style artwork; JS startup references `expo-logo.png`. Adopt approved MOMENTUM branding or explicitly accept the current artwork. Verify adaptive safe-zone cropping, monochrome icon, splash placement and Light/Dark launch transition in the final binary. No image was changed.

No native folders should be hand-edited. Current `predictiveBackGestureEnabled` is false; this is an explicit config choice, not a demonstrated navigation bug. Revisit against target Android behavior during release QA. iOS has no explicit bundle identifier in the inspected config; that is outside the Android release scope, not an Android blocker.

### Permissions, network and OS backups

No explicit application permissions list, blockedPermissions list or Android allowBackup policy is set in app config. That **does not mean zero permissions**: installed modules/config plugins contribute to the generated manifest. Inspect the actual production merged manifest for least privilege, debuggable/dev components, exported activities, intent filters, cleartext/network configuration and backup/data-extraction behavior. No manifest was generated in this audit. [SDK 58 config reference](https://docs.expo.dev/versions/v58.0.0/config/app/) describes the relevant app configuration surface.

The inspected core feature paths are local; backup sharing is user initiated. There is no app account/cloud-sync implementation in the inspected flow. Native library presence is not proof that a permission is used or private data is transmitted. Do not claim a complete runtime network/security assessment from source alone.

Settings correctly says phone-level backups depend on device/settings. Decide and verify whether OS backup includes AsyncStorage and unencrypted recovery files; align privacy/support statements with actual behavior. No public privacy-policy/support file or destination was found in the inspected app/docs. Prepare store data disclosures based on final dependencies, release manifest and observed behavior rather than simply asserting local-only means no disclosure work.

### Offline/development UI

Daily tracking, local calculations and settings should not require a backend, but the existing Dev build normally relies on Metro for current JavaScript. A successful Dev launch does not prove standalone offline launch. Test release cold start/reopen in airplane mode without Metro; include native backup-module startup checks and file-provider unavailability.

DevThemePreviewControls renders nothing. DevQaTools is gated by `__DEV__` and Android and only hides the native DevMenu gear if supported. No active synthetic seeding/reset button was found in reachable production UI. Including `expo-dev-client` in dependencies alone does not establish that release binaries expose a launcher; inspect final non-development profile/artifact. Never infer release cleanliness solely from a hidden gear.

Ignore rules protect common signing/environment files, backup folders/journals and APK/AAB outputs; `.easignore` also excludes local agent/repository metadata. These rules are useful but are not a secrets audit of every byte or proof that previously tracked private files could never be uploaded. This audit did not enumerate private backup directories or credential contents.

No `expo-updates` package/channel/runtime-version release policy was found. OTA delivery is optional; define it later if desired rather than assuming it already works. The first release can use normal binary updates.

## 9. Exact non-destructive check results

All commands were run from the requested project. No `--fix`, dependency install, reset, prebuild, bundling/build or device operation was run.

| Check / invocation | Exact result this audit |
| --- | --- |
| Initial `npm test` in PowerShell | Could not start: execution policy blocked `npm.ps1`; exit 1. Retried through the Windows command shim below, without changing policy. |
| `npm.cmd test` | **Exit 1: 291 tests, 18 suites; 290 pass, 1 fail, 0 cancelled/skipped/todo; duration 13338.0037 ms.** |
| `./node_modules/.bin/tsc.cmd --noEmit` | **Exit 0**, no diagnostics. |
| `./node_modules/.bin/expo.cmd lint --no-cache` with process-local `EXPO_NO_CACHE=1` | **Exit 0**, no diagnostics. No fixes requested. |
| Additional broad `./node_modules/.bin/eslint.cmd . --no-cache` | **Exit 0; 0 errors, 4 warnings**: unused eslint-disable in generated `.expo/types/router.d.ts:1`; unused `en`, `ar`, `enMessages` imports in `tests/today-localization.test.mjs:7–9`. This has wider scope than Expo's default lint. |
| Localization inventory regeneration to memory + independent `assert.deepStrictEqual` | **Exit 0; EXACT MATCH**: 183 source files, 22 route roots, 176 reachable files, 118 candidate files, 1502 candidates. No `--write`. Catalog parity/runtime tests also pass within the suite. |
| `git -c safe.directory=C:/Projects/momentum diff --check` | **Exit 0**, no whitespace diagnostics; run before report creation and checked again afterward. |
| Expo Doctor availability | **Not run: unavailable.** No local `node_modules/.bin/expo-doctor.cmd` or `node_modules/expo-doctor/bin/expo-doctor.js`; no executable found on PATH; documented former external temporary CLI path is absent; no existing CLI found in inspected current-user npm `_npx` cache. Installing/downloading a CLI would violate this task. |
| Local declared dependency versions vs installed Expo `bundledNativeModules.json` entries | No differing declared specifiers found for entries present in that local compatibility file. This is a limited static check, **not Expo Doctor or a current remote SDK recommendation check**. |
| Synthetic Goal/Insights denominator probe | Goal 5 vs Insights 1 finished scheduled opportunity for the dates described above; exit 0 for the probe itself. |
| Synthetic input sanitizer probe | Arabic-Indic `٨` -> empty string; confirmed input defect. |
| Synthetic label/contrast probe | Cached review/trend labels resolve Arabic on access; Dark contrast ratios 2.736296794925814 and 1.1395830894387369. Exit 0. |

### Failing test details and interpretation

Failure: `tests/phase4b-complete.test.mjs:114`, test named `Phase 3B/3C/4A reports/config/storage and validated Phase 4B-1 runtime/source fixtures remain byte-identical`.

First assertion failure: `ACHIEVEMENTS_PLAN.md` SHA-256 actual `aec543fd4f8e2f2f7b831d7cceda4e431304f3b53afeeea24358b45815de2fa6`, expected `914a28edba257761b7258b7df0a363aa9242f49f2b372c34764288caca879b72`.

The test hashes raw file bytes. Git reports LF in the index and CRLF in the working copy for inspected protected files. An independent all-protected-file comparison found many raw-byte mismatches; LF-normalizing source text reduced these to `ACHIEVEMENTS_PLAN.md` plus five files the test already explicitly exempts for activation (`preferences-store`, `use-app-theme`, `use-language`, `use-preferences`, `i18n/today`). Thus CRLF alone does **not** explain the remaining protected document mismatch. Determine whether that document changed intentionally relative to the frozen phase baseline. The failure does not demonstrate a broken app calculation, but it invalidates a claim of a clean full suite. Do not suppress it or claim 291/291 on this machine.

Expected injected save-failure warnings occur during otherwise passing queue/recovery tests. They are deliberate test scenarios, not additional failing test cases. No full suite was rerun after inspection-only probes because source was unchanged; adding this Markdown report does not change application logic.

Historical Doctor 19/20 results and the 13 patch recommendations in `RTL_ROOT_CAUSE_FIX_REPORT.md` are **historical only**. The previous 20/20 build report is older still. Neither is substituted for a current Doctor result. A future authorized environment should supply the compatible CLI and rerun without suppression before dependency remediation is chosen.

## 10. Minimal practical completion roadmap

Use three implementation batches plus one acceptance/release gate. Complexity describes integration/testing effort, not calendar duration. Source/config changes below are proposals only.

### Batch 1 — Correctness, navigation safety and trustworthy checks

**Priority P1; complexity medium–high.** Address A04–A08 and the small numeral/greeting defects together because they need focused regression fixtures and stable domain contracts.

- Investigate baseline drift; normalize line-ending-sensitive textual preservation tests where appropriate while retaining meaningful content protection. Update expected content only after reviewing the actual intended delta.
- Add narrow digit input conversion and cases for ASCII/Arabic-Indic/Persian/mixed paste; preserve range checks and backup bytes.
- Agree Goal start/link denominator policy; add numerical Goal/Insights fixtures for new habits, deleted links, unreadable days, target/completion boundaries, schedule changes and provisional today.
- Refresh Goals history on date/finished-save revisions without reading unfinished queued state as final. Include midnight and delayed-save cases.
- Apply coherent draft-discard and in-flight navigation policy to Habit/Goal/Routine. Cover visible Cancel, hardware Back, cross-tab exit, linking detours and async completion after navigation. Review Profile's save-time behavior too.
- Format trend values and make greeting time sensitive without changing date-key semantics.

Exit evidence: full tests green, typecheck and Expo lint green, broad lint warnings resolved or explicitly scoped, inventory exact, diff clean; meaningful synthetic race/numerical tests. No real-data migration is needed.

### Batch 2 — Shared Arabic/accessibility/layout acceptance

**Priority P0/P1; complexity high, dominated by native visual acceptance.** Address A02/A09/A10/A12/A13.

- First obtain existing-build screenshots/results for the newest alignment fix; change its native encoding only if evidence warrants it.
- Route recovery/actions through the shared text policy without weakening startup recovery or circular-import safety.
- Correct active dark contrast and inspect selected/disabled/tinted states. Extend compact ring/prose handling to surfaces that fail actual narrow/large-font QA.
- Test the complete English/Arabic × Light/Dark/System matrix, input cursor/mixed script, TalkBack and Back/focus behavior. Include recovery-only UI using synthetic failure fixtures.

Exit evidence: recorded current-revision physical matrix, approved screenshots and interactions; automated regression checks remain green; no provider remount/data changes caused by language/theme switches. Do not mark this batch complete based only on mocked text prop tests.

### Batch 3 — Production packaging, privacy and distribution preparation

**Priority P0/P1; complexity medium–high.** Address A01/A11/A14 and approved branding A18.

- Define separate Dev/production identity and standalone internal APK/production AAB profiles through CNG app config. Define version source/increment policy, account ownership and signing custody. Keep existing Dev isolation.
- Approve icon/adaptive/splash/startup branding. Verify permissions and OS data-backup policy from the later generated release artifact, not assumptions from package names.
- Prepare privacy/support/store text and accurate recovery/export instructions. Replace starter README, especially its destructive reset-project guidance, with actual developer/release instructions.
- Obtain available compatible Doctor and rerun SDK compatibility checks. Any patch upgrades must use SDK-compatible Expo installation commands in a separately authorized dependency change; revalidate native impact before building.
- Add a compact repeatable check/release checklist or CI job. Avoid maintaining many contradictory phase reports as the only completion authority.

Exit evidence before build approval: concrete reviewed config/artwork/docs diff, all local checks green, identified final identity/version/signing plan and bounded release QA plan. This report does not authorize cloud build, artifact installation or store submission.

### Final acceptance gate — Synthetic native safety and standalone release evidence

**Priority P0; complexity high verification effort.** After separately authorized artifact creation, use a disposable synthetic environment with the correct standalone identity.

- Export -> save/read-back -> preview -> replace -> verified recovery; picker/share cancellations; corrupt/future/empty imports; stale preview; low disk; interruption/rollback; inaccessible crypto/filesystem; unsupported providers. Follow `DATA_BACKUP_ANDROID_TESTS.md`, keeping all replacement/removal tests off real Expo Go data.
- Cold launch/reopen with no Metro/network, saved language/theme, all tracking types, overlapping routines, Goals/Insights totals, achievement award/ack persistence, rapid saves, date rollover and foreground/OS theme changes.
- Confirm actual package/version/certificate, non-debuggable release behavior, permissions, adaptive/splash assets, system bars, Back/deep links and crash-free native startup. Record artifact hash and JS revision.
- For Play distribution, validate the AAB through a suitable test track; for direct distribution, validate the release APK. Account/store requirements should be checked at that time; no current account eligibility is asserted here.

No uninstall/reset/clear/restore/migration of the user's actual Expo Go data is part of this gate. Any eventual personal-data transfer requires a separate reviewed preservation plan and explicit authorization.

### Optional after release (P2)

Schedule/link/pause history versioning; archive and deleted-habit browsing; backdated check-in editing; reminders; search/reordering beyond current routines; encrypted portable backups; optional OTA delivery; scale-driven indexing/virtualization; reduced-motion refinements and removal of unreachable template files. None should delay launch automatically if the core limitations are accepted and disclosed. Promote performance work if synthetic benchmarks reveal unacceptable supported-data behavior.

## 11. Independent-review handoff and preservation

Reviewers should reproduce the failing baseline case, check the Goal denominator policy, inspect the raw-Text recovery exception, and request current physical evidence for Android alignment and standalone native recovery. These are more actionable than treating every historic TODO or preserved plan section as unfinished implementation.

Official documentation consulted read-only: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo documentation index](https://docs.expo.dev/llms.txt), [SDK 58 app config](https://docs.expo.dev/versions/v58.0.0/config/app/), [SDK 58 filesystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/), [Android APK/AAB guidance](https://docs.expo.dev/build-reference/apk/), and [app version management](https://docs.expo.dev/build-reference/app-versions/). Repository behavior and current check outputs, rather than earlier reports, support the findings above.

The audit stops at reporting. No implementation, dependency/native configuration change, build, account mutation, device operation or Git history change was performed. Final expected Git delta: only untracked `MOMENTUM_FULL_AUDIT.md`.
