# Phase 4A: English/Arabic localization infrastructure

Implementation and audit only. Branch remains `wip/settings-appearance-language`; HEAD remains `df1c93d653faa5ff8a60d9eebfe5aa4087e03f29`. No screen migration or Arabic/RTL activation is included. Stop for review before any later phase.

## Outcome and preservation

Read the Settings Appearance/Language plan and Phase 2/3A/3B/3C reports. The user reports that Phase 3C physical Android tests passed for the selector, persistence across restart, Cancel and live System appearance. That evidence is retained as user-reported Phase 3C acceptance; Phase 4A does not claim new physical Arabic or RTL testing.

Before editing, captured SHA-256 hashes for **208 existing source/test/script/report/config files**. Final comparison found exactly **six intentionally changed existing files**: the five existing `src/i18n/` files and one numbering-policy assertion in `tests/presentation-foundation.test.mjs`. **202 existing files are byte-for-byte unchanged; none is missing.** All uncommitted Phase 3B/3C application changes, their tests, and all existing reports are preserved byte-for-byte.

No route, screen, component, provider, hook, domain utility or `src/data/` file changed in Phase 4A. In particular, `useLanguage` still pins the public language/direction to English/LTR; Language Settings is still read-only English; the working Appearance selector/theme authority/session are unchanged. Existing preference error strings used by the product remain unchanged. No key/provider remount, default-preference write, global locale setter or device-locale discovery was added.

No app.json/native configuration, package manifests, lockfile, dependencies, signing or EAS settings changed. No APK build, installation/uninstallation, device-data clearing, branch change, commit or push was performed. The new audit reads source files, and tests use synthetic fixtures; no real user/device data was accessed.

## Infrastructure delivered

- **147 fixed semantic labels** in English/Arabic across common controls, navigation, Today/greetings, Habits, Goals, Routines, Insights, Profile, Settings, Achievements, accessibility, validation and backup/recovery. These are seeds for future migration, not complete screen coverage. Arabic wording is draft Modern Standard Arabic and requires native review.
- **26 complete parameterized messages**, including **11 cardinal plural messages**. Fixed labels use the backwards-compatible `translate(language, key)`. Templates use `formatMessage(language, key, namedParams)` or typed descriptors with `translateMessage`.
- TypeScript derives each template's required parameter names from the canonical English templates. Count/progress/limits/positions are numbers; user text, dates and versions are strings. Fixed and parameterized keys are separate APIs. Mapped descriptor unions preserve the relationship between key and parameters. A compiled test fixture verifies invalid keys, missing/extra/mistyped parameters, descriptor mismatch and incomplete Arabic plural forms are rejected.
- Catalog validation checks key/shape/parameter parity, nonempty forms, simple named-placeholder syntax, collisions and all six Arabic cardinal categories. Arabic zero/one/two sentences can naturally omit a printed count while still requiring `count` for plural selection; every form may use only declared parameters.
- Rendering uses `Intl.PluralRules`, not English `count === 1` logic. Zero/one/two/few/many/other and fractional selection are tested. Message counts must be finite and nonnegative. Numeric values are localized at display time; string values remain literal, including braces, `$&`, markup-like text, mixed scripts and newlines. There is no expression evaluation, recursive interpolation or general ICU engine.
- Missing translations fall back to canonical English. Invalid parameters or unknown keys return a safe generic English message in normal mode; strict test translators throw `LocalizationError` codes. Development diagnostics and injected diagnostic hooks receive codes only, never user parameter values. Unknown native errors are not echoed or classified by their English text.
- `PresentationError` and error-descriptor helpers are unused presentation-boundary infrastructure. They copy/freeze descriptors for later rendering; they do not wrap domain/backup errors, change `RecoveryBlocked` classification, serialize descriptors or alter validation results.
- Explicit display policy: `en-US` with Latin digits, `ar-EG` with Arabic-Indic digits, Gregorian calendar for dates. Bounded per-language Intl caches cover numbers, percentages, cardinal rules, local dates, month/year and weekdays. Local keys are validated and parsed from local parts, preserving calendar identity across timezones. Date ranges display full endpoints without depending on `Intl.formatRange` support.
- `normalizeNumericInput` is an **unused opt-in boundary helper**, supporting Arabic-Indic and Eastern Arabic-Indic digits without stripping separators or parsing values. Existing ASCII-only validators and all validation decisions remain unchanged. It must not be applied to user names, notes, units or machine keys.

