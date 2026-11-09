# Goals — Implementation Plan

Milestone: long-term personal goals linked to existing daily habits, with progress computed only from real saved completions.

Constraints: Expo SDK 58, Expo Router, AsyncStorage only (no backend, login, AI or sync), **no new dependencies**, Expo Go (Android) compatible, existing dark design and five-tab navigation unchanged.

---

## 1. Files

### New

| File | Purpose |
| --- | --- |
| `src/data/goal-storage.ts` | `Goal` types, strict parsing, `loadGoals` / `saveGoals`, `createGoalId` |
| `src/hooks/use-goals.tsx` | `GoalsProvider` + `useGoals()`: status, `reload`, `createGoal`, `updateGoal`, `deleteGoal` (same save-then-commit write queue as `useHabits`) |
| `src/hooks/use-completion-history.ts` | Loads all saved completion days (read-only), reloads whenever the Goals tab gains focus |
| `src/utils/goal-progress.ts` | Pure Habit Consistency calculation (section 3) |
| `src/utils/goal-validation.ts` | Pure form validation and draft → input |
| `src/app/goals/_layout.tsx` | Stack inside the Goals tab (same options as the Habits stack) |
| `src/app/goals/index.tsx` | Goal list: header + “+ New Goal”, filter chips (Active / Completed / All), loading, error and empty states |
| `src/app/goals/new.tsx` | Create screen |
| `src/app/goals/[id].tsx` | Edit screen with Delete (mirrors `habits/[id].tsx`, including the “not found” and in-flight-delete handling) |
| `src/components/goals/goal-card.tsx` | Card: title, status pill, timeline, Habit Consistency bar + provisional today row, linked-habit icon chips, “x of y check-ins” |
| `src/components/goals/goal-form.tsx` | Shared create/edit form: title, description, target date, status, linked habits |
| `src/components/goals/date-picker.tsx` | Dependency-free month calendar grid + quick presets (1 month, 3 months, 6 months, 1 year) |
| `src/components/goals/habit-link-picker.tsx` | Multi-select list of existing habits (icon, name, schedule), with a link to create a habit when none exist |
| `src/components/goals/status-picker.tsx` | Segmented control: Active / Paused / Completed |

`EmptyState`, `confirmDestructive`, `Palette`/`Radius`/`Spacing`, `HABIT_ICONS` and `describeSchedule` are reused as they are.

### Modified

| File | Change |
| --- | --- |
| `src/app/goals.tsx` | Removed, replaced by the `src/app/goals/` folder. Route name `goals` is unchanged; `app-tabs.tsx` needs no edits. |
| `src/components/app-tabs.web.tsx` | Web tab uses `GOALS_HREF` (same Windows typed-routes workaround as `HABITS_HREF`) |
| `src/app/_layout.tsx` | Wrap the app in `GoalsProvider` (inside `HabitsProvider`) |
| `src/data/completion-storage.ts` | Add read-only `loadCompletionHistory()` (section 4). Existing functions unchanged. |
| `src/utils/date.ts` | Add `parseLocalDateKey`, `addDays`, `daysBetween`, `formatShortDate` helpers (local time, no UTC parsing) |
| `src/utils/navigation.ts` | Add `GOALS_HREF` (same Windows typed-routes cast as `HABITS_HREF`) and `closeGoalEditor()` |
| `src/app/habits/[id].tsx` | Delete confirmation mentions linked goals, e.g. “It’s linked to 2 goals; it will be unlinked from them.” |

### Not touched

`habit-storage.ts`, `use-habits.tsx`, `use-daily-completions.ts`, `src/app/index.tsx` (Today), `habit-card.tsx`, `progress-ring.tsx`, `app-tabs.tsx`, `app.json`.

---

## 2. Data model

```ts
type GoalStatus = 'active' | 'paused' | 'completed';

type Goal = {
  id: string;            // `g_<time36>_<rand36>`, generated once, never changed or reused
  title: string;         // trimmed, 1–60 chars
  description?: string;  // trimmed, ≤ 200 chars, omitted when empty
  startDate: string;     // 'YYYY-MM-DD' local; set to the creation day, never edited
  targetDate: string;    // 'YYYY-MM-DD' local; ≥ startDate
  status: GoalStatus;
  completedAt?: string;  // 'YYYY-MM-DD'; set when status becomes 'completed', removed otherwise
  habitIds: string[];    // unique; order = user's selection order; may be empty
  createdAt: string;     // ISO timestamp
  updatedAt: string;     // ISO timestamp
};

type GoalInput = Pick<Goal, 'title' | 'description' | 'targetDate' | 'status' | 'habitIds'>;
```

- **Key:** `momentum:goals:v1` → `{ "version": 1, "goals": Goal[] }`. Separate from habits and completions; no existing key is written.
- **Dates as local `YYYY-MM-DD` strings**, same convention as completion keys, so no time-zone drift.
- **Deleted habits:** a goal may still hold the ID of a habit that was deleted. It is ignored everywhere (display and progress) and dropped the next time that goal is saved. Deleting a habit does **not** write to the goals store, so the two stores never need a cross-key transaction.
- **Validation (form):** title required, ≤ 60; description ≤ 200; target date required, ≥ today when creating (when editing, an already-past date may be kept, but must stay ≥ startDate); unknown habit IDs filtered out. Linking zero habits is allowed — the card then says “Link habits to see how consistently you show up” instead of showing 0%.

---

## 3. Habit Consistency formula (revised after approval)

The percentage is labelled **Habit Consistency**, never "Goal Progress". It measures how consistently the linked habits were checked off on Today since the goal started. It does **not** measure how much of the goal is achieved: achievement is set manually through the goal's status.

