# Latest Android EAS build report

Reporting date: 11 November 2026. This report records the completed, approved Phase 3B Android development cloud build. Creating this report did not start another build or install anything.

## Build result

| Field | Result |
| --- | --- |
| Build ID | `f6f82f76-eed8-41d5-b5a8-27a06e894bbf` |
| Final EAS status | **FINISHED**; no build error reported |
| EAS build URL | https://expo.dev/accounts/elmagico_aw/projects/momentum/builds/f6f82f76-eed8-41d5-b5a8-27a06e894bbf |
| Direct APK download URL | https://expo.dev/artifacts/eas/7L6VEphcWY-9GwjW1oGdgIpfKELmmePrFhBsV0LAzQI.apk |
| Platform / artifact | Android / APK |
| Profile / environment | `development` / `development` |
| Distribution | `internal` |
| Development client | `true` |
| Credentials source | Existing remote Android credentials on EAS |
| Application name | `MOMENTUM Dev` |
| Android application package ID | `com.beeviro1.momentum.dev` |
| App version / version code | `1.0.0` / `1` |
| Expo SDK | `58.0.0`; installed Expo package `58.0.23` |
| EAS project | `@elmagico_aw/momentum` |
| EAS project ID | `38bb19b4-9b46-444e-b928-2618fcc66e31` |
| Initiating account | `elmagico_aw` |
| EAS created timestamp | `2026-11-11T12:43:50.000Z` (14:43:50 Cairo) |
| EAS completion timestamp | `2026-11-11T12:58:43.046Z` (14:58:43 Cairo) |
| Elapsed creation to completion | Approximately 14 minutes 53 seconds, including queue time |
| EAS CLI | `27.7.2`, Windows x64, Node `26.13.0` |

Exact cloud build command executed:

```powershell
npx.cmd eas-cli@latest build --platform android --profile development --non-interactive --no-wait
```

The request returned after upload; subsequent read-only `build:view` queries confirmed the final FINISHED result and APK URLs. No second build was started.

## Source and upload preflight

- Workspace: `D:\Projects\momentum`.
- Branch: `wip/settings-appearance-language`.
- HEAD: `df1c93d653faa5ff8a60d9eebfe5aa4087e03f29`.
- Phase 3B changes were intentionally uncommitted. `cli.requireCommit` remains `false`. The commit shown on the EAS build page identifies HEAD; it does not mean the build omitted working-tree changes.
- `build:inspect --platform android --profile development --stage archive` generated the local upload candidate at `C:\Users\Beeviro1\AppData\Local\Temp\momentum-phase3b-archive-20261111`.
- Archive inventory: **231 files, 3,036,476 bytes**. All **206 required source/test/script/asset/config files** were present; no required file was missing.
- SHA-256 comparisons found **zero archive/workspace mismatches** before the build and again after completion.
- The archive included `app.json`, all three changed Phase 3B components/hooks, `src/utils/appearance-session.ts`, `tests/appearance.test.mjs`, `SETTINGS_PHASE3B_REPORT.md`, and `CODEX_LATEST_REPORT.md`, plus the existing project source and configuration.
- Archived and resolved app config both had `userInterfaceStyle: automatic`. MOMENTUM Dev name/scheme, Android package, EAS owner/project linkage, original splash, icons and background were preserved.
- Resolved profile confirmed `developmentClient: true`, `distribution: internal`, `environment: development`, `buildType: apk`, and `credentialsSource: remote`. No production profile or identity was changed.
- `.easignore` excludes local repository/agent/editor metadata, dependency/build outputs, environment files, service-account/credential/signing material, APK/AAB outputs, real backup export folders and recovery journal patterns. Excluded directories visible in the inspection tree contained no uploaded files.
- Filename and content scans found no credential/signing file candidates, private-key headers, `private_key`/`client_secret` objects, real portable backup exports or recovery records. All archive JSON parsed successfully in Node; PowerShell's JSON parser rejected the lockfile, so Node was used to complete this check. These are scoped scans, not a guarantee against arbitrary hidden secrets.
- Available local space before the build: C: **3,393,470,464 bytes** (about 3.39 GB); D: **475,417,018,368 bytes** (about 475 GB). Source compression/upload completed successfully; uploaded compressed archive was approximately **1.7 MB**. No global cache deletion was performed.

