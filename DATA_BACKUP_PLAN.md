# MOMENTUM — Data & Backup plan

Status: approved and implemented for review on main; Android device acceptance is pending. Original inventory inspected on 2026-11-09. Section 12 records actual implementation decisions and supersedes proposal details where stated.

## 1. Baseline and scope

- Git started clean on `main`, tracking `origin/main`, at `5482e08` (`Add achievements and gamification`).
- `package.json`: app 1.0.0, Expo `~58.0.23`, React Native `0.88.1`, React `19.3.0`, AsyncStorage `2.2.0`, Expo Router `~58.0.30`. `app.json` also declares 1.0.0. npm project (`package-lock.json`, no Bun lock).
- This milestone provides manual, complete export and replacement restore of local user data. No merge, automatic backup, backend, account, upload, notifications, or new tab.
- Leave `feature/notifications-wip` untouched. No checkout, merge, implementation, dependency installation, commit or push during planning. This document is the only proposed working-tree change.

## 2. Architecture and current persistence inventory

`src/app/_layout.tsx` mounts Profile → Habits → DailyProgress → Achievements → Goals → Routines around the root Stack and five tabs. Settings already has a Data & Backup section with device storage, counts, and an inactive “Export & backup” row. Non-route logic belongs outside `src/app/`.

Repository-wide storage search found AsyncStorage access only in the six `src/data/*-storage.ts` modules. The following keys, including legacy/recovery data, are user-owned and belong in the backup. Preserve raw strings and key presence, rather than serializing provider state.

| Key | Stored schema/version | Ownership and dependencies |
| --- | --- | --- |
| `momentum:habits:v2` | `{version:2, habits:Habit[]}` | Current ordered habit definitions; IDs referenced by history, goals, routines and achievement evidence. |
| `momentum:habits:v1` | `{version:1, habits:[...]}`; same base fields without tracking | Legacy definitions, retained frozen after migration. Every legacy habit becomes Tick when migrated. |
| `momentum:completions:v1:<local-date>` | JSON string array of completed habit IDs; version in key | Legacy Tick history, read-only in normal operation. |
| `momentum:checkins:v2:<local-date>` | `{version:2, entries:{[habitId]:HabitEntry}}` | Full daily Tick/Count/Checklist snapshots. One value per date. |
| `momentum:goals:v1` | `{version:1, goals:Goal[]}` | Ordered goals with linked habit IDs; manually controlled status. |
| `momentum:routines:v1` | `{version:1, routines:Routine[]}` | User routine order and ordered habit-ID membership; no independent completion history. |
| `momentum:profile:v1` | `{version:1, profile:Profile}` | Display name, avatar and name-prompt state. |
| `momentum:achievements:v1` | `{version:1, awards:{[badgeId]:AchievementAward}, seenBadgeIds:string[]}` | Persistent awards and acknowledgements, distinct from computed metrics. |
| `momentum:backup:pre-habits-v1` | `{version:1, reason, createdAt, legacyHabitIds:string[], completions:{[storageKey]:rawString}}` | Original completion snapshot before demo-habit migration. Never flatten into current history. |

### Field-level schemas

- **Habit:** `id`, `name`, optional `description`, `icon`, `color`, `schedule`, `tracking`, `createdAt`. Schedule is `{kind:'daily'}` or `{kind:'weekdays',days:[0..6]}` (Sunday=0). Tracking is `{type:'tick'}`, `{type:'count',target:integer 1..9999,unit:string}`, or `{type:'checklist',steps:[{id,label,optional?:true}]}`. Stable step IDs, ordering and optional flags matter. Current editor limits checklist steps to 12 and requires a required step; the storage parser is less restrictive. Do not retroactively apply editor limits to archived records.
- **Day entry:** Tick `{type:'tick',done:true}`; Count `{type:'count',value:integer 0..9999,target:integer 1..9999}`; Checklist `{type:'checklist',done:string[],required:string[]}`. A missing entry means no progress. Snapshot targets and required IDs must survive later habit edits. Local date keys remain local calendar dates; do not convert them through UTC.
- **Goal:** `id,title,description?,startDate,targetDate,status,completedAt?,habitIds,createdAt,updatedAt`. Status is `active|paused|completed`; completion date is a local date, timestamps are strings. Existing parser validates local dates but does not enforce every editor/business constraint (such as target ≥ start).
- **Routine:** `id,title,description?,icon,color,timeOfDay,habitIds,createdAt,updatedAt`. Time is `morning|afternoon|evening|anytime`; missing time is read as `anytime`. Array order and habit order are meaningful. Editor limits: 20 routines, 20 habits per routine, title 40 and description 140 characters; these are not all storage-parser limits.
- **Profile:** optional normalized `displayName` (1–30 code points when present), `avatar:{kind:'initials'}` or `{kind:'icon',icon,color:'#RRGGBB'}`, `namePrompt:pending|dismissed|completed`, `createdAt`, `updatedAt`. Stored profiles require timestamp strings; the unsaved in-memory default has none. Unknown icon keys have display fallbacks.
- **Achievement award:** `ruleVersion`, UTC ISO `awardedAt`, `source:backfill|evaluation`, `evidenceThrough` local date, `evidence:{metric:nonnegative safe integer,windowEnd,windowStart?,habitId?}`. `windowEnd` equals `evidenceThrough`, start is not after end. Known badge rule version is 1; unknown badge IDs with otherwise valid awards are retained by the parser. Seen IDs must be unique and reference awards. Twelve current definitions live in `achievement-definitions.ts`; definitions are bundled app code, not backup data.

### Relationships, migrations and error behavior

