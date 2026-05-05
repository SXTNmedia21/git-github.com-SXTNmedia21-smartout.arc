---
title: "Handoff — Cascade Task Surface"
feature: cascade-task-surface
branch: feat/cascade-task-surface
closed: 2026-03-27
module: dashboard
---

# Handoff — Cascade Task Surface

## Summary

Replaced the Guardian/Vakt dashboard tab with a cascade-driven task surface ("A gjore") that shows admins what needs doing across all cascade dimensions. The surface groups tasks by domain (departments, staff, framework, budget, governance, schedule, contracts, messages), sorts by urgency, and provides direct navigation to fix each issue. The onboarding guide now derives its `needsSetup` flag from cascade critical task count instead of the legacy `useWorkspaceSetup` hook.

## What Was Done

- [x] **Task 0:** Shared types in `packages/types/src/cascade-tasks.ts` (CascadeTask, TaskGroup, TaskUrgency, TaskGroupSummary, CascadeTasksResult) + telemetry entity registration
- [x] **Task 1:** Supabase RPC migration `20260426100000_resolve_cascade_tasks_rpc.sql` — scans D1/D2/D3/D4/C4/D6/C2 dimensions, returns grouped JSONB
- [x] **Task 2:** Data hooks `use-cascade-tasks.ts` (full data) and `use-cascade-task-count.ts` (badge counts via TanStack Query select), both sharing same query key
- [x] **Task 3:** UI components — `TodoTaskCard` (urgency border + icon + telemetry click), `TodoGroupSection` (collapsible, spring-animated progress bar), `TodoEmptyState` (orb glow celebration), `TodoTaskView` (orchestrator with skeleton/error/empty states), `todo-icons.ts` (icon mapping)
- [x] **Task 4:** DashboardShell integration — `AdminViewType` updated with `"todo"`, default view set to `"todo"`, sidebar NavItem and tab button with badge count, voice session context for todo view
- [x] **Task 5:** Guardian cleanup — removed Guardian UI components/hooks from dashboard, migrated `useOnboardingGuide` to consume cascade tasks instead of legacy setup hook. Guardian DB tables retained (not dropped).
- [x] **Task 6:** Typecheck passes (28/28 packages)
- [x] **Task 7:** i18n translations for nb and en locales
- [x] **Task 8:** Decision log committed
- [x] **Task 9 (doc):** Journey + Handoff

## Decisions Made

| #   | Decision                                                                      | Rationale                                                                                                    |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | Server-side RPC (`resolve_cascade_tasks`) instead of client-side checks       | Single query, consistent logic, no waterfall of individual table queries. RLS enforced via SECURITY INVOKER. |
| 2   | Shared TanStack Query key between `useCascadeTasks` and `useCascadeTaskCount` | Avoids duplicate RPC calls. Count hook uses `select` to extract just the numbers.                            |
| 3   | Guardian tables retained, only UI removed                                     | Tables may still be needed for future features or data migration. Safe to drop later.                        |
| 4   | `"todo"` as default `adminView` (replaces `"tactical"`)                       | Task surface is the primary admin landing — shows what needs attention first.                                |
| 5   | Onboarding guide derives `needsSetup` from `cascadeData.critical_count > 0`   | Single source of truth for workspace readiness. No separate setup-check query.                               |
| 6   | RPC returns JSONB (not typed rows)                                            | Flexible structure for heterogeneous task groups. Types enforced on client via `CascadeTasksResult`.         |

## Learnings

| #   | Learning                                                                                                                             | Impact                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 1   | `employment_contract.status` uses enum values `draft/sent/viewed/signed/expired/terminated` — no `"active"` or `"pending_signature"` | Had to fix RPC after initial attempt used wrong enum values                        |
| 2   | `public_holiday` uses `holiday_date` column, not `date`                                                                              | Column naming inconsistency caught during RPC schema fix                           |
| 3   | framer-motion `Variants` type requires explicit tuple cast `[number, number, number, number]` for cubic-bezier ease arrays           | TypeScript infers `number[]` which doesn't satisfy the type. Needed explicit cast. |
| 4   | Shared query keys between hooks that call the same RPC is highly effective — TanStack Query deduplicates automatically               | The count hook gets data for free from the full hook's cache                       |
| 5   | `workspace_framework_binding` table is the join between workspace and framework — not a direct column on workspace                   | Discovered during D3 framework check implementation                                |

## Known Issues / Debt

- **i18n keys are used as display text fallback** — the `interpolate()` function in TodoTaskCard falls back to the raw key string when i18n is not wired. Works because translations are loaded, but not a robust long-term pattern.
- **`eslint-disable @typescript-eslint/no-explicit-any`** on RPC calls — `supabase.rpc` doesn't know about the custom function until types are regenerated. Safe cast but lint-suppressed.
- **Guardian tables still in DB** — `guardian_signal`, `guardian_log`, etc. remain. Should be evaluated for removal in a future cleanup pass.
- **TodoTabButton uses hardcoded zinc colors** — the tab button styling in DashboardShell still has `bg-zinc-800`, `text-zinc-400` etc. instead of CSS variable classes. Should be migrated to design tokens.
- **No E2E tests** — Playwright tests for the task surface are not yet written.

## Next Steps

1. **E2E tests** — Write Playwright specs for each journey (view tasks, click through, empty state)
2. **Regenerate Supabase types** — Run `npx supabase gen types typescript --local` after migration is applied to remove the `any` casts on RPC calls
3. **Real-time updates** — Consider Supabase Realtime subscription on relevant tables to push task resolution instantly (instead of 30s/5min polling)
4. **Mobile surface** — The data hooks are in `apps/web` dashboard hooks. For mobile parity, extract the RPC call logic into `packages/` and create a React Native equivalent view
5. **Additional dimension checks** — The RPC could be extended with D5 (service concept config), C1 (calibration/KPI targets), C3 (commercial) checks as those features mature
6. **Guardian table cleanup** — Evaluate and drop unused guardian tables once confirmed no downstream dependencies
