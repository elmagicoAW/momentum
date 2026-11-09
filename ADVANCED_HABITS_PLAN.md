# Advanced Habit Tracking — Implementation Plan

Milestone: add three tracking types (Tick, Count, Checklist) without losing any existing habit, completion or goal link.

Baseline: commit `ae5fba7`. Expo SDK 58, Expo Router, AsyncStorage only. No new dependencies, Expo Go compatible, no backend, sync, login or AI.

---

## 1. What exists today (inspected)

| Area | Current state |
| --- | --- |
| Habit store | `momentum:habits:v1` → `{ version: 1, habits: Habit[] }`. Strict parser, throws on anything unexpected. Legacy demo migration plus backup key `momentum:backup:pre-habits-v1`. |
| Completions | One key per local date: `momentum:completions:v1:YYYY-MM-DD` → `string[]` of habit IDs. Strict parser. Unreadable days are reported and never rewritten. |
| Writer | `useDailyCompletions(dateKey)` lives inside the Today screen. It is the only thing that writes completions. Writes are optimistic and queued. |
| History | `loadCompletionHistory()` → `Map<date, Set<habitId>>`, read on focus by the Goals screens. |
| Consistency | `computeHabitConsistency` in `utils/goal-progress.ts` gives one scheduled check-in per linked habit per scheduled day. It is complete when the ID is in that day's set. |
| Goals | Store habit IDs only (`habitIds: string[]`). They don't depend on the shape of a habit. |

Goal links depend only on habit IDs, and IDs never change, so goal storage needs **no migration**.

---

## 2. Data model

### 2.1 Habit definition (store v2)

```ts
type ChecklistStep = {
  id: string;          // e.g. "s_mh9x2k_a1b2", generated once, stable across renames
  label: string;       // trimmed, 1–40 chars
  optional?: true;     // omitted = required
};

type HabitTracking =
  | { type: 'tick' }
  | { type: 'count'; target: number; unit: string }   // target: integer 1–9999; unit: 0–16 chars, may be ""
  | { type: 'checklist'; steps: ChecklistStep[] };     // 1–12 steps, unique IDs, at least one required

type Habit = {
  id: string; name: string; description?: string; icon: string; color: string;
  schedule: HabitSchedule; createdAt: string;
  tracking: HabitTracking;          // NEW, required in v2
};
```

Storage: `momentum:habits:v2` → `{ version: 2, habits: Habit[] }`. Parsing stays strict: an unknown `tracking.type`, an invalid target or duplicate step IDs throws a load error. Nothing is ever silently replaced.

### 2.2 Daily progress record (completions v2)

One key per local date, same as today: `momentum:checkins:v2:YYYY-MM-DD`.

```ts
type DayRecord = { version: 2; entries: Record<string /* habitId */, HabitEntry> };

type HabitEntry =
  | { type: 'tick'; done: true }
  | { type: 'count'; value: number; target: number }            // target = snapshot of the definition
  | { type: 'checklist'; done: string[]; required: string[] };  // step IDs; required = snapshot
```

- No entry means no progress. Unticking, setting a count back to 0 or clearing all steps removes the entry.
- Each entry carries **its own type and a snapshot of the rule it is judged by** (target or required step IDs). This lets past days keep their meaning after later edits (see §5).
- `value` is an integer from 0 to 9999 and may go above `target`, because people drink a 9th glass.
- The parser is strict. An unknown version, unknown entry type or malformed entry makes the day unreadable, and an unreadable day is never overwritten. This is the same policy as v1.

### 2.3 Single completion rule — `utils/habit-progress.ts` (pure)

```ts
isEntryComplete(entry, rule):
  tick      → true
  count     → entry.value >= rule.target
  checklist → rule.required.length > 0 && rule.required.every(id => entry.done.includes(id))

ruleFor(entry, habit, dateKey, todayKey):
  dateKey === todayKey && habit && habit.tracking.type === entry.type
    → rule from the CURRENT habit definition
  otherwise → rule from the entry's own snapshot
```

Every consumer calls `isHabitCompleteOn(record, habit, dateKey, todayKey)`: the Today ring, Today cards, Goal consistency and history. One function means one answer everywhere.

---

## 3. How the types affect progress (no double-counting)

**Every scheduled habit is exactly one unit, complete or not complete.** Partial progress is shown on the habit's own card only.

