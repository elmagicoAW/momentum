# Android review checklist

The implementation has automated coverage and bundle checks. **Real Android / Expo Go behavior has not been tested in this workspace.** Backups and recovery files are unencrypted. No real user data was used in automated restore tests.

## If Android reports missing ExpoCrypto

The project uses SDK 58 (`expo 58.0.23`), with its recommended `expo-crypto 58.0.7`. JavaScript installation and bundling cannot add native modules to an already installed Expo Go binary. Crypto is documented as included in SDK 58 Expo Go, so a development build is not inherently required just to use SHA-256.

1. Check the installed Expo Go version in Android Settings > Apps > Expo Go (or its About screen). Update **in place** from the Play Store, or consult [Expo's official Go installer](https://expo.dev/go) with SDK 58 and Android selected. Use a current compatible SDK 58 binary, not just any Expo Go release. If an installer asks you to uninstall first, stop; do not remove the app holding your data.
2. Close/reopen Expo Go normally. On the computer stop Metro with Ctrl+C and run `npx.cmd expo start --clear --go`. This clears Metro's JavaScript cache, **not the phone's saved app data**. Open the new QR/session in Expo Go itself.
3. With the guarded loading fix, missing crypto plus a verified empty recovery directory allows normal MOMENTUM use while Data & Backup shows an unavailable explanation. No insecure checksum is substituted. If recovery evidence exists, or the filesystem cannot be inspected, the gate deliberately blocks editing until a compatible runtime can verify recovery.
4. If a current SDK 58 Expo Go binary still cannot expose `ExpoCrypto`, record its exact version and the displayed error. A corrected Expo Go binary or a newly compiled SDK 58 development build containing the native dependencies is required for backups. Reloading JavaScript cannot repair a missing/incorrect native registration. Do not downgrade dependencies arbitrarily, reset storage, or bypass the gate.
5. A development build has a **separate app sandbox**; it does not automatically contain the local data held by Expo Go. Keep Expo Go installed and its data intact. Set up/build the development client separately, and move data only through a verified export and explicit import once that path is available. No development build was created during this fix.

The exact native-side reason on the phone (old/incompatible Expo Go binary versus native registration failure) cannot be distinguished without its installed version and runtime evidence. The JavaScript package versions alone do not prove native availability. SDK 58's Android crypto module migrated to Expo Modules API 2.0; the main module's absence from the legacy module-list configuration is intentional, not a reason to patch node_modules manually.

## A. Main phone: safe export and preview only

1. Start the app with `npx.cmd expo start` and open it in SDK-58-compatible Expo Go. Do not uninstall, clear app data, or change your phone clock. If Expo Go asks to replace/reset existing app data, stop.
2. Open Settings > Data & Backup > Export Backup. Check the summary and any archive warnings. Export reads raw saved records; it does not run a migration or change definitions.
3. Tap **Save to device**, choose a private local folder in Files, and check the generated JSON file exists. Cancel the folder picker once too. A denied/canceled picker must not say “Saved.” Try **Share backup** separately; closing the share sheet does not prove a destination saved it.
4. Tap **Import Backup**, select your exported file, and inspect its date, app version, filename and counts. **Do not check the replacement acknowledgement or tap Replace current data.** Tap **Cancel import**. Your data should remain unchanged.
5. Record any unexpected warnings, unreadable records or mismatched counts and stop restore testing. An archive warning does not mean the raw data was omitted; it means this version cannot safely restore it.
6. Check Android Back, large font/display size, TalkBack and the bottom gesture/three-button navigation area. Critical buttons should be readable and reachable, with no new tab.

Only export, sharing/saving and preview/cancel belong on a main phone with real data. Keep exported files private; another selected app/provider controls any copy you give it.

## B. Prepare a disposable sandbox

Use an emulator, spare device or separate Android user/profile with separate application data. Confirm the sandbox has no real habits before proceeding. A second Metro session or changing a project folder alone is not proof of isolated storage. If isolation is uncertain, stay with section A.

On the computer, generate synthetic input files:

```powershell
node --import ./tests/support/register.mjs scripts/create-backup-test-files.mjs
```

The command prints a new temporary folder and writes only synthetic files there. It does not read the phone's data or use real AsyncStorage. Copy the files to the sandbox's local Files folder, for example over USB.

## C. Destructive replacement tests — sandbox only

1. Import `TEST-valid.json`. Preview and explicitly confirm replacement. This fixture includes all nine storage families, Tick/Count/Checklist history, v1 shadows, ordered routines, a linked goal, a synthetic profile and known/unknown-versioned badge evidence. Deleted habit/step references are intentional.
2. Inspect Today, Habits, Goals, Routines, Insights, Profile and Achievements. Export **A**. Note counts, routine order, profile/avatar/prompt, awards and acknowledged badges. Historical Count target is 8 although the current target is 12; the old Checklist required IDs differ from current steps. They must not be rewritten to match current definitions.
3. Change only sandbox data: add a habit/check-in, change the Count target, rename a checklist step, reorder a routine, change the goal status and edit the profile. Export **B** as an additional safeguard.
4. Import A. Verify comparison, cancel once and verify B remains. Import A again, acknowledge replacement, then explicitly confirm. Verify A's complete raw contents return and B-only records disappear. Force-close/reopen and check all screens again. Do not treat newly recomputed, derived Insights metrics as independent backed-up records.
5. Save the local recovery copy. It should contain B's exact raw data, including its key presence. Keep it outside the app. Test **Remove recovery copies** with Cancel first, then explicit removal; current app data must remain unchanged. Uninstall/clear data can erase internal recovery copies.
6. Try `TEST-bad-checksum.json`, `TEST-unsupported.json`, `TEST-truncated.json`, `TEST-oversized.json` and `TEST-archive-only.json`. Every import must reject before replacement, preserve current data, and provide a clear error. Test picker cancellation and a non-JSON file too. Do not edit a real backup to make these cases.
7. Preview `TEST-empty.json`. It must warn prominently that replacement removes all current user data. Cancel. If testing empty replacement, do so only after A/B have been saved outside this disposable sandbox.
8. Try rapid check-ins, midnight via deterministic developer tests (not phone clock changes), and app background/foreground during picker/sharing. Pending/failed daily saves must delay or abort restore; a timeout must never permit replacement.
9. Real native low-space, partial-write and process-death injection remain developer checks. Use an isolated device and controlled fault tooling, never fill your main phone. During an unresolved recovery the app must block editing and offer Retry / Save recovery copy / Share recovery copy. Never clear app data to “fix” a failed recovery.
10. Repeat the core export/import round trip in an Android development build before release. Expo Go inclusion and successful bundling do not establish device runtime behavior.

## Remaining device checks

- SDK 58 Expo Go native picker results/cancellation and local directory write/read-back.
- Android content providers with absent/incorrect MIME or file size, rejected folder access, sharing receiver lifetime and low-space errors.
- TalkBack focus/announcements, large fonts, hardware Back, process recreation, gesture and three-button safe areas.
- No initial Today normalization or achievement backfill writes during restored hydration; later explicit edits/foreground achievement refresh behave normally.
- Real native interruption/rollback and development-build parity. There is no claim of atomic multi-key storage or guaranteed survival of OS/device storage loss.
