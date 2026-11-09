# Insights & History — Implementation Plan

Milestone: a read-only Insights tab with a calendar heatmap, per-habit streaks, statistics, trends and a Weekly Review, plus an optional habit history screen.

**Status: approved and implemented (uncommitted, awaiting Android testing).** D1, D2, D4 and D5 were approved as written. D3 was changed: unreadable days are now excluded in **both** Insights and Goals (see §5 and §10).

Baseline: commit `ceff5ce`. Expo SDK 58, Expo Router (typed routes, React Compiler on), AsyncStorage only. **No new dependencies**, Expo Go Android compatible, no backend.

**Ground rule: Insights never writes to storage.** It only calls `loadCompletionHistory()` (which only reads) and reads in-memory state from `useHabits()` and `useDailyProgress()`. No new storage keys, no migrations, no repairs.

---

## 1. What exists today (inspected)

| Area | Current state | What it means for Insights |
| --- | --- | --- |
| Daily progress | One key per local date. `momentum:checkins:v2:YYYY-MM-DD` → `{version:2, entries:{[habitId]: HabitEntry}}`. Legacy `momentum:completions:v1:YYYY-MM-DD` → `string[]`, read-only. | v2 takes priority for a date. v1 is read only when no v2 record exists, and each v1 ID counts as a completed Tick. A corrupt v2 record never falls back to v1. |
| Entry snapshots | `count` stores the `target` in force at the time. `checklist` stores `required` step IDs. `tick` is `done:true`. | Past days are judged by `isCompleteBySnapshot(entry)`, so editing a habit never rewrites history. That holds even when the habit's tracking type has changed since: an old Tick entry still counts as complete. |
| Today | `DailyProgressProvider` is the **only** writer. `normalizeTodayRecord` keeps today's snapshot in line with the habit's current definition. A tracking-type change clears today's entry. | Today is judged with `isCompleteNow(liveRecord, habit)` using the **live** record, which includes saves still pending. This matches Goals. |
| History reader | `loadCompletionHistory()` returns `{days: Map<date, DayRecord>, unreadableDays: string[]}` and reads everything with one `multiGet`. `useCompletionHistory()` reloads it on screen focus. | Reuse both as they are. Corrupt days are already isolated and reported. |
| Schedules | `{kind:'daily'}` or `{kind:'weekdays', days}`, current definition only. `isScheduledOn(habit, date)`. Today shows **only scheduled habits**. | If an entry is saved on a day the habit is not scheduled now, its schedule has almost certainly changed since. We use that to warn the user. |
| Habit start | `createdAt` is an ISO timestamp. The legacy demo migration set `createdAt` to the migration time, **after** their real check-ins. v1→v2 kept `createdAt`. | A habit's history start can't rely on `createdAt` alone (see §3.1). |
| Deleted habits | Their entries stay in storage, and goals unlink them. | We can't know their schedule, so they are excluded from all stats. Their records are left untouched. |
| Existing math | `utils/goal-progress.ts` counts one check-in per habit per scheduled day, splits finished days from today, and documents the schedule limitation. | Insights uses the same unit and the same rules. |
| Insights route | `src/app/insights.tsx` is a `PlaceholderScreen`. The tab trigger is named `insights` (native and web). | It becomes a folder with a Stack. The trigger name stays the same. |

---

## 2. Screens

### 2.1 Insights tab — `src/app/insights/index.tsx`

A single `ScrollView` in the existing style (`Palette.surface` cards, `Radius.lg`, uppercase 11px labels, violet/blue accents, `BottomTabInset` padding):

1. **Header**: "Insights" and a one-line caption ("Based on your saved check-ins").
2. **Overview tiles** (2×2), covering the **last 30 finished days**:
   - Consistency %
   - Check-ins completed (`X of Y`)
   - Best current streak (habit name and length)
   - Perfect days (days when every scheduled habit was done)
3. **Calendar heatmap card**: a month grid (Mon–Sun columns, up to 42 cells) with ‹ › month navigation. Navigation is limited to the range from the earliest history month to the current month. Includes a legend. Tapping a day shows a small summary line under the grid, e.g. "Tue, Nov 3 · 4 of 5 check-ins".
4. **Weekly Review card**: ‹ week › navigation, with the current week as the default (see §3.7).
5. **Trends card**: a Weekly / Monthly segmented toggle. Shows 8 weeks or 6 months as bars drawn with plain `View`s (no chart library). The current period is labelled "so far" and drawn with a dashed outline.
6. **Habits list**: one row per habit, in the user's order. Each row shows the icon in the habit's colour, the name, the schedule, 🔥 the current streak, the best streak, 30-day consistency, and 7 dots for the last 7 days. Tapping a row opens the habit's history.
7. **About these numbers**: a collapsible card (`components/ui/collapsible.tsx`) with the limitations from §5, plus any data warnings that apply right now.