| Consumer | Rule |
| --- | --- |
| **Today ring and "X of Y habits"** | Y = habits scheduled today, any type. X = those where `isHabitCompleteOn` is true. A Count habit at 5/8 adds 0. A Count habit at 12/8 adds 1. A Checklist with 5 steps adds at most 1, never 5. |
| **Goal Habit Consistency** | Unchanged formula: one scheduled check-in per linked habit per scheduled day, completed = `isHabitCompleteOn`. Finished days use snapshots. Today is still provisional and uses the current definition. A habit linked to two goals counts once in each goal, as it does now. |
| **Completion history** | `loadCompletionHistory()` returns `Map<date, DayRecord>` plus `unreadableDays`. A day is "completed" for a habit only through the shared rule. Unscheduled days, deleted habits and unlinked habits are ignored, as now. |
| **Unscheduled days** | Progress can't be entered for habits not shown on Today. Any stray entries are ignored. |

Optional checklist steps count toward the step display ("3 of 4 steps") but never toward completion.

---

## 4. Migration strategy

Principles: **never modify or delete v1 data**, migrate in small steps that can be retried, write each new key in a single `setItem`, and throw instead of falling back to empty.

### 4.1 Habits: v1 → v2 (eager, on load)

`loadHabits()` resolution order:

1. `momentum:habits:v2` exists → parse strictly and return it.
2. Otherwise `momentum:habits:v1` exists:
   - Parse it with the existing strict v1 parser. If it is corrupt, throw and write nothing.
   - Map every habit to `{ ...habit, tracking: { type: 'tick' } }`. IDs, `createdAt`, schedule and order stay the same.
   - Read the v2 key again just before writing, as the current migration already does. If it now exists, return it instead.
   - `setItem('momentum:habits:v2', …)`. If this fails, throw. The next launch retries from untouched v1.
   - The v1 key is left frozen. It acts as the pre-migration backup. From now on `saveHabits` writes only v2.
3. Otherwise completion keys exist (either prefix) → run the existing legacy demo migration. It writes v2 directly with `tick` tracking and keeps the existing backup step.
4. Otherwise it is a new install → return `[]` and write nothing.

### 4.2 Completions: v1 → v2 (lazy read-through, per day)

There is no bulk migration, so there is no bulk step that can fail halfway.

- **Read day D:** if `checkins:v2:D` exists, use it. Otherwise, if `completions:v1:D` exists, convert it in memory: each ID becomes `{ type: 'tick', done: true }`. Otherwise the day is empty.
- **Write day D:** always write the full record to `checkins:v2:D`. Since the record was loaded with the v1 fallback, v1 progress for that day is carried over. `completions:v1:D` is never written or deleted.
- **History:** list keys with both prefixes. For each date, v2 wins and v1 is the fallback. A corrupt v1 day stays an unreadable day, the same as now.
- v1 days convert to **tick** entries. This is correct because every habit was a tick habit when those days were recorded. If "Drink Water" later becomes a Count habit, its old ticked days stay complete.

Result: existing completions, IDs and goal links work from the first launch without any data being rewritten. Only today's key ever gets a v2 copy, and only after the user interacts.

### 4.3 Rollback

If an older build is installed again, it reads v1 keys, which are intact but frozen at upgrade time. Progress made after the upgrade won't appear in it, but nothing is lost. Upgrading again picks up v2 again. This is accepted and documented, not engineered around.

---

## 5. Editing after progress exists — historical-data policy

**Past days are judged by the rule in force that day (the snapshot). Today is judged by the current definition.** Past records are never rewritten. Only today's record is updated.

| Edit | Past days | Today |
| --- | --- | --- |
| Name, icon, color, description, unit | Not affected (display only) | Not affected |
| Count target 8 → 10 | Still judged against 8 | Value kept, judged against 10 (8/10 is no longer complete) |
| Count target 10 → 6 when value is 7 | Not affected | Becomes complete |
| Add a required step | Not affected | Incomplete until the new step is done |
| Rename a step | Not affected | Progress kept (step ID is stable) |
| Remove a step | Not affected | Its tick is dropped. The habit may become complete. |
| Mark a step optional or required | Not affected | Re-evaluated |
| Change tracking type | Not affected (each entry keeps its own type) | Today's entry for this habit is cleared. If today has progress, the form asks first: "Today's progress for this habit will be reset." |
| Schedule change | Existing known limitation: the current schedule applies to past days (unchanged) | — |
| Delete habit | Records kept and ignored (unchanged) | Hidden |

**Keeping today's snapshot current.** If a definition changes and today's entry still holds the old snapshot, the snapshot would freeze with the old rule at midnight. To prevent that, the daily progress provider (§6) watches `habits`. When today's entry for an edited habit has a stale snapshot or the wrong type, it queues one normalization write for today only: update the target or required steps, drop removed step IDs, or remove the entry if the type changed. If that write fails, the in-memory evaluation is still correct, the save-error notice shows, and the next write retries the whole record.

---

## 6. Architecture changes

