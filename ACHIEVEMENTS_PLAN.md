# Achievements & Gamification — proposed plan

Status: implementation approved and completed locally; Android phone acceptance and Git commit approval remain pending. No commit or push has been made.
Inspection date: 2026-11-09. Baseline: `main` at `aece430` (Add profile personalization and settings hub), tracking `origin/main`. Initial Git status had no tracked changes and one existing untracked file, this plan (`?? ACHIEVEMENTS_PLAN.md`). This inspection refines that draft in place; it does not assume the initial workspace was completely clean.
The postponed `feature/notifications-wip` branch is outside scope; do not check it out, merge it, or modify it.

## 1. What the existing app actually supports

- `src/data/completion-storage.ts`: daily AsyncStorage records use `momentum:checkins:v2:YYYY-MM-DD`. A v2 record wins over legacy `momentum:completions:v1:YYYY-MM-DD`; legacy IDs become completed Tick entries. A corrupt v2 must never fall back to v1. History reports unreadable dates separately; whole-storage failures throw.
- `src/utils/habit-progress.ts`: shared completion rules power Today and history. Tick requires its entry; Count requires value >= target; Checklist requires a nonempty required-step set and every required step checked. Optional steps never block completion. Each completed habit/date contributes one unit regardless of count or step quantity.
- Today uses the current habit definition and matching tracking type. `normalizeTodayRecord` updates today's target/required-step snapshots and removes entries after tracking-type changes. Past days use the saved target/required steps and are not rewritten.
- `src/hooks/use-daily-progress.tsx` is the sole progress writer. Its optimistic state can differ from disk. `src/data/save-queue.ts` serializes/coalesces writes, retains failed records with backoff, and keeps pending records across midnight. Its current interface does not expose pending-date membership or a successful-write revision.
- `src/hooks/use-completion-history.ts` reads history on screen focus and date changes; it is not a global persistence event stream. `use-insights.ts` overlays today's live record, including unsaved changes. Permanent awards must not use that live overlay as durable evidence.
- `src/utils/insights.ts` builds statuses per habit/date. Start is the earlier usable creation date or first saved entry, supporting migrated habits. Missing finished scheduled days are missed, partial days are incomplete, corrupt days are unknown, future/invalid dates are ignored. Deleted habits are reported but excluded from statistics.
- Current and longest streaks count consecutive scheduled opportunities, skipping unscheduled days. Partial/missed/unknown finished scheduled days end a known run. A pending today does not break it; a completed today can extend it provisionally. Longest-run ties favor the most recent run.
- Schedules and habit deletion history are NOT versioned. Current schedules are applied retrospectively; completed unscheduled dates appear as EXTRA and are not counted. Absence of EXTRA does not prove the schedule never changed. Historical perfect-day and streak claims therefore cannot be described as independently verified.
- Weekly Insights already contains textual `achievements` (perfect-day and consistency highlights). These are computed summaries, not persistent badges.
- Five tabs: Today, Habits, Goals, Insights, Settings. Android/iOS use `app-tabs.tsx`; web uses `app-tabs.web.tsx`. Root-stack routine/profile routes preserve the originating tab. Profile editing is `/profile/edit`, opened from Today avatar or Settings summary; there is no separate profile dashboard.
- Profile uses its own `momentum:profile:v1` key and save-first `createValueStore`. No account, in-app cloud sync, or achievement store exists.
- Design is dark-only: `Palette`, `Radius`, `Spacing`, `MaxContentWidth = 800`, and `BottomTabInset` in `src/constants/theme.ts`. Existing UI uses rounded bordered cards, violet accents, mint success, platform-mapped `SymbolView` icons, safe areas and accessible pressables.
- Installed stack: Expo 58 (`~58.0.23`), React Native 0.88.1, Expo Router, AsyncStorage, and existing animation packages. `package-lock.json` is present; use npm/npx, not bun. Existing tests use Node's built-in runner with TypeScript/alias hooks and an AsyncStorage mock.

Inspection scope: this workspace exposes source code and test fixtures, not AsyncStorage from the running Android installation. No personal completion totals, real unlock dates or device-history integrity have been verified. Stored history below describes the inspected saved-record formats and loader behavior; device data must be verified during Android acceptance testing.

## 2. Recommended first release

A small, transparent badge collection with progress toward milestones. Permanent awards use finished local days only; today's progress is explicitly provisional. This avoids irreversible awards from accidental taps, undone check-ins, failed saves, or today's habit edits.

