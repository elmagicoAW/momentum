# WIP checkpoint preflight — Phases 4B, 4C and 4D

Base checkpoint: `2ed299cba1ff9b65408915c7f49ee124fc993389`. Authorized branch/upstream: `wip/settings-appearance-language` / `origin/wip/settings-appearance-language`. This is a WIP checkpoint, not release work. The resulting commit hash and remote verification are reported in the completion response rather than embedded in the commit itself.

## Acceptance and scope

The user reports physical Android acceptance of Arabic localization, mirrored tab navigation, improved RTL layout, switching back to English, and persistence after reopening the app. The Dev client reload issue was resolved by force-stopping/reopening. No device action was performed for this checkpoint, and no app data was altered or cleared.

Scope: consolidated typed English/Arabic copy, runtime-safe Intl fallbacks, save-first language persistence and accessible selector, runtime RTL/LTR without language-driven provider remounts, targeted Arabic visual fixes, associated regression tests, localization inventories and phase reports. Light/Dark/System, domain identifiers/calculations, achievements, backup v1 payload/checksum and recovery semantics retain their tested contracts. Prior reports' pending physical checklists remain historical; this paragraph records the later user acceptance.

## Preflight review

Before staging: 111 tracked modifications and 36 untracked phase files, 147 files total; index empty. The full candidate set is constrained to reviewed source, tests/fixtures, inventories and named phase documentation. All untracked content was inspected as text. No APK/AAB, dependency directory, personal backup, credentials/signing file, private key/service-account/API-token signature, temporary script/log or unrelated file was found in the candidate set. Synthetic backup fixtures and synthetic private-path strings are test inputs, not real user backups or credentials. The main inventory was checked for relative src paths, canonical source hashes and reproducibility; it contains source evidence, not device storage.

The source/test diff review includes the preference write/apply boundary, stable provider/navigation identities, native-tab direction, isolated numeric rendering, Arabic/English catalog contracts, metadata getters, form save/cancel/error paths, backup error descriptors and unchanged backup/recovery calculations. New fixtures preserve stylesheet/business/backup baselines. No runtime source was changed during this checkpoint preflight.

Application/native/package manifests and dependency lockfiles are unchanged. Prior phase changes and reports are preserved. No merge, rebase, reset, clean, amend, force-push, branch switch, dependency installation or APK operation is part of this checkpoint.

## Validation rerun

| Check | Exact result |
| --- | --- |
| `npm.cmd test` | Exit 0; **281 tests, 18 suites, 281 pass**, 0 fail/cancelled/skipped/todo; **10097.3084 ms** |
| `npx.cmd --no-install tsc --noEmit` | Exit 0; no diagnostics |
| `npx.cmd --no-install expo lint` | Exit 0; no diagnostics |
| Inventory independently generated in memory and compared | Consistent; **179 sources, 22 roots, 172 reachable files, 117 candidate files, 1489 candidates**; existing full-suite hash/line-ending tests also pass |
| `git diff --check` | Exit 0; existing LF-to-CRLF working-copy advisories only |
| Compatible external Expo Doctor 1.21.6 `--verbose` | Exit 1; **19/20**; existing recommended SDK patch versions only |

Doctor's package-version check is not suppressed or described as a full pass. The same 13 recommendations remain; all other checks, including peer dependencies, native support compatibility, duplicate dependencies and Expo schema, passed. No dependency/configuration update was applied. User authorization explicitly permits checkpointing with these known recommendations documented.

```text
Package             Installed -> Recommended
@expo/ui            58.0.27 -> ~58.0.28
expo                58.0.23 -> ~58.0.24
expo-constants      58.0.15 -> ~58.0.16
expo-crypto         58.0.7  -> ~58.0.8
expo-dev-client     58.0.18 -> ~58.0.19
expo-font           58.0.11 -> ~58.0.12
expo-linking        58.0.16 -> ~58.0.17
expo-router         58.0.30 -> ~58.0.31
expo-sharing        58.0.22 -> ~58.0.23
expo-splash-screen  58.0.13 -> ~58.0.14
expo-status-bar     58.0.4  -> ~58.0.5
expo-symbols        58.0.4  -> ~58.0.5
expo-web-browser    58.0.7  -> ~58.0.8
```

Reviewed content fingerprint before this report was added: `c684455097916f41b35c6d77541d508f4749030c4455c1b401dade30dee5835d` (SHA-256 over sorted path/content hashes). The staging step must verify that fingerprint and branch/index conditions again. Staged inventory hashes must also agree with normalized Git content before commit.

Protected local refs recorded before mutation:

```text
main                       cbd23fa13b1b927bf6aaca4db1c5dcf9666ebafb
feature/notifications-wip  2111e900b5b33158582cc6ce64309e0ff6923687
```

## Explicit checkpoint file list

The following reviewed files, plus this report, form the exact stage candidate set. No blanket `git add .` is used.