- Habit deletion deliberately retains history. Goals/routines may retain deleted habit IDs; their editing flows can later prune those links. Achievement evidence can also refer to a deleted habit. These are legitimate orphans, not reasons to invent a habit or discard history.
- For each date, v2 wins whenever present, even when unreadable; corrupt v2 must never fall back to stale v1. Both raw values must be exported when both exist.
- `loadHabits()` prefers v2; otherwise migrates v1 to v2 while preserving v1; otherwise, if any completion keys exist, snapshots them under `pre-habits-v1` and recreates the four original demo habits. It rechecks v2 before writing. Failure throws and retries on later loading. If nothing exists it returns an empty list without writing.
- Backup reads must bypass `loadHabits()` and all migrating/defaulting loaders. An export must not trigger migration or manufacture demo habits, timestamps, profile defaults, awards or missing keys.
- `loadCompletionHistory()` reads both prefixes, returns readable days plus `unreadableDays`, and throws on storage access failure. Invalid date suffixes can exist because enumeration only checks prefixes. Export them unchanged and flag them.
- Current parsers are protective but not lossless serializers: some deduplicate arrays, normalize weekdays, omit optional fields or unknown fields, and the goal parser removes inappropriate completion dates. Never round-trip raw data through them to create a backup or restore payload.
- Most loaders throw on corrupt/newer values; providers show load errors and block edits instead of overwriting with defaults. Missing goals/routines/awards return empty collections and missing profile returns a display-only default without saving.

### Writers, queues and derived state

| Owner | Existing behavior | Backup/restore implication |
| --- | --- | --- |
| `use-habits.tsx`, `use-goals.tsx` | Independent promise queues; compute from last saved list, save first, then publish. Failed operation rejects, later operations continue. | No public drain/pause API; reload alone does not stop queued or already-started writes. |
| `list-store.ts` → routines | Save-first serialized commits; successful load required; newest load token wins. | Add lifecycle control, including queued work and loading, before restore. |
| `value-store.ts` → profile and achievements | Same save-first guarantees for one value. | Track active loads/commits and drain them. |
| `save-queue.ts` → daily progress | Optimistic UI, per-date coalescing, one active write, pending retained until exact value succeeds; retries after 1/3/10/30 seconds indefinitely. Enqueue/drain revisions guard achievement reads. | Must drain ALL dates, including yesterday across midnight; never discard unsaved taps. Existing API has no await-idle/dispose facility. |
| `use-daily-progress.tsx` | Backgrounding triggers retry; current-date loading can use pending state. `normalizeTodayRecord` automatically updates today's targets/steps or removes type mismatches and queues writes. | Picker foreground/background events and rehydration can cause writes; explicitly suppress these during backup/restore and initial restored hydration. |
| `achievement-coordinator.ts`, `use-achievements.tsx` | Serialized load/evaluate/award/acknowledge operations; generation and input revisions suppress stale evaluations. Foreground requests force refresh; pending daily progress delays awards. Errors distinguish store/history/save/input/acknowledgement problems. | `invalidate()` does not cancel a started write. Pause new requests, invalidate reads, drain both operation and value-store queues. |

`use-completion-history.ts` reloads on focus/date; `use-insights.ts` combines history with today's live state. Goal/routine progress, achievement metrics, streaks, date timers, focus caches, splash state, form drafts, navigation and save-status flags are derived/transient and excluded. Theme is fixed dark, language fixed English: there are no persisted preference keys. Do not export all AsyncStorage keys or touch unrelated app/Expo storage. Future journal files/markers are operational recovery artifacts, excluded from portable exports.

Unknown keys: recognize only the listed families, including unknown versions within those exact families, as candidate user data for lossless archival export. Do not indiscriminately include every `momentum:*` key. Unknown family/version is reported, never silently deleted; restore is blocked if its safety cannot be established. Before implementation, centralize this registry and ensure export, validation, replacement and recovery use the same scope.

## 3. Portable format v1 and preservation contract

Proposed filename: `momentum-backup-<UTC timestamp without colons>.json`, MIME `application/json`, UTF-8. It is plain text and **NOT ENCRYPTED**. SHA-256 detects accidental changes; it is not a signature, proof of origin or password protection.

Illustrative envelope (digest and contents below are placeholders):

```json
{
  "format": "momentum.local-backup",
  "backupVersion": 1,
  "createdAt": "2026-11-09T12:00:00.000Z",
  "app": { "id": "momentum", "version": "1.0.0", "expoSdkMajor": 58 },
  "schemaVersions": {
    "habits": [1, 2], "completions": [1], "checkins": [2],
    "goals": [1], "routines": [1], "profile": [1],
    "achievements": [1], "preHabitsBackup": [1]
  },
  "payload": {
    "scope": "all-user-data",
    "records": [
      { "key": "momentum:habits:v2", "raw": "{\"version\":2,\"habits\":[]}" }
    ]
  },
  "integrity": { "algorithm": "SHA-256", "digest": "<64 lowercase hex characters>" }
}
```

`schemaVersions` declares the format's supported storage schemas, not evidence that every key exists. Exact key presence is the manifest: absent differs from a present empty array or empty/corrupt string. `records` is a sorted array of unique key/raw-string pairs, retaining every stored character, unknown nested field, original array order and corrupt value. Do not parse/restringify `raw` during transfer. Duplicate JSON object member names in the envelope are rejected, rather than accepting parser-dependent last-member wins.

Define canonical hashing precisely: recursively lexicographically sort object property names by JS code-unit order; retain array order; serialize with JSON string escaping and no whitespace, finite numbers only. Hash UTF-8 bytes of the full envelope excluding `integrity`. Raw strings remain opaque to canonicalization. App metadata, scope and creation date are covered. Use fixed cross-runtime test vectors, including Arabic, emoji and escaped characters. Derive preview counts independently; do not trust counters from a file.

Two outcomes are explicit:

1. **Lossless export/archive:** include recognized user-family raw data even if corrupt/unsupported. Preview reports unreadable and unsupported records and explains that the file may not be restorable by this app version. Never claim a fully validated restore-ready backup in that case.
2. **Normal replacement restore:** require supported schemas and readable active records. Reject unsupported versions and corrupt records without any live mutation. Retained corrupt legacy shadows or migration snapshots are also archive-only for v1 simplicity. The original file remains a lossless recovery artifact; do not offer a hidden force-import or silently omit records.