```
window       = startDate … endDate
endDate      = min(targetDate, completedAt if status = 'completed')

For each linked habit h that still exists, and each day d in the window
where h is scheduled on d (isScheduledOn, current schedule):
  scheduled += 1
  completed += 1  if h.id is in the saved completions for d

finished     = days in the window before today
consistency  = finished.scheduled > 0 ? finished.completed / finished.scheduled : null
today        = counted separately, shown as "Today · in progress: x of y checked in so far"
```

- **Headline:** e.g. "Habit Consistency 68%", with the bar and "17 of 25 scheduled check-ins completed on past days".
- **Today is provisional:** it's shown in its own row with an "in progress" tag and is never part of the percentage, so habits not done yet today never look like missed commitments. A new goal shows "No completed days yet" until its first full day has passed.
- **Timeline:** shown separately as calendar time, e.g. "Day 12 of 90 · 78 days left", "Target date passed · Mar 1, 2027" or "Completed Feb 20, 2027".
- **Nothing is invented:** only real saved completions count. Completions on unscheduled days, for unlinked or deleted habits, or outside the window are ignored. No streaks.
- `startDate` is the goal's creation day, so check-ins from before the goal existed don't count.
- **Known limitations (in `src/utils/goal-progress.ts` and in the goal editor):** habit schedules aren't versioned. The app only knows each habit's *current* schedule and applies it to every past day, so after a schedule change, past "scheduled" counts may differ from what was actually planned. Days while a goal was paused are still counted.
- Status is never changed automatically.

---

## 4. Data safety

**Goals store** (same rules as habits):
- Strict parsing: an unparseable value, wrong version, invalid entry or duplicate ID makes the load fail with a “Couldn’t load your goals” error + Try again. It never falls back to an empty list over existing data.
- Nothing is written until goals have loaded successfully. New install (key missing) → empty list, nothing written.
- Writes are queued one at a time; each change is computed from the last saved list, saved, and only then shown in the UI. A failed save keeps the form open with an error message and leaves state unchanged.
- IDs are checked against existing IDs before use.

**Completions:** read-only.
- `loadCompletionHistory()` uses `getAllKeys` + `multiGet` on `momentum:completions:v1:*` and returns `Map<dateKey, Set<habitId>>`. It never writes.
- A corrupt day is skipped and reported (“N days of saved check-ins couldn’t be read and may show as not completed”) instead of failing the whole screen or being rewritten.
- If history fails to load entirely, goal cards still render with a “Habit Consistency unavailable” note; goal editing keeps working.
- History is reloaded when the Goals tab gains focus (`useFocusEffect` from `expo-router`), so check-ins made on Today show up immediately. Size is one small key per day used, which is fine for years of data.

**Existing data:** habits, completions, the pre-habits backup key and the Today screen are untouched. The only new key is `momentum:goals:v1`.

---

## 5. UI notes

- Dark premium style matching Habits: fixed header with violet “+ New Goal” pill, 20px gutters, `Palette.surface` cards, `Radius.md`, safe-area and bottom-tab insets.
- Status pill colors: Active = accent violet, Paused = muted, Completed = success green. Consistency bar uses the first linked habit’s color, accent if none.
- List order: active goals by nearest target date, then paused, then completed (most recent first).
- Empty state: “Set your first goal” with a CTA. If the user has no habits yet, the form’s habit picker explains that and offers “Create a habit”.
- Accessibility: buttons ≥ 48px, `accessibilityRole`/`State` on chips and calendar days, progress bar exposes `accessibilityValue`.
- Delete: confirmation via `confirmDestructive` — “Delete “<title>”? Your habits and their history are not affected. This can’t be undone.”

---

## 6. Verification

Before declaring done: `npx expo lint`, `npx tsc --noEmit`, `npx expo-doctor`.

### Android testing (Expo Go)

1. `npx expo start`, open in Expo Go on Android; confirm all five tabs load and Today shows existing habits and today’s check-ins unchanged.
2. **Empty state:** Goals tab shows “Set your first goal”.
3. **Validation:** try saving with empty title, a 61-char title, no target date, a past target date → inline errors, nothing saved.
4. **Create:** goal with description, target date via preset and via calendar, two linked habits → card appears with “No check-ins due yet” or real counts.
5. **Habit Consistency:** check off a linked habit on Today, return to Goals → the “Today · in progress” count increases by one and the percentage (past days only) does not change. Uncheck → decreases. Check a habit that isn’t linked → no change.
6. **Edit:** change title, target date, status to Completed, unlink one habit → card updates; reopen the editor to confirm values persisted.
7. **Delete:** cancel confirmation (button, back gesture, tap outside) → goal kept; confirm → removed.
8. **Persistence:** force-stop Expo Go and reopen → goals, links and status persist; Today’s completions unchanged.
9. **Habit deletion:** delete a linked habit from Habits (dialog mentions the goal) → goal stays, habit no longer shown on its card, Habit Consistency recalculated without it.
10. **No habits:** with all habits deleted, the habit picker shows the “Create a habit” hint and goals can still be saved.
11. **Android back button** closes the goal editor without saving; rotate/keyboard: form scrolls so fields aren’t hidden behind the keyboard.
12. **Storage error (dev only):** temporarily corrupt `momentum:goals:v1` in a dev build → “Couldn’t load your goals” with Try again; existing value not overwritten. Revert the change afterwards.

---

## 7. Housekeeping (needs your OK, not part of the feature)

The repo tracks a stray file named `istent storage"git push` (17 KB of `less` help text, probably from a mistyped commit command). I suggest deleting it in a separate commit.