## Copy coverage and migration artifacts

See [LOCALIZATION_COPY_INVENTORY.json](LOCALIZATION_COPY_INVENTORY.json) for exact source files, hashes, line-numbered candidates and import dependencies. It records **157 TS/TSX source files**, **22 route/layout roots**, **150 files in a conservative dependency closure**, and **1,344 candidate occurrences across 111 files**. The reachable closure contains **1,337 candidates in 107 files**. Candidates include technical false positives and repeated strings; they are not a unique-message count or a translation-completion metric.

The audit intentionally includes native/web variants and errors/metadata outside JSX. It can miss computed copy, lower-case fragments, arbitrary dynamic imports and OS/dependency-owned messages; type-only imports can overstate reachability. Every route is included as a root. Generic components with no literals can still display metadata supplied by parents. Tests verify deterministic regeneration, source hashes, route coverage and inclusion of important validator/Insights/achievement/backup/recovery producers.

See [LOCALIZATION_MIGRATION_PLAN.md](LOCALIZATION_MIGRATION_PLAN.md) for a feature-by-feature source/producer inventory and future migration order: common/navigation/Settings/Profile pilots; forms and validation boundaries; Today/routine progress; Goals/Insights; achievement metadata; backup/recovery with dedicated safety review; then closure audit and separately approved Arabic/RTL activation.

Key backlog items remain full badge names/criteria/details, quote text/attribution policy, detailed Insights/provisional/unknown summaries, exact form/helper copy and accessibility announcements, and all schema/checksum/runtime/restore/recovery instructions. Native/OS share/save/IME strings need device review. No claim of full product translation or Arabic accessibility certification is made.

The future plan preserves achievement IDs/metrics/thresholds, route identifiers, tracking and schedule keys, current domain calculations, validation decisions, local ASCII date keys, raw user text, raw records, backup v1 schemas/checksums/allowlist and recovery journals. Later presentation adapters must classify safety errors before rendering them, never match translated English error text.

## Changed files in Phase 4A

Modified existing files:

1. `src/i18n/en.ts`: expanded fixed English semantic labels; the seven existing preference/Retry entries remain unchanged.
2. `src/i18n/ar.ts`: matching expanded fixed Arabic labels.
3. `src/i18n/types.ts`: typed template parameters, plural dictionaries and discriminated message descriptors; retains a narrower static preference-error descriptor for current callers.
4. `src/i18n/translate.ts`: backwards-compatible fixed-label translation plus typed named-template/descriptor rendering, diagnostics and fallback.
5. `src/i18n/format.ts`: explicit locale/numbering/Gregorian policy, cached formatters, validated local-date range/month/weekday display and unused digit normalizer.
6. `tests/presentation-foundation.test.mjs`: changes only the Arabic-year assertion to explicitly request `ar-EG`/`arab` instead of assuming the engine's default Arabic numbering system. The existing Gregorian-year/data-key test and all other tests are retained.

Added files:

7. `src/i18n/en-messages.ts`: canonical complete English templates/plurals.
8. `src/i18n/ar-messages.ts`: matching Arabic templates and six-form cardinals.
9. `src/i18n/catalog.ts`: placeholder extraction and test/build-time catalog contract checks.
10. `src/i18n/errors.ts`: presentation-only typed error helpers.
11. `tests/localization.test.mjs`: 13 focused runtime/audit/isolation tests.
12. `tests/support/localization-typecheck.ts`: nonexecuted compile-time API contract fixture included in normal TypeScript checks.
13. `scripts/audit-localization.mjs`: source-only audit; `--write` refreshes only the root JSON inventory, otherwise emits JSON to stdout.
14. `LOCALIZATION_COPY_INVENTORY.json`: reproducible inventory artifact (247,161 bytes at handoff).
15. `LOCALIZATION_MIGRATION_PLAN.md`: coverage review, constraints, backlog and future feature migration gates.
16. `SETTINGS_PHASE4A_REPORT.md`: this report.

