---
name: test-coverage-map
description: Playwright E2E test coverage map — what's tested, what's missing, known fake tests. Updated 2026-03-22.
type: project
---

## E2E Test Infrastructure (apps/e2e/)

### Helpers

| File                     | Purpose                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `helpers/performance.ts` | PERF_GATES thresholds + assertion helpers (expectVisibleWithin, expectNavigationWithin, expectColdLoadWithin) |
| `helpers/telemetry.ts`   | expectTelemetryEvent() — polls activity_trail table, expectNoTelemetryEvent(), telemetryTimestamp()           |
| `helpers/seed.ts`        | Seed helpers: workspace, profile, department, shift, protocol, protocolAssignment, departmentSession, policy  |
| `helpers/auth.ts`        | Auth helpers                                                                                                  |
| `helpers/cleanup.ts`     | Cleanup helpers                                                                                               |

### Test Coverage

| Spec File                           | What's Tested                                                                                                                                                                                        | Quality                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `performance-gates.spec.ts`         | Cold load (login, signup, onboarding), login→dashboard, sidebar nav (schedule, website, season), API content (schedule, website, season), wizard step, template gallery                              | SOLID — real timing assertions                                  |
| `cascade-ui.spec.ts`                | Schedule nav, grid render, day control sheet (Oversikt tab, Apningstider, hours override popover), season page nav, planning cycle selector, Hendelser tab                                           | OK — but heavy use of `waitForTimeout` and `catch(() => false)` |
| `journey-website-factory.spec.ts`   | Template gallery, preview, section editing, page management, publish, DB verification (has_website flag, sort_order, FK integrity, domain format, activity_trail scope, profile/workspace existence) | MOSTLY SOLID but has fake telemetry test                        |
| `auth.spec.ts`                      | Login flows                                                                                                                                                                                          | Basic                                                           |
| `dashboard.spec.ts`                 | Dashboard render                                                                                                                                                                                     | Basic                                                           |
| `landing.spec.ts`                   | Landing page                                                                                                                                                                                         | Basic                                                           |
| `onboarding.spec.ts`                | Onboarding flow                                                                                                                                                                                      | Basic                                                           |
| `signup-flow.spec.ts`               | Signup                                                                                                                                                                                               | Basic                                                           |
| `workspace-setup-flow.spec.ts`      | Setup wizard                                                                                                                                                                                         | Basic                                                           |
| `join-wizard.spec.ts`               | Join wizard                                                                                                                                                                                          | Basic                                                           |
| `journey-signup-onboarding.spec.ts` | Signup + onboarding journey                                                                                                                                                                          | Journey                                                         |
| `journey-workspace-setup.spec.ts`   | Workspace setup journey                                                                                                                                                                              | Journey                                                         |

### Known Issues (flag on review)

1. **FAKE TELEMETRY TEST**: `journey-website-factory.spec.ts` lines 368-395 — "telemetry registry has all website events routed" loops over hardcoded event name strings and asserts `.toBeTruthy()`. This does NOT check the actual registry or database. Must be rewritten to import from `packages/telemetry/src/registry.ts` or query `activity_trail`.

2. **waitForTimeout abuse**: `cascade-ui.spec.ts` uses `waitForTimeout(1000-3000)` in multiple places instead of waiting for specific elements. Fragile in CI.

3. **Missing seed helpers**: No seed functions for cascade tables — `department_operating_hours`, `department_hours_override`, `regulatory_framework`, `framework_rule`, `tariff_rate_table`, `change_proposal`, `season_budget`, `day_factor`, `hour_factor`.

### Coverage Gaps (no tests exist)

| Feature/Area                            | What Needs Testing                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| Cascade D1 (department_operating_hours) | CRUD, override creation, cascade to schedule_shift                                  |
| Cascade D3 (framework rules)            | Rule resolution, tariff rate lookup, validity windows                               |
| Cascade D4 (season budget)              | Budget calculation, day/hour factor distribution                                    |
| Cascade C4 (governance)                 | Change proposal lifecycle, authority config enforcement                             |
| Cascade bootstrap (Phase C)             | Workspace creation seeds all dimension tables correctly                             |
| Employee views                          | my-schedule, my-training, handbook                                                  |
| Governance CRUD                         | Policy/protocol creation and assignment                                             |
| Telemetry per mutation                  | Most mutations lack `expectTelemetryEvent()` assertions in journey tests            |
| Performance: cascade pages              | Day control sheet open time, season tab switch time, budget calculation render time |
