# MOMENTUM Batch 1 completion report

Date: 15 November 2026. Workspace: `C:\Projects\momentum`.
Branch: `wip/settings-appearance-language`. HEAD remains `038107a`.

Batch 1 is implemented and locally validated. No Batch 2 visual redesign or Batch 3 production packaging was started. The full audit was read before implementation. Its existing untracked report and all other existing Markdown reports/instructions were preserved byte-for-byte: **34 files checked, zero mismatches**.

## Fixes

### 1. Trustworthy, portable preservation assertions

The failing test used raw bytes for text-source hashes, so an LF index/CRLF working checkout failed even when content was identical. The protected-text assertion now uses the existing `sourceTextHash` policy: UTF-8 with CRLF converted to LF, no whitespace trimming or other normalization. Existing source-hash regression tests continue to distinguish meaningful text/whitespace changes.

The `ACHIEVEMENTS_PLAN.md` mismatch was investigated independently:

- Git history shows its original addition at `5482e08`; the document has no content diff from that commit through the Phase 4B baseline checkpoint `2ed299cba1ff9b65408915c7f49ee124fc993389` to pre-Batch-1 HEAD.
- The original, checkpoint and HEAD LF text hash is `e7c8205281f5e1df0db657e89f7acda203aa63dacc752b22a2010acec40ea81c`.
- The checkout's CRLF hash is `aec543fd4f8e2f2f7b831d7cceda4e431304f3b53afeeea24358b45815de2fa6`.
- The old fixture hash, `914a28edba257761b7258b7df0a363aa9242f49f2b372c34764288caca879b72`, matches neither. BOM, final-newline and Unicode-normalization probes did not explain it. The precise historical cause of the incorrect fixture value is unknown; there is no evidence that the current plan was substantively edited.

Only that document's expected protected-file hash was corrected against historical committed content. The baseline records the previous value, original commit, checkpoint and review reason. The document itself was not changed. All other protected-file expected values remain unchanged, with the five pre-existing activation exceptions retained.

The authorized Goal consistency formula necessarily differs from the old AST snapshot. Its assertion now pins an explicitly reviewed replacement AST hash for **that function only** (`e6a85b11a19eda38b75a57d5a109f226e47fab9f3a053c3aebb2bb5c370cdfc7`). Its historical AST fixture remains intact. Every other backup/domain function retains its previous exact AST assertion. Numerical Goal fixtures now test behavior rather than relying solely on preservation hashes.

### 2. Arabic-Indic/Persian Count target entry

`CountFields` calls the existing `normalizeNumericInput` utility before its existing digit-only/four-character filter. Arabic-Indic, Persian and mixed digit entry becomes canonical ASCII form text. The existing ASCII-only domain validator, 1–9999 range, numeric storage, user-entered unit text and backup format are unchanged.

Executable component tests cover ASCII/localized/mixed entry, four-digit truncation, empty/zero/out-of-range validation, pasted non-digits and unchanged unit text. For example, `٨` becomes `8`, and `۱۲۳۴` becomes `1234`; directly passing `٨` to the domain validator still fails, as intended.

### 3. Evidence-bounded Goal consistency

A shared read-only `evidencedHabitStart` helper now serves Insights and Goals. It preserves Insights' existing rule: begin at the earlier of a reliable creation date (year >= 2000) or first valid saved entry, bounded by today. Partial entries are evidence too. Invalid/future record dates do not move the start backwards; missing/unreliable creation without saved evidence invents no past days.

Goals skip habit opportunities before that start, while still respecting goal start, target/completion end, current schedules, snapshot completion rules and separate provisional today. Unreadable-day notes count only days with an actual scheduled opportunity in the evidence-bounded window. Unknown live today is no longer inferred from a saved today snapshot.

The audit example now yields **one finished opportunity in both Goals and Insights**, instead of Goal 5 versus Insights 1. Numerical fixtures cover creation after goal start, earlier legacy/partial evidence, invalid/future dates, unreliable creation, rest days, deleted links, count/checklist snapshots, completion/target boundaries, unreadable days, empty links and live/unknown today.

The English/Arabic Goal explanation now explicitly states that historical link dates, schedule versions and pause intervals are unavailable. Current links/schedules still apply retrospectively inside the evidence-bounded window, and paused days remain included. No historical link/pause dates were fabricated or persisted.

### 4. Goal history refresh and saved-generation safety

Both Goal list and editor use `useGoalHistory`, keyed by the daily provider's date and successful finished-date persistence revision. Date rollover and a completed-day successful save refresh the focused screen without requiring navigation away/back.

