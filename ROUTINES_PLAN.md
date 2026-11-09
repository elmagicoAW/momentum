# Routines & Daily Planning — Implementation Plan

Milestone: users group existing habits into ordered routines (e.g. Morning Routine), track them from a routine detail screen, and see a light "Today's plan" on Today.

**Status: approved (D1–D7) and implemented. Uncommitted, awaiting Android testing.** §0 lists what changed during implementation. Sections below are updated to match the code.

---

## 0. Changes made during implementation

| # | Change | Why |
| --- | --- | --- |
| C1 | **Navigation moved from option A to option C** (§5.1). Every tab moved into a `src/app/(tabs)/` route group under a new **root Stack**. The routine detail, new and edit screens are root-stack routes (`src/app/routine/…`) pushed **over** the tabs. The routine list stays inside the Habits tab (`(tabs)/habits/routines.tsx`). | The Expo Router docs ("Common navigation patterns → Returning to the originating screen") say that linking into another tab's stack puts the screen above that stack's first screen, **so Back does not return to where you started**. They recommend an outer stack for native tabs. With option C, the header Back button and Android hardware back both pop the same native root stack, so the user always lands on the tab that opened the routine (Today, or Habits › Routines). The `from=today` workaround from the draft is no longer needed. |
| C2 | Route groups don't change URLs. `/`, `/habits`, `/goals/…` and `/insights/…` are unchanged, and the five tab trigger names are unchanged. Root `unstable_settings.anchor = '(tabs)'`. | A deep link to `/routine/…` still has the tabs underneath it. |
| C3 | Habits stack: `unstable_settings.anchor = 'index'`. | When Today's plan "Manage" jumps to Habits › Routines, Back from the list returns to the Habits list instead of leaving the tab. **Side effect:** Insights → "Edit habit" now also always has the Habits list underneath (previously undefined). |
| C4 | `HOME_HREF = '/' as Href`. | After the move, the Windows typed-routes generator emits `/index` for `/`. This is the same known bug as `HABITS_HREF`. |
| C5 | Deleting a routine from its editor calls `router.dismissAll()` on the root stack. | It closes the editor and the now-stale detail screen together and lands on the originating tab. |
| C6 | Save-first logic is extracted into `data/list-store.ts`, a pure module with no React. `RoutinesProvider` wraps it. | The serialized writes and save failures can be tested on their own. The behaviour is the same as `useGoals`. |
| C7 | Daily notices are extracted to `components/today/progress-notices.tsx`. | Today and the routine screen show identical "Saving…/Saved/Retry" and load-error feedback. |
| C8 | `useTimeOfDay` re-checks every **30 s** (planned 60 s) and on foreground. | The "Now" highlight moves within half a minute of a bucket boundary. It re-renders only when the bucket changes. |
| C9 | Isolated tests use Node's built-in `node:test`, plus a resolver hook for the `@/` alias and an in-memory AsyncStorage mock. Run with `npm test`. **No new dependencies.** | No test framework existed. The tests use fixed dates instead of the device clock. |

Baseline: commit `2446663`. Expo SDK 58, Expo Router (typed routes, React Compiler on), NativeTabs, AsyncStorage only. **No new dependencies**, Expo Go Android compatible, no backend.

**Ground rules**
1. Routines store **only habit IDs**. They never copy, edit or delete habit definitions or progress.
2. Routines **never write progress**. All tracking goes through `DailyProgressProvider` (`toggleTick` / `adjustCount` / `toggleStep`), the only writer.
3. Routine progress is **derived, never stored**. Goals and Insights stay unaware of routines, so a habit can't be counted twice.
4. One new storage key. No existing key is read differently, rewritten or migrated.

---

## 1. What exists today (inspected)

