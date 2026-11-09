# Profile & Personalization + Settings Hub: Implementation Plan

Milestone: replace the hardcoded "Alex" with a name the user chooses and saves on the device, add a simple avatar, and rebuild the Settings tab as an organized dark settings hub.

**Status: approved (D1–D8 plus the adjustments below) and implemented. Uncommitted, awaiting Android testing.** §0 lists what changed during implementation. Where a later section disagrees with §0, §0 wins.

---

## 0. Approved adjustments and implementation changes

| # | Change | Why |
| --- | --- | --- |
| C1 | **Unsaved-changes protection works on two layers.** (a) `usePreventRemove(dirty, …)` from `expo-router`. I confirmed it is exported in `expo-router@58.0.30` (`build/exports.d.ts`) and read the SDK 58 doc "Prevent screen removal". It blocks Android hardware back, Android gesture back, the iOS swipe and any other navigation that would remove the screen, then asks "Discard changes?". The callback's `repeat()` turns prevention off (`disablePrevention()`) and then replays the blocked action. (b) The visible **Cancel** button checks `dirty` itself and asks first. This is the fallback: it works even where removal prevention can't intercept. Intentional exits (Save succeeded, unchanged form, discard confirmed) set `leaving` and call `disablePrevention()` before navigating, so the user is never asked twice. A ref guard allows only one dialog at a time. | Approval item 3. Back interception uses the documented API, and the Cancel button doesn't depend on it. `predictiveBackGestureEnabled: false` in `app.json` means Android gesture back goes through the JS back handler, so (a) catches it. |
| C2 | **What counts as "dirty":** the normalized name, the avatar kind, and the icon/color only while Icon is selected. Edits that only add whitespace, or changing a hidden icon while Initials is selected, don't trigger the prompt. | Avoids prompts when nothing would actually be saved differently. |
| C3 | **The first-run prompt never comes back.** `namePrompt` only moves forward: `pending` → `dismissed` / `completed`. Saving with a name → `completed`. Saving without a name while the prompt is pending → `dismissed`, because the user has seen and answered it. Clearing a name later keeps `completed`. "Not now" is saved first, and the card hides only after the write succeeds. | Approval item 2. Covered by tests. |
| C4 | **Name limit:** the input has `maxLength` 30 (UTF-16 units) and the counter shows the same units, so the counter and the limit always agree. Storage validates at most 30 **code points**. That rule is always met by input from the field, but it also rejects bad stored data. Names made mostly of emoji therefore reach the limit sooner. | One clear limit in the UI, strict check in storage. |
| C5 | **`saveProfile` re-parses the value before writing.** It refuses (and writes nothing) if the strict parser would reject it on the next load. | The app can't write anything it would later refuse to read. |
| C6 | **Privacy wording (approval item 4):** "Your habits, goals, routines, check-ins and profile are stored locally on this device. Momentum has no account and no in-app cloud sync." A second row says: "Whether app data is included in your phone's own backups depends on your device and its settings." The text makes no promise about OS or device backups. | Approval item 4. |
| C7 | **Settings rows as built:** Appearance → Theme "Dark" (info). Language → App language "English" (info) and More languages (*Coming later*). Data & Backup → Storage "This device", Your data "N habits · N goals · N routines" ("…" while loading, "—" if a list failed to load), Export & backup (*Coming later*). Privacy → two text rows. About → Momentum "Personal growth" and Version (from `Constants.expoConfig.version`; the row is hidden if that is unavailable). Only the profile card can be tapped. | Approval item 5. |
| C8 | `closeProfileEditor()` falls back to **Settings** (the plan said Today) when nothing is underneath, e.g. after a deep link. It reuses `leaveRoutineScreen` (back if possible, otherwise replace). | Settings is the editor's home. |
| C9 | `ProfileProvider` is the **outermost** data provider and doesn't depend on the others. The Today header greets with a name only when `status === 'ready'`. | The profile can never delay or block habits. |
| C10 | `placeholder-screen.tsx` is kept even though nothing uses it any more. | Lint doesn't flag it, and deleting it is outside this milestone's scope. |
| C11 | Notifications: none. `feature/notifications-wip` was not touched, `expo-notifications` was not installed, and `package.json` is unchanged. | Approval item 7. |

