---
title: "Cascade Operational Layer — Design Specification"
status: draft
updated: 2026-03-22
created: 2026-03-22
module: cascade
tags: [cascade, rules, tariff, cost, demand, governance, design-spec]
---

# Cascade Operational Layer — Design Specification

## 1. Executive Summary

This spec defines the work to make the Cascade Core Foundation operational — wiring framework rules into the schedule planner, computing cost snapshots on publish and completion, building admin visibility for rules/tariffs/proposals, and propagating demand targets from season budgets to daily staffing goals.

**Prerequisite:** Cascade Foundation Completion (this branch, already implemented). Schema, bootstrap, rule evaluator, tariff resolver, change proposals all exist.

**Approach:** Dual-layer architecture. Client-side pure functions for instant UI feedback. Server-side engine actions for authoritative cost computation and demand propagation. Admin management integrated into existing settings.

**Canonical model reference:** `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`

---

## 2. Scope

### In Scope

**Phase 1 — Wire cascade to schedule:**

- Client-side rule evaluation on shift create/edit (instant feedback)
- Publish batch validation (operational gate)
- Cost snapshot on publish (`planned`) and completion (`actual`)
- "shift completed" telemetry event from punch-out path
- Enrich "shift published" payload with `shift_ids`
- New `cascade_cost_snapshot` engine action
- `snapshot_basis` enum + provenance columns on `shift_cost_snapshot`

**Phase 2 — Admin visibility:**

- "Regelverk" section in `/dashboard/settings`
- Framework rules viewer with override toggles
- Workspace tariff rates viewer with adjustment
- Change proposals list with approve/reject/apply flow

**Phase 3 — Demand propagation:**

- Pure function `propagateBudgetTargets()` (budget → daily targets)
- `cascade_budget_propagation` engine action
- Push on save, re-propagate on factor changes
- Schedule planner reads `workspace_budget` (already wired)

### Out of Scope

- Server-side RPC for shift save validation (deferred — no API consumers yet)
- Real-time session alerts for overtime (timer-based trigger, separate feature)
- Hour-level target storage (computed on-demand by planner)
- Base rate loading for cost snapshots (% supplements like helligdagstillegg and overtime compute to 0 until employment_contract.hourly_rate is loaded per employee — kr/t supplements like kveldstillegg and helgetillegg are correct)
- actual_start/actual_end columns on schedule_shift (completion snapshots use planned times as fallback)
- C1 calibration loop (EWMA correction factors)
- C2 explanation generation
- External adapters (Tripletex payroll sync)

---

## 3. Invariants

1. Client-side rule evaluation is advisory only — save is never hard-blocked client-side.
2. Publish validation is the operational gate — managers must acknowledge warnings before publishing.
3. Cost snapshots use authoritative DB data, not event payload data.
4. Event payloads stay thin — `shift_ids` + `workspace_id` + context, not full shift/profile objects.
5. `shift_cost_snapshot` is append-only. Planned and actual rows coexist.
6. Demand targets are always recomputed from source data (budget + factors), never incrementally patched.
7. Admin rule overrides respect the framework's `outcome_overridable` flag — non-overridable rules cannot be loosened.

---

## 4. Schema Changes

### 4.1 New Enum

```sql
CREATE TYPE snapshot_basis AS ENUM ('planned', 'actual');
```

### 4.2 ALTER `shift_cost_snapshot`

```sql
ALTER TABLE shift_cost_snapshot
  ADD COLUMN basis snapshot_basis NOT NULL DEFAULT 'planned',
  ADD COLUMN source_event TEXT,
  ADD COLUMN effective_start TIMESTAMPTZ,
  ADD COLUMN effective_end TIMESTAMPTZ;
```

- `basis`: distinguishes planning vs accounting snapshots
- `source_event`: which telemetry event triggered this snapshot (e.g. `shift.published`, `shift.completed`)
- `effective_start`/`effective_end`: the actual times used for calculation, preserved for pay breakdown auditability

---

## 5. Phase 1 — Wire Cascade to Schedule

### 5.1 Client-Side Rule Check

#### `useShiftRuleCheck()` hook

Location: `apps/web/src/app/dashboard/schedule/_hooks/use-shift-rule-check.ts`

