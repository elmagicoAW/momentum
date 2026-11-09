# Habit Management — Implementation Plan

Milestone: let users create, edit and delete habits, choose weekdays, save habits locally with AsyncStorage, and show only today's scheduled habits on the Today screen, without losing existing completion data.

Constraints: Expo SDK 58, Expo Router, AsyncStorage only (no backend, login, AI or sync), no new dependencies, Expo Go compatible, existing dark design and five-tab navigation unchanged.

---

## 1. Files

### New

| File | Purpose |
| --- | --- |
| `src/data/habit-storage.ts` | `Habit` types, load and save, unique ID generation, one-time migration and seeding |
| `src/data/habit-options.ts` | Curated icon list (key → SF Symbol / Material Symbol) and accent colors |
| `src/utils/schedule.ts` | `isScheduledOn(habit, date)` and schedule labels ("Every day", "Mon · Wed · Fri") |
| `src/utils/habit-validation.ts` | Pure form validation |
| `src/hooks/use-habits.tsx` | `HabitsProvider` + `useHabits()`: load status, `createHabit`, `updateHabit`, `deleteHabit` |
| `src/app/habits/_layout.tsx` | Stack navigator inside the Habits tab |
| `src/app/habits/index.tsx` | Habit list and empty state |
| `src/app/habits/new.tsx` | Create screen (sheet) |
| `src/app/habits/[id].tsx` | Edit screen (sheet) with Delete |
| `src/components/habits/habit-row.tsx` | List row |
| `src/components/habits/habit-form.tsx` | Shared create/edit form |
| `src/components/habits/icon-picker.tsx` | Icon grid |
| `src/components/habits/color-picker.tsx` | Accent color swatches |
| `src/components/habits/weekday-picker.tsx` | Daily toggle + S M T W T F S chips |
| `src/components/habits/empty-state.tsx` | Empty state with "Create your first habit" |

### Modified

| File | Change |
| --- | --- |
| `src/app/habits.tsx` | Removed and replaced by the `src/app/habits/` folder. The route name `habits` stays the same, so the tab keeps working. |
| `src/app/_layout.tsx` | Wrap the app in `HabitsProvider` |
| `src/app/index.tsx` | Use stored habits filtered to today, count progress against them, add loading and empty states |
| `src/components/today/habit-card.tsx` | Use the new `Habit` type and icon/color mapping; show the description or schedule instead of the hard-coded streak |
| `src/data/demo-habits.ts` | Keep the quotes and user name; the demo habits are only used for the one-time migration |

### Unchanged

- `src/data/completion-storage.ts` and `src/hooks/use-daily-completions.ts` stay as they are. A read-only helper to check whether any completion keys exist may be added to `completion-storage.ts`.
- `src/components/app-tabs.tsx`, `src/components/today/progress-ring.tsx`, `src/constants/theme.ts`.

---

## 2. Data model and AsyncStorage

```ts
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday … 6 = Saturday (JS getDay())

type HabitSchedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: Weekday[] }; // at least one day, sorted, no duplicates

type Habit = {
  id: string;            // generated once, never changed or reused
  name: string;          // trimmed, 1–40 chars
  description?: string;  // trimmed, up to 120 chars, omitted when empty
  icon: HabitIconKey;    // short name like 'water', 'book', 'run'
  color: string;         // one of the accent colors in habit-options.ts
  schedule: HabitSchedule;
  createdAt: string;     // ISO timestamp, used for sort order
};
```

- **Habits key:** `momentum:habits:v1` → `{ "version": 1, "habits": Habit[] }`. The version field allows later migrations.
- **Completion keys (unchanged):** `momentum:completions:v1:YYYY-MM-DD` → `["habitId", ...]`, one key per local calendar date.
- **IDs:** `h_<timestamp base36>_<random base36>`, checked against existing IDs before use. No new dependency needed.
- **Icons:** the stored value is a short key that `habit-options.ts` maps to platform symbols, so saved data doesn't depend on symbol names.
- **Validation on load:** each saved habit is checked against the expected shape. If the stored value doesn't parse or doesn't match, the load fails instead of guessing.
- **Writes:** queued in order, like `useDailyCompletions`, so quick edits land in sequence.

---

## 3. Preserving the four demo habits and their completions

Existing completions refer to the IDs `water`, `read`, `exercise` and `meditate`. The migration keeps those exact IDs.