| Area | Current state | What it means for Routines |
| --- | --- | --- |
| Habits | `momentum:habits:v2` → `{version:2, habits}`. Stable `h_…` IDs, never reused. `HabitsProvider` saves first, then updates state. Writes are serialized. | Routines reference `habit.id`. Because IDs are never reused, a stale ID can never point at a different habit. |
| Daily progress | One key per local date: `momentum:checkins:v2:YYYY-MM-DD` → `{entries:{[habitId]: HabitEntry}}`. Keyed by habit ID, one entry per habit per day. | An entry is per habit, not per routine, so double-counting is impossible by construction. |
| Progress writer | `DailyProgressProvider` loads the day before allowing writes and uses a coalescing retry queue (`save-queue.ts`). Pending saves are tagged with their date. It exposes `record`, `dateKey`, `canEdit` and `saveState`. | The routine detail screen reads the same context, so Today, Goals and Insights see the same live record immediately. |
| Completion rule | `utils/habit-progress.ts`: `isCompleteNow` (today) and `isCompleteBySnapshot` (past). Each habit counts as one unit. | Routine progress reuses `isCompleteNow`. No new completion rule. |
| Schedules | `isScheduledOn(habit, date)`. Today lists **only** habits scheduled today. Insights flags entries saved on unscheduled days as a possible schedule change. | Routines must not create progress for habits that aren't due today (see §4.2). |
| Today card | `components/today/habit-card.tsx` handles Tick, Count and Checklist and receives handlers as props. | Reused as is in the routine detail, so behaviour is identical. |
| Goals pattern | `goal-storage.ts` + `use-goals.tsx`: strict parser, save-first `commit` queue, `habitIds` that may hold deleted IDs ("ignored everywhere, dropped on next save"). | Routines copy this pattern exactly. |
| Pickers | `IconPicker`, `ColorPicker` (habits) and `HabitLinkPicker` (goals; keeps selection order, but its empty text mentions goals). | Reused. `HabitLinkPicker` gets an optional `emptyText` prop. |
| Navigation | Five NativeTabs: `index`, `habits`, `goals`, `insights`, `settings`. Habits, Goals and Insights are folders with a headerless Stack. `utils/navigation.ts` holds `*_HREF` casts (Windows typed-routes bug). Today is a single file, not a stack. | Routines live in the Habits stack (§5). No tab is added or renamed. |
| Date hook | `useCurrentDate()` refreshes every minute but **keeps the same object within a day**. | Its hours are stale, so "time of day" highlighting needs its own small hook (§4.5). |

---

## 2. Data model

```ts
// src/data/routine-storage.ts
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';

export type Routine = {
  id: string;            // `r_<time36>_<rand>`, generated once, never reused
  title: string;         // trimmed, 1–40 chars
  description?: string;  // trimmed, ≤ 140 chars, omitted when empty
  icon: string;          // HABIT_ICONS key; unknown key → fallback icon (same as habits)
  color: string;         // HABIT_COLORS value
  timeOfDay: TimeOfDay;  // default 'anytime'
  habitIds: string[];    // ordered, unique; may contain deleted IDs (see §6.1)
  createdAt: string;     // ISO
  updatedAt: string;     // ISO
};
export type RoutineInput = Pick<Routine, 'title' | 'description' | 'icon' | 'color' | 'timeOfDay' | 'habitIds'>;
```

- **Routine order** = array order in storage. Reordering rewrites the list in one write.
- **Habit order within a routine** = `habitIds` order.
- **Limits**: 20 routines and 20 habits per routine. Both are enforced by validation (`utils/routine-validation.ts`), not by the parser.
- A habit can be in **several** routines.
- Shared ID helper: extract `uniqueId(prefix, existing)` from `habit-storage.ts`, or duplicate it as goals already do. I recommend duplicating so `habit-storage.ts` stays untouched.

## 3. Storage strategy

- Key: `momentum:routines:v1` → `{ version: 1, routines: Routine[] }`.
- **Load**: missing key → `[]`, and nothing is written. Parsing is strict, like goals. A bad shape, unknown version, invalid entry or duplicate ID **throws**, so the provider shows an error and never writes over the data.
  - Tolerances: a missing `timeOfDay` is read as `'anytime'`, and duplicate entries in `habitIds` are de-duplicated (same as goals).
  - An unknown `timeOfDay` value throws, so data from a newer version is never silently changed.
- **Save**: one `setItem` of the full list. `RoutinesProvider` copies `GoalsProvider`:
  - no writes until a successful load
  - each change is computed from the last saved list
  - save first, then `setState`
  - serialized promise queue; a failure is rethrown to the caller
- **Migration**: none. Existing keys aren't touched. Rolling back to `2446663` simply ignores the new key.
- **Isolation**: a routines load or save failure affects only routine UI. Today's habits, Goals and Insights keep working.