Baseline: `main` @ `af2f7a9`. Expo SDK 58 (`expo ~58.0.23`), Expo Router (typed routes, React Compiler on), NativeTabs, AsyncStorage only.
Out of scope: notifications and reminders. The `feature/notifications-wip` branch stays untouched, and `expo-notifications` is not installed. The plan adds no dependencies, accounts, backend or cloud sync.

**Ground rules**
1. The plan adds **one new storage key**, `momentum:profile:v1`. No existing key is read differently, rewritten, migrated or deleted.
2. The profile is **never required**. Habits, goals, routines, Today progress and Insights all work whether the profile is missing, loading or broken.
3. Changes are **saved first**: the UI shows a new name or avatar only after the write succeeds.
4. **No fake controls.** A row is tappable only if tapping it does something real.

---

## 1. What exists today (inspected)

| Area | Current state | What it means for this milestone |
| --- | --- | --- |
| Today header | `(tabs)/index.tsx` shows `getGreeting(now)`, `DEMO_USER_NAME` and a 48 px avatar circle with `DEMO_USER_NAME.charAt(0)`. | This is the only place that uses `DEMO_USER_NAME`. It switches to the profile, and the constant is deleted. |
| `demo-habits.ts` | Holds `DEMO_USER_NAME = 'Alex'`, `LEGACY_DEMO_HABITS` (migration-critical IDs) and the motivation quotes. | Only `DEMO_USER_NAME` is removed. `LEGACY_DEMO_HABITS` must stay unchanged. |
| Settings tab | `(tabs)/settings.tsx` is a `PlaceholderScreen` ("Coming soon"). It is a single file, not a stack. | Fully replaced by the hub. The route `/settings` and the trigger name `settings` stay the same. |
| Navigation | Root Stack → `(tabs)` (five NativeTabs) plus root-level `routine/*` screens pushed over the tabs (ROUTINES_PLAN C1). `utils/navigation.ts` holds `*_HREF` casts to work around a Windows typed-routes bug. | The profile editor becomes a root-stack route too, so Back returns to whichever tab opened it (Today or Settings). |
| Providers | `_layout.tsx` nests Habits → DailyProgress → Goals → Routines. Each provider exposes `status: 'loading' \| 'ready' \| 'load-error'` and `reload()`. | `ProfileProvider` follows the same contract. It is independent of the other providers and placed outermost. |
| Persistence pattern | Strict parsers (`version` check, unknown → throw), a save-first serialized `commit`, and no writes before a successful load. `data/list-store.ts` is the tested pure version of this for lists. | The profile is a single object, not a list, so it gets a small `value-store.ts` with the same rules and its own tests. `list-store.ts` is not changed. |
| Forms | `habit-form.tsx` / `goal-form.tsx` use a header with ✕ / title / pill button, an inline `failure` banner (`accessibilityRole="alert"`), `KeyboardAvoidingView behavior="padding"`, `keyboardShouldPersistTaps="handled"` and a `revealInput` scroll for Android. | The profile editor copies this layout exactly, so the new screens look and behave like the existing forms. |
| Icons and colors | `HABIT_ICONS` (16 keys, platform symbols), `HABIT_COLORS` (9 accents), `IconPicker`, `ColorPicker`, `habitIconSymbol()` with a safe fallback. | The avatar icons reuse these keys, colors and pickers. No new assets. |
| Tokens | `Palette` (violet `#8B7CF6`, blue `#5B8DEF`, surfaces `#12121A` / `#1A1A25`, border `#24243A`), `Radius`, `Spacing`, `BottomTabInset`, `MaxContentWidth`. The app is dark-only (`userInterfaceStyle: "dark"`). | All new UI uses only these tokens. No new colors except reusing `success` and `danger`. |
| App metadata | `expo-constants` is already installed and gives the app version (`1.0.0` from `app.json`). | The About section shows the real version. No new package. |
| Tests | `node:test` with the `@/` resolver hook and the AsyncStorage mock (`tests/support`). Runs with `npm test`. | New storage, store and validation tests go here. |

---

## 2. Data model