Include 12 badges below, an Achievements screen, a Settings entry adjacent to the profile, and a compact Today entry/earned summary. Keep existing tab structure and profile editor behavior. Awards are local to this installation and never depend on entering a name or choosing an avatar.

Defer XP, levels, coins, leaderboards, streak freezes, rewards for over-target counts, goal-status badges, routine-specific badges, sharing, confetti, sounds, haptics and notifications. Goal completion is manual; routine completion reuses habit progress and would double-count effort. Badge count plus explicit next-milestone progress provides the initial gamification loop.

## 3. Exact evaluation contract

### Eligible evidence

Let `T` be the current local date key. Use valid local calendar keys only, with `d < T`; exclude today and future dates from permanent evaluation. Reuse existing date validation/reliable-start rules rather than UTC date slicing or fixed 24-hour arithmetic.

Precisely match `buildInsightsIndex` for habit start: `start(h) = min({T} union {local date of createdAt if parseable and local year >= 2000} union {valid saved date keys <= T containing any entry for h})`. Partial entries also establish first evidence; unreadable dates cannot establish an entry. An invalid/pre-2000 creation timestamp with no readable entries therefore starts at T and supplies no finished opportunities. A future creation date cannot push the start after T. History is the only completion evidence: do not award for demo definitions, creating a habit, opening the app, profile setup, or changing a goal's manual status.

For each currently existing habit `h` and finished date `d` at or after its inferred start:

- `scheduled(h,d)` means its CURRENT schedule includes that local weekday.
- `known(d)` means history loaded successfully and `d` is not unreadable. A missing record after a successful history read is known empty, not corrupt.
- `C(h,d) = 1` exactly when `scheduled(h,d) AND known(d) AND isCompleteBySnapshot(history[d].entries[h.id])`; otherwise 0. Each `(habit ID, date)` occurs at most once. Track entry type from that date's snapshot, not the habit's current tracking type.
- Entries for deleted/unknown habits, dates before inferred start, and unscheduled completions do not contribute. Saved but partial entries contribute zero. An empty Checklist required set is incomplete even if optional steps are checked.

Define:

- `N = sum C(h,d)` over eligible pairs (lifetime scheduled check-ins for habits that still exist).
- `N_type(t) = sum C(h,d)` restricted to entry snapshot type `t`.
- `A = number of distinct finished dates with sum_h C(h,d) >= 1`.
- `D(d) = set of currently existing habits started and scheduled on d`.
- `P(d) = 1` iff `known(d)`, `|D(d)| > 0`, and every member has `C(h,d) = 1`; otherwise 0. A rest day is never perfect.
- `L(h)` is the longest run of completed finished scheduled opportunities for h. Skip unscheduled dates; reset run to zero on missed, partial or unknown scheduled dates. Never bridge an unknown date. `L = max_h L(h)`, or 0 with no habits. Use the existing streak semantics with an explicitly finished-only scan; do not use `longestStreak` unmodified because it includes today.
- `W` is the number of finished Monday–Sunday local calendar weeks for which `sum_d P(d) >= 1` AND every date in the week with `|D(d)| > 0` has `P(d) = 1`. All seven dates must precede T; any unreadable date anywhere in the week disqualifies that week. Rest days are neutral. A week with no scheduled habits fails.

For clarity, a week in which the first habit starts on Friday can qualify after Sunday if every Friday–Sunday opportunity is complete; Monday–Thursday have no due habits. The badge means every scheduled opportunity in a finished calendar week, not seven active days. State this in its expanded criterion. A corrupt entry makes its entire daily record unreadable under the existing strict parser, so no other entry in that record supplies badge evidence.

### Badge catalog (stable IDs; all unlocked at most once)

