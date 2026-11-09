# MOMENTUM: first independent Android development build

Original plan prepared 2026-11-09. **Local preparation is complete (section 13); the user subsequently completed login/project linking, and the approved profile/archive review is recorded in section 14.** Source upload, signing, cloud build, installation, commit and push remain unperformed and require later approval. The original inspection and proposed sequence below are retained for reference; do not run the document as a script.

## 1. Current project and readiness

| Item inspected | Finding |
| --- | --- |
| Git | On `main`, tracking `origin/main`; HEAD `5482e08` (`Add achievements and gamification`). |
| Working tree | Data & Backup implementation, runtime guards and UI are local/uncommitted. Modified tracked files include package/lock files, root/Settings and persistence-related files. New backup modules, screen, tests, test-file generator and documentation are untracked. Preserve all this work. |
| Configuration source | `app.json` only. No `app.config.js/ts`, `eas.json` or `.easignore` found. |
| App identity today | Name/slug `momentum`, app version `1.0.0`, scheme `momentum`. **`expo.android.package` is absent: no independent Android application ID is configured.** |
| EAS identity | No `expo.owner` or `extra.eas.projectId` configured. Account login, project ownership, quota and credentials have not been queried. Do not assume an existing account/project is correct. |
| Native projects | No `android/` or `ios/` directories. Continuous Native Generation applies: configure app settings/plugins; let the cloud generate native projects. |
| Package manager | npm, `package-lock.json`; no Bun lock. Use Windows `npm.cmd` / `npx.cmd`. |
| Tooling here | Node `v26.13.0`, npm `11.20.0`. SDK 58 reference minimum is Node 22.13.x. No Node replacement is proposed. |
| Development client | `expo-dev-client` is not installed or configured. SDK 58 currently recommends `~58.0.18`; use Expo's installer to resolve it at installation time. |
| Android testing | User confirmed Export Backup, Save to device, Import Preview and Cancel Import in Expo Go without data loss. **Real Restore has NOT been tested on a device.** The latest UI adjustments still need Android verification. |

Installed core/native versions:

| Package | Installed | SDK 58 manifest recommendation |
| --- | --- | --- |
| `expo` | 58.0.23 | Project SDK 58 |
| `react` / `react-native` | 19.3.0 / 0.88.1 | 19.3.0 / 0.88.1 |
| `expo-router` | 58.0.30 | ~58.0.30 |
| `@react-native-async-storage/async-storage` | 2.2.0 | 2.2.0 |
| `expo-crypto` | 58.0.7 | ~58.0.7 |
| `expo-file-system` | 58.0.13 | ~58.0.13 |
| `expo-sharing` | 58.0.22 | ~58.0.22 |
| `expo-modules-core` | 58.0.30 | ~58.0.30 |

The local SDK manifest check covered **27 installed direct dependencies/dev dependencies with SDK recommendations: zero mismatches**. Other direct native dependencies include Expo UI, device/constants, font/image/symbol/splash/system modules, gesture-handler, Reanimated/Worklets, screens and safe-area-context. They must be linked by the new build. `expo-notifications` is not installed; do not add it or configure notification permissions/services. No dependency installation is needed just to write this plan.

Prior implementation checks passed 185 tests, lint/typecheck and Android/Hermes/web bundling. Those are not device Restore acceptance or proof of a cloud build. Planning-pass lint/typecheck results are recorded at the end.

## 2. What we are building

An Android **development client APK**, compiled in Expo's cloud and installed as its own app on the phone. Windows needs internet, Node/npm and Git; local Android Studio, Android SDK, Java/Gradle configuration and Xcode are not required for this cloud route. Android installation uses the completed APK link in the phone browser. See [development-build setup](https://docs.expo.dev/develop/development-builds/introduction/?buildenv=build-with-expo-services) and [APK installation](https://docs.expo.dev/build-reference/apk/).

“Independent” means its own installed binary, native modules, app identity and data sandbox. It does **not** mean an offline production/release app: the normal development profile loads JavaScript from Metro on the computer. Building a self-contained release/preview app, adding Expo Update or submitting to Google Play is separate scope.