While the existing queue has any pending writes, the hook defers historical reads and hides consistency as loading rather than presenting an interim saved completion as final. Pending includes previous dates and failed writes. Successful drain permits a new read; failures/optimistic records do not become saved history. In-flight reads are canceled by dependency cleanup and also checked against the synchronous persistence snapshot before publication. A new date/revision does not display old-boundary history while fetching.

Tests include a deferred pre-midnight read, pending undo, late stale result, successful completed-day revision and date rollover. An additional integration test uses the **actual save queue**: a failed yesterday undo remains pending, does not trigger a historical read or increment finished revision, then a successful retry refreshes the final undone record without refocus. No storage/writer implementation was changed.

This intentionally favors honest unavailable/loading consistency during pending saves; it can briefly reload after a current-day drain as well. If disk failure remains unresolved, historical consistency waits rather than displaying potentially superseded data.

### 5. Habit/Goal/Routine navigation safety

The new shared form guard handles dirty drafts and synchronous operation admission. Cancel and screen-removal actions share one confirmation; repeated exit taps do not open concurrent dialogs or replay competing actions. Rejecting discard retains the draft. Reverting a draft to its initial value removes dirty protection. Save/delete admission locks synchronously before awaiting, including clean forms; canceled destructive confirmations or failed mutations unlock without leaving. Failed edits remain available for retry.

`usePreventRemove` covers Back/gestures and actions that remove a form. SDK 58 native `tabPress` is explicitly **not preventable** in the installed API. Native tab triggers are therefore disabled while the focused form is dirty/busy. A disabled-trigger press emits a prevented event; the focused form guard can confirm discard, close the form through its original destination, and then replay the requested tab navigation. While saving/deleting it does not replay or queue a stale exit. Web tab buttons intercept their press before navigation and use the same guard. Goal/Routine create-habit detours are guarded explicitly too.

Route mutation callbacks no longer navigate immediately after their async operation. The still-mounted form disables removal prevention and closes only after confirmed save/delete success. Unmounted guards cannot navigate when delayed work or confirmation finishes. Routine deletion retains `closeAfterRoutineDeleted` as an explicit success destination, preserving the original editor-plus-stale-detail dismissal behavior. All other close destinations remain the existing helpers.

Profile's existing discard/removal implementation was left intact; only its greeting clock input changed. There are no new providers, domain remount keys or persisted draft records.

Executable tests cover guard confirmation/replay, busy admission, failure/unlock, obsolete registration cleanup, unmount during confirmation, actual hook wiring, native/web tab behavior, actual form controls and handlers for all three forms, dirty/revert, canceled/failed/successful deletion, successful save and late save/delete completion. All six route mutation callbacks are checked to keep navigation in the guarded form; routine deletion's destination is checked explicitly. These tests inject Router/native ports; they are not Android interaction acceptance.

### 6. Trend display and greeting clock

Visible Insight trend numbers now use `appNumber(pct)` instead of raw JavaScript string digits. English remains the same; Arabic uses the existing Arabic-Indic display policy. Rates, rounding, heights and domain calculations are unchanged.

Today and Profile greeting preview use a separate presentation clock that checks every 30 seconds and on foreground resume, publishing only when the greeting period changes. `useCurrentDate`, date keys, daily records, quote selection and routine time buckets are unchanged. Tests exercise bilingual morning/afternoon/evening/night transitions, resume, unchanged same-period identity and cleanup; trend rendering tests confirm localized digits with unchanged numeric bar heights.

## Exact changed files

Modified application sources:

- `src/app/(tabs)/goals/[id].tsx`
- `src/app/(tabs)/goals/index.tsx`
- `src/app/(tabs)/goals/new.tsx`
- `src/app/(tabs)/habits/[id].tsx`
- `src/app/(tabs)/habits/new.tsx`
- `src/app/(tabs)/index.tsx`
- `src/app/routine/edit/[id].tsx`
- `src/app/routine/new.tsx`
- `src/components/app-tabs.tsx`
- `src/components/app-tabs.web.tsx`
- `src/components/goals/goal-form.tsx`
- `src/components/habits/count-fields.tsx`
- `src/components/habits/habit-form.tsx`
- `src/components/insights/trend-bars.tsx`
- `src/components/profile/profile-form.tsx`
- `src/components/routines/routine-form.tsx`
- `src/hooks/use-completion-history.ts`
- `src/i18n/ar.ts`
- `src/i18n/en.ts`
- `src/i18n/remaining-ar-messages.ts`
- `src/i18n/remaining-en-messages.ts`
- `src/utils/goal-progress.ts`
- `src/utils/insights.ts`

New application sources:

- `src/hooks/use-form-navigation.ts`
- `src/hooks/use-goal-history.ts`
- `src/hooks/use-greeting-date.ts`
- `src/utils/form-navigation.ts`
- `src/utils/habit-start.ts`