| ID | Display name | Exact unlock predicate | Progress shown while locked |
| --- | --- | --- | --- |
| `first-checkin` | First Step | `N >= 1` | `min(N,1) / 1` check-in |
| `checkins-10` | Building Momentum | `N >= 10` | `min(N,10) / 10` check-ins |
| `checkins-50` | Finding Your Rhythm | `N >= 50` | `min(N,50) / 50` check-ins |
| `checkins-100` | Century | `N >= 100` | `min(N,100) / 100` check-ins |
| `active-days-7` | Show Up Seven | `A >= 7` | `min(A,7) / 7` different days |
| `active-days-30` | Thirty Days of Effort | `A >= 30` | `min(A,30) / 30` different days |
| `streak-3` | Three in a Row | `L >= 3` | `min(L,3) / 3` scheduled check-ins on one habit |
| `streak-7` | Steady Seven | `L >= 7` | `min(L,7) / 7` scheduled check-ins on one habit |
| `streak-30` | Staying Power | `L >= 30` | `min(L,30) / 30` scheduled check-ins on one habit |
| `tracking-trio` | All Three Ways | `N_type(tick) >= 1 AND N_type(count) >= 1 AND N_type(checklist) >= 1` | Number of satisfied types `/ 3`; name remaining types |
| `perfect-day` | A Day Well Spent | `sum_d P(d) >= 1` | `min(sum P,1) / 1` perfect day |
| `perfect-week` | A Week Well Spent | `W >= 1` | `min(W,1) / 1` finished perfect week |

Streak copy must say “scheduled check-ins,” not “days.” For example, Monday/Wednesday/Friday completions can earn Three in a Row; these are not three consecutive calendar days. Count 12/8 earns one check-in; 7/8 earns none. Checklist 2/2 required earns one regardless of optional steps. The same habit can satisfy multiple Tracking Trio types across different historical dates.

### Timing, retroactive awards and reversibility

- On first successful evaluation, backfill all qualifying badges from readable finished history, not merely the latest week or visible calendar range. Persist the batch once and display one summary, not a sequence of celebration dialogs.
- `evidenceThrough` is the earliest finished date at which the predicate became true under that evaluation's definitions. For streak ties choose the earliest threshold-crossing date, then lexical habit ID for deterministic evidence. Perfect Week uses Sunday. `awardedAt` is the actual ISO timestamp when the award is created. Display it as Recognized on; display `evidenceThrough` only as Based on saved history through. Neither field claims the original unlock timestamp. With unreadable days, the earliest provable crossing may be later than the actual milestone. Current schedules/deletions also prevent reconstructing the original historical crossing; never label a backfill evidence date Unlocked on.
- Later evaluations only add missing badge IDs. Already persisted awards remain earned after habit deletion, schedule edits, newly unreadable records, or decreased recomputed totals. Locked progress can decrease after those changes; show why. Existing awards represent a milestone recognized at award time, not a promise that current metrics still match.
- Today preview uses live current-rule progress and can decrease on undo. Show “Ready if completed today — confirmed after the day ends”; never add a stored award or earned count from preview. For Perfect Week, preview is possible only on Sunday and still waits until Monday.
- Confirmation happens on the next successful foreground/date-change evaluation after a date ends; no background timer or notification delivery is promised. Reopening after multiple missed days processes all available finished history.

## 4. Unreliable and incomplete history

1. **Whole-history/habits read failure:** do not evaluate, backfill, or write awards. Preserve readable stored awards and show “Couldn't check progress” with Retry. Never display failure as zero progress.
2. **Corrupt day or unsupported progress version:** preserve original bytes; skip its completions, break known streak runs at scheduled unknown dates, and reject perfect claims involving it. Other readable evidence may still unlock a threshold. Show “At least X recorded check-ins; some history couldn't be read.” An unknown day outside a qualifying run does not invalidate that proven run.
3. **Legacy v1:** count as Tick only; do not infer historic Count targets or Checklist steps from today's definition. v2 precedence applies even when v2 is corrupt. Do not migrate/repair progress for this feature.
4. **Schedule uncertainty:** always disclose “Streaks and perfect days use your current habit schedules.” EXTRA records are an additional visible warning, not a complete detector. This release accepts retrospective schedule semantics for parity with Insights; it does not claim original schedules are known. Schedule edits may qualify a new badge; once awarded it remains. Accurate original-schedule awards would require a separate schedule-history project.
5. **Deleted habits:** exclude orphan entries from new evaluations and progress, matching Insights. Retain existing awards; show “Some history belongs to removed habits.” Recreating a habit gets a new ID and does not inherit a streak. With no habits, show stored awards and zero new candidates, even though the Insights builder returns null.
6. **Invalid/future dates and creation timestamps:** reuse Insights date/start rules, ignore invalid/future saved dates and report ignored records; infer a start from earliest valid saved evidence when needed. Do not invent completions. Dates before start do not create misses. Device clock/time-zone changes follow existing local date semantics; no server clock or tamper protection is available. Persisted awards are never revoked by clock rollback.
7. **Unsaved progress across midnight:** permanent evaluation must wait until ALL pending daily writes have drained. A previously persisted interim completion may be awaiting a queued undo; reading disk alone is insufficient. Expose a read-only `hasPendingWrites`/successful-drain revision from the daily provider and trigger a fresh history read after drain. Retain existing awards and show “Waiting for check-ins to save” on pending/error; never freeze today's optimistic snapshot into an award.
8. **Stale async work:** tag evaluations with local date, habits revision, successful daily-drain revision and request generation. Discard stale results before commit and recheck inputs within the serialized award commit. Any read begun before a pending-write transition must be invalidated. No overlapping scans or late foreground results may overwrite newer state.