## 4. Calculation rules — `src/utils/routine-progress.ts` (pure)

All rules use the **provider's** date (`parseLocalDateKey(daily.dateKey)`), exactly like Today, so the cards and the saves always agree on the date.

### 4.1 Members
`members(routine, habits)` = `routine.habitIds` mapped to existing habits, in routine order. Missing IDs are skipped and counted as `missingCount` for a small notice.

### 4.2 Due today vs not due
- `due` = members where `isScheduledOn(habit, today)`.
- `notDue` = the other members. They are shown in the detail screen, dimmed, under "Not scheduled today" with their schedule (`describeSchedule`). They have **no tracking controls**: Today doesn't show them, and progress on an unscheduled day would trigger Insights' "schedule may have changed" warning.

### 4.3 Routine progress (today)
- `done` = due habits where `isCompleteNow(record, habit)`. Each habit counts as one unit, so a Count habit at 5/8 or a checklist with some required steps open is not done (the same rule as Today).
- `total = due.length`.
- The routine state is one of:

| State | Condition | Shown as |
| --- | --- | --- |
| `empty` | `members.length === 0` | "Add habits" call to action. Never on Today. |
| `rest` | `members > 0`, `total === 0` | "Nothing due today". Not in Today's plan, except as a muted footnote. |
| `todo` / `partial` | `0 ≤ done < total` | `done / total` with a progress bar |
| `complete` | `done === total > 0` | Check and accent border |

- Routine completion is **display-only**. It is not stored and not used by Goals or Insights. There are no routine streaks or history in this milestone (D6).

### 4.4 No double-counting
- Today's ring, Goals' consistency and Insights all keep counting **per habit ID per day** from the day record. Routines add nothing to these counts.
- Today's plan summary counts **routines** ("2 of 3 routines done"), never a sum of habit counts across routines. A shared habit appears in each routine, and completing it once marks it done in all of them, because they all read the same entry.
- "Not in a routine" = habits due today whose ID is in no routine. Computed as a set difference and shown only as a count.

### 4.5 Time of day
- Buckets: morning `05:00–11:59`, afternoon `12:00–17:59`, evening `18:00–04:59`. `anytime` never matches.
- `useTimeOfDay()` is a new hook. It recomputes the bucket on foreground and every 30 s, and only updates state when the bucket changes.
- It affects **ordering and highlighting only**. Nothing is hidden or locked by the clock.
  - Plan order: morning → afternoon → evening → anytime. Within a bucket, routines keep the user's order.
  - The first incomplete routine in the current bucket gets a "Now" chip.

### 4.6 Midnight rollover
- The detail screen and the plan read `useDailyProgress()`. At midnight `dateKey` changes, `status` returns to `loading` (so `canEdit` is false), the due lists recompute for the new weekday, and pending saves still go to the old date (existing queue behaviour).
- Nothing routine-specific is stored per day, so there's nothing to roll over.

## 5. Navigation and screens

### 5.1 Placement (D1)

| Option | How | Outcome |
| --- | --- | --- |
| A. Habits stack (originally recommended) | All routine screens inside `habits/` | **Rejected during implementation (C1).** Per the Expo Router docs, opening a Habits-stack screen from Today leaves Back pointing into the Habits stack, not to Today. |
| B. Make Today a stack | Move `index.tsx` into a group with its own stack | Not chosen. The detail and edit screens would need duplicate routes in two tabs. |
| **C. Root Stack above tabs (implemented)** | `(tabs)` group, plus `routine/[id]`, `routine/new` and `routine/edit/[id]` on the root stack | Back (header and hardware) returns to the originating tab. This is the documented pattern. Tabs, URLs and trigger names are unchanged. |

The **five tabs are unchanged**. Routines are reached from the Habits tab (entry card → list) and from Today's plan.

### 5.2 Routes (as implemented)
| Route | Stack | Screen |
| --- | --- | --- |
| `(tabs)/habits/routines.tsx` → `/habits/routines` | Habits tab | Routine list, with reorder and "+ New" |
| `routine/new.tsx` → `/routine/new` | Root | Create form (`slide_from_bottom`) |
| `routine/[id].tsx` → `/routine/[id]` | Root | **Routine detail**, with live tracking (`slide_from_right`) |
| `routine/edit/[id].tsx` → `/routine/edit/[id]` | Root | Edit form + delete (`slide_from_bottom`) |