**Single writer for daily progress.** `useDailyCompletions` (screen-local) is replaced by a `DailyProgressProvider` mounted in `src/app/_layout.tsx` inside `HabitsProvider`. It owns today's date key (`useCurrentDate`, which handles midnight), today's `DayRecord`, and the write queue. Because it is the only writer of `checkins:v2:<today>`, the edit screen, Today and normalization never race each other.

Provider API:

```ts
status: 'loading' | 'ready' | 'load-error' | 'save-error'
record: DayRecord; dateKey: string
toggleTick(habit) · adjustCount(habit, ±1) · toggleStep(habit, stepId)
hasProgress(habitId): boolean     // used by the edit form's type-change confirmation
```

Safety rules from the current hook carry over:
- Nothing is written until the day has loaded successfully.
- Actions are ignored while loading or after a failed load.
- Each action builds on the ref, so rapid taps stack.
- Each write saves the full record.
- A failed write sets `save-error` and is repaired by the next write.

Rapid +/− taps are coalesced: while a write is in flight, later taps only mark the record dirty, and a single follow-up write saves the latest state.

The Goals screens take today's record from the provider instead of the focus-loaded history, so today's provisional number matches the ring even before a write lands.

---

## 7. Files to change

### New
| File | Purpose |
| --- | --- |
| `src/utils/habit-progress.ts` | Pure functions: `isHabitCompleteOn`, `ruleFor`, entry updaters (`applyTick`, `applyCount`, `applyStep`), `normalizeEntry`, progress labels |
| `src/hooks/use-daily-progress.tsx` | `DailyProgressProvider` and `useDailyProgress()` (replaces `use-daily-completions.ts`) |
| `src/data/save-queue.ts` | (Added during implementation.) Pure serialized, coalescing, retry-until-success save loop used by the provider. Kept separate so it can be tested without React. |
| `src/components/habits/tracking-type-picker.tsx` | Tick / Count / Checklist segmented control |
| `src/components/habits/count-fields.tsx` | Target (number-pad) and unit inputs |
| `src/components/habits/checklist-editor.tsx` | Step rows: label input, optional toggle, remove, "Add step" (max 12) |
| `src/components/today/count-control.tsx` | Large − / value / + controls with a thin progress bar |
| `src/components/today/checklist-steps.tsx` | Expandable step list inside the card |

### Modified
| File | Change |
| --- | --- |
| `src/data/habit-storage.ts` | `HabitTracking` types, v2 key and parser, v1 → v2 migration chain, step ID generator, legacy path writes v2 |
| `src/data/completion-storage.ts` | `DayRecord` types, strict v2 parser, v1 read-through, `loadDay` / `saveDay`, history over both prefixes. `listCompletionKeys` covers both prefixes. |
| `src/hooks/use-completion-history.ts` | New history type |
| `src/utils/goal-progress.ts` | Uses `isHabitCompleteOn` and accepts a live today record. Doc comment updated with the rules from §3 and §5. |
| `src/utils/habit-validation.ts` | Draft gains `trackingType`, `countTarget` (string), `countUnit`, `steps`. Adds validation and `draftToInput`. |
| `src/components/habits/habit-form.tsx` | "Tracking" section after Description. Type-change confirmation in edit mode. |
| `src/app/habits/new.tsx`, `src/app/habits/[id].tsx` | Initial draft from `tracking`. `[id]` passes `hasProgress` for the confirmation. |
| `src/components/habits/habit-row.tsx` | Subtitle such as "8 glasses · Every day" or "4 steps · Weekdays" |
| `src/components/today/habit-card.tsx` | Shared shell. Tick body unchanged. Count and Checklist bodies use the new components. "Done" styling comes from the shared rule. |
| `src/app/index.tsx` | Uses `useDailyProgress`, ring count from the shared rule |
| `src/app/_layout.tsx` | Mounts `DailyProgressProvider` |
| `src/app/goals/index.tsx`, `src/app/goals/[id].tsx` | Pass today's live record into consistency |

### Removed
- `src/hooks/use-daily-completions.ts`, replaced by the provider.

### Unchanged
- `goal-storage.ts`, `use-goals.tsx`, `progress-ring.tsx`, `theme.ts`, `demo-habits.ts`, navigation and tabs.

---

## 8. UI notes (premium dark, Android)