```ts
// src/data/profile-storage.ts
export type ProfileAvatar =
  | { kind: 'initials' }                         // derived from displayName; default
  | { kind: 'icon'; icon: string; color: string }; // HABIT_ICONS key + HABIT_COLORS value

export type NamePrompt = 'pending' | 'dismissed' | 'completed';

export type Profile = {
  /** Trimmed, inner whitespace collapsed, 1–30 characters (counted by code point). Omitted = no name. */
  displayName?: string;
  avatar: ProfileAvatar;
  /** First-run name card on Today. 'pending' = show it (only while there's no name). */
  namePrompt: NamePrompt;
  /** ISO timestamps; set on first save. */
  createdAt: string;
  updatedAt: string;
};

export type ProfileInput = Pick<Profile, 'displayName' | 'avatar'>;
```

**Storage:** `momentum:profile:v1` → `{ version: 1, profile: Profile }`, written with one `setItem`.

| Situation | Result |
| --- | --- |
| Key missing (new install **or** existing user upgrading) | `DEFAULT_PROFILE` is returned in memory: no name, `{kind:'initials'}`, `namePrompt:'pending'`. **Nothing is written** until the user saves or dismisses the prompt. |
| Valid v1 | Parsed and returned. |
| Invalid JSON, wrong shape, `version !== 1` (e.g. data from a newer app version), name too long or containing control characters, unknown `avatar.kind`, unknown `namePrompt` | **Throws.** The provider enters `load-error`, **all writes are blocked**, and the stored value is never replaced. |
| `avatar.icon` is not in `HABIT_ICONS` / `avatar.color` is a well-formed hex not in the list | Accepted and rendered with the fallback icon and color, same as habits do. It is not rewritten. |

**Validation** (`src/utils/profile-validation.ts`, pure and tested):
- `normalizeName(raw)`: trim, collapse whitespace runs to one space, remove control characters. An empty result means "no name" and is allowed (this is how a user clears their name).
- `validateProfileDraft(draft)` returns an error if the name is longer than 30 code points, or if `kind:'icon'` has a missing icon or color.
- `initialsFor(name)`: up to 2 characters from the first and last word, taken with `Array.from` so emoji and accented letters are never split, and uppercased per locale. It returns `null` when there is no name, and the avatar then shows a neutral person symbol.
- The same parser rules are used on load and on save, so the app cannot write anything it would later refuse to read.

**Store** (`src/data/value-store.ts`, pure with no React, a sibling of `list-store.ts`):
- `load()`: only the latest load can apply its result. `loaded` is set to false while a load is in progress.
- `commit(change)`: queued, refuses to run before a successful load, computes the new value from the last **saved** value, saves it, then commits and calls `onChange`. A failed write rejects the caller's promise, leaves the in-memory value unchanged, and does not block later writes.

**Provider** (`src/hooks/use-profile.tsx`):
```ts
type ProfileContextValue = {
  profile: Profile;            // DEFAULT_PROFILE while loading or on error (display only)
  status: 'loading' | 'ready' | 'load-error';
  reload: () => void;
  updateProfile: (input: ProfileInput) => Promise<void>; // sets namePrompt 'completed' when a name is saved
  dismissNamePrompt: () => Promise<void>;                 // 'pending' → 'dismissed'
};
```

---

## 3. UX design

### 3.1 Today header (item 1)
- **Ready, with name:** "Good morning,\n**Maya**" with the avatar (initials or icon) on the right.
- **Ready, no name, loading, or load error:** "Good morning." on one line with a neutral avatar. The app **never shows "Alex"** and never flashes a placeholder name while loading.
- The avatar becomes a button ("Profile, edit") that opens the profile editor. It has a 48 px hit area plus `hitSlop`.
- `Text` for the name uses `numberOfLines={2}` so long names wrap and never push the avatar off screen.

### 3.2 First-run name setup (item 2): non-blocking
There is no gate, redirect or modal on launch. Instead, a compact **"Make Momentum yours"** card appears on Today **below the progress card**, so habits stay in view. It only appears when **all** of these are true:
`status === 'ready'` && no `displayName` && `namePrompt === 'pending'`.
- **Add your name** opens the profile editor.
- **Not now** calls `dismissNamePrompt()`, which saves first, so the card hides only after the write succeeds. If the write fails, an inline error is shown and the card stays.
- Existing users see the card once, and their data is untouched. On load error the card is never shown, so the app never prompts over profile data it couldn't read.
- Settings › Profile is always available to set the name later.