The native build must contain Crypto/SHA-256, FileSystem, Sharing and AsyncStorage. Installing JS dependencies or clearing Metro cannot add a native module to an already installed binary. A new native dependency/configuration change requires rebuilding the development APK. Ordinary compatible JS/UI edits normally require only Metro/Fast Refresh. [SDK 58 DevClient](https://docs.expo.dev/versions/v58.0.0/sdk/dev-client/)

## 3. Explicit application-ID and data-isolation check

Proposed identity for approval:

| Application | Android application ID | Data location/intent |
| --- | --- | --- |
| Existing Expo Go | `host.exp.exponent` | Existing real MOMENTUM experience data stays inside Expo Go. |
| New `MOMENTUM Dev` | **`com.beeviro1.momentum.dev`** | New independent sandbox for synthetic Restore testing only. |
| Possible future production MOMENTUM | Not configured or reserved | Must use a separately reviewed production identity; do not ship this development profile to a store. |

Expo's [Android source](https://raw.githubusercontent.com/expo/expo/main/apps/expo-go/android/app/build.gradle) declares `host.exp.exponent`. The proposed development ID is different. Android isolates apps' internal data; using the same `momentum:*` AsyncStorage keys in two different application sandboxes does not share their values. [Android application sandbox](https://developer.android.com/privacy-and-security/security-tips)

**Verified now:** the current project has no Android package ID, and the proposed ID differs from Expo Go's. **Not yet verifiable:** the final generated APK manifest and this phone's installed-package list, because no configuration/build/device inspection has been performed. Those are required acceptance checks below; do not claim an APK already exists or is isolated before checking its resolved identity.

Safety boundaries:

- Keep Expo Go installed. No uninstall, storage clearing, reset, data-directory copying or automatic migration. No command in this plan deletes phone data.
- Different display names, URL schemes, profiles, Git branches or Metro servers alone do not establish data isolation; the Android application ID is the decisive installation identity.
- If `com.beeviro1.momentum.dev` already exists on the phone, identify it before installation. If it contains anything valuable, choose a fresh reviewed development ID instead of replacing/removing it.
- Internal AsyncStorage, app documents and recovery journals are separate. Files explicitly saved to shared Downloads/Files can be selected by either app: use synthetic filenames and a separate test folder. Never pick a real backup for destructive testing.
- A development build cannot automatically read or migrate real Expo Go data. Even Expo account login/project linking does not transfer phone data.

## 4. Approval and credential checkpoints

| Stage | What changes or is disclosed | Who/what is needed |
| --- | --- | --- |
| This plan | Only this Markdown file | No login or cloud access performed. |
| Local preparation | Install DevClient; edit package/lock/config; create EAS profile | Approval of the exact package ID, name/scheme and proposed file changes. |
| Expo authentication | Establish developer CLI session | User signs in privately, including browser/2FA if requested. Never paste passwords, tokens or keystore secrets into chat or source files. |
| EAS project linking | Create/link a remote project and write its ID into app config | User chooses the intended Expo account/organization and authorizes that external project change. |
| Archive inspection | Locally stage the proposed source upload | Review which local/untracked files are included and exclude real backups/secrets if any. |
| Cloud build | Upload source/config/lockfile; consume build quota; compile an APK | Separate explicit approval after the configuration/archive is concrete and reviewable. Review plan/quota before accepting any paid upgrade. |
| Android signing | Sign the independent APK | If EAS requests a keystore, generate/manage one for the **new development ID**, not Expo Go or another app. Some debug-client paths use debug signing without a separate keystore prompt. Review actual prompts; keep credentials private. |
| Phone install / Restore | Install a new application; later replace its synthetic records | User verifies application identity and confirms sandbox-only Restore. No approval for real-data Restore is implied. |

No Google Play developer account, Play service-account JSON, Firebase configuration, notification credentials or Apple membership is needed for this Android APK sideload. An Expo developer account and access to the chosen EAS project are required. Android signing is required, but we are not publishing to a store.

## 5. Future steps after local-preparation approval

### A. Recheck the workspace

Run each command separately in PowerShell; stop on an unexpected failure rather than continuing automatically:

```powershell
Set-Location -LiteralPath 'C:\Users\Beeviro1\Projects\momentum'
git status --short --branch
git log -1 --oneline
node --version
npm.cmd --version
```

Stay on `main`. Preserve every uncommitted backup file. Do not run `git reset`, `git clean`, checkout/stash operations, commits, pushes or notification-branch commands. Existing dirty state is expected.

### B. Install only the SDK-compatible development client

```powershell
npx.cmd expo install expo-dev-client
npx.cmd expo install --check
npx.cmd --no-install expo-doctor
```

Expected new direct dependency is currently `~58.0.18`; Expo resolves the compatible version. Do not use `npm.cmd install expo-dev-client@latest` or upgrade Expo/RN. Review any installer-added plugin and package/lock changes. This downloads dependencies and changes the workspace; it is not authorized during the current planning task.

### C. Configure the explicit development identity

Edit the existing `app.json` **only after approval**, preserving its other fields and current plugins:

```json
{
  "expo": {
    "name": "MOMENTUM Dev",
    "slug": "momentum",
    "scheme": "momentum-dev",
    "android": {
      "package": "com.beeviro1.momentum.dev"
    }
  }
}
```

This is a **partial illustration to merge**, not a replacement app.json. Retain adaptive icons, dark design, splash/router plugins, version and existing Android settings. The distinct scheme helps route development links to the correct app; the package ID creates the installation separation. DevClient may add its generated launch scheme/plugin. Do not hard-code a local IP into app config.

For this first Android-only build, a static development identity is simpler than introducing app.config variants. No production profile will be offered. Later production identity/variants require separate review. The portable backup format's app ID and AsyncStorage keys remain unchanged. Do not edit backup logic to add a development namespace.

Keep the original slug and preserve existing Expo Go data. EAS can add owner/project metadata; review it. Opening a differently identified experience in Expo Go may show a different experience sandbox, not automatically migrate old values. From this step onward, target **MOMENTUM Dev** explicitly for the new session.

### D. User login and EAS project configuration

Create an Expo account in the browser if needed, then:

```powershell
npx.cmd eas-cli@latest --version
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest whoami
npx.cmd eas-cli@latest init
npx.cmd eas-cli@latest build:configure --platform android
```

The first EAS invocation can download the CLI to npm's tool cache; no global EAS install is needed. Record its version for reproducibility. The user enters credentials privately. Confirm the account/organization in `whoami`; choose/create the intended `momentum` project in `init`, then let EAS supply the real `extra.eas.projectId` (and owner if applicable). Do not invent a UUID, link a stranger's existing project or use `--force`/unattended acceptance. If a prompt asks to commit or configure iOS, stop and review instead.

Inspect changes with:

```powershell
git diff -- app.json package.json package-lock.json
Get-Content -LiteralPath .\eas.json
```

EAS configuration can generate sample profiles; replace/review them so the first setup has only the following intended development profile. [EAS setup](https://docs.expo.dev/build/setup/)

### E. Exact proposed eas.json

```json
{
  "cli": {
    "requireCommit": false
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "environment": "development",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

`developmentClient` supplies the developer launcher, `internal` is for direct distribution, and `apk` makes a phone-installable file rather than a Play-oriented AAB. No custom Gradle command, production profile, submission, cloud Update, notification settings or environment secrets are needed. Android native folders will be generated on the cloud builder, not edited manually. [SDK 58 DevClient](https://docs.expo.dev/versions/v58.0.0/sdk/dev-client/), [APK profiles](https://docs.expo.dev/build-reference/apk/)

`requireCommit:false` deliberately preserves the current no-commit requirement. The default EAS upload workflow includes uncommitted/untracked working files unless ignored. Setting it true would switch to last-commit/full-Git behavior and risk omitting Data & Backup. No `EAS_NO_VCS` override is needed. Build metadata may still show `5482e08`; that alone does not describe the uploaded dirty source. [Official project-upload rules](https://docs.expo.dev/build-reference/project-upload/)

### F. Validate identity, source archive and checks before build approval

```powershell
npx.cmd expo config --type public
npx.cmd eas-cli@latest config --platform android --profile development
npm.cmd test
npx.cmd --no-install expo lint
npx.cmd --no-install tsc --noEmit
npx.cmd --no-install expo-doctor
```

Verify resolved Android package is exactly `com.beeviro1.momentum.dev`, display name is `MOMENTUM Dev`, DevClient is present, project/account is correct and the profile produces an APK. Never accept `host.exp.exponent` as this project's package ID. Do not paste configuration output containing secrets; no secrets are needed for this build.

Inspect a local copy of the upload, in a fresh temporary directory outside the source tree:

```powershell
$momentumArchivePath = Join-Path $env:TEMP ('momentum-eas-archive-' + [guid]::NewGuid().ToString('N'))
npx.cmd eas-cli@latest build:inspect --platform android --profile development --stage archive --output $momentumArchivePath
Get-ChildItem -LiteralPath $momentumArchivePath
Get-FileHash -LiteralPath .\src\app\data-backup.tsx -Algorithm SHA256
Get-FileHash -LiteralPath (Join-Path $momentumArchivePath 'src\app\data-backup.tsx') -Algorithm SHA256
```

This stage does not start a cloud build. Check the two hashes match; if an archive wrapper directory changes where files are located, identify the archive root before comparing. Confirm new `src/data/backup-*`, `src/hooks/use-data-backup.tsx`, the updated screen, app/eas config and lockfile are included. Do not proceed if only stable-commit source is present.

By default EAS uses `.gitignore`; a future `.easignore` would replace those ignore rules and must retain their exclusions. Review the archive for real backup JSON, credentials and irrelevant local artifacts; none belong in the upload. Synthetic fixture generation already uses the OS temp directory. Only create `.easignore` if review shows a need, and approve/review that file before uploading. [Archive inspection and ignore rules](https://docs.expo.dev/build-reference/easignore/)

**Stop here and present the concrete local diff, resolved package/account/profile, archive verification, tests and current quota. Wait for explicit cloud-build approval.** No commit is required or authorized.

## 6. Cloud build, only after the separate build approval

```powershell
npx.cmd eas-cli@latest build --platform android --profile development
```

This is the first command in the plan that actually requests a cloud build. It uploads the reviewed working source and consumes quota. Confirm any signing prompts refer to the development package. Do not submit to Google Play, change the SDK or accept a paid plan automatically. If asked to run the completed APK in an emulator, decline unless an emulator is intentionally in use; use the physical-phone install link instead.

Save the build URL/ID. For later status, substitute the actual ID in the quoted placeholder:

```powershell
npx.cmd eas-cli@latest build:view 'ACTUAL_BUILD_ID'
```

Treat shared internal installation links as access to a development binary, not public release links. The cloud build uploads **source code**, not an automatic copy of the phone's AsyncStorage or local backups. No MOMENTUM backend/account/sync feature is introduced.

## 7. Phone installation and final separation verification

1. Open the completed build page/install link on Android. Download the **APK**, not an AAB. Check the artifact/build details and native build logs correspond to the approved package ID. If tooling is needed to read the APK manifest, do that before installation; do not infer its identity solely from the icon/name.
2. If prompted, allow “Install unknown apps” only for the browser/Files app used to open this APK. No USB debugging is required for browser installation. Revoke that install-source permission later if desired.
3. The installer must identify the new **MOMENTUM Dev** application. If it proposes replacing/removing Expo Go, or an existing app whose identity is uncertain, **cancel**. No workaround here involves uninstalling Expo Go or clearing its data.
4. Confirm Android's app list contains **both Expo Go and MOMENTUM Dev**. Open MOMENTUM Dev directly from its own icon; it should initially have no real MOMENTUM records. If unexpected existing data appears, stop and verify package/sandbox/device-backup history before destructive testing.
5. Optional, if Android platform-tools/USB debugging already exist, these read-only checks provide additional installed-identity evidence; do not install Android Studio just for them:

```powershell
adb shell pm list packages | Select-String -Pattern '^package:host\.exp\.exponent$|^package:com\.beeviro1\.momentum\.dev$'
adb shell dumpsys package com.beeviro1.momentum.dev | Select-String -Pattern 'userId=|dataDir='
adb shell dumpsys package host.exp.exponent | Select-String -Pattern 'userId=|dataDir='
```

Distinct package/UID/internal-directory evidence establishes separate app storage. If ADB is unavailable, verify the generated APK identity and separate Android app entries before proceeding. A reused dev package updates its own previous sandbox; it does not create another empty sandbox each build. Reinstalling with a different signing key can fail—do not respond by deleting valuable data.

## 8. Run the independent app from Windows

```powershell
npx.cmd expo start --dev-client --lan
```

Keep the computer and phone on the same reachable Wi-Fi, allow Node through Windows Firewall for the appropriate private network, and open the development-client QR/session **inside MOMENTUM Dev**, not Expo Go. Leave Metro running. Expo login is a developer-tool identity, not a MOMENTUM user account. If LAN routing is blocked, diagnose the network first; a separately approved `--tunnel` session may require additional tooling and routes developer traffic through an external service.

Expect the DevClient launcher/developer menu on first use. It is development UI, not a new MOMENTUM screen. A blank loader waiting for Metro is not evidence of data loss. If backup native capabilities are unavailable, keep its recovery gate intact; inspect the native build/linking and rebuild rather than replacing SHA-256 or bypassing validation. [Using a development build](https://docs.expo.dev/develop/development-builds/use-development-builds/)

## 9. First real Restore test: synthetic data only

Do this only after section 7 establishes the new application's identity/sandbox. Keep the Expo Go installation with real data closed during replacement tests. Nothing here authorizes Restore into Expo Go or import of a real personal backup.

1. On the computer, generate known synthetic backups:

```powershell
node --import ./tests/support/register.mjs scripts/create-backup-test-files.mjs
```

The command prints a new OS temp folder. It uses synthetic fixtures and Node's SHA-256, not device data. Transfer these files to a clearly labeled `MOMENTUM TEST ONLY` folder on the phone, e.g. over USB. Do not mix them with real exported backups.

2. In **MOMENTUM Dev**, preview `TEST-valid.json` and cancel first. Then explicitly confirm replacement in this disposable sandbox. Verify profiles, goals, routine order, awards/acknowledgements, schedules, legacy history and Tick/Count/Checklist snapshots. Legitimate deleted-habit/step references are intentional fixtures; do not repair/fabricate them.
3. Export synthetic **A** to the test folder. Change a test habit/target/step, reorder a routine, change goal/profile and add a check-in; export synthetic **B**.
4. Preview A and cancel; verify B is still present. Preview A again, acknowledge replacement, confirm, and verify A returns while B-only keys/dates disappear. Inspect all screens, then force-close/reopen only MOMENTUM Dev and verify again. Original achievement times/seen state and historical snapshot rules must remain preserved through restore.
5. Save the local recovery copy; verify it represents B. It is raw, unencrypted and local to this development app. No internal recovery file should be read from Expo Go.
6. Attempt checksum-error, unsupported-version, truncated, oversized and archive-only synthetic files. Each must reject without changing current dev data. Preview the empty fixture and cancel; any empty replacement test is confined to this sandbox after saving A/B externally.
7. Verify native SHA-256/file picker/local save/sharing in this binary, fixed Back access while scrolled, deduplicated notes, large fonts, TalkBack and Android gesture/three-button safe areas. Leave process-death/native write-failure injection to controlled disposable-device tests; do not fill the main phone's storage or weaken the recovery gate.
8. Do not scan the new development QR into Expo Go. If checking the original Go experience, use its existing entry/identity; do not import/restore/reset it. If it unexpectedly appears empty after project linking, stop and investigate experience identity rather than clearing or replacing its data. Record the development build ID, package ID, device version, test files, expected/actual outcomes and failures. Stop real Restore rollout if any verification fails.

Full cases remain in [DATA_BACKUP_ANDROID_TESTS.md](DATA_BACKUP_ANDROID_TESTS.md). A successful synthetic development Restore is the next acceptance milestone; it is not yet tested and does not by itself authorize real-data migration or a release.

## 10. Costs, limits and what is not promised

As checked on 2026-11-09, Expo's [pricing page](https://expo.dev/pricing) lists a $0 Free tier with up to **15 Android and 15 iOS builds**, a low-priority queue and a **45-minute build timeout**. Starter is listed at **$19/month plus additional usage**, with build credits and higher priority. Verify the actual account's current allowance, renewal rules, queue and billing before launch; no account usage was accessed here and a free remaining build is not guaranteed. No paid upgrade is authorized by this plan.

Queue wait, dependency downloads/build failures and worker resource limits can delay completion. Do not promise an exact completion time or assume repeated failed/rebuilt jobs are free. Native/config changes can require another build; compatible UI/JS iteration through Metro avoids needless rebuilds. Cloud build requires internet and uploads reviewed source; the development app normally also needs Metro reachable. Windows cloud builds do not require a local emulator, and this Android sideload does not incur a Play Store submission fee.

## 11. Proposed file changes after approval and exit criteria

Expected preparation edits only:

- `package.json` / `package-lock.json`: SDK-compatible `expo-dev-client` and its resolved dependencies.
- `app.json`: approved development name/scheme/package, DevClient plugin if added by installation/configuration, real EAS project linkage; preserve existing native settings and plugins.
- New `eas.json`: the reviewed development-only APK profile.
- Optional `.easignore` only if archive review justifies it, preserving `.gitignore` exclusions.

No backup schemas/validation/journals/coordination changes, no notifications, no generated native edits, no branch operations, commit or push. Keep this planning document updated with actual preparation/build/test results in the later approved tasks.

Ready to request cloud-build approval only when: user confirms account/project and package ID; resolved config and source archive match; SDK checks/tests/lint/typecheck/Doctor pass; build cost/quota/signing handling is understood; no source or secret is unintentionally uploaded. Ready to test Restore only after the resulting APK's separate application identity is verified. Ready for real-data Restore remains a later review decision.

## 12. Planning-pass verification

- Read-only repository/config/package/native-module inspection completed. All 27 locally checked SDK-manifest package versions matched. No EAS CLI/auth/config/build command was executed.
- `npx.cmd --no-install expo lint`: passed, exit 0.
- `npx.cmd --no-install tsc --noEmit`: passed, exit 0.
- Only `ANDROID_DEV_BUILD_PLAN.md` was written by this task; the pre-existing uncommitted Data & Backup work is preserved. Branch remains `main` at `5482e08`. No setup/install/build/commit/push was performed. All future commands in this document remain unexecuted.

Official sources reviewed: [SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/), [Expo LLM index](https://docs.expo.dev/llms.txt), the linked DevClient/development-build/APK/setup/upload/ignore/Android/privacy/pricing pages, [EAS CLI reference](https://docs.expo.dev/eas/cli/), [EAS configuration schema](https://docs.expo.dev/eas/json/), [build profiles](https://docs.expo.dev/build/eas-json/) and [app variants](https://docs.expo.dev/build-reference/variants/). Expo now calls EAS Build “Expo Build” in parts of the docs; the `eas-cli` commands and `eas.json` remain the relevant tooling.

## 13. Approved local preparation: completed, awaiting next approval

Completed on `main` with HEAD still `5482e08`. A pre-change SHA-256 inventory of 202 existing tracked/untracked files was captured in session memory to distinguish this task's edits from the existing uncommitted backup work. No pre-existing source/test/script file was changed or removed by preparation.

Exact files changed by this task:

| File | Actual change |
| --- | --- |
| `package.json` | Added only the direct dependency `expo-dev-client: ~58.0.18` relative to the pre-task working file. Existing backup dependencies, scripts, Expo SDK and React Native versions retained. |
| `package-lock.json` | Resolved DevClient 58.0.18 and six supporting packages: dev-launcher 58.0.18, dev-menu 58.0.12, dev-menu-interface 58.0.1, manifests 58.0.1, json-utils 58.0.1 and updates-interface 58.0.1. This does not add the full `expo-updates` module or configure OTA updates. |
| `app.json` | Changed only `expo.name` to `MOMENTUM Dev`, `expo.scheme` to `momentum-dev`, and added `expo.android.package: com.beeviro1.momentum.dev`. The original JSON settings, plugins, icons, splash, dark theme, slug, version, web/iOS settings, experiments and Android back behavior were compared against the pre-task config and preserved. |
| New `eas.json` | Added exactly the development-only profile in section 5E: `developmentClient:true`, `distribution:internal`, `environment:development`, `android.buildType:apk`, and `cli.requireCommit:false`. No production/submit/signing configuration or project ID was added. |
| `ANDROID_DEV_BUILD_PLAN.md` | Updated preparation status and recorded these actual decisions/results. |

Installation used the authorized `npx.cmd expo install expo-dev-client`. The initial sandbox attempt failed during its network compatibility lookup with EACCES; the network-enabled approved retry succeeded, adding seven packages. No EAS CLI, account login, `init`, `build:configure`, `build:inspect`, build, signing or phone command was run.

### EAS schema and uncommitted source handling

Before writing the commit option, checked the [current official schema source](https://raw.githubusercontent.com/expo/eas-cli/main/packages/eas-json/src/schema.ts): `requireCommit: Joi.boolean()` belongs under **`cli`**, not a build profile. The [official build-profile schema](https://raw.githubusercontent.com/expo/eas-cli/main/packages/eas-json/src/build/schema.ts) accepts the selected boolean `developmentClient`, `internal` distribution, `development` environment name and Android `apk` build type. The [current reference](https://docs.expo.dev/eas/json/) documents false as the default for `cli.requireCommit`. This was a review against official schema definitions; no account-aware EAS CLI configuration command was invoked.

The [default upload workflow](https://docs.expo.dev/build-reference/project-upload/) copies uncommitted and untracked working files subject to ignore rules. We explicitly keep `cli.requireCommit:false`. No `.easignore` or VCS environment override was added. A read-only `git check-ignore --no-index` inspection of source/test/script paths found none excluded by the current rules. This protects eligibility for a future archive; **the actual EAS archive is not yet generated or verified**, because its inspection step is deferred past the authorized local-only boundary. Do not substitute a build from the last pushed commit or enable the full-Git/clean-commit workflow.

### DevClient plugin behavior

The installer did not add an explicit DevClient plugin to `app.json`; the existing plugin list is identical to the baseline. Installed SDK 58 prebuild configuration lists `expo-dev-client` among its default plugins. Its plugin handles the generated launch scheme/launcher/menu when cloud prebuild runs. No custom launcher/plugin options or native folders were needed for local preparation.

### Resolved configuration and exact checks

`npx.cmd --no-install expo config --type public --json` passed, exit 0, and resolved:

```text
name:            MOMENTUM Dev
slug:            momentum
scheme:          momentum-dev
android.package: com.beeviro1.momentum.dev
sdkVersion:      58.0.0
version:         1.0.0
```

No `owner` or EAS project ID is present. The development package differs from Expo Go's `host.exp.exponent`; actual APK-manifest and installed-phone sandbox verification still await a later build/install approval.

| Check performed after preparation | Result |
| --- | --- |
| `npm.cmd test` | PASS, 185/185 tests, 18 suites; 0 failed/skipped/cancelled; exit 0. |
| `npx.cmd --no-install expo lint` | PASS, exit 0. |
| `npx.cmd --no-install tsc --noEmit` | PASS, exit 0. |
| `npx.cmd --no-install expo-doctor` | PASS, 20/20 checks, exit 0. |
| Local installed-version comparison with `expo/bundledNativeModules.json` | PASS, 28 SDK-managed direct/development packages checked, zero mismatches. |
| Preservation comparison | PASS: all existing app settings except the three approved identity fields unchanged; all existing package-manifest content except the DevClient dependency unchanged; backup source/tests/scripts unchanged. |

Warnings and boundaries:

- npm reported **12 moderate vulnerabilities** during installation (the same total reported previously). No forced audit fixes, unrelated upgrades or SDK changes were applied.
- No blocker found for the authorized local-preparation phase. Account identity, remote project linkage, quota, signing, source archive and native APK verification remain intentionally unverified. EAS may ask to select an app-version source at later setup; none was changed during this phase.
- No login, external project creation/linking, source upload, signing prompt, cloud build, APK install, phone-data access/reset or Expo Go change occurred. No `android/` or `ios/` directory was generated; notifications remain untouched and `expo-notifications` is absent.
- Real device Restore remains untested. The next approval must define login/project-linking and archive-review scope; no approval to start a cloud build or test real data is inferred from local preparation.

## 14. Linked-project configuration and actual archive review

User reported successful login as `elmagico_aw` and linking to `@elmagico_aw/momentum`. This task inspected that existing link without initializing, changing owners, replacing project IDs or creating a project.

### Verified identity and resolved profile

EAS CLI **27.5.0**, Windows x64, Node 26.13.0. Read-only `project:info` confirmed:

```text
fullName:        @elmagico_aw/momentum
project ID:      38bb19b4-9b46-444e-b928-2618fcc66e31
owner:           elmagico_aw
name:            MOMENTUM Dev
slug:            momentum
scheme:          momentum-dev
android.package: com.beeviro1.momentum.dev
SDK:             58.0.0
```

`npx.cmd eas-cli@latest config --platform android --profile development --non-interactive --json` passed, exit 0. It resolved `developmentClient:true`, `distribution:internal`, `environment:development`, Android `buildType:apk` and the default `credentialsSource:remote`. The current `eas.json` retains `cli.requireCommit:false`. Remote credential sourcing describes a future build default; no credentials/signing setup was run or approved here.

The configuration check reported no Plain text or Sensitive variables in the development EAS environment; none are required for this app's present build. This is not a claim about every secret stored in the Expo account. No build-configuration repair was required: **app.json, eas.json and package files were not changed by this task**. In particular, the user's correct project ID/owner remain intact. No `build:configure`, `init`, cloud build or signing command was executed.

Initial sandbox npm/EAS lookups failed with EACCES. The authorized configuration/project-info/archive commands were rerun with network access. They made read-only API requests as needed; archive staging remained local. An offline version lookup was not available in the sandbox cache; the successful version query recorded 27.5.0.

### Actual archive and minimal exclusion change

Ran the documented **archive-only** stage, not pre-build/post-build or cloud build:

```powershell
npx.cmd eas-cli@latest build:inspect --platform android --profile development --stage archive --output 'C:\Users\Beeviro1\AppData\Local\Temp\momentum-eas-review-final-0dd0d9a02304455091fcfeeb5a6a61b3'
```

The first local archive had 231 files: all application/test sources plus `.claude/settings.json`, two `.vscode` files and 28 shallow `.git` metadata files. No private backup JSON or credential-path match was found. Empty ignored artifact directories were not counted as uploaded files.

Created **`.easignore`**, starting with all existing `.gitignore` exclusions. Added narrow exclusions for Git/editor/agent metadata, generated APK/AAB/inspection outputs, environment/signing/service-credential files, private backup/recovery exports and generated manual-test JSON. Actual source, JavaScript/TypeScript synthetic fixtures, all test files, required assets/config and package/lock files remain eligible. `.gitignore` itself was not changed. Excluding `.git` removes shallow history/metadata from the upload without modifying the local repository, disabling Git or changing `requireCommit:false`.

Recreated the archive after applying those rules. Its local path is:

```text
C:\Users\Beeviro1\AppData\Local\Temp\momentum-eas-review-final-0dd0d9a02304455091fcfeeb5a6a61b3
```

Verified contents:

| Category | Actual archive files |
| --- | ---: |
| `src/` | 134 |
| `tests/` | 20 |
| `scripts/` | 2 |
| `assets/` | 23 |
| Required configuration plus project documentation/other root files | 22 |
| **Total** | **201** |

SHA-256 comparisons verified all **186 required source/test/script/asset/config files** against the current working tree, including every uncommitted backup module, screen/provider, persistence-related file, all four backup test files and supporting fixtures/mock/module loader. There were **zero missing or mismatched required files**. Config comparisons include the linked `app.json`, current `eas.json`, `package.json` and `package-lock.json`. The final local copy was refreshed after this report so the report and exclusions themselves are included too.

The final archive contains **zero files** under `.git`, `.expo`, `.claude`, `.vscode`, `.codex`, `.agents`, `.aws`, `node_modules`, `dist`, `web-build`, native `android/ios` or prior inspection-output directories. No APK/AAB, local environment/token configuration, credential/signing filenames, user backup/recovery JSON, generated `TEST-*.json`, or private recovery-journal files were present. Six included JSON files were parsed where valid: none was a portable MOMENTUM backup or an object carrying `private_key`/`client_secret`. A text scan for recognizable private-key headers and common credential-token patterns returned no candidates. These are scoped archive checks, not a guarantee that an arbitrary secret can never be hidden in source. The EAS project ID is public configuration, not a credential.

Synthetic JS fixtures and the test-file generator are intentionally included; generated synthetic JSON lives outside the workspace in a separate OS temp folder. Real backups saved on the phone are not part of this source archive. No archive or phone data was uploaded.

### Tests, costs and approval boundary

- `npm.cmd test`: PASS **185/185**, 18 suites; 0 failed/skipped/cancelled; exit 0.
- `npx.cmd --no-install expo lint`: PASS, exit 0.
- `npx.cmd --no-install tsc --noEmit`: PASS, exit 0.
- `npx.cmd --no-install expo-doctor`: PASS **20/20**, exit 0.
- `.easignore` is the only new configuration file from this review; this plan is the only other edited file. Application/backup code, linked identity, profile and dependencies are unchanged. Main/HEAD remain `main` / `5482e08`; no commit/push or notification/phone-data action occurred.

No configuration or archive blocker remains from these checks. Account billing/remaining quota and Android signing have **not** been exercised or approved. Current official pricing still advertises 15 Android builds on Free with a low-priority queue; confirm remaining account allowance before authorizing a build, and do not accept a paid upgrade automatically. Compilation/native behavior and real Restore remain untested until the independent APK exists and synthetic testing is performed. There is no promise of a free remaining build, exact queue time or successful native compilation.

**Next command, recorded but NOT executed:**

```powershell
npx.cmd eas-cli@latest build --platform android --profile development
```

Stop for explicit cloud-build approval before that command, upload, signing decisions, paid prompts or APK installation. This local archive review did not consume a cloud build request.