- **Tick card:** identical to today.
- **Count card:** shows "5 / 8 glasses" with a thin bar in the habit color. − and + are 44 dp circular buttons with `hitSlop`. − is disabled at 0. Tapping the card body does nothing, to avoid accidental toggles. Accessibility uses `accessibilityRole="adjustable"` with increment and decrement actions.
- **Checklist card:** header shows "2 of 3 steps". Tapping it expands or collapses the step list, and each step is its own checkbox row. The card switches to "done" styling when the required steps are complete.
- **Form:** the Tracking section uses the existing `Field` component.
  - Count target uses `keyboardType="number-pad"`, stored as a string in the draft, and is validated as an integer from 1 to 9999.
  - Checklist step inputs use `returnKeyType="next"`, and submitting the last one adds a new step.
  - The existing `KeyboardAvoidingView` + `ScrollView keyboardShouldPersistTaps="handled"` setup is kept. Before implementing, check the SDK 58 docs for keyboard and edge-to-edge behavior (per AGENTS.md).
- No new native modules. Everything uses RN core, `expo-symbols` and Reanimated, all already present and in Expo Go.

---

## 9. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Habit migration interrupted | v1 is never touched. The v2 write is a single `setItem`. A failure throws, and the next launch retries. |
| Corrupt v1 or v2 data | Strict parsing leads to load-error UI and no writes. Unreadable history days are skipped and reported. |
| Two writers for one day key | A single `DailyProgressProvider` writes today's key. Past keys are never written. |
| Stale snapshot after an edit | Normalization write (§5). If it fails, the in-memory result is still correct and the next write retries. Worst case, one past day is judged by the rule from before a same-day edit. |
| Write storms from rapid +/− taps | Coalesced writes, full-record saves |
| Rollback to an older build | Older builds read frozen v1 data. No loss, only missing post-upgrade progress (§4.3). |
| Future-version data read by this build | Unknown version or type means unreadable or a load error, never an overwrite |
| Schedule not versioned | Existing documented limitation, out of scope |
| Clock or time-zone changes | Same local-date keys as now. Midnight rollover is handled by `useCurrentDate`. |
| No automated test runner (no deps added) | Migration and completion logic stays in pure functions (`habit-progress.ts`, parsers) so tests can be added later. Manual matrix below. |

**Out of scope:** reordering checklist steps (remove and re-add), editing past days, per-day history UI, streaks, increments other than ±1.

---

## 10. Android testing steps (Expo Go, physical device or emulator)

**Prep: data from an older build**
1. Check out `ae5fba7`, run `npx expo start`, and open it in Expo Go.
2. Create 3 habits (one with weekday scheduling). Tick some today. Link 2 of them to a goal.
3. Set the device date back a few days and tick habits on each day to create v1 history. Note the goal's consistency %. Restore the date.

**Migration**
4. Check out the new branch and reload.
   - All habits appear as Tick with the same names and order.
   - Today's ticks are kept.
   - Goal links and consistency % are identical to step 3.
5. Force-stop the app and reopen it. Nothing changes.

**Count**
6. Create "Water", Count, target 8, unit "glasses".
   - Tap + to 7: ring unchanged.
   - Tap to 8: ring +1, card shows done.
   - Tap to 9: still done, ring unchanged.
   - Tap − to 7: ring −1.
7. Tap + quickly about 15 times, then force-stop immediately. On reopen the last value is shown, or at most one tap is missing.

**Checklist**
8. Create a checklist with 3 steps, one of them optional. Completing both required steps marks the habit done. The optional step doesn't affect completion.

**Persistence and per-date separation**
9. Force-stop and reopen. Count and checklist values are kept.
10. Change the device date to tomorrow. Today shows fresh progress. Change it back and yesterday's values are still there.
11. Leave the app open across midnight (or change the time to 23:59). It rolls to an empty day.

**Editing policy**
12. With Water at 8/8 today, change the target to 10. Today shows 8/10 and is not done. A goal linked to Water still counts past days that were judged against 8.
13. Remove a checklist step that was ticked today. Progress updates and nothing crashes.
14. Convert a ticked Tick habit to Count.
    - A confirmation appears.
    - After confirming, today resets for that habit.
    - Past days still count in goal consistency.

**Goals**
15. Goal detail: today's provisional count matches the ring. The finished-day % equals completed ÷ scheduled under the rules in §3.

**Android UI**
16. In the form, add 8 checklist steps and focus the last one. The input stays above the keyboard and "next" adds a step.
17. In the count target field, the number pad appears and non-numeric input is rejected.
18. Back gesture and back button close the form with no partial save.
19. Safe area: the cards don't sit under the status bar or the gesture nav bar. The tab bar inset is respected.

**Failures**
20. Temporarily make `saveDay` throw (dev only, then revert).
    - The save-error notice shows and the UI stays responsive.
    - Restoring it and making one more tap saves the full state.
21. Temporarily corrupt today's v2 value (dev only).
    - Today shows the load error and doesn't overwrite the value.
    - Goals mark the day unreadable.

**Before declaring done:** `npx expo lint`, `npx tsc --noEmit`, `npx expo-doctor`.