Takes a shift draft (profile, date, start/end times). Returns `EvaluationResult` from the existing `evaluateFrameworkRules()` pure function.

**Data sources (all cached via TanStack Query):**

1. **Rules + overrides** — framework rules for the workspace, joined through `workspace_framework_binding` + `workspace_rule_override`. Cache 10 min.
2. **Employee week context** — existing shifts for the selected employee in the target week. Cache keyed by `profileId + weekStart`, invalidated on shift mutations.
3. **Employee rule context** — birth date, contract type, agreed hours from `profile` + `employee_payroll_profile`. New `useEmployeeRuleContext(profileId)` hook since `ScheduleEmployee` type doesn't carry these fields.

#### `buildEntityContext()` helper

Location: `apps/web/src/lib/cascade/build-entity-context.ts`

Pure function. Takes:

- Employee's existing shifts for the week (pre-loaded)
- The draft shift being created/edited
- Employee rule context (age, contract type)

Returns `EntityContext` for `evaluateFrameworkRules()`.

Computations:

- `dailyHoursWorked` = sum of shift durations on the same date + draft duration
- `weeklyHoursWorked` = sum of all shift durations in the ISO week + draft duration
- `lastShiftEnd` = closest prior shift end time before draft start
- `employeeAge` = computed from birth date vs shift date

#### UI integration

Integration point: `shift-modal.tsx` (shift creation/edit panel).

| Outcome                  | UI treatment                       |
| ------------------------ | ---------------------------------- |
| `allowed`                | No indicator                       |
| `allowed_with_exception` | Yellow badge with reason text      |
| `review_required`        | Orange badge with reason text      |
| `blocked`                | Red warning badge with reason text |

Save is always allowed in this phase. Warnings are advisory.

### 5.2 Publish Batch Validation

#### `usePublishValidation()` hook

Location: `apps/web/src/app/dashboard/schedule/_hooks/use-publish-validation.ts`

Before publish confirmation dialog, loads all shifts in the batch, builds entity context per employee, evaluates rules for each. Returns aggregated summary.

**UI treatment:**

The publish dialog shows a summary before confirmation:

- "12 shifts ready, 0 issues" → green, proceed
- "12 shifts ready, 2 warnings" → yellow, expandable detail, proceed allowed
- "12 shifts ready, 1 blocked" → red, expandable detail, proceed still allowed but explicitly acknowledged ("Publiser likevel")

This is the operational gate — the manager must see and acknowledge rule hits.

### 5.3 Cost Snapshot — Publish Path

**Event flow:**

1. `usePublishShifts()` already emits `"shift published"` event
2. **Change needed:** enrich `properties.data` to include `shift_ids: string[]` (currently only carries first entity_id + dates + counts)
3. `engine-event.ts` converts to `shift.published` for dispatch
4. New `cascade_cost_snapshot` engine action handler in `engine-dispatch/index.ts`

**Handler behavior:**

1. Read `shift_ids` + `workspace_id` from event payload (thin payload)
2. Load `schedule_shift` rows from DB (authoritative start/end times)
3. For each shift with an assigned employee:
   - Load `employee_payroll_profile` for tariff context
   - Call `getTariffContext()` + `resolveTariffRate()` with planned start time
   - Compute `base_hours` from planned start/end
   - Insert `shift_cost_snapshot` row with `basis = 'planned'`, `source_event = 'shift.published'`, `effective_start`/`effective_end` from planned times

### 5.4 Cost Snapshot — Completion Path

**New telemetry event needed:** `"shift completed"` emitted from the punch-out / actual_end mutation path. This event does not exist today.

**Finding the mutation:** Locate the schedule mutation that writes `actual_end` or transitions shift status to `completed`, add `emit({ event: "shift completed", ... })` with `shift_ids` in properties.

**Handler behavior:** Same `cascade_cost_snapshot` action, but:

- Uses `actual_start` / `actual_end` from the shift row
- Writes `basis = 'actual'`, `source_event = 'shift.completed'`

### 5.5 Engine Action Registration

New action type `cascade_cost_snapshot` added to:

- `engine-dispatch/index.ts` handler map
- Action type documentation/contract

The action is triggered by `engine_process` → `engine_trigger` matching `shift.published` and `shift.completed` events. Requires adding engine_process + engine_trigger seed rows.

---