The static `routines` route takes precedence over `habits/[id]`, and habit IDs are always `h_…`. The helpers in `utils/navigation.ts` are `ROUTINES_HREF`, `HOME_HREF`, `openRoutine`, `openNewRoutine`, `openRoutineEditor`, `openRoutineList`, `closeRoutine`, `closeRoutineEditor`, `closeRoutineList` and `closeAfterRoutineDeleted`. The decision logic lives in `utils/routine-navigation.ts`, which has no expo-router import, so it can be tested.

| Flow | Back result (header button and Android hardware back) |
| --- | --- |
| Today's plan → routine | Today |
| Habits → Routines → routine | Routines list |
| Routines list | Habits list (anchored) |
| routine → Edit → cancel or save | Routine detail |
| routine → Edit → delete | Originating tab (`dismissAll`) |
| Deep link `/routine/x` | Tabs underneath (anchor). If nothing can go back, fall back to Today. |

### 5.3 Screens
**Habits screen (modified):** a "Routines" card above the habit list ("3 routines · Morning, Evening…" or "Group habits into routines") that opens the list. The habit list itself is unchanged.

**Routine list:**
- Header "Routines" with a "+ New" button.
- One card per routine: icon tile in the routine colour, title, time-of-day chip, "4 habits · 2/3 today", and a mini bar.
- "Reorder" toggles ↑/↓ buttons on each card (D5: no drag library). Each move is one save, and buttons are disabled while it saves.
- States: loading, load error with retry ("Nothing was changed"), and an empty state explaining routines, with a "Create a routine" action.

**Routine form (new and edit):**
- Fields: title, description, `IconPicker`, `ColorPicker`, `TimeOfDayPicker` (new 4-segment control).
- Habits: `HabitLinkPicker` to select, plus a new `RoutineHabitOrder` list of the selected habits with ↑/↓/✕ controls.
- Inline validation messages; Save stays disabled while saving; on failure the form stays open with an error.
- Edit mode adds "Delete routine" with a `confirmDestructive` dialog: "Your habits and their progress are not affected." Deleting a routine removes only the routine.

**Routine detail:**
- Header: back, icon, title, time chip, description, and **Edit**.
- Progress card: `ProgressRing` with `done/total` and a short message ("Nothing due today", "All done", and so on).
- Ordered due habits, each rendered with **`HabitCard`** using `daily.record`, `!daily.canEdit` and the daily handlers. Tick, Count and Checklist all work as they do on Today.
- Collapsed "Not scheduled today (n)" section with dimmed rows (§4.2).
- Notices:
  - "1 habit was deleted and will be removed from this routine next time you save it."
  - The daily load and save notices. These are extracted from Today into `components/today/progress-notices.tsx` and shared.
- Edge states:
  - routine not found ("This routine no longer exists" + back)
  - routines or habits loading or failed
  - empty routine ("Add habits" opens edit)

### 5.4 Daily Planning on Today (D3)
- A **"Today's plan"** section sits between the progress card and "Today's Habits". It is shown **only if at least one routine has habits due today**, so Today is unchanged for users without routines.
  - Compact rows: icon, title, time chip, `done/total` and a mini bar. "Now" chip per §4.5, checkmark when complete.
  - Section meta: "2 of 3 routines done · Manage".
  - Footnotes: "+2 habits not in a routine" (when > 0) and "Evening Routine has nothing due today" (when relevant).
- The flat "Today's Habits" list and the progress ring are **unchanged**: same habits, same counts. The plan is a navigation and overview layer, not a second list.
- Tapping a row calls `openRoutine(id)`, which pushes `/routine/[id]` on the root stack, over Today. Back returns to Today (§5.2). "Manage" calls `openRoutineList()`.
- If routines fail to load, Today shows a single muted line "Couldn't load routines · Retry". Habits are unaffected.

### 5.5 Visual identity
Use the existing tokens only: `Palette.surface` cards, `Radius.lg`, 12px uppercase labels, the violet accent for "Now" and complete states, the routine colour at `22` alpha for icon tiles, `BottomTabInset` padding, 48px minimum touch targets and plain-text buttons (no icon-font dependency, as on the Habits screen). No new fonts, images or libraries.

## 6. Edge cases

