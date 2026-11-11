# Phase 4B-1 Android localization runtime fix

Branch: `wip/settings-appearance-language`. HEAD remains `2ed299cba1ff9b65408915c7f49ee124fc993389`. Phase 4B-1 remains uncommitted. No staging, commit, push, branch change, dependency installation, native configuration change, APK build or device operation was performed.

## Root cause and runtime audit

The physical Android stack reports an undefined `Intl.PluralRules` constructor. `format.ts` previously created NumberFormat, percent NumberFormat, PluralRules and three DateTimeFormat instances together on the first formatting call. Consequently, even a supported number/date operation depended on the unavailable plural constructor. Node's complete Intl implementation concealed this runtime difference in the prior 257 passing tests.

SDK confirmed from package.json: Expo ~58.0.23, React Native 0.88.1. Reviewed the matching [SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/) and [Expo documentation index](https://docs.expo.dev/llms.txt). [Hermes Intl documentation](https://github.com/meta/hermes/blob/main/doc/IntlAPIs.md) documents platform-backed NumberFormat/DateTimeFormat support and platform/version variations; its supported constructor list does not include PluralRules. Node test success is not evidence of device constructor availability. The reported device failure establishes the missing plural constructor; NumberFormat/DateTimeFormat availability on that specific device was not directly probed here.

All localization Intl use was audited with `rg -n 'Intl\.|toLocale' src/i18n`: only NumberFormat and DateTimeFormat remain, behind constructor checks in format.ts. The separate Arabic Today header constructor has been removed in favor of the same guarded date path. No ListFormat, RelativeTimeFormat, formatToParts, formatRange, locale discovery, global polyfill or implicit toLocale call is used in localization. English Today retains its original non-Intl date helper and ungrouped numerals.

## Exact incremental changes

- `src/i18n/format.ts`: replace PluralRules entirely with the [CLDR English/Arabic cardinal rules](https://www.unicode.org/cldr/charts/49/supplemental/language_plural_rules.html). English one/other; Arabic zero/one/two/few/many/other, including fractions and absolute negative values. Number/date formatters are independently lazy and cached. Missing constructors select actual scoped formatting fallbacks; no catch-and-hide path. Invalid dates/nonfinite numeric input still throw.
- `src/i18n/format-fallback.ts` (new): scoped English/Arabic grouping, decimals, percent rounding, Arabic digits/separators/sign marks, and localized Gregorian month/weekday/date/header presentation when the relevant Intl constructor or entire Intl object is absent. Scientific notation is expanded; decimal shifting/rounding uses integer digits to avoid percent multiplication overflow. This is limited to the app's existing formatting policies and two supported locales, not a general-purpose Intl polyfill.
- `src/i18n/today.ts`: route the still-gated Arabic header through guarded formatDisplayDate; English output unchanged.
- `tests/localization-runtime.test.mjs` (new): five focused tests. CLDR comparison covers 2,001 signed integers plus fractions/large counts for each language. Four isolated child processes remove PluralRules, NumberFormat, DateTimeFormat, or all Intl before importing localization. They render all parameterized catalogs in both languages across plural categories, exercise Today, compare number/percent results to intact Intl reference output, verify Gregorian dates/header output, and preserve invalid-input rejection.
- `LOCALIZATION_COPY_INVENTORY.json`: regenerated hashes/dependency graph; 164 source files, 22 route roots, 157 reachable files, 111 candidate files, 1,355 copy candidates. Hash normalization/generator logic unchanged.
- This report (new).

All other uncommitted Phase 4B-1 files and its original report remain present. This fix did not edit any screen/component, dictionary/message resources, theme, preference hook/store, domain helper/data, backup/recovery, navigation, package manifest/lockfile or native configuration. Git diff confirms no tracked changes in src/data, src/hooks, src/utils, package.json, package-lock.json, app.json or eas.json relative to the checkpoint. Existing Phase 3B/3C/4A plans/reports/tests remain intact. Public language remains English/LTR and Language Settings remains read-only; no Arabic/RTL activation.

## Exact validation results

| Command/check | Result |
| --- | --- |
| `npm.cmd test` | Exit 0; 262 tests, 18 suites, 262 pass, 0 fail/cancelled/skipped/todo; duration 4272.0397 ms |
| `npx.cmd --no-install tsc --noEmit` | Exit 0; no diagnostics |
| `npx.cmd --no-install expo lint` | Exit 0; no diagnostics |
| `node scripts/audit-localization.mjs --write` | Exit 0; inventory regenerated with counts above |
| Inventory consistency | Full suite passed exact generated-artifact and source-hash consistency tests, including LF/CRLF portability |
| `git diff --check` | Exit 0; no whitespace errors; Git emits its existing LF-to-CRLF working-copy notices, with no settings changed |
| External compatible Expo Doctor 1.21.6, `--verbose` | Exit 1; 19/20 checks pass; existing patch-version check only |

Doctor command used the existing CLI without installation:

```powershell
node 'C:\Users\Beeviro1\AppData\Local\Temp\momentum-doctor-7441495e4de54f8a984e89e2e3e35524\node_modules\expo-doctor\bin\expo-doctor.js' 'D:\Projects\momentum' --verbose
```

The same 13 patch recommendations remain (installed -> recommended):

| Package | Installed | Recommended |
| --- | --- | --- |
| @expo/ui | 58.0.27 | ~58.0.28 |
| expo | 58.0.23 | ~58.0.24 |
| expo-constants | 58.0.15 | ~58.0.16 |
| expo-crypto | 58.0.7 | ~58.0.8 |
| expo-dev-client | 58.0.18 | ~58.0.19 |
| expo-font | 58.0.11 | ~58.0.12 |
| expo-linking | 58.0.16 | ~58.0.17 |
| expo-router | 58.0.30 | ~58.0.31 |
| expo-sharing | 58.0.22 | ~58.0.23 |
| expo-splash-screen | 58.0.13 | ~58.0.14 |
| expo-status-bar | 58.0.4 | ~58.0.5 |
| expo-symbols | 58.0.4 | ~58.0.5 |
| expo-web-browser | 58.0.7 | ~58.0.8 |

No new Doctor failures: required peers, duplicate dependencies, config schema, native support compatibility and the other checks pass. These recommendations have not been suppressed or applied. They do not provide PluralRules and are separate from this JavaScript runtime fix.

## Android retest and limits

No native rebuild is required: only JavaScript presentation code changed. Physical verification of this fix is pending; isolated Node capability-removal tests are not a substitute for testing the installed Android runtime.

1. Serve the updated project to the existing MOMENTUM Dev development client (`npx.cmd expo start --dev-client --lan -c` if needed). Reload the JavaScript bundle; do not install/uninstall or clear app storage.
2. Open Today from cold start and after visiting another tab. Confirm no constructor error/red screen, unchanged English date/greeting and all bottom-tab labels.
3. Check Today with zero, one and multiple remaining habits, routine plan progress, rest/empty states, achievements summary and accessibility descriptions. Confirm expected English counts and user-entered names remain literal.
4. Select Light, Dark and System in Settings. Revisit Today; change Android Light/Dark with System selected, then with each explicit mode. Resume from background and fully restart; verify saved appearance remains correct.
5. Verify existing habits, goals, routines, achievements and progress still appear. Do not clear data or perform destructive recovery. Arabic and RTL must remain inaccessible/read-only in public Settings.

The fallback covers current supported locales/styles, not future locale additions or Intl option sets. Native platform date/number formatting remains preferred where available and may have platform-specific punctuation differences. Arabic linguistic/visual review and activation remain out of scope. No Phase 4B-2 work started.