## 5. Persistence and coordination

Use existing AsyncStorage and `createValueStore`; no dependency, native configuration or check-in schema change is proposed.

New independent key: `momentum:achievements:v1`. Proposed JSON envelope:

```text
{
  version: 1,
  awards: {
    [badgeId]: {
      ruleVersion: 1,
      evidenceThrough: "YYYY-MM-DD",
      awardedAt: "ISO timestamp",
      source: "backfill" | "evaluation",
      evidence: { metric: number, habitId?: string, windowStart?: string, windowEnd: string }
    }
  },
  seenBadgeIds: [badgeId, ...]
}
```

- `evidence` is a compact explanation at award time, not a duplicate history database. Store threshold metric and crossing date/window; Trio records metric 3. Use stable IDs, not habit names/profile data. Removed habit evidence renders “a previous habit.”
- Missing key means an in-memory empty store; write only when adding awards or acknowledging unseen awards. A valid empty collection with no candidates needs no initial write. Do not store derived XP, totals, streaks or locked progress; recompute from source data.
- Strictly validate envelope/version, dates, unique seen IDs and award fields. Preserve unknown badge IDs with structurally valid records; exclude them from this release's 12-badge denominator. Corrupt/unsupported envelopes block all achievement writes, including acknowledgement; show Retry, never replace with defaults. No automatic destructive reset.
- Validate finite nonnegative integer evidence metrics, valid ordered window dates, and that every seen ID refers to a stored award. Treat an unsupported rule version on a known badge as read-only incompatible data, rather than interpreting it under today's formula or rewriting it. Rule changes require an explicit compatibility policy; never silently reuse an existing ID for a different achievement.
- Mount one `AchievementsProvider` under Habits and DailyProgress, independent of Profile. Own one shared history load/evaluation and save-first award store. Do not mount a screen-focus history hook as a global event source; coordinate startup, foreground, date changes, successful save drain, habit changes and manual retry explicitly.
- Add all new awards in one serialized save-first commit; merge against the last saved awards to avoid duplicates. State and unseen summaries update only after storage succeeds. Failed award saves retain previous earned state and a retryable evaluation; re-evaluate fresh inputs on retry/foreground instead of trusting a stale candidate list.
- Keep achievement-store load/retry and commits mutually exclusive in the provider: the current `createValueStore` serializes commits but does not serialize `load()` with an in-flight commit. Coalesce reload requests until a commit settles; never let a late load replace a newer saved award set. Test this boundary without changing the shared store unless a separately justified fix is needed.
- Check-in and award writes are not a cross-key transaction. If the app dies after a check-in save but before award save, startup reconstructs missing awards. Idempotent badge-ID merging prevents double awards. If it dies after award save, the badge survives and remains unseen until acknowledgement succeeds.
- A compact summary exposes unseen persisted awards. One-time means one persisted award per ID and no celebration after successful acknowledgement. Exactly-once visual delivery across process death cannot be guaranteed with separate storage/display operations; an unacknowledged summary may reappear, never a duplicate award. Explicit dismiss/open acknowledgement is saved separately using the same serialized store. On acknowledgement failure retain unseen status and retry; repeating a summary after a crash is preferable to losing an award. Backfill is summarized as “X achievements found in your history.”
- Keep all achievement writes separate from habits, profile, goals, routines and daily records. Update Settings privacy copy to include achievements stored on this device. No in-app sync, export, permissions or notification changes.
- Scan sparse records once for totals/types/dates; use the existing indexed schedule/start semantics for streak/perfect predicates. Memoize by input revision and avoid all-history reloads on each tap or render. Evaluate after queue drain, coalescing rapid changes. Preserve all-history coverage; do not silently cap to the calendar's lookback. Profile several years of fixture history on Android before release.

## 6. UI and navigation