Modified generated inventory/test artifacts:

- `LOCALIZATION_COPY_INVENTORY.json`
- `tests/phase4b-complete.test.mjs`
- `tests/support/phase4b-preservation-baseline.json`

New tests/support/report:

- `tests/batch1-goals.test.mjs`
- `tests/batch1-navigation.test.mjs`
- `tests/batch1-presentation.test.mjs`
- `tests/support/hook-harness.mjs`
- `MOMENTUM_BATCH1_REPORT.md`

The pre-existing untracked `MOMENTUM_FULL_AUDIT.md` remains unchanged and is not a Batch 1 addition. No existing report was revised. No source under `src/data/`, dependencies/lockfile, native config, artwork, achievement definitions or backup wire/recovery implementation was changed.

## Exact final validation

| Check | Result |
| --- | --- |
| `npm.cmd test` | **Exit 0: 312 tests, 18 suites; 312 pass, 0 fail/cancelled/skipped/todo; 24239.3348 ms.** Original 291 tests plus 21 focused Batch 1 tests. |
| `./node_modules/.bin/tsc.cmd --noEmit` | **Exit 0**, no diagnostics. |
| `./node_modules/.bin/expo.cmd lint --no-cache` with process-local `EXPO_NO_CACHE=1` | **Exit 0**, no errors/warnings. |
| Additional `./node_modules/.bin/eslint.cmd . --no-cache` | **Exit 0: 0 errors, 4 pre-existing warnings**; details below. |
| Independent in-memory inventory regeneration and deep comparison | **Exit 0, EXACT MATCH**: 188 sources, 22 route roots, 181 reachable sources, 120 candidate files, 1506 candidates. |
| `git -c safe.directory=C:/Projects/momentum diff --check` | **Exit 0**; no whitespace errors. Git emits LF-to-CRLF checkout advisories, with no line-ending configuration change. |
| Existing Markdown preservation hash comparison | **34 existing files, zero mismatches**, including the untracked full audit. |
| Expo Doctor | **Unavailable; not run.** No local executable/package or PATH executable; the documented old external CLI path is absent, and no installed CLI was found in the inspected current-user npm `_npx` cache. No dependency/tool installation was attempted. |

Broad ESLint warnings retained: generated `.expo/types/router.d.ts:1` has an unused eslint-disable directive; `tests/today-localization.test.mjs:7–9` has unused `en`, `ar`, `enMessages` imports. These are outside Expo lint's default scope and predate this batch. No automatic fixes were run against generated or unrelated files.

During implementation, one early focused run failed because new mock drafts omitted `description`; the fixture was corrected. The first full integration run passed 307/307 while tests were still being expanded. That run's Expo lint found three ref-during-render errors in the new hook; the implementation was changed to pass explicit callbacks and update lifecycle/dirty state in layout effects. A subsequent broad lint found one new test-only unused-expression warning; it was corrected. The final results above include those fixes and all expanded tests. No remaining check failure is hidden.

Expected failure-injection diagnostics appear for queue/save/delete/recovery tests, including the deliberate failed completed-day undo. They are passing recovery/failure-path tests, not evidence of device failures.

## Remaining risks and scope limits

- **Physical Android QA was not performed.** Native disabled-tab event behavior, Back/gesture timing, asynchronous route queue ordering, accessibility activation and confirmation UX must be accepted on the installed Dev binary. SDK 58 documentation and installed native-tab event definitions informed the implementation; Node tests do not execute those native components.
- Latest shared text-alignment visual acceptance, dark contrast correction, compact routine progress redesign and raw-Text recovery presentation remain Batch 2 work. None was silently included here.
- Production identity/profiles/signing/offline release artifacts and native backup recovery acceptance remain later gates. No build or packaging work was performed.
- Historical link dates, pause intervals and schedule versions remain unavailable; current-policy semantics are now explicitly disclosed. Saved records were not rewritten to manufacture missing history.
- Goal consistency can wait while any daily write remains pending, including a persistently failing save. It does not silently classify an interim completion as final. Pending progress is still memory-resident until the existing writer succeeds; this batch adds no process-death persistence guarantee.
- Cross-tab guarding covers app tab controls and explicit form detours; OS process termination is not a cancelable navigation action. Unmount during external interruption suppresses late navigation but cannot cancel a native storage write already started.
- No real Expo Go or MOMENTUM Dev data was accessed. All fixture history, restores and write failures in automated tests use isolated synthetic/mocked storage. Real-data transfer remains a separate task requiring explicit authorization.

## Concise Android smoke checklist — synthetic MOMENTUM Dev only