On load:

1. **Habits key exists:** use it as is, even if it's an empty list. No reseeding, so deleted habits never come back.
2. **Habits key missing and at least one `momentum:completions:v1:*` key exists (existing user):** save the four demo habits with their original IDs, names, icons and colors as daily habits. Their old detail text becomes the description. All saved completions stay linked.
3. **Habits key missing and no completion keys (new install):** save an empty list and show the empty state.
4. **Read fails or the data is corrupt:** show an error and write nothing, so the saved data is never overwritten. Habit editing is disabled until a load succeeds.

Completion data itself is never rewritten, renamed or migrated.

---

## 4. Scheduling and the Today screen

- `isScheduledOn(habit, date)` returns true for `daily`, or when `days` includes `date.getDay()`. This uses the device's local date, the same as `toLocalDateKey`.
- Today screen:
  - `todayHabits = habits.filter(h => isScheduledOn(h, now))`, sorted by `createdAt`.
  - The progress ring and "X of Y" count only `todayHabits` that are completed. Completions for unscheduled or deleted habits are ignored, as they are now.
  - `useCurrentDate` already updates at midnight and when the app returns to the foreground, so the scheduled list rolls over with the date.
  - States: loading; "No habits yet" with a link to the Habits tab; "Nothing scheduled today" when habits exist but none are due; and the existing storage error notices.
- Toggling stays in `useDailyCompletions`, unchanged.

---

## 5. Editing and deleting safely

- **Create and edit** share `habit-form.tsx`:
  - The name is required, trimmed, and 1–40 characters. The description is up to 120 characters. A weekday schedule needs at least one day.
  - Errors appear under each field, and Save stays disabled while the form is invalid or a save is in progress.
  - Editing keeps the habit's `id` and `createdAt`, so completions stay linked when the name, icon, color or schedule changes.
- **Delete:** a button on the edit screen opens `Alert.alert` with "Cancel" and a destructive "Delete", warning that the habit will disappear from Today. Past completion records are left in storage. They're ignored because they no longer match a habit, and since IDs are never reused they can't attach to a new habit.
- **Save safety:** no habit write happens before a successful load. A failed save shows a message and keeps the form open.
- **Missing habit:** opening `/habits/[id]` for an ID that no longer exists shows a "Habit not found" message with a way back.
- **Layout:** `KeyboardAvoidingView` plus a `ScrollView` with `keyboardShouldPersistTaps="handled"`, safe-area insets, and bottom padding so content clears the tab bar. Before coding I'll check the SDK 58 docs for keyboard handling with edge-to-edge, a Stack nested inside `NativeTabs`, and sheet presentation.

---

## 6. Testing

### Automatic checks

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

### Android manual tests (Expo Go)

**Upgrade and migration**

1. On the current build, check off two demo habits today.
2. Load the new build. The same two habits are still checked and the ring shows 2 of 4.
3. Restart the app. Nothing has changed, and no duplicate habits appear.

**Create**

4. Create a daily habit. It appears on Habits and on Today.
5. Create a weekday habit that includes today. It appears on Today.
6. Create a weekday habit that excludes today. It appears on Habits but not on Today.

**Validation**

7. An empty name, a whitespace-only name, or a name over 40 characters can't be saved.
8. A weekday schedule with no days selected can't be saved.

**Edit**

9. Change a completed habit's name, icon and color. It stays checked on Today.
10. Change a habit's schedule so it excludes today. It leaves Today and the ring total updates.

**Delete**

11. Cancel a delete. Nothing changes.
12. Confirm a delete. The habit is gone from both screens and the counts update.
13. Delete every habit and restart the app. The empty states show and the demo habits don't come back.

**Android UI**

14. With the keyboard open on the description field, the field stays visible, the form scrolls, and Save works.
15. Content clears the status bar, the gesture bar and the tab bar.
16. The back gesture or button closes the form without saving.
17. All five tabs still switch correctly.

**Date rollover**

18. Change the device date, or leave the app open past midnight. Today shows the new day's scheduled habits with fresh completions, and the previous day's completions are still saved.

---

## Open decisions (defaults if not specified)

- **Streaks:** remove the hard-coded 🔥 numbers for now; add real streaks from completion history in a later milestone.
- **Unit tests:** no Jest for now. Optionally add `jest-expo` later to test `schedule.ts`, `habit-validation.ts` and the migration logic.