## Signing and update compatibility

Read-only EAS credential inspection found an existing remote keystore for `com.beeviro1.momentum.dev`. No signing credentials were created, rotated, downloaded or changed.

| Signing field | Finding |
| --- | --- |
| Credential configuration | `Build Credentials Z-GLRxdOAm` (Default) |
| Type | JKS |
| Certificate SHA-256 | `48:78:9A:D3:4B:D3:B0:93:A1:7D:1C:A7:BB:B4:C8:7C:66:B5:E2:4F:18:B0:34:81:EE:50:DB:9E:2A:E2:91:6E` |
| Certificate SHA-1 | `B9:2D:9D:1C:E7:B7:48:01:AC:EF:AB:B0:82:38:FC:4B:71:77:F1:02` |
| Credential age at inspection | Updated two days earlier |
| Actual new build selection | EAS explicitly reported using remote Android credentials and keystore configuration `Build Credentials Z-GLRxdOAm` |

Prior EAS build `8120b334-ab2a-4d67-8c39-6c427c935821` finished successfully on 9 November 2026. Its metadata records the same development profile, internal distribution, package ID, app version `1.0.0`, and version code `1`.

**Limitation:** signing continuity with the application currently installed on the phone is not cryptographically established. Neither the phone's installed certificate nor the previous APK's signing certificate was inspected. Existing remote credential reuse and matching prior-build identity are supporting evidence, not proof that the installed binary uses this certificate. A certificate mismatch can prevent an in-place update. Do not uninstall or clear app data to work around an installation error. Device installation and compatibility verification require separate approval.

## Validation and warnings

Previously completed Phase 3B validation used as the approved build baseline:

| Check | Exact recorded result |
| --- | --- |
| Full tests: `npm.cmd test` | Exit 0; **223/223 passed**, 18 suites; 0 failed/cancelled/skipped/todo; 3580.1715 ms |
| TypeScript: `npx.cmd --no-install tsc --noEmit` | Exit 0; no diagnostics |
| Expo lint: `npx.cmd --no-install expo lint` | Exit 0; no errors or warnings |
| Expo config introspection | Exit 0; Android automatic appearance resource and `uiMode` configuration handling confirmed |
| Expo Doctor 1.21.6, isolated external invocation | Exit 0; **20/20 checks passed. No issues detected!** |
| Build preflight/post-build `git diff --check` | Exit 0; no whitespace errors |

Tests, lint, TypeScript and Doctor were not rerun during this reporting-only task. Earlier Doctor 1.21.7 CLI startup failures were resolved by the compatible pinned external 1.21.6 invocation; no application dependency change was needed. See `CODEX_LATEST_REPORT.md` for the complete CLI diagnosis.

Build CLI warning: `cli.appVersionSource` is unset and will be required in the future. It did not block this build; no version-source setting was added. EAS reported no Plain text or Sensitive environment variables in the development environment. Git emitted LF-to-CRLF advisories for the four tracked modified Phase 3B files; these were not whitespace errors.

Successful cloud compilation does not certify native live System appearance, navigation-bar contrast, absence of activity recreation, in-place update compatibility, or preservation of on-device data during installation. These remain Android device QA gates. The existing dark native splash is intentionally preserved; a dark launch surface before Light/System is expected. A development client normally needs Metro to serve the current JavaScript.

## Git status and reporting-only boundary

Git status immediately before writing this report matched the post-build state exactly:

```text
 M app.json
 M src/components/app-presentation.tsx
 M src/components/dev-theme-preview.tsx
 M src/hooks/use-theme-preview.tsx
?? CODEX_LATEST_REPORT.md
?? SETTINGS_PHASE3B_REPORT.md
?? src/utils/appearance-session.ts
?? tests/appearance.test.mjs
```

This reporting task adds only:

```text
?? LATEST_ANDROID_BUILD_REPORT.md
```

Application code, existing reports, package manifests/lockfile, native configuration and signing setup were not changed by this reporting task. No APK was downloaded to or installed on the phone. No emulator was launched, Expo Go was untouched, and no app was uninstalled or had its data cleared. No branch switch, commit or push occurred. Stopped for review before device installation.