**States**
- Loading: a spinner, shown only on the first load. Later focus reloads keep the previous data on screen.
- Habits failed to load: an error with a retry button. History failed to load: an error with a retry button and the line "Nothing was changed".
- No habits: an empty state with a link to the Habits tab.
- Habits exist but there are no finished days yet: "Insights fill in after your first full day." Today's provisional progress is still shown.

### 2.2 Habit history — `src/app/insights/habit/[id].tsx` (optional, recommended)

This fits the existing architecture without adding complexity: a Stack inside the Insights tab, the same pattern as `habits/_layout.tsx`. Contents:
- A header with the habit's icon and colour, its schedule (`describeSchedule`), and its tracking type (`describeTracking`). Back button.
- Tiles for current streak, best streak, all-time consistency (`completed of scheduled`), and this month's consistency.
- A month calendar in the habit's colour, with each day showing its status from §3.2. The habit view also shows **partial** days, e.g. a Count of 5/8 or Checklist steps done but not all required ones.
- The data notes that apply to this habit, such as a possible schedule change or unreadable days.
- An "Edit habit" link that navigates to `/habits/[id]`. Insights itself never edits anything.
- If the habit was deleted or the ID is unknown: "Habit not found" with a button back to Insights.

---

## 3. Calculation rules

All of these are pure functions in `src/utils/insights.ts`, with no React and no storage access.

### 3.1 Inputs and windows

- `todayKey = daily.dateKey`, the same date the provider writes to.
- `todayRecord` = the live `daily.record`, used only when `daily.status === 'ready'`. Otherwise today is treated as **unknown**, not as missed.
- **Valid history keys**: only keys that pass `isLocalDateKey` and are `<= todayKey`. Keys dated after today come from clock changes or travel. They are **ignored and counted** in `futureRecords` so the UI can mention them.
- **Habit start date** `S(h) = min(localDate(createdAt), firstEntryDate(h))`.
  - `firstEntryDate(h)` is the earliest valid date with any entry for `h`. This covers the legacy demo habits, whose `createdAt` is later than their first check-ins.
  - An unparseable `createdAt` falls back to `firstEntryDate`, and then to `todayKey`.
  - Days before `S(h)` are **not scheduled**: the habit didn't exist yet, so they are never counted as missed.
  - **Legacy rule (approved):** saved entries may only move the start *earlier*, to the first reliable evidence. No check-ins are invented. Nothing before the first evidence is treated as scheduled or missed. From the first evidence onward, the habit is treated as existing, and its current schedule applies (see §5.1). Such habits show the note "History starts at the first saved check-in".
  - Any saved entry counts as evidence (a completed, partial, or legacy v1 tick).

### 3.2 Day status for habit `h` on date `d`

| Condition (checked in this order) | Status | Counts as |
| --- | --- | --- |
| `d > todayKey` | `future` | nothing (never drawn as data) |
| `d < S(h)` | `before-start` | nothing |
| not `isScheduledOn(h, d)` | `unscheduled` (or `extra` if a complete entry exists) | nothing. `extra` raises the schedule-change hint. |
| `d` is in `unreadableDays` | `unknown` | excluded from both numerator and denominator, and reported |
| `d === todayKey` and complete per `isCompleteNow(todayRecord, h)` | `done` | completed (provisional) |
| `d === todayKey`, not complete | `pending` | **never missed**. Shown as "in progress". |
| `d < todayKey`, `isCompleteBySnapshot(entry)` | `done` | completed |
| `d < todayKey`, an entry exists but isn't complete | `partial` | missed (shown as partial in the habit view) |
| `d < todayKey`, no entry | `missed` | missed |

A scheduled day with no record is "missed". The app can't tell "didn't do it" apart from "didn't open the app", and the copy says "not checked in" rather than "failed".

### 3.3 Consistency

```
finished(h, range) = scheduled days of h in range with d < todayKey, excluding unknown
completed(h, range) = days in finished(h, range) with status done
consistency(h, range) = completed / |finished|          (null when |finished| = 0, shown as "—")
overall(range) = Σ_h completed / Σ_h |finished|         (weighted by check-in; each habit-day = 1 unit)
```