- LOCALIZATION_COPY_INVENTORY.json
- LOCALIZATION_PHASE4B_COVERAGE.json
- PHASE4B_COMPLETE_REPORT.md
- PHASE4C_LANGUAGE_RTL_REPORT.md
- PHASE4D_RTL_VISUAL_REPORT.md
- RTL_SPIKE_ANDROID_TESTING.md
- SETTINGS_PHASE4B1_REPORT.md
- SETTINGS_PHASE4B1_RUNTIME_FIX_REPORT.md
- src/app/(tabs)/goals/[id].tsx
- src/app/(tabs)/goals/_layout.tsx
- src/app/(tabs)/goals/index.tsx
- src/app/(tabs)/goals/new.tsx
- src/app/(tabs)/habits/[id].tsx
- src/app/(tabs)/habits/_layout.tsx
- src/app/(tabs)/habits/index.tsx
- src/app/(tabs)/habits/new.tsx
- src/app/(tabs)/habits/routines.tsx
- src/app/(tabs)/index.tsx
- src/app/(tabs)/insights/_layout.tsx
- src/app/(tabs)/insights/habit/[id].tsx
- src/app/(tabs)/insights/index.tsx
- src/app/(tabs)/settings.tsx
- src/app/_layout.tsx
- src/app/achievements.tsx
- src/app/data-backup.tsx
- src/app/profile/edit.tsx
- src/app/routine/[id].tsx
- src/app/routine/edit/[id].tsx
- src/app/routine/new.tsx
- src/components/achievements/achievement-card.tsx
- src/components/achievements/achievement-data-notes.tsx
- src/components/achievements/achievements-summary-card.tsx
- src/components/app-tabs.tsx
- src/components/app-tabs.web.tsx
- src/components/goals/consistency-summary.tsx
- src/components/goals/date-picker.tsx
- src/components/goals/goal-card.tsx
- src/components/goals/goal-form.tsx
- src/components/goals/habit-link-picker.tsx
- src/components/goals/status-picker.tsx
- src/components/habits/checklist-editor.tsx
- src/components/habits/color-picker.tsx
- src/components/habits/count-fields.tsx
- src/components/habits/empty-state.tsx
- src/components/habits/habit-form.tsx
- src/components/habits/habit-row.tsx
- src/components/habits/icon-picker.tsx
- src/components/habits/tracking-type-picker.tsx
- src/components/habits/weekday-picker.tsx
- src/components/insights/data-notes.tsx
- src/components/insights/day-detail-panel.tsx
- src/components/insights/format.ts
- src/components/insights/habit-insight-row.tsx
- src/components/insights/heatmap-calendar.tsx
- src/components/insights/period-nav.tsx
- src/components/insights/stat-tile.tsx
- src/components/insights/trend-bars.tsx
- src/components/insights/weekly-review-card.tsx
- src/components/localized-inline.tsx
- src/components/localized-native.tsx
- src/components/placeholder-screen.tsx
- src/components/profile/name-prompt-card.tsx
- src/components/profile/profile-avatar.tsx
- src/components/profile/profile-form.tsx
- src/components/routines/routine-badges.tsx
- src/components/routines/routine-card.tsx
- src/components/routines/routine-form.tsx
- src/components/routines/routine-habit-order.tsx
- src/components/routines/routines-entry-card.tsx
- src/components/routines/time-of-day-picker.tsx
- src/components/routines/todays-plan.tsx
- src/components/settings/appearance-selector.tsx
- src/components/settings/language-selector.tsx
- src/components/settings/profile-summary-card.tsx
- src/components/settings/settings-row.tsx
- src/components/settings/settings-section.tsx
- src/components/themed-text.tsx
- src/components/today/checklist-steps.tsx
- src/components/today/count-control.tsx
- src/components/today/habit-card.tsx
- src/components/today/progress-notices.tsx
- src/components/today/progress-ring.tsx
- src/components/ui/collapsible.tsx
- src/data/achievement-definitions.ts
- src/data/backup-files.web.ts
- src/data/backup-format.ts
- src/data/backup-io.ts
- src/data/backup-native-implementation.ts
- src/data/backup-native-loader.ts
- src/data/backup-runtime-check.ts
- src/data/backup-service.ts
- src/data/habit-options.ts
- src/data/persistence-coordinator.ts
- src/data/preferences-store.ts
- src/hooks/use-app-styles.ts
- src/hooks/use-app-theme.ts
- src/hooks/use-data-backup.tsx
- src/hooks/use-language.ts
- src/hooks/use-preferences.tsx
- src/hooks/use-presentation-language.ts
- src/i18n/app-copy.ts
- src/i18n/ar-messages.ts
- src/i18n/ar.ts
- src/i18n/en-messages.ts
- src/i18n/en.ts
- src/i18n/format-fallback.ts
- src/i18n/format.ts
- src/i18n/insight-summary.ts
- src/i18n/language-ar.ts
- src/i18n/language-en.ts
- src/i18n/presentation-date.ts
- src/i18n/remaining-ar-messages.ts
- src/i18n/remaining-ar.ts
- src/i18n/remaining-en-messages.ts
- src/i18n/remaining-en.ts
- src/i18n/today-ar-messages.ts
- src/i18n/today-ar.ts
- src/i18n/today-en-messages.ts
- src/i18n/today-en.ts
- src/i18n/today.ts
- src/i18n/translate.ts
- src/i18n/types.ts
- src/utils/confirm.ts
- src/utils/direction-styles.ts
- src/utils/goal-progress.ts
- src/utils/goal-validation.ts
- src/utils/habit-progress.ts
- src/utils/habit-validation.ts
- src/utils/insights.ts
- src/utils/language-editor.ts
- src/utils/presentation.ts
- src/utils/profile-validation.ts
- src/utils/routine-list.ts
- src/utils/routine-progress.ts
- src/utils/routine-validation.ts
- src/utils/rtl-presentation.ts
- src/utils/schedule.ts
- tests/appearance-selection.test.mjs
- tests/language-activation.test.mjs
- tests/localization-runtime.test.mjs
- tests/localization.test.mjs
- tests/phase4b-complete.test.mjs
- tests/rtl-visual.test.mjs
- tests/support/phase4b-preservation-baseline.json
- tests/support/today-localization-typecheck.ts
- tests/support/today-presentation-baseline.json
- tests/today-localization.test.mjs
- PHASE4BCD_CHECKPOINT_REPORT.md