1. Create/edit each Habit, Goal and Routine; change then revert a field. Check Cancel, Android Back and cross-tab exit: Keep editing retains the draft; Discard exits once. Test the create-habit linking detour and return. Check unchanged forms leave without unnecessary confirmation.
2. Rapidly tap Save/Delete/Back/tabs. During work, verify exits do not race; canceled deletion and failures retain the form; success closes to the original destination. Delete a routine opened from Today and from Habits and confirm the stale detail closes too. Do not induce failures by clearing app data.
3. Enter `٨`, `۱۲۳۴` and mixed digits into a Count target; save/reopen and check 1–9999 validation. Confirm unit/name text remains literal. Repeat English/Arabic with Light/Dark/System.
4. In synthetic Goals, link a newly created habit to an older goal: earlier pre-habit days must not count. Compare its valid window with Insights; inspect the new limitations copy. Keep a Goal screen focused across midnight and verify saved completed-day history refreshes after persistence finishes.
5. Switch Insights English/Arabic: visible trend digits and accessibility descriptions agree. Resume Today/Profile across a greeting boundary; date keys and saved check-ins must remain unaffected. Check existing Profile discard behavior still works.

Use the existing Dev installation and current JavaScript only; no build, uninstall, reset, clear, import, restore or migration of real device data is part of this checklist. Stop for review after this Batch 1 handoff. No Git commit, push, reset, clean or branch switch was performed.

## Pre-checkpoint encoding correction — 15 November 2026

The subsequent checkpoint review found that the earlier PowerShell-piped JavaScript edits had written literal question marks in four new Arabic entries and in place of two English possessive apostrophes. The earlier 312-test suite passed because catalog parity/nonempty checks did not verify the actual text of these additions. The earlier report's translation-completion claim was therefore incomplete; this appended note corrects it without changing the historical report above.

With explicit user approval, the exact intended text was restored from the original Batch 1 edit instructions in the conversation, cross-checked against existing Arabic discard terminology and the Goal evidence-window policy. There was no unresolved wording ambiguity. UTF-8-safe patch edits were used, without a shell pipe carrying the Arabic text.

| Entry | Corrected text |
| --- | --- |
| Arabic `forms.discardTitle` | تجاهل التغييرات؟ |
| Arabic `forms.discardMessage` | لم تُحفظ تغييراتك بعد. |
| Arabic `forms.discard` | تجاهل |
| Arabic `goals.consistency.explanation` | يبدأ الحساب من {date}، ولا يسبق بداية كل عادة المثبتة بتاريخ إنشائها أو تسجيل محفوظ أقدم. نستخدم العادات المرتبطة حاليًا وجداولها الحالية؛ لا تُحفظ تواريخ الربط السابقة أو الجداول السابقة أو فترات الإيقاف المؤقت، لذا تبقى أيام الإيقاف ضمن الحساب. يظل اليوم مؤقتًا حتى ينتهي. |
| English explanation, first damaged apostrophe | `habit?s` restored to `habit’s` |
| English explanation, second damaged apostrophe | `goal?s` restored to `goal’s` |

Only `src/i18n/ar.ts`, `src/i18n/remaining-ar-messages.ts`, `src/i18n/remaining-en-messages.ts`, `tests/batch1-presentation.test.mjs`, the required localization inventory refresh and this append-only report correction changed during the correction pass. Three focused tests now assert the exact Arabic labels, the entire Arabic Goal explanation, the entire English explanation with both apostrophes, and the rendered messages with an interpolated date. They do not merely check key parity, script presence or nonempty values.

Post-correction validation:

- `npm.cmd test`: **exit 0; 315 tests, 18 suites; 315 pass, 0 fail/cancelled/skipped/todo; 17029.0898 ms**.
- `./node_modules/.bin/tsc.cmd --noEmit`: **exit 0**, no diagnostics.
- Expo lint (`EXPO_NO_CACHE=1`, `./node_modules/.bin/expo.cmd lint --no-cache`): **exit 0**, no errors/warnings.
- Independent in-memory localization inventory comparison: **exact match**, 188 sources, 22 route roots, 181 reachable sources, 120 candidate files, 1506 candidates. Regeneration was needed because Arabic source content changed; the totals remain the same.
- `git diff --check`: **exit 0**, no whitespace errors; existing LF/CRLF checkout advisories only. Rechecked with the staged candidate before committing.

The original report prefix and full audit were fingerprinted for preservation. Checkpoint scope remains the same 37 reviewed files: Batch 1 source/tests/inventory and the two reports, with no private-data, dependency, native-config or build-output addition. This corrects copy encoding only; it does not claim physical Android acceptance or authorize any device operation. Commit and remote verification identifiers will be supplied in the checkpoint handoff rather than rewriting this historical report after committing.