## 6. Phase 2 — Admin Visibility (Settings Integration)

### 6.1 New Settings Section: "Regelverk"

Added as a tab/section within `/dashboard/settings`. Three subsections.

### 6.2 Active Rules Viewer + Override Toggle

**Hook:** `useFrameworkRules()` in `apps/web/src/app/dashboard/settings/_hooks/use-framework-rules.ts`

Loads:

- `framework_rule` rows joined through `workspace_framework_binding`
- `workspace_rule_override` rows for the workspace

**UI component:** `FrameworkRulesPanel.tsx`

Displays:

- Rule name (Norwegian via `description_no`), category, severity, source reference (AML §)
- Current effective outcome (default or overridden)
- For overridable rules: toggle to set workspace override with `valid_from`/`valid_until`
- Non-overridable rules shown as locked (greyed toggle)

Writes to `workspace_rule_override` on toggle. Emit on mutation.

### 6.3 Tariff Rates Viewer

**Hook:** `useWorkspaceTariffs()` in `apps/web/src/app/dashboard/settings/_hooks/use-workspace-tariffs.ts`

Loads workspace-scoped `tariff_rate_table` rows + platform baseline for comparison.

**UI component:** `TariffRatesPanel.tsx`

Displays:

- Rate type, amount, unit, effective period
- Platform baseline in muted text for reference ("Riksavtalen: 15.65 kr/t")
- "Juster" button to create a new effective-dated workspace rate row (does not mutate existing rows — append-only pattern)

### 6.4 Change Proposals List

Uses existing `useChangeProposals()` hook (already built in foundation phase).

**UI component:** `ChangeProposalsPanel.tsx`

Displays:

- Pending/approved/failed proposals with status badges
- Click opens existing `ChangeProposalDialog` (already built) for preview + approve/reject/apply
- Applied proposals shown in read-only history section

---

## 7. Phase 3 — Demand Propagation

### 7.1 Pure Function: `propagateBudgetTargets()`

Location: `apps/web/src/lib/cascade/propagate-budget-targets.ts`

**Input:**

- `seasonBudget`: `{ totalTargetRevenue, targetLaborPercentage, avgHourlyWage }`
- `dayFactors`: `Array<{ weekday: number, factor: number }>` (7 entries)
- `dateRange`: `{ startDate: string, endDate: string }`

**Output:** `Array<{ date: string, targetRevenue: number, targetLaborCost: number, targetStaffHours: number }>`

**Calculation chain:**

1. Normalize day factors so they sum to 1.0 across the 7-day week
2. For each date in range:
   - Determine weekday (ISO: 0=Mon..6=Sun)
   - `targetRevenue = totalTargetRevenue × (dayFactor / totalWeeks)`
   - `targetLaborCost = targetRevenue × targetLaborPercentage`
   - `targetStaffHours = targetLaborCost ÷ avgHourlyWage`
3. Return array of daily target rows

### 7.2 Engine Action: `cascade_budget_propagation`

Triggered by:

- `"season_budget updated"` event (existing emit in `useBudget()`)
- `"day_factor updated"` event (existing emit in season hooks)

**Handler behavior:**

1. Load season budget + day factors from DB (thin payload, authoritative data)
2. Determine season date range
3. Call `propagateBudgetTargets()` pure function
4. Upsert results into `workspace_budget` table

### 7.3 Re-propagation on Factor Changes

When `day_factor` rows change:

- Same engine action fires
- Recomputes all daily targets for the season
- Upserts overwrite previous values

When `hour_factor` rows change:

- No re-propagation (hour-level not stored in `workspace_budget`)
- Hour breakdown computed on-demand by planner components

### 7.4 Schedule Planner Integration

The schedule planner already reads `workspace_budget` for daily target display. Once rows are propagated by the engine action, the planner shows target staff-hours vs scheduled staff-hours with no additional wiring needed.

---

## 8. Affected Files

### 8.1 New Files