**Entry points:** a standalone Achievements summary card immediately below Settings' profile card (independent of profile loading/error), and a compact card below Today's daily progress/name prompt. Summary shows “X of 12 earned,” up to three recent badge symbols, and “View achievements.” Today card also contains the persisted unseen-award summary; no blocking modal interrupts tracking. Keep the avatar opening the profile editor.

**Collection:** root-stack `/achievements` screen pushed above the current tab, like routine/profile routes. Back button and Android system/predictive Back return to the originating tab. With no back stack, use Settings fallback. Preserve root anchor behavior for deep links. No sixth tab.

**Layout:** title, earned count, explanatory subtitle (“Finished days count. Today's progress is provisional.”), compact data-quality notice, filters All/Earned/Locked, then grouped cards: Check-ins, Showing up, Streaks, Tracking, Perfect days. Catalog order is stable. On phones show two columns only when text fits; switch to one column for narrow widths/large font settings. Bound content with `MaxContentWidth`; safe-area padding protects Android gesture/three-button navigation.

**Badge card:** existing platform symbols in a circular tile, title, short exact criterion, recognition date or textual progress and a small progress bar. Earned uses violet/mint plus a check indicator; locked uses neutral surfaces with readable secondary text. State must never depend on color alone. Expanding a card reveals the formula in plain English, observed metrics, historical limitations, and recognition timestamp and separately labeled saved-evidence date. Expansion stays in-screen; no detail route is needed initially.

**Progress:** show the catalog's exact numerator/threshold. Next milestone is the first locked badge in catalog order; do not rank unrelated ratios as equivalent effort. Today's optional preview is separate from confirmed progress. Perfect Week shows a complete-week requirement rather than a misleading fractional percent from unscheduled days.

**States:** loading indicator without fabricated zeros; empty history (“Your first finished check-in starts your collection”); history failure with stored awards still visible; achievement-store failure with collection writes blocked; partial-history notice; pending progress save; failed award save with Retry. Profile errors do not hide the collection or block habit tracking.

**Visual/accessibility requirements:** reuse `Palette.background/surface/surfaceRaised/border/accent/accentSoft/success`, existing radii and spacing, and platform icon mappings with fallback. No new assets required. Use 48dp minimum interactive targets on Android, scalable text, TalkBack labels containing name/state/progress, accessible filter selection and progress values. Decorative symbols are excluded from focus. Announce an award batch politely once after persistence, without stealing focus. Use static feedback initially; avoid motion/reduced-motion complications. Verify earned/locked text contrast against dark surfaces.

## 7. Proposed files to create/change after approval

| File | Planned responsibility |
| --- | --- |
| `src/data/achievement-definitions.ts` (new) | Stable 12-badge catalog, rule versions, copy, categories and platform symbols |
| `src/utils/achievements.ts` (new) | Pure finished-day evaluation, earliest crossing dates, progress, evidence and data-quality results |
| `src/data/achievement-coordinator.ts` (new) | Pure serialized load/evaluate/save/acknowledge lifecycle, source cache and synchronous stale-input guards |
| `src/data/achievement-storage.ts` (new) | Independent key, strict parser, load/save and idempotent award/seen merge helpers |
| `src/hooks/use-achievements.tsx` (new) | Shared provider, lifecycle/history coordination, stale-result guards and save-first state |
| `src/components/achievements/achievement-card.tsx` (new) | Accessible earned/locked card and expandable explanation |
| `src/components/achievements/achievements-summary-card.tsx` (new) | Shared compact Today/Settings entry and unseen summary |
| `src/components/achievements/achievement-data-notes.tsx` (new) | History/schedule/save-state disclosures and retry presentation |
| `src/app/achievements.tsx` (new) | Collection screen, filters, groups, loading/error/empty states |
| `src/app/_layout.tsx` | Mount provider under its dependencies; register root-stack screen |
| `src/utils/navigation.ts` | Open/close Achievements helpers with Settings fallback |
| `src/app/(tabs)/settings.tsx` | Summary next to profile and updated local-data privacy copy |
| `src/app/(tabs)/index.tsx` | Compact entry, today's clearly provisional preview, unseen summary |
| `src/hooks/use-daily-progress.tsx` | Read-only pending-write/drain-revision signals; preserve sole-writer semantics |
| `src/data/save-queue.ts` (only if needed) | Minimal observable queue-state support if provider cannot derive correct signals; preserve retry/coalescing behavior |
| `src/utils/insights.ts` (only if needed) | Extract/share start/status helpers without changing existing Insight results; no direct reuse of today-inclusive streak result |
| `tests/achievements.test.mjs` (new) | Formula boundaries, crossing dates, schedule/date/unknown/deletion fixtures |
| `tests/achievement-storage.test.mjs` (new) | Parsing, version protection, merge/backfill and acknowledgement failure cases |
| `tests/achievement-coordination.test.mjs` (new) | Pure coordinator state/async race tests; extract coordinator outside React if needed |
| `tests/progress-save-queue.test.mjs` | Add regression cases for any new queue signal contract |

Reuse `value-store.ts`, theme tokens and date/completion utilities. No planned edits to profile schema/editor, tab implementations, native directories, package manifests/lockfiles or notification files. No dependency installation.

## 8. Android acceptance cases after implementation

Use a development/test fixture environment for storage/error injection; never alter a user's real history. These cases are planned, not executed during this documentation task.

Execution steps after approval and implementation:

1. Run `npm test`, `npx expo lint`, and `npx tsc --noEmit` using installed dependencies. In Windows PowerShell where script execution is disabled, invoke `npm.cmd` / `npx.cmd`; no execution-policy change is necessary.
2. Start Metro with `npx expo start --android` against an SDK-compatible Android development environment. Verify the installed SDK 58 documentation before choosing Expo Go versus an existing development build. No new native module is planned and this milestone does not require notification permissions.
3. Run the matrix below on a disposable test installation with deterministic local dates and AsyncStorage fixtures. Use injected clocks/failure adapters in the test environment for boundary and race cases; keep fixture injection out of production Settings. Record Android version, device/emulator, navigation mode, font scale, fixture, actual result and pass/fail.
4. Force-stop/relaunch for durability cases and background/resume across local midnight for lifecycle cases. Re-read the persisted achievement envelope to verify one award per stable ID and compare original history bytes for all corruption tests.
5. Repeat navigation, TalkBack, large-text and tracking smoke cases on a physical Android device when available. Record unavailable device coverage explicitly; do not treat a Metro launch or passing unit suite as completion of the Android matrix.

| Case | Action/fixture | Expected result |
| --- | --- | --- |
| Fresh install | Open Today, Settings and collection with no habits/history/name | 0/12, helpful empty state, no phantom awards or profile requirement |
| Tick undo | Complete then undo today's Tick; save and relaunch | No permanent badge; preview disappears |
| Day confirmation | Complete first habit, persist, advance to next local day/foreground | First Step saved once; evidenceThrough is prior date and recognition date is current date; summary visible |
| Count boundary | Past values 7/8, 8/8, 12/8 | Contributions 0, 1, 1; no reward for excess units |
| Checklist boundary | Required incomplete, all required complete, optional-only, empty required snapshot | Contributions 0, 1, 0, 0 |
| Milestone boundaries | Fixtures N=9/10,49/50,99/100 and A=6/7,29/30 | Unlock exactly at threshold; multiple habits on one day increase N but only one A |
| Scheduled streak | M/W/F habit with three completed scheduled dates and rest days | Three in a Row; copy says check-ins, not calendar days |
| Broken/unknown streak | Insert missed, partial or corrupt scheduled date; then new run | Runs do not join across gap; threshold met by a separate known run may unlock |
| Today pending | Existing streak, today incomplete or not loaded | No premature permanent break or extension; finished metrics unchanged |
| Long streak thresholds | Fixtures L=2/3,6/7,29/30, multiple habits | 3/7/30 badges unlock at exact length on a single habit |
| Tracking Trio | Complete Tick, Count, Checklist snapshots on finished dates, including type changes on same habit | Exactly 3/3 when all types proven; legacy v1 only supplies Tick |
| Perfect Day | Zero due, some due incomplete, all due complete, unknown date | Only known nonempty all-complete day qualifies |
| Perfect Week | Monday–Sunday with rest days; repeat with missed/unknown day and an empty week | Award only after Sunday ends for known qualifying week; rest days neutral, empty week fails |
| Sunday vs Monday | All due check-ins complete on Sunday afternoon, then foreground Monday | Sunday shows preview only; Monday confirms once |
| Historical edits | Change today's Count target/required steps/type; relaunch | Preview follows current rules; previous-day snapshots retain original meaning |
| Schedule edits | Change daily to M/W/F with prior entries | Metrics follow disclosed current-schedule semantics; EXTRA ignored; persisted awards remain |
| Deleted habits | Delete a habit after earning; reopen; delete all habits | Earned badges remain; orphan records never generate new awards; no-habits UI works |
| Legacy precedence | v1-only date, valid v2+v1, corrupt v2+valid v1 | Tick fallback only with no v2; no duplicate or corrupt-v2 fallback award |
| History corruption | One corrupt day vs whole history read failure | Partial lower-bound progress vs blocked evaluation; original bytes preserved |
| Achievement corruption | Malformed or future-version achievement envelope | Error/Retry; no overwrite, default write or acknowledgement write |
| Write failures | Fail daily save, then achievement save, then acknowledgement save | No premature award; retry yields one saved badge; failed acknowledgement stays unseen |
| Midnight race | Persist completion, queue undo, delay/fail save across midnight | Evaluator waits for full drain; interim disk completion earns nothing |
| Fast actions/races | Rapid taps; navigate away; edit habits during history scan; background/foreground during save | Stale generations discarded; no duplicate award, lost pending record or blocked tracking |
| Process death | Kill after daily save/before award, and after award/before acknowledgement | Reconstruct missing badge on launch; saved badge remains; unseen summary survives |
| Backfill | Launch with years of valid history meeting several predicates | All earned badges batched once, earliest crossing dates correct, single history summary |
| Calendar edges | Local midnight, month/year/leap-day boundaries, DST/time-zone change, clock rollback, invalid/future date keys | Local calendar rules; ignored records reported; no UTC shift, duplicate or revoked award |
| Navigation | Open from Today/Settings; hardware/system Back; cold deep link to `/achievements` | Return to origin or safe Settings fallback; five tabs preserved |
| Accessibility/layout | TalkBack, large font, narrow phone, landscape, gesture and three-button navigation | Readable states, labeled progress, logical focus order, no clipped cards/buttons or covered content |
| Regression/performance | Track each type; edit profile; open routines/goals/Insights with long fixture history | Existing flows unchanged; no per-tap history scan or obvious main-thread pause |

Automate pure formulas and storage/coordinator failure paths with the current Node runner and AsyncStorage mock. Manually verify Android UI/lifecycle/navigation and error-state behavior on an emulator plus a physical device when available; smoke-test iOS/web compatibility. Do not claim device coverage from unit tests.

## 9. Approved implementation sequence and boundaries

1. Approve finished-day confirmation, current-schedule historical semantics, deleted-habit exclusion, permanent award retention, the 12-badge catalog and no-XP scope.
2. Before any Expo/React Native implementation, fetch the installed SDK's docs at `https://docs.expo.dev/versions/v58.0.0/` and `https://docs.expo.dev/llms.txt`, following the relevant Router/lifecycle/symbol/accessibility links. This plan is based on repository inspection and does not introduce API code.
3. Implement and test pure evaluator/storage, then persistence coordination and pending-save protections, then collection/summary UI.
4. Run existing and new tests, `npx expo lint` and `npx tsc --noEmit`, then the Android acceptance matrix. Review Git diff for unrelated changes and notification isolation.

Original planning boundary: only this document was authorized during planning. The subsequent explicit user approval authorizes the milestone implementation, with no new dependencies, branch changes, commits or pushes. The approved formulas and data-safety requirements above remain the implementation contract.

## 10. Planning review verification

- Inspected the root/tab layouts, Today and Settings entry points, profile storage/provider/navigation, habit schemas, snapshot completion rules, history loading, Insights start/status/streak calculations, routine progress, daily save queue and save-first value store directly on `main` at `aece430`.
- The initial draft was already untracked; the plan is the only intended workspace difference. The postponed notifications branch was not checked out or modified.
- Baseline checks for this documentation review: `npx.cmd --no-install expo lint` and `npx.cmd --no-install tsc --noEmit` both passed. No dependencies installed; no application implementation or Android device tests performed.

## 11. Implementation decisions and verification

The user approved implementation with the 12-badge catalog and additional first-day encouragement, race protection and test requirements. All 12 definitions, persisted local awards, the root-stack Gallery, Today/Settings cards, expandable criteria, filters, real finished-day progress, data-quality notices and acknowledgement summaries are implemented. Five tabs remain. Recognition timestamps and saved-history evidence dates have separate labels; no historical unlock timestamp is manufactured.

Implementation refinements:

- `src/data/achievement-coordinator.ts` is a pure, independently tested coordinator used by the shared provider. Its outer operation queue serializes store loads, evaluations, award commits and acknowledgements; this avoids the existing value-store load/commit race without changing that shared store.
- The evaluator walks sorted sparse saved records and at most seven days per candidate perfect week, rather than allocating an all-days-by-habits index. A run continues only when the next scheduled opportunity after its last completed date equals the next completion. Missing, partial and unknown scheduled opportunities therefore cannot bridge runs. There is no historical lookback cap.
- The daily queue exposes synchronous enqueue/success revisions and a successful-write revision for dates before the evaluation date. The daily provider exposes that guard plus a drain trigger. Pending writes on ANY date block evaluation. Today-only drains reuse an already completed evaluation, since finished evidence has not changed; previous-date drains, startup, date/habit changes, foreground and Retry re-read history. A refresh invalidated during a tap is re-read after drain, including when an older cache existed. Full history is not scanned per tap or render.
- `src/hooks/use-habits.tsx` also exposes a stable read-only snapshot of the last saved list and load readiness. This closes the interval between a successful habit write and the next React render when checking stale evaluation inputs. No persisted habit schema changed.
- Immediately before an award write starts, the coordinator rechecks actual local date, saved-habit identity/readiness, daily enqueue/success revision, pending writes and request generation. That synchronous check and invocation of persistence are the commit point; a write already invoked cannot be canceled. A concurrent later edit does not revoke the award. There is no cross-key transaction or claim of atomic native storage plus UI delivery.
- The daily mutation guard also rejects callbacks tagged with a date that no longer matches the real local date, protecting the short interval before the existing date hook refreshes after midnight.
- Today shows lightweight encouragement for a scheduled Tick, positive Count value, or completed required Checklist step, including partial effort. Optional-only Checklist effort, rest-day entries and undone effort do not qualify. It never adds an award, earned count, or a confirmed progress unit. Wording makes confirmation conditional on completing the requirement and saving it after the day finishes.
- One batch summary is acknowledged by explicit Dismiss or opening the gallery from an entry card. A failed acknowledgement keeps the summary unseen and retryable. No automatic animation, sound, haptic, notification or focus-stealing modal was added. Recognition time is captured when the award write is initiated and becomes visible only after persistence succeeds; AsyncStorage cannot supply a native completion timestamp.
- The planned component responsibilities are implemented in `achievement-card.tsx`, `achievement-data-notes.tsx`, and `achievements-summary-card.tsx`; the latter also contains the small shared celebration summary. A separate celebration file was unnecessary. The beginner phone checklist is `ACHIEVEMENTS_ANDROID_TESTING.md`.
- No application dependencies, lockfiles, native configuration, existing data schemas or notifications were changed. The branch remains `main` at `aece430`; all milestone changes are uncommitted.

Executed checks on Windows PowerShell (the `.cmd` suffix avoids execution-policy restrictions):

| Check | Exact result |
| --- | --- |
| `npm.cmd test` | Exit 0: 151 tests, 18 suites; 151 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo |
| `npx.cmd --no-install tsc --noEmit` | Exit 0; no diagnostics |
| `npx.cmd --no-install expo lint` | Exit 0; no lint diagnostics |
| `npx.cmd --no-install expo-doctor` | Exit 0: 20/20 checks passed, no issues detected. First sandbox attempt failed with npm registry `EACCES`; approved network rerun succeeded with `--no-install`. |
| `npx.cmd --no-install expo export --platform android --output-dir dist/achievements-check --no-bytecode` | Exit 0: Android bundle generated (1,746 modules). This is a debug bundle check, not a phone installation or native build. Output is in ignored `dist/`. |
| `git diff --check` | Exit 0; no whitespace errors. Git also reports expected Windows LF/CRLF conversion notices. |

New isolated suites cover every badge threshold and earliest crossing, snapshot boundaries, legacy precedence, corrupted/future data, changed schedules, rest days, removed habits, retained awards, backfill, future dates, first-day effort, midnight, delayed/failed daily saves, award and acknowledgement failures, concurrent requests, stale refreshes and cache/drain coordination. Daily-queue regression coverage verifies synchronous revisions and previous-date dirty detection. A five-year/12-habit fixture verifies complete lifetime coverage without a calendar cap. Expected failure-injection warnings appear in the test output; the suite passes.

Android phone UI, TalkBack, real foreground/midnight behavior and device performance have NOT been tested here. Follow `ACHIEVEMENTS_ANDROID_TESTING.md` before approving a commit. The full acceptance matrix above remains relevant for a disposable fixture/device test environment; no real user history was read, seeded, repaired or reset from this workspace.