### 6.1 Deleted habits
- Stale IDs are ignored in members, counts and the plan, and dropped the next time that routine is saved. This is the same lazy rule as Goals: no write across two stores, and no new failure mode in `deleteHabit`.
- The habit delete dialog in `habits/[id].tsx` adds "It's in 2 routines and will be removed from them; the routines are kept."
- A routine whose habits were all deleted becomes `empty`. It is kept, not auto-deleted.

### 6.2 Habit edits
- Schedule, name, colour and tracking changes show up live, because routines read `useHabits()`.
- A tracking-type change resets today's entry through the existing `normalizeTodayRecord`. This is unchanged.

### 6.3 Concurrency
- Every routine mutation re-reads the latest saved list inside the queue.
- Editing a routine that was deleted meanwhile throws "This routine no longer exists". The form shows the error and offers back.
- When saving a form, `habitIds` are filtered against the current habits, which drops any habit deleted while the form was open.

### 6.4 AsyncStorage failures
- **Load fails**: error state with retry in the routine screens, and the muted line on Today. No writes happen.
- **Save fails**: the caller gets the error and state is unchanged (save-first), so the UI never shows an unsaved routine. A reorder failure leaves the order as it was, with a toast-style inline error.
- **Progress saves** use the existing retrying queue. The detail screen shows the same "Saving…/Saved/Retry" notices as Today.

### 6.5 Empty data
| Case | Behaviour |
| --- | --- |
| No habits | The form shows `HabitLinkPicker` with routine-specific empty text and a "Create a habit" action. A routine can still be saved empty. |
| No routines | Today is unchanged. The Habits screen card invites the user to create one. |

## 7. Files

**Moved (content unchanged unless listed under Modified)**
- `src/app/{index.tsx, settings.tsx, habits/, goals/, insights/}` → `src/app/(tabs)/…`

**New**
- `src/app/(tabs)/_layout.tsx`: renders `AppTabs` (the five tabs, trigger names unchanged)
- `src/app/(tabs)/habits/routines.tsx`: routine list
- `src/app/routine/[id].tsx`, `src/app/routine/new.tsx`, `src/app/routine/edit/[id].tsx`
- `src/data/routine-storage.ts`: types, strict parser, `loadRoutines`/`saveRoutines`, `createRoutineId`
- `src/data/list-store.ts`: save-first serialized store (C6)
- `src/hooks/use-routines.tsx`: `RoutinesProvider` and `useRoutines()`, providing `createRoutine`, `updateRoutine`, `deleteRoutine` and `moveRoutine`
- `src/hooks/use-time-of-day.ts`
- `src/utils/routine-progress.ts`: `routineDay`, `planForDay`, `timeOfDayBucket`, `sortByTimeOfDay`, `routinesContaining`, labels
- `src/utils/routine-list.ts`: pure add, update, delete and move
- `src/utils/routine-validation.ts`
- `src/utils/routine-navigation.ts`: back and dismiss decisions, testable
- `src/components/routines/`: `routine-form.tsx`, `routine-card.tsx`, `routine-badges.tsx`, `routine-habit-order.tsx`, `time-of-day-picker.tsx`, `todays-plan.tsx`, `routines-entry-card.tsx`
- `src/components/today/progress-notices.tsx` (extracted from Today)
- `tests/*.test.mjs` (6 files) and `tests/support/` (resolver hook, AsyncStorage mock, fixtures)

**Modified**
- `src/app/_layout.tsx`: root `Stack` (tabs plus routine screens) with anchor `(tabs)`, and `<RoutinesProvider>`
- `src/app/(tabs)/habits/_layout.tsx`: registers `routines`, anchor `index`
- `src/app/(tabs)/habits/index.tsx`: Routines entry card
- `src/app/(tabs)/habits/[id].tsx`: delete confirmation mentions routines
- `src/app/(tabs)/index.tsx`: Today's plan section and the extracted notices. The ring, counts and habit list are unchanged.
- `src/components/app-tabs.web.tsx`: `HOME_HREF` (C4)
- `src/components/goals/habit-link-picker.tsx`: optional `emptyText` prop (Goals default unchanged)
- `src/utils/navigation.ts`: routine helpers, `HOME_HREF`, updated path comments
- `package.json`: `"test"` script only (no dependencies)