| File                                                                       | Purpose                                               |
| -------------------------------------------------------------------------- | ----------------------------------------------------- |
| `supabase/migrations/YYYYMMDD_cascade_operational_schema.sql`              | snapshot_basis enum + ALTER shift_cost_snapshot       |
| `apps/web/src/lib/cascade/build-entity-context.ts`                         | Pure function: employee shift context → EntityContext |
| `apps/web/src/lib/cascade/propagate-budget-targets.ts`                     | Pure function: budget + factors → daily targets       |
| `apps/web/src/lib/cascade/__tests__/build-entity-context.test.ts`          | Tests for context builder                             |
| `apps/web/src/lib/cascade/__tests__/propagate-budget-targets.test.ts`      | Tests for demand propagation                          |
| `apps/web/src/app/dashboard/schedule/_hooks/use-shift-rule-check.ts`       | Client-side rule evaluation hook                      |
| `apps/web/src/app/dashboard/schedule/_hooks/use-publish-validation.ts`     | Batch publish rule validation                         |
| `apps/web/src/app/dashboard/schedule/_hooks/use-employee-rule-context.ts`  | Employee birth date, contract, payroll data for rules |
| `apps/web/src/app/dashboard/settings/_hooks/use-framework-rules.ts`        | Framework rules + overrides query                     |
| `apps/web/src/app/dashboard/settings/_hooks/use-workspace-tariffs.ts`      | Workspace tariff rates query                          |
| `apps/web/src/app/dashboard/settings/_components/FrameworkRulesPanel.tsx`  | Rules viewer + override toggles                       |
| `apps/web/src/app/dashboard/settings/_components/TariffRatesPanel.tsx`     | Tariff rates viewer + adjustment                      |
| `apps/web/src/app/dashboard/settings/_components/ChangeProposalsPanel.tsx` | Proposals list + history                              |

### 8.2 Modified Files

| File                                                              | Change                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx` | Integrate `useShiftRuleCheck()`, show warning badges                          |
| `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts`        | Enrich "shift published" payload with `shift_ids`, add "shift completed" emit |
| `supabase/functions/engine-dispatch/index.ts`                     | Add `cascade_cost_snapshot` + `cascade_budget_propagation` action handlers    |
| `apps/web/src/app/dashboard/settings/page.tsx`                    | Add "Regelverk" tab/section                                                   |

### 8.3 Files to Verify

| File                                                                 | Why                                                  |
| -------------------------------------------------------------------- | ---------------------------------------------------- |
| `apps/web/src/app/dashboard/schedule/_hooks/use-planned-hours.ts`    | May need awareness of rule evaluation results        |
| `apps/web/src/app/dashboard/season/_hooks/use-season-budget.ts`      | Verify emit events match engine trigger expectations |
| `apps/web/src/app/dashboard/season/_hooks/use-season-day-factors.ts` | Verify emit events match engine trigger expectations |

---

## 9. Build Order

### Phase 1: Wire Cascade to Schedule (blocks Phase 2 partially)

1. Schema migration: `snapshot_basis` enum + ALTER `shift_cost_snapshot`
2. `buildEntityContext()` pure function + tests
3. `useEmployeeRuleContext()` hook
4. `useShiftRuleCheck()` hook
5. Integrate into `shift-modal.tsx` (warning badges)
6. `usePublishValidation()` hook
7. Integrate into publish dialog (validation summary)
8. Enrich "shift published" payload with `shift_ids`
9. Add "shift completed" emit to punch-out path
10. `cascade_cost_snapshot` engine action handler
11. Seed engine_process + engine_trigger for shift.published / shift.completed

### Phase 2: Admin Visibility (parallel with Phase 1 tasks 6+)

12. `useFrameworkRules()` hook
13. `FrameworkRulesPanel.tsx` with override toggles
14. `useWorkspaceTariffs()` hook
15. `TariffRatesPanel.tsx` with rate adjustment
16. `ChangeProposalsPanel.tsx` (wraps existing hook + dialog)
17. Wire all three panels into settings page

### Phase 3: Demand Propagation (after Phase 1)

18. `propagateBudgetTargets()` pure function + tests
19. `cascade_budget_propagation` engine action handler
20. Seed engine_process + engine_trigger for budget/factor events
21. Verify planner reads propagated `workspace_budget` rows

### Validation

22. Full typecheck + test suite + manual verification

---

## Changelog

| Date       | Version | Change                                   | Author          |
| ---------- | ------- | ---------------------------------------- | --------------- |
| 2026-03-22 | 1.0.0   | Initial spec — 3-phase operational layer | Claude + Pontus |