This distinction preserves unknown/corrupt existing data without pretending it is safe to activate. Recovery copies of the CURRENT device data are always raw and may contain corrupt records; internal rollback restores that exact pre-import state without applying normal import schema rules. Never fabricate data to turn an archive into a valid import.

## 4. Official Expo SDK 58 review and proposed file access

Reviewed the installed version first, the [SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/), and [Expo's current LLM index](https://docs.expo.dev/llms.txt). The initial index request failed; retry succeeded. Relevant official pages reviewed on 2026-11-09:

- [SDK 58 FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/): included in Expo Go. Use modern `File`, `Directory`, `Paths`, async file operations, and bounded `readableStream()` reads. Its current `File.pickFileAsync({multipleFiles:false,mimeTypes:[...]})` returns a cancellation-aware result; avoid obsolete overload assumptions. Android directory picking and `Directory.createFile` provide a user-selected local save destination.
- [SDK 58 Sharing](https://docs.expo.dev/versions/v58.0.0/sdk/sharing/): included in Expo Go; availability check and local-file `shareAsync` support mobile export. Returning from the share sheet does not prove a destination saved the file. Browser local-URI sharing differs.
- [SDK 58 Crypto](https://docs.expo.dev/versions/v58.0.0/sdk/crypto/): included in Expo Go; use SHA-256 through `digestStringAsync`. No encryption is proposed.
- [SDK 58 DocumentPicker](https://docs.expo.dev/versions/v58.0.0/sdk/document-picker/): reviewed as an alternative. It is in Expo Go; when paired with FileSystem, `copyToCacheDirectory:true` makes a picked document immediately readable. Not initially needed because SDK 58 FileSystem has a picker.

Propose three direct dependencies only: `expo-file-system` (files, picker, durable recovery), `expo-sharing` (user export handoff), `expo-crypto` (integrity). None is currently declared directly. After approval only: `npx expo install expo-file-system expo-sharing expo-crypto`; let Expo resolve compatible versions. Do not pin versions from memory, upgrade the SDK, introduce native hand edits, or install a third-party backup/zip/validation library. Verify actual installed declarations and Android Expo Go behavior before finalizing the adapter. Add DocumentPicker only if an observed picker compatibility problem justifies the fourth dependency and the plan is updated.

### Export Backup

1. Settings > Data & Backup > Export Backup opens a root-stack backup screen. Show sensitive-data/plain-text notice, contents summary and Save to device / Share choices.
2. Briefly freeze mutations and automatic work; settle already accepted writes and loads, then read the raw key manifest/values under the shared barrier. A read failure or unresolved pending save aborts export; never export an empty substitute. Readable-schema errors produce an explicit archive warning, not data loss.
3. Build/hash the immutable snapshot; release the app barrier once capture finishes. Later edits do not alter that snapshot. Bound file construction and report limits without truncation.
4. Write a uniquely named private temporary file and re-read/validate its envelope and digest. For Android Save to device, request a directory and create a unique JSON file there; do not overwrite an existing file. Report success only after awaited write/read-back checks. If directory access is denied, allow retry or Share.
5. Share invokes the OS sheet only after an explicit tap. Say “Backup ready; choose where to save or share it,” not “Saved” after sheet dismissal. Cancellation is neutral. Avoid broad storage permissions; use system-granted access. Keep the temp file long enough for receiving apps; remove only owned stale export files on a later bounded cleanup, never immediately during handoff.

### Import Backup and preview

1. Explicit tap opens the system single-file picker. Prefer JSON filtering with an “all files” fallback because providers can mislabel MIME types. Extension/MIME never substitute for content validation. Cancellation changes nothing.
2. Read selected bytes into a bounded private snapshot; do not follow paths/URLs contained in JSON. All validation is read-only with respect to live data. If invalid, show a specific error and discard staged input.
3. Preview filename (as plain text), creation date/time, source app version, habits by tracking type, goal counts/statuses, routine count/order, profile presence, awards/seen count, distinct dates/date range, legacy/shadow records, and orphan/compatibility warnings. Missing/unreadable values are “unknown,” never zero. Compare current and incoming totals. Do not expose personal text unnecessarily.
4. State: “This replaces all current MOMENTUM data, including check-ins, profile and achievements. It does not merge. A local recovery copy will be kept.” Show incoming-empty warnings prominently. Require an acknowledgement plus explicit **Replace current data**; Cancel is the initial/safe focus. Empty backups still require this confirmation.
5. Hold the immutable validated snapshot/digest, not a mutable picker URI. Acquire the restore barrier after confirmation; recheck digest and current snapshot. If current data changed since preview, refresh comparison and require confirmation again before replacement. Back/dismiss is safe before mutation; during apply show a blocking progress state and recovery explanation.

No cloud integration is added. The OS picker/share UI may offer third-party cloud providers; selecting those is the user's separate action. Default guidance is local device storage. No network request, analytics payload, account or automatic upload is part of this feature.

## 5. Strict validation and rejection policy

All checks finish before a restore journal is armed or any user key is written/deleted:

- Limit incoming file to **8 MiB UTF-8**, including unknown-size providers: stream with a running byte counter, cancel at limit, then decode strictly. No unbounded full-file read first. Reject invalid UTF-8, binary, archives, truncated JSON, duplicate envelope members and excessive nesting (maximum 32 outside raw strings).
- Maximum **20,000 records**, **1 MiB per raw value**, **4 MiB total raw key/value UTF-8 bytes**, key length **256 UTF-8 bytes**. These are initial conservative product limits, not claims about AsyncStorage capacity. Check boundaries and JSON escaping expansion. Export never truncates data: if over limits, explain that this version cannot create a supported backup. Internal recovery capture must never silently truncate oversized existing data; abort restore if a complete verified recovery copy cannot be made.
- Require exact format/version, supported schema manifest, all required envelope types, UTC creation timestamp, bounded metadata, unique keys, allowed key families and SHA-256 match. Reject unsupported backup/schema versions with “This backup needs a newer or different version of MOMENTUM.” Source app version is informational; declared/data schemas decide compatibility.
- Validate each supported raw value with shared pure storage validators, without loader side effects. Expose existing private parsers as needed. Validate migration snapshot structure and nested completion key/raw types too. Unknown/corrupt records block normal restore; keep archive and current data intact.
- Validate real local calendar suffixes, unique primary IDs, entry discriminants/numeric ranges, schedules, checklist IDs/flags, profile/avatar/prompt fields, achievement dates/rules/evidence and seen-award links. Reject impossible structural references (such as seen IDs without awards). Use prototype-safe Maps/own-property checks; never merge parsed objects into application objects or configuration.
- Distinguish current storage compatibility from new editor limits. Report legacy anomalies that the app can safely read (duplicate relationship IDs that its parser deduplicates, older string timestamps, unusual goal chronology) without rewriting raw values; reject truly unreadable/unsafe input. Add tests that codify each decision rather than quietly tightening existing loaders.
- Report dangling habit references in goals/routines/history/evidence as warnings; preserve them. Do not demand historical step IDs, snapshot targets or tracking types match current habit definitions. Checklist `done` can contain optional IDs outside `required`. Do not require awards to be re-earned from present habits or rewrite original award times.
- Preserve v1/v2 precedence and all shadows. Legacy-only habit v1 can use the existing documented Tick migration only after complete restore, with the raw original/recovery retained. A completion-only dataset that would trigger demo-habit reconstruction is archive-only in this milestone: reject normal activation and explain why, rather than inventing definitions or importing a partially usable dataset.
- Detect unknown versions in CURRENT user-family keys before replacement: block normal restore rather than delete data this app cannot understand. Corrupt current known-schema raw data can be replaced only after an exact verified recovery capture and explicit warning/confirmation.

Examples of actionable errors: “Not a MOMENTUM backup”; “Backup is incomplete or has changed (checksum mismatch)”; “Backup exceeds the 8 MiB limit”; “Some saved records cannot be read; this archive cannot be restored safely”; “Your latest changes are still saving; retry after they are saved”; “Not enough space to keep a recovery copy; nothing was replaced.” Do not print raw personal values to logs or error dialogs. Validation failure must leave live keys, providers and their generations unchanged.

## 6. Safe replacement, recovery and provider reinitialization

**AsyncStorage multi-key writes are not fully transactional.** Neither `multiSet` followed by `multiRemove` nor individual awaited calls guarantees atomic restore. A process death, disk-full condition or native failure can leave a partial set. Do not describe this feature as atomic or guaranteed against device/storage failure.

Proposed design: one persistence coordinator, durable file-backed recovery journal, and an initialization gate above ALL providers. Avoid a database migration or rewriting every existing key into generations for this milestone.

1. **Acquire exclusivity synchronously.** Disable new mutations, queue enqueues, automatic normalization, migrations and achievement evaluation/acknowledgement requests. Guard persistence entry points as well as UI; a disabled button alone is insufficient. Permit only already accepted work to finish under its original generation. No new operation may enter while draining.
2. **Drain, do not discard.** Await habits/goals queue tails, routines/profile value/list queues, daily progress for every date, achievement coordinator/value-store queues and active startup loads/migration writes. Invalidate stale reads and wait for any already-invoked write. Existing cleanup/unmount does NOT cancel native writes or save retries. Add explicit await-idle, pause/dispose and generation checks. A finite wait (proposed 15 seconds) offers Retry/Cancel; timeout never authorizes a restore or releases exclusivity while an old write is still running. Resume the original session safely on pre-apply cancellation; never drop pending values.
3. **Snapshot current device data.** Under the barrier enumerate/read the scoped raw manifest, including legacy shadows and malformed known-prefix records. Preserve absence as well as bytes. No `AsyncStorage.clear()`. Reserve enough disk space for old snapshot, incoming snapshot, journal and working headroom; actual writes/read-back still decide success. If recovery creation fails, abort with no user-key mutation.
4. **Prepare durable recovery.** In a private documents subdirectory (not cache), write old and incoming immutable snapshots with checksums. Re-open and verify both. Write/read-verify a small `prepared` journal with operation ID, app/schema versions, fixed internal filenames, both hashes and exact before/after manifests. Paths are generated internally, never taken from imported JSON. Do not begin live writes unless this journal is discoverable and verified. File rename is useful for publication but not a cross-store transaction or power-loss guarantee.
5. **Apply exact replacement.** With providers quiescent, write incoming user-key values in bounded batches, then remove only scoped keys absent from the incoming manifest. This removes post-backup dates and stale fallback keys intentionally, as disclosed by replacement confirmation. Re-enumerate and compare every scoped key/value to the intended manifest, including absence; unrelated keys stay untouched. Never write through provider save functions that could normalize records.
6. **Commit or roll back.** Only after exact verification publish and read-verify a `committed` journal state. On any failure before verified commit, restore the exact before-manifest, remove scoped keys absent before, and verify. Rollback is idempotent and may itself fail; then keep providers unmounted, preserve files/journal, and show a blocking recovery screen with Retry recovery and an option to save the recovery archive. Do not allow navigation into mixed data or say the restore succeeded.
7. **Startup recovery is mandatory.** Before any provider mount or migration, inspect the journal. `prepared`/interrupted/uncommitted operations always roll back, even if incoming data appears fully written. A verified `committed` operation must match the after-manifest before mounting; otherwise enter recovery and restore before-state. Missing, corrupt or ambiguous journal artifacts block normal loading for recovery, rather than initializing empty defaults. Test interruption between EVERY durable step. No algorithm here promises survival if the OS loses both journal and recovery files.
8. **Reinitialize one data generation.** After successful commit (or verified rollback), discard all old provider instances, queue timers, refs, cached histories and navigation drafts. Mount the whole provider/navigation subtree under a fresh generation key; return to Settings with a result message. Cold restart uses the same gate. Do not rely on `expo-updates` reload, which is not installed and is not necessary for Expo Go.
9. **Prevent rehydration changes.** Load all incoming raw stores in one restore generation with automatic writes suspended; histories and computed metrics start fresh. Do not let today's normalization rewrite imported snapshots on initial hydration; resume normalization only after an explicit habit/progress edit in this generation (normal midnight rules remain). Achievement restore loads exact awards/seen state; no restore-triggered backfill/evaluation write. Resume normal achievement evaluation on a later explicit refresh, normal new edit or subsequent foreground event after hydration, retaining existing awards. Unknown nested fields remain in raw storage until an ordinary user mutation, whose existing serializer may omit them; disclose this limitation rather than claiming perpetual unknown-field preservation.
10. **Recovery retention.** Keep one verified pre-restore snapshot in private documents until a later successful restore replaces it or the user explicitly removes it. Add “Save recovery copy” and “Remove recovery copy” controls in Data & Backup, with deletion confirmation. Never delete an active journal's artifacts. Cleanup occurs only after verified commit/rollback, preserves the designated recovery snapshot, and tolerates interruption. Private recovery is local and unencrypted too; uninstall/device loss may remove it, so it is not a substitute for an external export.

The coordinator must live above the remounted subtree. All readers/writers, including future features, must honor its generation/barrier. Multiple app runtimes writing the same store are unsupported; require a single active app session and test normal Android process recreation.

## 7. UI, accessibility and platform boundaries

- Keep Settings Data & Backup and replace the placeholder with active Export Backup and Import Backup rows; push `/data-backup` in the existing root Stack, with no new tab. Recovery controls appear only when applicable.
- Reuse `SettingsRow`, `SettingsSection`, `Palette`, `Spacing`, `Radius` and `MaxContentWidth`: background `#08080D`, surfaces `#12121A`/`#1A1A25`, violet accent and danger red for the explicit replacement control. Native picker/share sheets keep OS styling.
- Respect top/bottom Android safe areas, gesture/three-button navigation, keyboard and large text. The root backup screen uses actual safe-area insets, not tab padding. Scroll previews; keep confirmation reachable at large font sizes.
- At least 48 dp touch targets, TalkBack labels/hints, semantic headings, disabled/busy states, progress announcements, focus on errors/results, sufficient contrast; never communicate danger/status by color alone. Avoid muted text for critical notices. Hardware Back cancels safely before apply; during apply the persistent recovery gate handles interruption.
- Android is the acceptance target, with iOS using local files/sharing through the same adapter. For web, keep native modules behind platform adapters and show an explicit unavailable state for restore in this milestone; no cloud-upload workaround. Typecheck and web routing must continue to work. A browser download/transaction-safe web restore would be separate approved scope.

## 8. Exact proposed implementation files (after approval)

New files:

- `src/data/backup-keys.ts`: single key-family registry, schema manifest, scope/absence rules.
- `src/data/backup-format.ts`: envelope types, canonical digest input, size limits, lossless serializer, strict parser, content preview and validation classification.
- `src/data/persistence-coordinator.ts`: operation barrier, accepted-work tracking, generation and drain contracts.
- `src/data/backup-service.ts`: immutable capture, export validation, restore/recovery state machine; injected storage/files/hash ports for tests.
- `src/data/backup-files.native.ts`: SDK 58 file picker, bounded reads, local save/share, durable journal/recovery operations and hashing adapter.
- `src/data/backup-files.web.ts`: explicit unsupported native-backup adapter without server-side native imports.
- `src/hooks/use-data-backup.tsx`: coordinator/provider, boot recovery gate and remount generation.
- `src/app/data-backup.tsx`: route for export, import preview, confirmation and results.
- `src/components/settings/backup-preview.tsx`: accessible counts, comparisons, warnings and replacement confirmation.
- `tests/backup-format.test.mjs`, `tests/backup-validation.test.mjs`, `tests/backup-coordination.test.mjs`, `tests/backup-recovery.test.mjs`.
- `tests/support/backup-fixtures.mjs`, `tests/support/backup-file-mock.mjs`: synthetic raw manifests, failure/interruption fixtures and persistent fake files.

Modify:

- `src/app/_layout.tsx`: recovery gate above providers, generation-keyed provider/navigation subtree and Stack registration.
- `src/app/(tabs)/settings.tsx`: active backup/import entry points and recovery entry when relevant.
- `src/data/{habit,completion,goal,routine,profile,achievement}-storage.ts`: pure validator exports where private; route every read/migration/write through the shared operation contract without changing existing schema/precedence.
- `src/data/{save-queue,list-store,value-store,achievement-coordinator}.ts`: await-idle, pause/disposal and stale-generation safety, preserving existing save-first/retry semantics.
- `src/hooks/use-{habits,goals,routines,profile,daily-progress,achievements}.tsx`: participate in freeze/drain/generation lifecycle and suspend automatic hydration writes.
- `src/hooks/use-completion-history.ts`: prevent old-generation results publishing during recovery; new generation reloads history (Insights then derives fresh state).
- `tests/progress-save-queue.test.mjs`, `tests/list-store.test.mjs`, `tests/value-store.test.mjs`, `tests/achievement-coordination.test.mjs`, `tests/support/async-storage-mock.mjs`: lifecycle and fault-injection coverage.
- `package.json`, `package-lock.json`: only justified Expo dependencies after approval; keep the existing Node test runner. No test framework dependency. Update this plan if device testing requires a different adapter/dependency.

No expected `app.json` permission/plugin changes for these basic flows. No generated `ios/` or `android/` edits. No notification-related changes.

## 9. Automated verification and release criteria

Use the existing `node --import ./tests/support/register.mjs --test "tests/*.test.mjs"` runner (`npm test`), injected file/hash ports and AsyncStorage mock. Real SHA-256 test vectors use Node's built-in crypto; device tests verify equivalence with Expo Crypto.

Required meaningful tests:

1. Exact raw round trip for every listed key, optional/missing keys versus empty collections, unknown nested fields, Arabic/emoji, all schedules, ordered routines/goals and profile prompt/avatar states.
2. Tick, Count target changes, optional/renamed/deleted checklist steps and historical tracking-type changes; v1-only/v2-only and both-version precedence, corrupt-v2 shadow behavior. No historical normalization.
3. Achievement award/seen byte preservation, unknown valid badge IDs, evidence orphan warnings; no immediate re-awarding or altered award timestamps. No demo reconstruction on unsafe completion-only import.
4. Unknown/corrupt export archives retain exact bytes; import rejects them; malformed/future envelopes, duplicate fields/keys/IDs, invalid dates, bad digest and schema/type errors reject with ZERO live storage writes/removes and no provider reload.
5. Every file/key/count/depth/byte boundary, missing provider size, multibyte UTF-8, wrong MIME/extension, cancellation, unsafe object properties, unrelated keys and fake path fields.
6. Delayed native writes, rapid taps, failed/retrying saves, midnight, background/foreground during picker, startup migration in flight and achievement acknowledgement/evaluation races. Restore never starts with pending accepted work and old generations never write after replacement.
7. Fault injection before/after each journal publication, batch write, deletion, verification and commit; partial native batch failure, disk full, rollback failure, process death and restart. Startup gate recovers idempotently or remains blocked; never mounts mixed data. Assert unrelated keys unchanged.
8. Remove keys/dates absent in imported manifest only after confirmation; exact pre-state rollback includes absence and corrupt original strings. Recovery copy retained and explicit cleanup never deletes unrelated files.

Implementation acceptance commands: `npm test`, `npx expo lint`, `npx tsc --noEmit`; then `npx expo-doctor` after dependencies/config change. No implementation is complete until lint/typecheck pass and Android flows pass. Planning also runs lint/typecheck as required by AGENTS.md; results recorded below.

## 10. Beginner-friendly Android checklist — synthetic data only

1. Use a spare Android device/emulator or separate Android user/profile with a separate app sandbox. Do NOT clear, uninstall or import into the installation holding real habits. Expo Go projects can share development circumstances: confirm the sandbox is disposable first. If no separate sandbox exists, stop at preview/cancel tests until one is available. Do not rely on this new feature as the only protection for real data.
2. Start the approved implementation with `npx expo start` and open it in an SDK-58-compatible Expo Go. Repeat core flows in an Android development build before release. Record Android/Expo Go versions.
3. Create obvious test records: “TEST Tick,” weekday Count with target 8, Checklist with required and optional steps, linked goal, two ordered routines, and a test profile/icon. Record progress. Use synthetic test fixtures for finished historical dates/awards/legacy records; do not alter the phone clock or production storage to manufacture them.
4. Write down expected counts, names, links, routine order, history snapshots and award/seen state. Export A to a local Files folder. Confirm it exists, has nonzero size, and preview recognizes it. Test Share separately; canceling the share sheet must not claim a saved file.
5. Change ONLY disposable test data: change Count target, rename/remove a checklist step, edit profile, reorder/delete a routine, change goal status, add a habit and extra check-in. Export B as an additional safeguard.
6. Select A via Import. Verify preview is correct, shows current versus incoming data and replacement wording; Cancel first and confirm B's state remains. Repeat and explicitly confirm replacement.
7. Verify A's definitions, schedules, IDs/links, routine order, goal status/dates, profile/avatar/name prompt, dates and historical Tick/Count/Checklist targets/required steps, awards and seen status. B-only records disappear as disclosed. Force-close/reopen and verify again; browse Today, Habits, Goals, Routines, Insights and Achievements. No phantom awards or demo habits should appear.
8. Save the recovery copy and verify it represents B. Restore B in the same disposable sandbox if needed; do not experiment on real data. Confirm recovery retention/deletion messaging is truthful.
9. Test picker cancellation, denied directory access, share unavailable, incorrectly labeled JSON, wrong file, truncated/edited/future-version and oversized fixtures. Each rejection must leave data unchanged. Check a fully empty valid backup has a prominent warning and requires explicit confirmation.
10. Test pending saves/rapid taps and switching away/back while picking; a busy/error state must block replacement safely. Use fault-injection automated/dev-only tooling for low-space, write failure and interruption after journal/batch steps; do not fill a real phone's storage. Reopen after each interruption and verify rollback or blocking recovery, never mixed data.
11. Check TalkBack, large font/display size, keyboard, hardware Back, gesture and three-button navigation, small display, dark contrast, reachable bottom controls and no extra tab. Repeat offline with local Files to confirm no network is required.

## 11. Planning verification

- `npx.cmd --no-install expo lint`: passed (exit 0).
- `npx.cmd --no-install tsc --noEmit`: passed (exit 0).
- `git diff --check`: passed for tracked files; the new Markdown document was reviewed separately.
- Final working-tree inspection: only `DATA_BACKUP_PLAN.md` is untracked; branch remains `main` at `5482e08`. No app code, dependency, config or lockfile changes; no commit or push.

The user subsequently approved implementation subject to strict storage safety requirements. The planning-only results above are historical; current implementation results follow.

## 12. Actual implementation and review status

Implemented on `main` above `5482e08`; no commit/push, branch switch, notification configuration change or native project edits. Actual Android/Expo Go execution remains untested: no connected Android runtime/adb was available here. Successful bundles and mocks are not a device test or a promise of storage durability.

### Files and decisions actually implemented

- `src/data/backup-keys.ts` is the shared user-family registry. `backup-format.ts` implements the v1 envelope, deterministic canonical SHA-256 input, duplicate-member/depth/type/size validation, shared existing parsers, safe-import classification, orphan/shadow warnings and derived preview. Raw strings and key presence are never reconstructed from providers.
- `src/data/backup-io.ts` implements bounded stream reading with fatal UTF-8 decoding and cancellation handling. `backup-files.native.ts` uses SDK 58 File/Directory, local directory save, sharing, private documents recovery files and Expo Crypto. `.web.ts` explicitly disables this milestone on web; `.ts` is the TypeScript fallback. Metadata SDK/app versions are informational; format/storage schemas decide compatibility.
- `persistence-coordinator.ts` grants synchronous admission leases before work is enqueued. Habits/goals queues and loading, generic value/list stores, the achievement coordinator and daily save queue all participate. Leases survive async queues, native writes and daily retry backoff across all dates. A retired generation cannot enqueue more work. This implements draining without abandoning retries or adding cancel/dispose APIs: at successful generation retirement there are no active accepted operations or pending retry timers left.
- `backup-service.ts` implements raw capture, read-only validation/preview, replacement and verified rollback using injected storage/file/hash ports. It never calls AsyncStorage.clear or migrating/defaulting loaders to export. Incoming validation fails before the barrier or any live write. Current future schema versions block replacement. A corrupt known current value can be replaced only after its exact bytes are captured/verified in recovery and the user confirms the preview warning.
- Durable per-operation files are named `restore-<timestamp>-<random>.before`, `.after`, `.prepared`, `.committed`, `.settled`, optionally `.removed`. Before/after contain checked portable envelopes; markers bind their digest/operation identity. Writes exclusively create files and are read back; snapshots are rechecked against expected digests immediately before the first live mutation. The apply path uses individual awaited key writes/removals, followed by complete manifest/value verification.
- Startup recovery runs before ANY provider mount. An unfinished operation rolls back verified before-state unless a valid committed marker and exact after-state can be verified. An invalid incoming staging file never prevents rollback from a valid before snapshot. A missing/unreadable before snapshot or ambiguous completion marker blocks editing. Retry/save/share recovery actions do not clear storage.
- A settled marker distinguishes completed recovery from later ordinary user edits: startup must not compare completed operations against their old after-snapshots and undo subsequent user work. After completion-marker publication, failure/read-back uncertainty NEVER starts rollback. This boundary has dedicated regression coverage; otherwise an interrupted rollback could leave mixed data behind a trusted completion marker.
- Recovery retention is deliberately more conservative than the proposed single slot: **all completed before-copies remain until explicit removal**; the save/share control offers the newest available copy. This avoids silently deleting an earlier safety copy. Remove recovery copies requires confirmation and removes snapshots only for settled operations; small completion/tombstone markers remain so startup distinguishes intentional removal from missing active evidence. Storage can grow with repeated restores; there is no automatic deletion of recovery data.
- If the 15-second drain times out, replacement aborts before preparing a journal or mutating user keys. The original session is unlocked so its accepted pending writes can continue retrying. This is safe cancellation back to the original data generation, not permission to proceed with restore. An unresolved apply/rollback instead leaves the app locked and unmounts providers until recovery verifies a complete state.
- `use-data-backup.tsx` owns the boot gate, global apply overlay, blocked recovery actions and keyed remount of the provider/navigation subtree. Old content is hidden from accessibility during apply. Verified restore/rollback lands back in Settings with a result. Native splash is hidden for the initial gate so recovery errors cannot remain behind it.
- Restored hydration suppresses today's automatic normalization and achievement backfill writes. Legacy v1 habits can be read as Tick in memory without creating v2 during this hydration. Explicit user edits reenable normal behavior; later safe foreground/explicit achievement refresh reenables evaluation. Original awards/seen state and historical raw records are never replaced by computed metrics during restore.
- `src/app/data-backup.tsx` contains the preview/confirmation UI directly (no separate `backup-preview.tsx` was needed). Settings has active Export Backup / Import Backup rows; both open the same root-stack route. The screen supports capture, save/share, picker/preview/cancel, acknowledgement plus native replacement confirmation, and recovery save/share/removal. Empty backup and raw unreadable-current-data warnings are explicit. No tab was added.
- Existing storage schemas and parser compatibility remain unchanged. Only existing private habit/goal/completion parsers were exported for validation; backup validation never writes their normalized output. `use-completion-history.ts` required no changes: keyed subtree remount runs its existing cancellation cleanup and constructs fresh histories/Insights. Profile/routine hooks required no changes because their generic stores own admission.

Installed via approved `npx.cmd expo install`: `expo-file-system ~58.0.13`, `expo-sharing ~58.0.22`, `expo-crypto ~58.0.7`. FileSystem was already transitive and is now directly declared. No DocumentPicker, zip, encryption, database or test framework dependency was added. Expo's automatically inserted sharing config plugin was removed because only outgoing sharing is used; `app.json` matches the baseline. No SDK upgrade. npm reported 12 moderate audit findings during installation; no unrelated forced dependency updates were applied.

### Automated verification and remaining acceptance

New tests: `tests/backup-format.test.mjs`, `tests/backup-io.test.mjs`, `tests/backup-recovery.test.mjs`, with `tests/support/backup-fixtures.mjs`. Existing tests were not weakened. Tests cover all nine raw families, Unicode, unknown fields/versioned awards, v1/v2 precedence, corrupt/future archives, invalid files/metadata/checksums, byte bounds and picker cancellation, concurrent admission, queued commits, pending retries across midnight, stale generations, migration/backfill suppression, full synthetic export → edit → restore → verify, rollback failure, restart at journal stages, and one-shot failure at every awaited restore I/O boundary. Native platform adapters are checked by TypeScript/bundling, not mocked proof of Android native behavior.

Final command results are recorded below. Earlier layer runs passed 157, 166, 169, 175 and then 178 tests; intermediate failures exposed test-fixture ordering and completion-marker error handling and were fixed before proceeding.

- `npm.cmd test`: **passed, 179/179 tests**, 18 suites, 0 failed/skipped/cancelled, exit 0.
- `npx.cmd --no-install expo lint`: **passed**, exit 0.
- `npx.cmd --no-install tsc --noEmit`: **passed**, exit 0.
- `npx.cmd --no-install expo-doctor`: **passed, 20/20 checks**, exit 0 after dependency changes.
- Android export/bundle with Hermes: **passed**, exit 0 after rerunning outside the sandbox (initial sandbox run could not execute hermesc.exe). Recheck also passed, exit 0.
- Web export/server rendering: **passed**, exit 0. Final code bundle recheck pending.
- Synthetic Android test-file generator: **passed**, exit 0; files written to a fresh OS temp folder, without reading any live app storage.

Use [DATA_BACKUP_ANDROID_TESTS.md](DATA_BACKUP_ANDROID_TESTS.md) for beginner testing. Its section A permits export/save/share/preview/cancel on a main phone; replacement tests are restricted to a confirmed disposable sandbox. `scripts/create-backup-test-files.mjs` creates complete synthetic, empty, archive-only, checksum-error, future-version, truncated and oversized fixtures. Remaining Android cases include Expo Go native picker/cancellation/provider behavior, local folder read-back, sharing receivers, low-space/native failures, actual process death, TalkBack/large fonts/safe areas, restored hydration and development-build parity. They have **not** been marked passed.

AsyncStorage multi-key replacement remains non-atomic. Verified journals and a fail-closed gate reduce partial-state risk; they do not guarantee survival of OS/device/storage failure or destruction of both app data and recovery evidence. No cloud/backend/account/automatic upload or encryption is implemented.

## 13. Android ExpoCrypto runtime diagnosis and guarded startup

User-reported Android Expo Go error: `Cannot find native module 'ExpoCrypto'`, initially while importing the backup adapter through the root layout. The previous eager `expo-crypto` import was an app integration error: the package evaluates `requireNativeModule('ExpoCrypto')` at module load and also exports an AES module requiring `ExpoCryptoAES`. A missing native registration therefore aborted layout/route evaluation before React could show a recovery/availability error. Router's missing-default-export warnings are consistent with that interrupted import; the routes themselves still have default exports.

Verified local installed versions: Expo **58.0.23**, Crypto **58.0.7**, FileSystem **58.0.13**, Sharing **58.0.22**, React **19.3.0**, React Native **0.88.1**, Modules Core **58.0.30**, Modules JSI **58.0.22**. `expo/bundledNativeModules.json` agrees with the SDK's Crypto/FileSystem/Sharing versions. `npx.cmd --no-install expo install --check` passed with “Dependencies are up to date.” Its first sandbox run was network-blocked; the read-only network-enabled retry passed. No dependencies, SDK versions or app/native configuration were changed for this fix.

Official [SDK 58 Crypto docs](https://docs.expo.dev/versions/v58.0.0/sdk/crypto/) list `~58.0.7` and inclusion in Expo Go. [Expo's Go installer](https://expo.dev/go) offers SDK 58 for Android. This is not evidence that the particular installed phone binary exposes the module: that version is still unverified. The confirmed native failure is that the running binary cannot resolve `ExpoCrypto`. An old/incompatible binary or native registration defect needs a compatible/corrected Expo Go binary, or a newly compiled development build; JavaScript installation and Metro cache clearing cannot supply native code.

Installed Crypto's changelog records Android Expo Modules API 2.0 migration at 58.0.5 and an ABI-related fix at 58.0.7. The missing main crypto entry in the legacy `android.modules` list is intentional for its annotated v2 module. Do not “fix” this by editing node_modules or copying old autolinking entries. Expo also documented a related SDK 58 v2 R8 registration issue in [issue 51180](https://github.com/expo/expo/issues/51180); the local Modules Core changelog includes the fix. That history is context, **not a diagnosis of this uninspected phone binary**. Package checks and Hermes bundles do not prove the installed client contains the native fix.

Actual code correction:

- `backup-files.native.ts` is now a safe facade with no eager native-package imports. Native file operations moved unchanged to `backup-native-implementation.ts`, outside route directories.
- `backup-native-loader.ts` lazily loads native dependencies. It uses Expo's optional native lookup to check `ExpoCrypto`/`ExpoCryptoAES`, `FileSystem` or `ExpoSharing` **before** evaluating packages whose own module initializers would throw. Missing modules become handled availability errors instead of aborting Router imports. Crypto loading still uses the official SHA-256 implementation; there is no fallback checksum or changed backup format.
- `backup-runtime-check.ts` first inspects the dedicated recovery directory, then verifies native SHA-256 against the standard empty-string digest. Only a verified empty recovery directory plus unavailable crypto permits degraded normal app use; backup actions are disabled with update/development-build instructions. Any recovery evidence with unavailable crypto, or inability to inspect files, keeps the gate blocked before providers mount. Existing checksum/schema validation, journal, rollback and replacement semantics are unchanged.
- Sharing loads only on explicit use. A missing sharing module cannot prevent safe recovery or local-save functionality. The backup screen reads actual runtime availability from its provider rather than assuming platform eligibility guarantees native availability.
- `tests/backup-runtime.test.mjs` imports the facade with all optional modules absent, checks that throwing package initializers are never evaluated, exercises deferred/coalesced/retry loading, optional-module probes, correct/incorrect SHA-256 self-checks and empty/unknown/existing recovery evidence. Existing integrity/recovery tests remain unchanged.

Validation for this correction: tests **185/185 passed**, lint **passed**, typecheck **passed**, Expo Doctor **20/20 passed**, Android/Hermes export **passed** (1,788 modules), and web/server export **passed**, all exit 0. Temporary bundle outputs were removed after checks. No physical Android/Expo Go runtime was available here. The exact phone steps and development-build/data-sandbox distinction are recorded at the top of `DATA_BACKUP_ANDROID_TESTS.md`. No clear/reset/uninstall, branch change, notification change, commit or push was performed.
