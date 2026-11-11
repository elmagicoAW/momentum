# WIP checkpoint preflight: Phases 3B–4A

Scope: existing `wip/settings-appearance-language` branch only. The checkpoint includes reviewed automatic native appearance, the saved Light/Dark/System selector, English/Arabic localization infrastructure (public UI still English/LTR), phase/build reports, migration inventory/plan, tests, and the source-hash portability fix. No Phase 4B work is included.

## Current Expo Doctor warning

Final preflight used the existing external Expo Doctor **1.21.6** with `--verbose`. It completed with **exit 1, 19/20 checks passed**. The sole failing check was “Check that packages match versions required by installed Expo SDK,” reporting the following **patch version mismatches**:

| Package | Installed | Doctor's current recommendation |
| --- | --- | --- |
| `@expo/ui` | 58.0.27 | ~58.0.28 |
| `expo` | 58.0.23 | ~58.0.24 |
| `expo-constants` | 58.0.15 | ~58.0.16 |
| `expo-crypto` | 58.0.7 | ~58.0.8 |
| `expo-dev-client` | 58.0.18 | ~58.0.19 |
| `expo-font` | 58.0.11 | ~58.0.12 |
| `expo-linking` | 58.0.16 | ~58.0.17 |
| `expo-router` | 58.0.30 | ~58.0.31 |
| `expo-sharing` | 58.0.22 | ~58.0.23 |
| `expo-splash-screen` | 58.0.13 | ~58.0.14 |
| `expo-status-bar` | 58.0.4 | ~58.0.5 |
| `expo-symbols` | 58.0.4 | ~58.0.5 |
| `expo-web-browser` | 58.0.7 | ~58.0.8 |

All other Doctor checks passed, including required peer dependencies, config schema, native support-package compatibility, duplicate dependencies and React Native Directory validation. `npm ls --all --json` reported an empty dependency-problems list. Independent comparison with the **installed Expo 58.0.23** `bundledNativeModules.json` checked **28 SDK-managed direct/development packages with zero mismatches**.

These checks detect no missing dependency, peer dependency problem, installed-SDK package-range mismatch or native configuration error beyond Doctor's newer patch recommendations. They do not guarantee that an update contains no important fixes. The online recommendation warning remains unresolved and is being recorded under the user's explicit checkpoint authorization; Doctor is not described as fully passing. No dependencies were installed/updated, no check suppressed and no configuration changed for this warning. Older phase reports retain their historical 20/20 results from those earlier executions.

## Inventory portability correction

`scripts/source-text-hash.mjs` supplies a single helper shared by the audit generator and its tests. It calculates SHA-256 of UTF-8 text after replacing **only CRLF with LF in memory**. It does not trim, rewrite files, discard a BOM, normalize lone CR, or alter other whitespace/content. Backup/domain checksums are unchanged.

The regenerated inventory still covers 157 source files and 1,344 copy candidates. Eleven source hashes changed because of line endings; only hash metadata/policy changed, not candidates, paths, imports or source content. Validation checked 138 tracked files with content equivalent to HEAD against normalized Git content, including `src/app/_layout.tsx`; 12 intentionally modified tracked files and seven new/untracked source files also passed canonical hashing checks. No source files or Git line-ending settings were rewritten.

The last implementation validation passed **246/246 tests**, 18 suites, 0 failed/cancelled/skipped/todo, duration **6470.4222 ms**; TypeScript and Expo lint exited 0. The regression test verifies LF/CRLF/mixed-ending equivalence and detects meaningful content, trailing/leading whitespace, BOM and lone-CR differences. Final checkpoint inspection uses whitespace/index/content verification without installing packages.

Preflight inspection of newly added files also reported one cosmetic whitespace warning: `tests/localization.test.mjs` has an extra blank line at EOF (line 207). This does not affect runtime, hash normalization, tests or compatibility. The checkpoint preserves the reviewed source rather than editing it during this Git-only task. Existing tracked-file whitespace checks passed; Git also emits its usual LF-to-CRLF advisories.

## Checkpoint contents and safety boundaries

The explicit checkpoint list contains the reviewed Phase 3B/3C/4A application source and `app.json`, five test/type-contract files, two audit/hash scripts, the localization inventory, and seven phase/build/checkpoint/migration documents. Earlier Phase 2/3A plans, reports, source and tests already exist in branch history and are retained unchanged.

The regenerated JSON contains relative source paths, normalized source hashes, import links and source-copy excerpts. It contains no personal backup payload or device data. The reviewed report paths are development-command examples; certificate fingerprints are public certificate metadata, not private signing keys. Build/APK URLs were explicitly requested in the saved build reports. No signed authorization query strings, credentials, actual token/private-key material, personal backup exports, APK files, dependency directories or private device records are intended for staging.

All pre-existing phase work/reports are preserved. The hash fix changed only the audit generator, corresponding localization test, inventory JSON, and new shared hash helper. App runtime/preferences/appearance/domain/backup/native source were not changed by that fix. This checkpoint preflight adds only this warning/scope document; it does not migrate screens or activate Arabic.

Before checkpointing, branch HEAD and its live configured upstream `origin/wip/settings-appearance-language` were both `df1c93d653faa5ff8a60d9eebfe5aa4087e03f29`. Protected-by-scope local/remote branch tips were:

- `main`: `cbd23fa13b1b927bf6aaca4db1c5dcf9666ebafb`
- `feature/notifications-wip`: `2111e900b5b33158582cc6ce64309e0ff6923687`

Only the existing WIP branch is authorized for a new commit and normal upstream push. No force push, merge, rebase, reset, clean, amend, branch switch, APK build/install, or device-data operation is included. The final commit hash and actual push/status result will be reported after those operations; this preflight document does not claim they have already succeeded.