### 3.3 Profile editor (item 3): `src/app/profile/edit.tsx`
This is a root-stack screen (`slide_from_bottom`), with the same layout as the habit and goal forms:
- Header: ✕ Cancel · "Profile" · **Save** pill (spinner while saving, locked while busy).
- **Live preview card:** a large avatar (72 px) plus the exact greeting Today will show (e.g. "Good evening, Maya"), or "Good evening." when no name is entered.
- **Display name** field: `maxLength` 30, counter "12/30", `autoCapitalize="words"`, `autoComplete="name"`, `textContentType="name"`, `returnKeyType="done"`, `accessibilityLabel="Display name"`, and helper text "Shown on Today. Stays on this device." A "Clear" text button appears when the field is not empty.
- **Avatar** segmented choice: *Initials* / *Icon* (`radiogroup`). *Icon* reveals the existing `IconPicker` + `ColorPicker`. If the user picks Initials without a name, the preview shows the neutral person symbol and a hint: "Add a name to show initials."
- **Errors:** validation messages appear under the field after the first Save attempt. A save failure shows the `alert` banner "Couldn't save your profile. Your changes are still here — try again."
- **Unsaved changes:** Cancel or Android hardware back on a changed form asks "Discard changes?" through `confirmDestructive`. *(The exact Expo Router v58 API for intercepting back, such as `usePreventRemove`, will be checked against the versioned docs before implementation; see D6.)*
- **Load error:** the editor shows an `EmptyState` ("Couldn't load your profile. Your saved data hasn't been changed.") with a **Try again** button, and no form, so a broken profile can't be overwritten.