**Unchanged (on purpose)**
`completion-storage.ts`, `habit-storage.ts`, `goal-storage.ts`, `save-queue.ts`, `use-daily-progress.tsx`, `use-habits.tsx`, `use-goals.tsx`, `habit-progress.ts`, `schedule.ts`, `goal-progress.ts`, `insights.ts`, `use-insights.ts`, `habit-card.tsx`, `app-tabs.tsx` (native), `app.json`.

## 8. Technical risks

| Risk | Mitigation |
| --- | --- |
| Opening a routine from Today leaves an odd back stack | **Resolved by C1.** Routine screens are on the root stack, so the Habits stack is never touched from Today. Covered by `tests/routine-navigation.test.mjs` and the Navigation steps in §10. |
| Moving the tabs into `(tabs)` breaks an existing route | Groups don't change URLs, and trigger names are unchanged. Typecheck runs against the regenerated typed routes. Covered by the Regression steps in §10. |
| Typed-routes Windows bug for nested index routes | `ROUTINES_HREF` cast, same as the existing hrefs |
| `useCurrentDate` hours are stale within a day | Separate `useTimeOfDay` hook |
| A second progress writer, or routine-level progress, sneaks in | The detail screen only calls `useDailyProgress()` handlers. Review check: no `saveDay`/`loadDay` import outside the provider. |
| Tracking a habit that isn't due today creates Insights warnings | Not-due habits are rendered without controls |
| Corrupt or future routine data overwritten | Strict parser, and no writes before a successful load |
| Reorder spam causing out-of-order writes | Serialized commit queue, with buttons disabled while a move saves |
| React Compiler and ref/queue patterns | Copy the proven `use-goals.tsx` structure verbatim |
| Today gets cluttered | The plan is hidden without due routines, rows are compact, and the habit list is unchanged |

## 9. Implementation order (done)
1. Storage, validation and progress utils (pure), then a `tsc` check.
2. `RoutinesProvider` and the root layout.
3. Navigation helpers, the Habits stack registration, and the list, new and edit screens.
4. The detail screen, reusing `HabitCard` and the extracted notices.
5. Today's plan section.
6. Habit delete dialog text.
7. `npx expo lint`, `npx tsc --noEmit`, `npx expo-doctor`, then Android testing.

## 10. Testing

### 10.1 Automated (isolated, deterministic) — `npm test`
No device clock and no phone date changes. Dates are fixed `Date` objects, and storage is an in-memory mock with failure injection.

| File | Covers |
| --- | --- |
| `routine-storage.test.mjs` | Own versioned key. Missing key → `[]` with no write. Round-trip. Saving touches **only** `momentum:routines:v1` (habits, goals and both check-in formats are byte-identical afterwards). Strict rejection of 7 corrupt or future shapes, with corrupt data left in place. Read failure. |
| `list-store.test.mjs` | No writes before load or after a failed load. A change appears only after it's saved. A failed save rejects and keeps the old list. Serialized order. Unchanged list → no write. A stale load can't win. |
| `routine-list.test.mjs` | Add, update, delete and move (edges → no write), limits, trimming, validation, stale-ID cleanup on save |
| `routine-progress.test.mjs` | States. Deleted IDs ignored. Not-due habits. Count and Checklist as one unit. **Shared habit in two routines:** one entry, done in both, Today's ring counts it once, and a second tap toggles the same entry. Plan ordering, "Now", rest and empty routines hidden, time never hides anything. **Midnight rollover.** Bucket boundaries 00:00 / 04:59 / 05:00 / 11:59 / 12:00 / 17:59 / 18:00 / 23:59. |
| `routine-navigation.test.mjs` | A model of the root stack plus tab stacks. Today → routine → header back **and** hardware back → Today. The Habits stack is untouched. Habits › Routines → routine → back → list. Edit → cancel. Delete → `dismissAll` to the originating tab. Deep-link fallback. |
| `progress-save-queue.test.mjs` | The existing progress writer: "Saved" only after the write is on disk. A failure reports `error`, keeps the record and retries. Rapid taps coalesce. A save pending at midnight goes to its own date. |

### 10.2 Android manual checklist (Expo Go). Do **not** change the phone's date or time.