Git status also contains all earlier Phase 3B/3C modifications/untracked reports. Those are preserved prior work, not additional Phase 4A edits. No existing report was overwritten.

## Exact validation results

| Command / check | Final result |
| --- | --- |
| `npm.cmd test` | Exit 0; **245 tests**, 18 suites; **245 passed**, 0 failed/cancelled/skipped/todo; **7296.6201 ms** |
| `npx.cmd --no-install tsc --noEmit` | Exit 0; no diagnostics; includes the negative/positive localization type-contract fixture |
| `npx.cmd --no-install expo lint` | Exit 0; no errors or warnings |
| Previously working external Expo Doctor **1.21.6**, `--verbose` | Exit 0; **20/20 checks passed. No issues detected!** |
| `git diff --check` | Exit 0; no whitespace errors; LF-to-CRLF advisories only |
| Source-only inventory regeneration | 157 files / 22 route roots / 1,344 candidates; reproducibility and hashes verified by tests |
| SHA-256 preservation comparison | 208 baseline files checked; six intentional foundation/test changes, 202 unchanged, zero missing; all Phase 3B/3C files/reports unchanged |

Exact Doctor invocation (existing external CLI; no installation):

```powershell
node 'C:\Users\Beeviro1\AppData\Local\Temp\momentum-doctor-7441495e4de54f8a984e89e2e3e35524\node_modules\expo-doctor\bin\expo-doctor.js' 'D:\Projects\momentum' --verbose
```

The full suite retains its expected achievement failure-injection save/retry console diagnostic. Initial checks caught two TypeScript union/indexing issues and the old test's implicit Arabic-digit expectation; these were corrected before the final passing results. No validation branch was changed, no lint rule suppressed and no existing test removed.

The 13 new tests cover catalog/key/parameter/form parity and malformed catalogs; literal named substitution; all Arabic cardinal categories and fractions; strict invalid-key/parameter rejection; production fallback/privacy; copied/frozen error descriptors; Gregorian/number formatting; optional input normalization without parser changes; local calendar identity across UTC, Cairo, New York and Kiritimati; exact backup v1 body/checksum and user-record/achievement-ID isolation; closed language gate/working appearance source; and reproducible inventory coverage. They use Node Intl and synthetic data, not Hermes/device storage. Existing preference/restore/rollback/recovery/appearance tests also pass unchanged.

## Remaining risks, rebuild requirements and next review

No native rebuild is required for Phase 4A: no dependency, native API integration or app/native configuration changed. The already installed user-tested APK remains suitable for English/Appearance regression checks with Metro. No build or installation was performed here.

Before any Arabic activation: finish feature catalogs and English-only migration, manually reconcile computed strings and metadata, obtain native Arabic wording review, verify Arabic-Indic digits/Gregorian formats/shaping on Hermes, and physically test accessibility, chart semantics, input behavior, recovery overlays and RTL/native navigation in both device locales and all appearance modes. Desktop catalog parity is not proof of correct Arabic grammar or RTL usability. Any future OS per-app language metadata/native configuration is separate scope and may need a rebuild.

Public app remains English/LTR. Appearance selection/persistence/System behavior are preserved. Stop after Phase 4A for review; translating screens, activating the Language selector or Arabic/RTL, changing schemas, adding dependencies and building/installing another APK remain unauthorized.

Reference checks: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo localization guide](https://docs.expo.dev/guides/localization/), and [ECMA-402 plural rules](https://tc39.es/ecma402/#sec-intl.pluralrules.prototype.select). Existing project plan/report constraints take precedence over optional guide dependencies.