Today is always reported separately as provisional ("Today · 2 of 4 so far"), as Goals already does. One habit counts at most 1 unit per day, whatever its tracking type.

### 3.4 Current streak (respects schedules)

Unit: **consecutive scheduled check-ins**, labelled "5 in a row". It is not labelled "days", because a Mon/Wed/Fri streak of 5 spans about 12 calendar days.

```
walk scheduled days of h from yesterday backwards (unscheduled days are skipped; they neither extend nor break):
  done     → streak += 1
  missed / partial → stop
  unknown  → stop, mark streak as "at least N" (atLeast = true)
  before-start → stop
then today:
  scheduled & done    → streak += 1
  scheduled & pending → unchanged; UI shows "Keep it going today" (streak is at risk, not broken)
  not scheduled       → unchanged
```

So **a streak only breaks once a scheduled day has fully ended without completion.** It never breaks because today isn't finished yet.

### 3.5 Longest streak

The maximum run of `done` over all scheduled days from `S(h)` to today, in chronological order. Today adds to a run only when it is `done`, and `pending` never ends a run. An `unknown` day ends the run (the conservative choice) and sets `atLeast` on runs next to it. Stored as `{ length, endDate }` for display, e.g. "Best: 12 · ended Oct 4".

### 3.6 Heatmap (overall)

For each date `d` in the visible month:

```
due(d)  = habits with S(h) ≤ d and isScheduledOn(h, d)
done(d) = habits in due(d) with status done
ratio   = done / |due|  (unknown habit-days removed from both)
```

| Cell | Look |
| --- | --- |
| `|due| = 0` (rest day) | faint outline, no fill |
| ratio 0 (past) | `ringTrack` fill |
| 0 < ratio < 0.5 | accent at ~30% opacity |
| 0.5 ≤ ratio < 1 | accent at ~60% opacity |
| ratio = 1 | full accent, i.e. a perfect day |
| today | the level so far plus a dashed ring ("in progress") |
| future / before any history | dimmed day number only |
| contains an unreadable record | small `danger` dot plus the explanation in notes |

Colour is never the only signal. Every cell has an `accessibilityLabel` such as "November 3, 4 of 5 check-ins". Today and perfect days also get a marker that doesn't rely on colour.

### 3.7 Weekly Review

Weeks run **Monday–Sunday**, matching `WEEKDAY_DISPLAY_ORDER`. For a week `W`:

| Field | Formula |
| --- | --- |
| Completed check-ins | done habit-days in W with d ≤ today (today's are marked provisional) |
| Missed check-ins | `missed` + `partial` habit-days in W with **d < today** |
| Still to come | pending today + scheduled days after today in W (current week only) |
| Week consistency | completed(finished) / finished, as in §3.3 |
| Perfect days | finished days in W where `|due| > 0` and ratio = 1 |
| Best habit | highest consistency with ≥ 2 finished scheduled days; ties go to more completions |
| Needs attention | the habit with the most missed check-ins (shown only if > 0) |
| vs last week | difference in consistency, in percentage points; shown only when both weeks have ≥ 1 finished check-in |
| Achievements | facts derived from the numbers above, e.g. "3 perfect days", "Meditate: 10 in a row", "Best week in the last 8". Never invented. |

Navigation goes back to the week that contains the earliest `S(h)`, and forward to the current week. A week with nothing scheduled shows "Nothing was scheduled this week."

### 3.8 Trends

- **Weekly**: the last 8 Monday-start weeks. **Monthly**: the last 6 calendar months.
- The value is `overall(range)` over finished days. A period with 0 finished check-ins is drawn as a gap, not as 0%.
- The current period is labelled "so far" and covers finished days only.
- Below the bars: "Avg X% · Best period Y%".

---

## 4. Data flow and performance

```
useHabits() ─────────────┐
useDailyProgress() ──────┼─► useInsights() ─ useMemo ─► buildInsightsIndex(habits, history, todayKey, todayRecord)
useCompletionHistory() ──┘        │                          │ one pass: per-habit Uint8Array of DayStatus,
                                  │                          │ indexed by day offset from the earliest S(h)
                                  ▼                          ▼
                          status / errors         selectors (cheap linear scans over the index):
                                                  overview, heatmapMonth(y,m), weeklyReview(weekStart),
                                                  trends(kind), habitSummary(id), dataNotes
```

- **One index, many selectors.** `buildInsightsIndex` walks each habit's window once. It moves the date forward with a running weekday counter instead of calling `parseLocalDateKey` per day. That is O(habits × days): 20 habits × 3 years ≈ 22k steps and about 22 KB of `Uint8Array`, well under a frame on a mid-range Android.
- Memoised on `[habits, history, todayKey, todayRecord]`. Navigating between months or weeks only reruns the cheap selector.
- **Loading**: reuses `loadCompletionHistory()`, which is already one `getAllKeys` plus one `multiGet`. Only small, additive change: `useCompletionHistory` also reloads when `todayKey` changes, so a day that rolls over while Insights is open is picked up. Goals benefit from the same change.
- **Rendering**: a month grid is ≤ 42 `View`s, trends ≤ 8 bars, and each habit row has 7 dots. No virtualisation is needed for realistic habit counts (≤ 50). A plain `map` inside the `ScrollView` is fine.
- No new dependencies: no chart, calendar or date libraries.

---

## 5. Limitations (shown in the app, under "About these numbers")

1. **Schedules aren't versioned.** The app only knows each habit's *current* schedule and applies it to all past days. If a schedule was changed, past scheduled, missed and streak numbers reflect the current schedule, not the one in force then. We don't claim past schedule accuracy. If a habit has completed entries on days it isn't scheduled now (`extra`), its row and detail screen say: "This habit has check-ins on days it isn't scheduled now, so its schedule may have changed. Past numbers use the current schedule."
2. **Past days use the rule saved that day** (count target, required steps), so editing a habit doesn't change history. Today uses the current rule.
3. **Unreadable days** are left out of all numbers and listed as "N days of saved check-ins couldn't be read". Streaks next to them show as "at least N". Nothing is repaired or rewritten.
4. **Future-dated records** (device clock or time-zone changes) are ignored and counted.
5. **Deleted habits** are not shown. Their saved records are kept untouched.
6. **History start**: days before a habit was created don't count. For the original demo habits, the start is their first saved check-in.
7. **Local dates**: days follow the device's local calendar. Travelling across time zones can shift or merge a day.
8. **Not checked in ≠ not done.** A scheduled day with no saved check-in counts as missed.

**Goals alignment (approved D3 change):** `computeHabitConsistency` now uses the same rule as Insights. Unreadable finished days are left out of **both** completed and scheduled, and are still counted in `unreadableDays`. The Goals card now says "N days … couldn't be read and are left out, so this may be incomplete. Nothing was changed." Today is skipped only when its saved record is unreadable *and* no live record is available. This is a read-only calculation change: saved goals and check-ins are untouched.

---

## 6. Files

**New**

| File | Purpose |
| --- | --- |
| `src/utils/insights.ts` | Types (`DayStatus`, `HabitSummary`, `WeeklyReview`, …), `buildInsightsIndex`, streaks, consistency, heatmap, weekly review, trends, data notes. Pure. Header doc block with all rules from §3 and §5. |
| `src/hooks/use-insights.ts` | Combines the three sources, memoises the index, exposes `status` (`loading`/`ready`/`habits-error`/`history-error`) and `retry`. |
| `src/app/insights/_layout.tsx` | Stack (`headerShown:false`, `Palette.background`), like `habits/_layout.tsx`. |
| `src/app/insights/index.tsx` | Insights tab (§2.1). |
| `src/app/insights/habit/[id].tsx` | Habit history (§2.2). |
| `src/components/insights/stat-tile.tsx` | Label, value, caption tile. |
| `src/components/insights/heatmap-calendar.tsx` | Month grid with nav and legend. `mode: 'overall' \| 'habit'`. |
| `src/components/insights/weekly-review-card.tsx` | §3.7. |
| `src/components/insights/trend-bars.tsx` | Segmented toggle plus View bars. |
| `src/components/insights/habit-insight-row.tsx` | Row for the habits list. |
| `src/components/insights/data-notes.tsx` | Limitations and live warnings. |
| `src/components/insights/period-nav.tsx` | Shared ‹ label › control for months and weeks. |
| `src/components/insights/format.ts` | `formatRate`, `plural`, `withAlpha`, `statusLabel`. |

**Changed (additive only)**

| File | Change |
| --- | --- |
| `src/app/insights.tsx` | **Deleted**. Replaced by the `insights/` folder. The tab trigger name `insights` is unchanged. |
| `src/utils/date.ts` | Add `startOfWeek(date)` (Monday), `formatWeekRange`, `monthGrid(year, month)`. Existing functions untouched. |
| `src/utils/navigation.ts` | Add `INSIGHTS_HREF` (same Windows typed-route cast as `HABITS_HREF`), `habitHistoryHref(id)`, `closeHabitHistory()`. |
| `src/hooks/use-completion-history.ts` | Optional `reloadKey` param (pass `todayKey`) so the history reloads at midnight. The default behaviour is unchanged. |
| `src/components/app-tabs.web.tsx` | Use `INSIGHTS_HREF` (no behaviour change). |
| `src/utils/schedule.ts` | Add `isScheduledOnWeekday` (used by the index loop). `isScheduledOn` is unchanged. |
| `src/utils/goal-progress.ts` | Read-only calculation change: unreadable days are skipped in both counts (see §5). |
| `src/components/goals/consistency-summary.tsx` | Unreadable-day warning wording updated. |

`useCompletionHistory` also gained `reload()` for the Insights error state. Existing callers are unaffected.

**Not touched**: `completion-storage.ts`, `habit-storage.ts`, `goal-storage.ts`, `save-queue.ts`, `use-daily-progress.tsx`, `habit-progress.ts` (only imported), the Today, Habits and Goals screens.

---

## 7. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Accidentally writing storage | Insights imports only `loadCompletionHistory` and read-only hooks. Review step: `grep setItem\|saveDay\|saveHabits src/utils/insights.ts src/hooks/use-insights.ts src/app/insights src/components/insights` must return nothing. |
| Today's unfinished habits shown as missed | `pending` status. Today is excluded from every "finished" denominator, and today is unknown until `daily.status === 'ready'`. |
| Streaks wrong for weekday schedules | Walk scheduled days only (§3.4). Checklist scenarios cover Mon/Wed/Fri and weekend-only habits. |
| Misleading numbers after a schedule change | §5.1 note, plus the per-habit `extra` hint. |
| Legacy demo habits looking new | `S(h)` uses the first entry date (§3.1). |
| Stale history (check-in on Today, then switching tabs) | Today comes from the live record. History reloads on focus and on date change. |
| Corrupt `createdAt` (e.g. year 1970) giving huge windows | `createdAt` is ignored when it's before 2000-01-01 or unparseable, and `firstEntryDate` is used instead. |
| Long histories | A single O(habits × days) pass with typed arrays. Selectors are memoised. Bounded rendering. |
| Expo Router typed-route bug on Windows for nested index routes | `INSIGHTS_HREF` cast, the same as the existing pattern. |
| Converting `insights.tsx` to a folder breaks the tab | The trigger name is unchanged. Verify on Android that the tab opens, the detail screen pushes, and tapping the tab again returns to the root. |
| Large AsyncStorage `multiGet` on Android | Each value is small (one day). Already in production use by Goals. If it ever becomes an issue, chunk it later without changing the format. |

---

## 8. Implementation order (after approval)

1. `utils/insights.ts` and the date helpers, then lint and tsc.
2. `use-insights.ts` and the `useCompletionHistory` reload key.
3. Insights folder, layout and tab screen with components.
4. Habit history screen and navigation helpers.
5. `npx expo lint`, `npx tsc --noEmit`, `npx expo-doctor`, then the Android checklist below.

No commit or push without your go-ahead.

---

## 9. Android testing checklist (Expo Go)

**Do not change the phone's date or alter real data.** The history calculations (streaks, rollover, snapshots, partial progress, weekly review, unreadable and future records, Goals alignment, performance) are verified by isolated, deterministic tests. They run on in-memory sample history, with AsyncStorage stubbed to throw if touched, using Node's built-in test runner and TypeScript stripping. The tests live in a temporary scratchpad folder outside the repo, so nothing was added to the project. On the phone, test with the history you already have, plus normal check-ins today.

Items that need history you may not have (several weeks, unreadable or future records) are already covered by the automated tests. On the phone, just confirm they display sensibly where they apply.

**Regression**
- [ ] Today: Tick, Count and Checklist still save, survive an app restart, and roll over at midnight.
- [ ] Habits: create, edit and delete still work. A tracking-type change still asks for confirmation.
- [ ] Goals: consistency numbers are unchanged from before.

**Insights basics**
- [ ] The tab opens with no warnings. Loading shows only on the first visit, with no flicker when you return.
- [ ] No habits: empty state, and the link opens the Habits tab.
- [ ] A new install with habits but no finished days shows the "after your first full day" message and today's provisional count.

**Correctness**
- [ ] Ticking a habit on Today and switching to Insights updates today immediately.
- [ ] An unfinished habit today shows as "in progress", not missed. The current streak isn't reset.
- [ ] Daily habit done for 3 days, today pending: current streak shows 3 with "Keep it going today". Completing it shows 4.
- [ ] Mon/Wed/Fri habit done Mon, Wed and Fri, with Tue and Thu not done: the streak is 3 (unscheduled days don't break it).
- [ ] Missing a scheduled day resets the current streak the next day. The longest streak keeps the old run.
- [ ] Count 5/8 yesterday shows as partial or missed. Count 8/8 shows as done. Raising the target today doesn't change yesterday.
- [ ] Checklist with an optional step undone still counts as done.
- [ ] A habit whose type changed from Tick to Count keeps its past Tick days as done.
- [ ] Changing a habit's schedule shows the "schedule may have changed" note on that habit.
- [ ] Days before a habit was created don't appear as missed.
- [ ] Future days in the heatmap are dimmed and never counted. Navigation stops at the current month and week.
- [ ] Weekly Review for the current week: missed counts only past days, and "still to come" includes today.
- [ ] Previous week's numbers match a hand count from the heatmap.
- [ ] Trends: the current period says "so far". An empty period shows as a gap.

**Robustness**
- [ ] (Automated) Future-dated and unreadable records are ignored or excluded and mentioned in notes. Don’t reproduce this on the phone.
- [ ] Deleting a habit removes it from Insights. Re-checking storage shows its old records are still there.
- [ ] The Habit history screen opens from a row. Back works. Tapping the Insights tab again pops to the root. "Edit habit" opens the editor.
- [ ] Opening Habit history for a habit deleted meanwhile shows "Habit not found".
- [ ] Leaving the app open past midnight on Insights moves "today" forward.
- [ ] Scrolling stays smooth with 10+ habits and several months of history.
- [ ] TalkBack reads heatmap cells and streak tiles meaningfully.

---

## 10. Decisions (approved)

- **D1 ✅** Streak unit = consecutive *scheduled* check-ins, labelled "in a row", not "days".
- **D2 ✅** A scheduled day that has ended with partial progress counts as missed for streaks and consistency. It is drawn as "partial" only in the habit view.
- **D3 ✅ (changed)** Unreadable days are excluded from completed **and** scheduled counts in both Insights and Goals, with clear "may be incomplete" warnings. Streaks that reach an unreadable day show "+" ("may be longer").
- **D4 ✅** The overview covers the last 30 finished days. Weeks start on Monday.
- **D5 ✅** The Habit history screen is included.

---

## 11. Review round: navigation and day details (implemented)

- **Why the previous-month arrow was disabled:** the calendar's earliest month was the month of the earliest habit start. For a first-day user that is the current month, so both arrows were disabled. Weekly Review was limited the same way.
- **Month bounds** (`monthBounds`): from the earlier of *the first history month* and *12 months before the current month*, up to the current month. Future months are never shown. Weeks (`weekBounds`) run from the week containing the first day of that oldest month to the current week.
- **Before history:** those days show as **"Not started"** (habit view) or **"No habits yet"** (overall), with a small bar marker. They are never shown as missed and nothing is counted. Empty weeks say "No habits had started yet this week".
- **Day details** (`dayDetail`): tapping a day shows its date and today/provisional badge. In Habit History it shows schedule (Scheduled / Not scheduled / Not started), status (Completed / Partial / Not checked in / In progress / Upcoming / Unreadable), and **saved** progress: Count value of target (saved target for past days), Checklist steps ✓/○ with removed steps labelled. Past days with nothing saved say "Nothing saved"; progress is never estimated. The overall calendar shows the day's totals plus each habit's status and progress. Today is selected by default.
- **Controls:** 48 dp prev/next buttons. Disabled buttons are hollow, dashed and dimmed, announce "disabled", and explain why. There's a "This month" / "This week" jump chip. Calendar cells use the full 1/7-width square as the touch target.
- **First-day labels:** "—" with "No finished days yet" instead of "0/0". Streaks that include today are marked "Provisional" / "Includes today". "Best streak" says "Current run" when the longest run hasn't ended, instead of "Ended <date>".