**Regression (route move)**
1. Upgrade over your existing data: Today, Habits, Goals and Insights look and count exactly as before. All five tabs switch normally, and tapping the active tab pops to its root.
2. Habits → edit a habit → back. Goals → edit → back. Insights → habit history → back → "Edit habit" → back. All behave as before; Edit habit from Insights now returns to the Habits list (C3).

**Routine CRUD**

3. Habits → **Routines** card → "+ New" → "Morning Routine", Morning, icon and colour, 3 habits → reorder them with ↑/↓ → Create. It appears in the list. Kill and reopen the app: it's still there in the same order.
4. Open it → Edit → change the title, description and time, remove one habit, add another → Save. The detail screen shows the changes, and they persist after a restart.
5. Create a second routine → Reorder → ↑/↓ several times quickly → Done. The order persists after a restart.
6. Validation: an empty title shows an error, and the title can't exceed 40 characters (counter). "+ New" is disabled at 20 routines (optional).
7. Delete a routine from Edit → confirm. You land back where you started (list or Today). Habits, today's progress, Goals and Insights are unchanged.

**Tracking through a routine**

8. In a routine, tick a Tick habit. Go back to Today: the card is ticked and the ring updated. Goals shows the "today" count updated, and Insights shows it.
9. Count `+`/`−` (including going past the target) and Checklist steps (including optional ones) behave exactly as on Today.
10. Put the **same habit in two routines**. Complete it in routine A: routine B shows it done too, and Today's ring and Goals and Insights count it once. Un-tick it in B: it's un-ticked everywhere.
11. While tapping, the section header shows "Saving…" and then "Saved".

**Navigation (requirement 4)**

12. Today → Today's plan row → routine → **header back** → Today.
13. Today → Today's plan row → routine → **Android hardware back** → Today. Then open the Habits tab: it shows the normal Habits list, not a stale routine.
14. Habits → Routines → routine → header back → Routines list. Repeat with hardware back. Back again → Habits list.
15. Routine → Edit → hardware back → routine detail → hardware back → origin.
16. Today's plan "Manage" → Habits › Routines → back → Habits list.

**Planning and schedules**

17. A routine containing a habit that isn't scheduled today: detail shows "Not scheduled today (n)" with dimmed rows and no controls.
18. A routine with nothing due today isn't in Today's plan; its name appears in the footnote. An empty routine never appears on Today. With no routines, Today looks exactly as before.
19. "+N habits due today not in a routine" matches reality.
20. "Now" highlight, without touching the clock: a Morning routine shows **Now** before noon, an Afternoon routine 12:00–18:00, an Evening routine after 18:00. Leave the app open (or background it) across a boundary if convenient: the chip moves within about 30 s or on resume. Bucket logic is covered by the automated tests.

**Edge cases**

21. Delete a habit that is in a routine: the dialog mentions routines, the routine detail shows the "was deleted" note, the note disappears after Edit → Save, and the routine itself is kept.
22. Delete every habit in a routine: the routine shows "No habits in this routine" with "Add habits".
23. Change a habit's schedule or tracking type: the routine detail reflects it immediately.
24. Airplane mode doesn't affect AsyncStorage, so to see the save-error path, rely on `progress-save-queue.test.mjs`. On the device, check that progress taps in a routine survive kill + relaunch.
25. Midnight: optional. If you happen to have the app open at 00:00, the routine detail switches to the new day (briefly loading) without losing the last tap. Otherwise rely on the automated rollover test.
26. Long title or description, 20 habits: no overflow, smooth scrolling, buttons at least 44 px. TalkBack reads plan rows, ↑/↓ buttons and the time picker.

## 11. Decisions (approved; D1 changed, see C1)

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Where routines live | Approved as A. **Changed to C during implementation** (see C1): the list stays in the Habits tab, and the detail and forms are on the root stack. The five tabs are unchanged. |
| D2 | Habits not due today in a routine | Show dimmed, without tracking controls |
| D3 | Daily Planning scope | A compact "Today's plan" section, shown only when routines have due habits. Today's list and ring are unchanged. |
| D4 | Deleted habit IDs | Lazy cleanup on the next routine save, same as Goals. No cross-store writes on habit delete. |
| D5 | Reordering | ↑/↓ buttons; no drag-and-drop library |
| D6 | Routine history and streaks | Out of scope. Routine progress is live and for today only. |
| D7 | Time of day | Affects ordering and the "Now" highlight only. Never hides or locks anything. |
