# Notifications & Reminders: Implementation Plan

Milestone: optional local reminders for individual habits and for routines. Users control them in Settings and in the habit and routine editors. No backend, no push server, no login, no cloud sync.

**Status: approved (D1–D9 plus adjustments A1–A13) and implemented. Uncommitted. Awaiting Android testing in Expo Go.** Production-like behaviour is **unverified** until it has been tested on an Android development build (§12).

Baseline: commit `af2f7a9`. Expo SDK 58, React Native 0.88.1, Expo Router (typed routes, React Compiler), NativeTabs (5 tabs, unchanged), AsyncStorage.

Sources: the SDK 58 notifications reference (`docs.expo.dev/versions/v58.0.0/sdk/notifications/`), `push-notifications/what-you-need-to-know`, and `docs.expo.dev/llms.txt`. The installed `expo-notifications` type definitions were checked for every API used.

---

## 0. Approved adjustments and what changed during implementation

| # | Adjustment / change | Where |
| --- | --- | --- |
| A1 | Local habit and routine reminders. They use the existing schedules and stable IDs, live in **separate reminder storage**, and the OS schedule is derived from that storage and only read back for comparison. Existing data is preserved. | `data/reminder-storage.ts`, `utils/reminder-plan.ts` |
| A2 | Repeating DAILY/WEEKLY triggers. Foreground reminders are suppressed when the habit, or every routine habit due today, is already complete. Partial progress still shows the reminder. The UI states plainly that **background reminders may still arrive after completion**. | `utils/reminder-presentation.ts`, `notifications/scheduler.ts`, Settings › How reminders work, editor hint |
| A3 | Overlaps (a habit reminder plus a reminder for a routine containing that habit): both stay on. A prominent card appears in Settings, with **amber** styling when the times match, plus one-tap "Turn off habit reminder" / "Turn off routine reminder" buttons. The editors show an inline overlap notice with "Turn off this habit's/routine's reminder". **Settings are never changed automatically.** | `findOverlaps`, `OverlapCard`, `ReminderField` |
| A4 | **Tap navigation uses the real routes.** The request said routines live at `/habits/routines/[id]`, but the code shows otherwise: `/habits/routines` is only the **list** (`src/app/(tabs)/habits/routines.tsx`). The routine **detail** screen is the root-stack route `/routine/[id]` (`src/app/routine/[id].tsx`, opened by `openRoutine()` in `utils/navigation.ts`). Taps use that existing helper. A habit opens `/` (Today). A deleted or missing routine opens Today. Each delivered notification is handled once (a `request.identifier@date` key plus `clearLastNotificationResponse()`). A routine that's already open isn't pushed again. The handler waits for habits and routines to load. | `notifications/tap-handler.tsx` |
| A5 | Save-first. The habit or routine is saved first and the reminder after it. If the reminder save fails, the editor closes (re-saving would create a **duplicate** habit or routine) and an alert says **"Habit saved, reminder not saved"** with recovery steps. Only an actual change is written. | `hooks/use-reminder-draft.ts`, `reportReminderOutcome` |
| A6 | `npx expo install expo-notifications` selected **`~58.1.8`**. The plan's earlier `58.0.11` figure was wrong, as anticipated. No version is hardcoded anywhere else. | `package.json` |
| A7 | Permission is contextual and optional, and **never requested on launch**. The app handles undetermined, denied, blocked (`canAskAgain: false`), disabled channels, scheduling failures with automatic retries, and permission changes made while the app was in the background. | `use-reminders.tsx`, `permission-notice.tsx` |
| A8 | Reconciliation touches only `momentum.h.*` / `momentum.r.*` identifiers, so even the app's own `momentum.test.*` is left alone. It is idempotent (no duplicates). Existing schedules are preserved when any source store fails to load. Cancel and schedule failures are tested, and so are retries. | `notifications/reconcile.ts`, `tests/reminder-reconcile.test.mjs` |
| A9 | Five tabs and the dark UI are kept. The main controls are in Settings and simple controls in the editors. The only new dependency is `expo-notifications`. | — |
| A10 | Deterministic isolated tests. They never touch the phone's clock or user data and use fixed dates, a fake scheduler and the in-memory AsyncStorage mock. | `tests/reminder-*.test.mjs` |
| A11 | Expo Go first. Development-build steps are documented in §3. **No build has been started**, and no Expo account is needed until you approve one. | §3 |
| C1 | **Time-zone handling, simplified.** The device's zone name and current UTC offset are part of every reminder's **signature**. Any zone or offset change (travel, DST) therefore shows up as a changed signature and reschedules everything through the normal diff, **even across app restarts**. No extra storage key or in-memory tracking is needed. | `reminderSignature(r, zone)` |
| C2 | The Expo Go warning is confirmed in the installed source. `expo-notifications` logs *"functionality is not fully supported in Expo Go"* on import. Local scheduling still works. | expected console warning |
| C4 | **Fixed an Android permission bug.** Settings said "not allowed yet" even though Expo Go's notifications were ON. In `expo-notifications` 58.x, Android 13+ returns `status: 'undetermined'` **only** while `areNotificationsEnabled()` is true; it means Expo's permission layer (Expo Go's per-project records) hasn't recorded a grant. This now maps to the new deliverable state **`system-allowed`**. A raw `android.importance` of 0 means the app's notifications are off. API failures map to a new **`error`** state ("Couldn't check", with **Check again**), never "not allowed". Reconcile **skips** on `error` instead of cancelling. Channels are created quietly on mount and before any request. The dialog is only requested when Android can still show it; blocked offers **Open settings**. Test-notification errors are shown in the UI. Temporary `__DEV__`-only diagnostics (a console log and a Settings card showing the raw status, granted, canAskAgain, importance and channel importance, with no user data) are to be removed after verification. | `notifications/permission-check.ts`, `toPermissionState`, `tests/reminder-permission-check.test.mjs` |
| C3 | The sync runner keeps its own "latest input". The React Compiler lint rejected reading refs inside the runner, and this design also guarantees that follow-up runs never use stale data. | `createSyncRunner<I>` |

---

## 1. Ground rules (as implemented)

1. **Reminders are derived, never authoritative.** The OS schedule is always rebuilt from habits, routines and reminder settings.
2. **One new key, `momentum:reminders:v1`.** No existing key is read differently, rewritten or migrated. No field was added to `Habit` or `Routine`. A test asserts that saving reminders writes only this key.
3. **Scheduling never writes app data.** A failure becomes a warning plus an automatic retry (5 s → 30 s → 2 min → 10 min) and a retry on the next foreground.
4. **Never schedule from a partial picture.** If habits, routines or reminder settings are loading or failed to load, reconcile makes **zero** OS calls.
5. **Only owned identifiers are touched.** The app never calls `cancelAllScheduledNotificationsAsync`.
6. **Orphans.** Settings for deleted habits or routines are ignored by the planner, and pruned on the next reminder save **only** when the full habit and routine lists are known.

---

## 2. Data model

```ts
// momentum:reminders:v1
{ version: 1,
  enabled: boolean,                                   // master switch; item settings kept when off
  habits:   { [habitId]:   { enabled, time: {hour, minute}, updatedAt } },
  routines: { [routineId]: { enabled, time: {hour, minute}, updatedAt } } }
```

- A missing key gives defaults (`enabled: true`, empty maps), and nothing is written.
- The parser is strict. Bad JSON or shape, a future version, an out-of-range time or wrong types → **throw**. Settings then shows an error with Retry, and the stored value is never overwritten.
- Writes are save-first and serialized through `data/value-store.ts`, the single-value twin of `list-store.ts`.
- Default times: habit **9:00**. Routine by time of day: morning **7:30**, afternoon **13:00**, evening **20:00**, anytime **9:00**.

---

## 3. Expo Go versus development build (Android)

| Capability | Expo Go | Development build |
| --- | --- | --- |
| Local DAILY / WEEKLY / TIME_INTERVAL scheduling, cancel, list, tap response | ✅ | ✅ |
| Channels | Created under **Expo Go's** system settings | Under **MOMENTUM** |
| Permission | **Expo Go's** permission, shared across projects | MOMENTUM's own |
| Notification name and icon | Expo Go's | MOMENTUM and the plugin's `icon` / `color` (in `app.json`) |
| Tap from a killed app | Opens Expo Go first, then the project. **May be flaky.** | Opens MOMENTUM |
| Restore after reboot | Through Expo Go's manifest **(unverified)** | `RECEIVE_BOOT_COMPLETED`, added by the library |
| Exact alarms / push | ❌ Not used | Not used |

**Not yet verified, and needs a development build:** MOMENTUM branding and icon, channels and permission listed under MOMENTUM, cold-start tap, reboot persistence, and OEM battery behaviour for the real app package.

### Development build steps (do not run without approval)
1. `npx expo install expo-dev-client`
2. `npx eas-cli@latest login` (this needs an Expo account)
3. `npx eas-cli@latest build:configure`. This creates `eas.json`. Check that the `development` profile has `"developmentClient": true, "distribution": "internal"`.
4. `npx eas-cli@latest build --profile development --platform android`. This is a **remote** cloud build that produces an installable APK link.
   - *Local alternative:* `npx expo run:android`. It needs the Android SDK and JDK and generates `android/`. Never edit that folder by hand.
5. Install the APK. Then run `npx expo start --dev-client` and open the project from the dev client.
6. Repeat the ★ items in §12.

---

## 4. Scheduling strategy

- **Habit reminders:**
  - daily schedule → **1 DAILY** (`momentum.h.<id>.d`)
  - weekday schedule → **one WEEKLY per due day** (`.w1`–`.w7`)
  - never on days the habit isn't due
  - all seven days selected → collapses to one DAILY
- **Routine reminders:**
  - due weekdays are the **union** of the due days of its *existing* habits
  - **1 DAILY** if the same habits are due every day; otherwise one WEEKLY per due day, each with that day's count ("3 habits due today")
  - no due days → nothing scheduled
- **Weekday conversion:** app 0 = Sunday … 6 = Saturday → expo `weekday` 1 = Sunday … 7 = Saturday. This is tested.
- **Signature:** a hash of identifier, channel, trigger, title, body, content version and **time-zone signature**. A rename, time change, schedule change, tracking change or zone/offset change reschedules exactly the affected items.
- **Reconcile:**
  1. list the OS schedule
  2. keep only owned identifiers
  3. diff against the plan
  4. cancel what's stale or changed, then schedule what's missing or changed

  If cancelling a changed item fails, **that item is not rescheduled in the same run**, so a failure can't leave two copies. A listing failure means no changes at all.
- **Permission not granted, or master switch off** → all owned reminders are cancelled. Settings are untouched, and everything is rescheduled once permission is granted again.
- **Cap:** 150 on Android (the per-app alarm limit is about 500 and is shared in Expo Go) and 64 on iOS. Routines get priority, then habits in list order. Anything omitted is reported in Settings.
- **When sync runs:**
  - after any change to habits, routines, reminder settings or permission (debounced 400 ms)
  - on app launch, once all three stores are ready
  - on every return to the foreground (throttled to 30 s)
  - on "Retry now"
  - on automatic retry after failures

  The runner is single-flight: requests made during a run collapse into one follow-up run that uses the latest input.

---

## 5. Permissions

- **Never on launch.** The system dialog is shown only when the user turns on a reminder, turns the master switch on, or taps "Allow notifications".
- Channels are created before the request, because Android 13+ shows no dialog until a channel exists.
- States:
  - `undetermined` / `denied` → can ask (**Allow notifications**)
  - `blocked` (`canAskAgain: false`) → **Open settings** (`Linking.openSettings()`)
  - `granted` with a channel set to importance `NONE` → "Habit reminders are turned off in system settings" + **Open settings**
- Turning a reminder on without permission keeps it **off** and explains why. If permission is revoked later, the enabled settings are **kept** and the UI shows the problem. They work again once permission is restored.

## 6. Android channels

`habit-reminders` ("Habit reminders") and `routine-reminders` ("Routine reminders"), both `HIGH` importance with vibration. After creation, the app can only change their name and description. The user owns importance and sound from then on, and changing those values in code would need new channel IDs.

## 7. Reliability limitations (also explained in the app)

- **Timing:** `delivery: 'bestEffort'` (`setExactAndAllowWhileIdle`). Reminders may be a few minutes late, especially in Doze or on battery saver. Exact alarms aren't used: Android 14+ denies them by default, Google Play policy restricts them, and `alarmClock` shows an alarm icon.
- **OEM battery managers** (Samsung, Xiaomi and others) may block background delivery or restore after reboot for apps that aren't used often. The app re-syncs on every launch and foreground, and the help text explains battery settings.
- **Force stop** removes alarms. Opening the app reschedules them.
- **Time zones and DST:** triggers are wall-clock times. A zone or offset change reschedules everything the next time the app is open. **Until then, at most the already-armed occurrence may be off (unverified)**. Times between 1 and 3 AM show a note that they may shift on DST change days.
- **Background reminders can't check completion.** They may arrive after the habit is done. Only foreground reminders are suppressed.
- **Expo Go** uses its own identity, permission and channels, and shares the alarm budget with other projects.

## 8. UI

- **Settings › Reminders** (replaces the placeholder):
  - permission status dot and notice
  - "All reminders" master switch
  - sync status ("Up to date · N scheduled notifications", or an amber failure line with **Retry now**)
  - a cap warning when the limit is reached
  - the **overlap card**
  - **Routines** and **Habits** lists, each row with a switch, a time pill and an inline time picker with **Save time** / Cancel
  - **How reminders work**: the completion caveat, a "Reminders late or missing?" disclosure and an Expo Go note
  - **Send a test notification** (about 5 s)
  - on web: "available in the Android and iOS app"
- **Habit and routine editors:** a "Reminder" field with a switch, the time picker, the due-day summary from the **live draft** (schedule or habits), an overlap notice with a one-tap disable, a master-switch-paused note and a permission notice.
- **Time picker:** dependency-free. Hour and 5-minute steppers plus Morning, Noon, Evening and Night presets. 12 h or 24 h from the device locale, falling back to 24 h.

## 9. Files

**New**

| File | Purpose |
| --- | --- |
| `src/data/reminder-storage.ts` | Types, strict parser, load/save, `withItemReminder`, `pruneOrphans` |
| `src/data/value-store.ts` | Save-first single-value store |
| `src/utils/reminder-time.ts` | Time type, defaults, steppers, formatting, DST hint |
| `src/utils/reminder-plan.ts` | **Pure** planner, identifiers, signatures, diff, overlaps |
| `src/utils/reminder-presentation.ts` | **Pure** foreground suppression, tap target, permission mapping, zone signature |
| `src/notifications/reconcile.ts` | **Pure** reconcile and single-flight retrying runner |
| `src/notifications/scheduler.ts` | The only `expo-notifications` user: channels, permission, schedule/list/cancel, test notification, foreground handler |
| `src/notifications/tap-handler.tsx` | Tap navigation |
| `src/hooks/use-reminders.tsx` | `RemindersProvider` |
| `src/hooks/use-reminder-draft.ts` | Editor draft and the save-after-item flow |
| `src/components/reminders/time-picker.tsx` | Time picker |
| `src/components/reminders/reminder-field.tsx` | Editor reminder field |
| `src/components/reminders/editor-reminders.tsx` | Editor sections and partial-success notice |
| `src/components/reminders/reminder-item-row.tsx` | Settings list row |
| `src/components/reminders/permission-notice.tsx` | Permission notice |
| `src/utils/alert.ts` | `showNotice` |
| `tests/reminder-plan.test.mjs`, `tests/reminder-reconcile.test.mjs`, `tests/reminder-storage.test.mjs`, `tests/reminder-presentation.test.mjs` | Tests |

**Edited**

| File | Change |
| --- | --- |
| `src/app/_layout.tsx` | `RemindersProvider` |
| `src/app/(tabs)/_layout.tsx` | Tap handler |
| `src/app/(tabs)/settings.tsx` | Reminders screen |
| `src/app/(tabs)/habits/new.tsx`, `src/app/(tabs)/habits/[id].tsx` | Reminder field and save-after-item |
| `src/app/routine/new.tsx`, `src/app/routine/edit/[id].tsx` | Reminder field and save-after-item |
| `src/components/habits/habit-form.tsx`, `src/components/routines/routine-form.tsx` | Optional `renderReminder` prop |
| `app.json` | `expo-notifications` plugin: icon `android-icon-monochrome.png`, colour `#8B7CF6`. Takes effect in dev and production builds only. |
| `package.json`, `package-lock.json` | `expo-notifications ~58.1.8` |

**Not touched:** habit, routine, goal and completion storage, `list-store.ts`, `save-queue.ts`, and all check-in, goal and insights logic.

## 10. Automated checks

| Check | Result |
| --- | --- |
| `npm test` | 166 tests, 0 failures. 66 existing + 100 new. |
| `npx tsc --noEmit` | Exit 0 |
| `npx expo lint` | Exit 0 |
| `npx expo-doctor` | 20/20 checks passed |
| `npx expo export --platform android` | Bundles (output to a temporary folder) |
| `npx expo export --platform web` | Bundles (output to a temporary folder) |

What the new tests cover:
- weekday conversion
- habit and routine planning, including union, collapse, per-day counts and deleted IDs
- the master switch and the cap
- signatures (name, time, tracking, zone/offset)
- the diff, including foreign IDs and the test ID
- overlaps that never mutate settings
- reconcile: not-ready, checking, unsupported, every non-granted permission state, master off, deletion, listing failure, schedule failure, stale-cancel failure, changed-cancel failure (no duplicate) followed by retry, a failed schedule then retry, zone change, and the cap
- runner: coalescing, backoff and reset, skipped runs not retried, a throwing run, dispose
- storage: defaults with no write, round-trip, writes only its own key, 8 corrupt variants, read failure, pruning rules, save-first store behaviour
- foreground suppression with partial count and checklist progress, routine partial vs complete, not-due habits, unloaded progress, stale IDs
- tap targets, permission mapping, time formatting and steppers

## 11. Decisions (approved)

D1 repeating DAILY/WEEKLY · D2 foreground suppression, background always delivered · D3 two `HIGH` channels · D4 no exact alarms · D5 overlaps allowed and explained · D6 Settings plus editor rows · D7 permission requested on first enable · D8 Expo Go first, then a dev build · D9 dependency-free time picker.

---

## 12. Android testing instructions

**Rules:** don't change the phone's date, time or time zone, and don't clear app data. Every test below uses near-future times.

### Setup
1. On the PC, run `npx expo start`. Open the project in **Expo Go** on the Android phone and pull to reload.
2. A yellow log line, *"expo-notifications functionality is not fully supported in Expo Go"*, is expected.

### A. Existing data is preserved (do first)
1. Before reloading, note the number of habits, goals and routines, and today's check-ins.
2. After reloading, all of them are identical. Insights history and streaks are unchanged.

### B. No prompt on launch
1. Fully close Expo Go and reopen the project. **No** permission dialog appears.
2. Open **Settings**. The Reminders card shows a status dot. If Expo Go never had notification permission it says "not allowed yet"; if it did, it says "allowed".

### C. Permission flows
1. In Settings, turn on a habit's switch. The system dialog appears if Expo Go hasn't been asked yet. Choose **Allow** → the switch turns on and shows the time pill.
2. To test denial without resetting data: go to Android Settings › Apps › Expo Go › Notifications and turn them off. Return to the app → the status changes to blocked or not allowed, the notice offers **Open settings**, and the sync line disappears. Your switches stay on.
3. Turn notifications back on for Expo Go and return → the status changes to allowed, and the sync line shows "Up to date · N scheduled notifications".
4. In Android Settings › Apps › Expo Go › Notifications, turn off only the **Habit reminders** category. This category appears after the first reminder or test. Return → the app says "Habit reminders are turned off in system settings". Turn it back on.

### D. Test notification
1. Settings › **Send a test notification**, then lock the phone → a notification arrives in about 5 s.
2. Repeat with the app open → a banner appears. The test notification is never suppressed.

### E. Habit reminder delivery (no clock changes)
1. Pick a habit that's **due today**. Turn on its reminder in Settings, tap the time pill and set it **2–3 minutes from now**, then tap **Save time**.
2. Press Home and lock the phone → the reminder arrives with the habit's name and body text, possibly a few minutes late.
3. Tap it → MOMENTUM opens on **Today**.

### F. Foreground suppression and partial progress
1. Set a **Count** habit's reminder for about 2 minutes from now. Log some progress but **not** the full target, and keep the app open → a banner **does** appear.
2. Complete the habit fully. Set its reminder about 2 minutes later again and keep the app open → **no** banner.
3. Repeat with the app in the background → it **does** arrive. This is expected and explained in the app.

### G. Routine reminder and navigation
1. Pick a routine with a habit due today. Turn its reminder on and set it about 2 minutes ahead.
2. Background the app → the reminder arrives ("N habits due today"). Tap it → the **routine detail screen** opens. Back returns to the previous tab.
3. With that routine's screen already open, let the next routine reminder arrive and tap it → the screen isn't stacked twice.
4. Delete a test routine **after** its reminder fires but before you tap the notification. Tap → Today opens with no crash.

### H. Overlaps
1. Turn on a reminder for a habit **and** for a routine that contains it, both at the **same time** → Settings shows an amber "Double reminders at the same time" card.
2. Open the habit editor → it shows an overlap notice with "Turn off this habit's reminder".
3. Tap **Turn off routine reminder** in the card → only the routine's switch turns off. Nothing else changes.

### I. Editing and deleting
1. Edit a habit that has a reminder and change its schedule from Every day to Mon/Wed/Fri → its reminder subtitle shows Mon · Wed · Fri.
2. Rename the habit → the next notification uses the new name.
3. Create a **new** habit with Reminder on, set 2 minutes ahead, and tap **Create** → the habit is saved and the reminder fires.
4. Delete a habit that has a reminder → it no longer fires, and routines containing it update their days and counts.
5. Turn **All reminders** off → nothing fires and the item switches are kept but dimmed. Turn it back on → everything is restored.

### J. Rapid changes (no duplicates)
1. Toggle one reminder on and off about 10 times quickly, ending on **on** → exactly one notification arrives at the set time.
2. Background and foreground the app 5 times → the "N scheduled notifications" count stays the same.

### K. Lifecycle
1. Set a reminder about 3 minutes ahead and **swipe the app away** from Recents → it still fires.
2. Optional, Expo Go: **reboot** the phone without opening the app → a reminder set 3–5 minutes after the reboot fires. This is **unverified** in Expo Go, so record the result.

### L. Regression
Check Today, Habits (Tick, Count, Checklist), Goals, Insights, Routines and Today's plan. They behave exactly as before.

### ★ Development build only (after approval)
Repeat B–E, G and K on the dev build. Also confirm:
- the notification shows **MOMENTUM** with the monochrome icon and violet tint
- the channels appear under MOMENTUM in system settings
- tapping from a **killed** app opens the right screen
- reminders survive a **reboot**