### 3.4 Settings hub (items 4–5): `src/app/(tabs)/settings.tsx`
One calm screen of grouped cards (like iOS and Material settings, in Momentum's dark style). It never lists habits or reminders. The screen has a large "Settings" title, `SafeAreaView edges={['top']}`, a ScrollView with `paddingBottom: BottomTabInset + Spacing.four`, and content limited to `MaxContentWidth`.

| Section | Rows | Type |
| --- | --- | --- |
| **Profile** (hero card) | Avatar, display name (or "Add your name"), and the subtitle "Edit name and avatar" with a chevron | **Link** → `/profile/edit` |
| **Appearance** | Theme: "Dark" | **Info** (true value, not tappable). Footnote: "Momentum is designed for dark mode." |
| **Language** | App language: "English" | **Info**. "More languages later" is shown as a muted *Coming later* badge. |
| **Data & Backup** | Storage: "On this device"; Your data: "N habits · N goals · N routines" (live counts from providers; "—" while loading or on error); Export & backup | Info · Info · **Coming later** (disabled, no chevron, `accessibilityState.disabled`) |
| **Privacy** | Two short paragraphs: local storage with no account and no in-app cloud sync, and that device backups depend on the device (exact wording in §0 C6) | **Text only** |
| **About** | Version "1.0.0" (from `expo-constants`) · "Momentum — build momentum, one habit at a time." | Info |

Rules applied:
- Destructive or unbuilt actions (reset, delete all data, export, theme picker, language picker, reminders) are **omitted** or appear only as the muted *Coming later* badge. None look tappable.
- A profile load error appears **inside the Profile card** ("Couldn't load profile" plus a **Try again** button). The rest of Settings still renders.

**Components** (`src/components/settings/`):
- `settings-section.tsx`: an uppercase muted label plus a `surface` card with hairline dividers.
- `settings-row.tsx`: variants `link` | `info` | `soon`. Only `link` is a `Pressable` (`accessibilityRole="button"`, chevron, `android_ripple`, min height 56). `info` and `soon` are plain `View`s with a merged `accessibilityLabel` such as "Theme, Dark" or "Export and backup, coming later".
- `profile-avatar.tsx`: a shared avatar (sizes 48 / 56 / 72) used by Today, Settings and the editor, so all three always match.
- `profile-summary-card.tsx`: the Settings hero card.
- `name-prompt-card.tsx`: the Today first-run card.

---

## 4. Accessibility, keyboard, safe area, states (item 9)

- **Screen reader:** headers use `accessibilityRole="header"`. The avatar button is labeled "Profile: Maya. Edit profile" (or "Set up profile"). The avatar pickers keep their `radio` roles. Errors use `accessibilityRole="alert"` and `accessibilityLiveRegion="polite"`. The Save button announces `busy`.
- **Touch targets** are at least 48 dp. Text contrast stays on `text` / `textSecondary`. `textMuted` is used only for decorative labels and *Coming later* badges, and those badges always come with readable text. Font scaling is not disabled, and rows grow in height rather than truncating.
- **Android keyboard:** `KeyboardAvoidingView behavior="padding"`, `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`, and the `revealInput` pattern from `habit-form.tsx` keep the name field visible. Pressing Done submits nothing and only dismisses the keyboard.
- **Safe area:** editor `edges={['top','left','right']}`, tabs `edges={['top']}`, bottom padding `BottomTabInset`.
- **States:** loading (no name shown, skeleton-free), ready, load error (retry, writes blocked), save error (inline, input kept), empty (no name → neutral avatar plus prompt).

---

## 5. Files

**New**
| File | Purpose |
| --- | --- |
| `src/data/profile-storage.ts` | Types, `DEFAULT_PROFILE`, strict `parseProfileStore` (exported for tests), `loadProfile`, `saveProfile`, key `momentum:profile:v1` |
| `src/data/value-store.ts` | Pure save-first, serialized single-value store |
| `src/utils/profile-validation.ts` | `normalizeName`, `validateProfileDraft`, `initialsFor`, `PROFILE_NAME_MAX_LENGTH = 30` |
| `src/hooks/use-profile.tsx` | `ProfileProvider` / `useProfile` |
| `src/app/profile/edit.tsx` | Profile editor (root-stack route) |
| `src/components/profile/profile-avatar.tsx`, `profile-form.tsx`, `name-prompt-card.tsx` | Shared avatar, editor body (incl. `usePreventRemove`), Today card |
| `src/components/settings/settings-section.tsx`, `settings-row.tsx`, `profile-summary-card.tsx` | Hub building blocks |
| `tests/profile-storage.test.mjs`, `tests/value-store.test.mjs`, `tests/profile-validation.test.mjs` | Isolated tests |

**Changed**
| File | Change |
| --- | --- |
| `src/app/_layout.tsx` | Wrap the tree in `<ProfileProvider>` (outermost). Add `<Stack.Screen name="profile/edit" options={{ animation: 'slide_from_bottom' }} />` |
| `src/app/(tabs)/index.tsx` | Header uses `useProfile()` + `ProfileAvatar`. Add `NamePromptCard`. Remove the `DEMO_USER_NAME` import |
| `src/app/(tabs)/settings.tsx` | Replace the placeholder with the hub |
| `src/data/demo-habits.ts` | Delete only `DEMO_USER_NAME` |
| `src/utils/navigation.ts` | `openProfileEditor()` and `closeProfileEditor()` (back, fallback `HOME_HREF`), with the typed-route cast |
| `tests/support/fixtures.mjs` | `profile()` fixture |

**Unchanged on purpose:** every habit, goal, routine and check-in storage module and its key, `list-store.ts`, `save-queue.ts`, `app-tabs.tsx` (the five tabs), Insights, `app.json`, `package.json`. `placeholder-screen.tsx` stays in place but is no longer used. It will be deleted only if lint flags it.

---

## 6. Tests (isolated, `npm test`)

- **Storage:** missing key → default with no write · round-trip · `version: 2` throws and nothing is written · invalid JSON or shape throws · name over 30 characters or with control characters throws · unknown `avatar.kind` or `namePrompt` throws · unknown icon key accepted · saving the profile never touches `momentum:habits:v2`, `goals:v1`, `routines:v1`, `checkins:*` or backup keys.
- **Value store:** no commit before load · save failure keeps the old value and rejects · writes run in order · a later write builds on the earlier saved value · a superseded load can't apply.
- **Validation:** whitespace collapse · empty → no name · code-point length (emoji counted as one) · initials for "maya", "Maya Lin", "  jean-luc  picard ", "Émile", "🙂 Sam", "" → null.
- Then `npx expo lint`, `npx tsc --noEmit` and `npx expo-doctor`.

---

## 7. Implementation order

1. `profile-validation.ts` + `profile-storage.ts` + `value-store.ts`, with their tests (green before any UI work).
2. `use-profile.tsx`, then add the provider to the root layout.
3. `ProfileAvatar` → Today header (remove "Alex") → `NamePromptCard`.
4. Profile editor route plus navigation helpers.
5. Settings components → Settings hub.
6. Check the Expo SDK 58 docs for every API touched (`expo-constants` version field, Stack screen options, back interception, `KeyboardAvoidingView`), as required by AGENTS.md.
7. Lint, typecheck, `npm test`, expo-doctor, then the Android checklist (§9).

---

## 8. Decisions to approve

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | First-run setup style | **Non-blocking card on Today** that can be dismissed, rather than a launch modal or onboarding route. It never blocks access to data. |
| D2 | Behaviour when no name is set | **"Good morning." with a neutral avatar**, no placeholder name. |
| D3 | Name limit | **30 code points**, whitespace collapsed, can be cleared. |
| D4 | Avatar choices | **Initials (default) or one of the 16 existing habit icons in one of the 9 accent colors.** No photo, so there's no permission or image-picker dependency. |
| D5 | Editor location | **Root-stack `/profile/edit`**, reachable from Today's avatar or prompt and from Settings, with Back returning to the tab that opened it (same pattern as routines). Settings stays a single file, not a stack. |
| D6 | Unsaved changes | **Ask before discarding** on Cancel or hardware back, using the back-interception API confirmed in the v58 docs. If it's not available on NativeTabs + Stack, fall back to confirming on Cancel only. |
| D7 | Future sections | Appearance and Language show **true read-only values**. Export and Backup and more languages show a muted **"Coming later"** badge. Reset, delete and reminders are **omitted**. |
| D8 | Data counts in Data & Backup | **Show** live, read-only habit, goal and routine counts. |

---

## 9. Android test checklist (Expo Go, Android)

**Upgrade safety (run first, on a device that already has data)**
- [ ] After updating, all habits, goals, routines, today's progress and Insights history are unchanged. Five tabs, same order and icons.
- [ ] Today shows "Good morning." (no "Alex") and the "Make Momentum yours" card below the progress ring. The habit list is still fully usable.
- [ ] "Not now" hides the card, and after killing and relaunching the app the card stays hidden.

**Name and avatar**
- [ ] Add a name from the card → Save → back on Today: the greeting and initials update. Relaunch: still there.
- [ ] Edit from Settings › Profile → Back returns to Settings (header ✕ and hardware back both work). Edit from the Today avatar → returns to Today.
- [ ] 30-character name: the counter stops at 30, the name wraps on Today, and the avatar is not pushed off screen. Spaces only → saved as no name. An emoji name shows correct initials.
- [ ] Switch to Icon avatar, pick an icon and color: the preview, Settings card and Today avatar all match. Switch back to Initials.
- [ ] Clear the name → Today falls back to "Good morning." and the neutral avatar. The card does **not** reappear.
- [ ] Change something → hardware back → "Discard changes?" appears. Cancel keeps the edits, Discard leaves.

**Keyboard and layout**
- [ ] With the keyboard open on a small screen (or display size set to Large), the name field and its error stay visible, and the Save button stays reachable.
- [ ] Gesture navigation and 3-button navigation: no content hidden under the status bar or tab bar. Settings scrolls fully past the tab bar.
- [ ] Font size at maximum: rows grow, nothing is clipped, and every tappable area is still easy to hit.

**Settings hub**
- [ ] Only the Profile card is tappable. Theme, Language, Storage, counts, Version and *Coming later* rows give no ripple and no navigation.
- [ ] The counts match the Habits, Goals and Routines tabs, and update after creating or deleting a habit.
- [ ] Version shows 1.0.0.

**TalkBack**
- [ ] The Today avatar is announced as "Profile: <name>. Edit profile". The radio options are announced as selected or not selected. Save errors are announced. Coming-later rows are announced as "coming later" or disabled.

**Failure handling** (temporary dev-only corruption of `momentum:profile:v1`, e.g. setting `{"version":2}` with a debug snippet that is not committed)
- [ ] Today still shows the habits, with the neutral greeting and no prompt card. Settings shows "Couldn't load profile" with Try again. The editor shows the error state and no form. Nothing overwrites the stored value.
- [ ] In airplane mode or with storage full, a failed save shows the inline error, keeps the input, and leaves the old name on Today.
