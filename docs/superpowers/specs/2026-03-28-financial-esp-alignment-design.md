---
title: "Financial ESP Alignment — Live Budget, Revenue & Labor Cost System"
status: approved
updated: 2026-03-28
created: 2026-03-28
module: operations
tags: [cascade, budget, revenue, labor-cost, reconciliation, kpi, module-4.5]
---

# Financial ESP Alignment — Live Budget, Revenue & Labor Cost System

> **Origin:** Brainstorm session on ensuring all financial numbers displayed in Smartout dashboards are live, real, and aligned with the cascade engine. Identified 14 loose ends across budget, revenue, and labor cost components.
>
> **Approach C (approved):** Implement Module 4.5 data layer and UI without OCR pipeline. Manual revenue input by on-shift employees, admin approval, automatic KPI calculation. Fix baseRate=0 so labor costs are real. Connect all dashboards to live data.

---

## 1. Problem Statement

The Smartout dashboard displays financial data in 11+ components across operations, schedule, reports, and strategic views. Analysis revealed:

- **Labor costs are always 0 kr** — `baseRate = 0` hardcoded in engine-dispatch and resolve-tariff-rate
- **Revenue input has no pipeline** — Module 4.5 (Daily Financial Close) is fully specced but not implemented
- **3 KPI cards are empty** — Fraværsrate, Personalomsetning, Varekostnad show "—"
- **Operations chart uses fake data** — 200 NOK/hour fallback for all cost, revenue evenly distributed
- **Reports use mock data** — `report-data.ts` is 100% hardcoded demo values

All required database tables exist (`shift_cost_snapshot`, `workspace_budget`, `workspace_kpi_target`, `daily_reconciliation`, `schedule_absence`, `employment_contract`). The data is there — it's just not connected.

---

## 2. Cascade Mapping

| Dimension                | Role in this spec                                        |
| ------------------------ | -------------------------------------------------------- |
| D6 Production & Product  | Settlement closes the day's production state             |
| C1 Calibration           | Plan vs actual comparison (budget vs reconciled revenue) |
| C3 Commercial & Outcome  | Shift cost snapshots with real base rates                |
| D2 Resource Availability | Absence rate from schedule_absence                       |
| D4 Demand Signal         | Settled actuals refine future demand predictions         |

---

## 3. Scope

### In scope

1. **baseRate fix** — load `employment_contract.hourly_rate` in engine-dispatch and resolve-tariff-rate
2. **Schema extensions** — extend `daily_reconciliation` and `settlement_image`, add `financial_close_config`
3. **Revenue input UI** — new "Økonomi" tab in day-control drawer for on-shift employee registration
4. **Admin approval** — extend existing reconciliation approval flow
5. **Automatic KPI hooks** — fraværsrate, personalomsetning (90d)
6. **Reconciliation propagation** — engine action aggregating shift costs into reconciliation
7. **Operations chart fix** — real cost from shift_cost_snapshot, weighted revenue distribution
8. **Report mock data cleanup** — replace report-data.ts with real hooks

### Out of scope

- OCR pipeline (Module 4.5 phases 13.3-13.5) — Phase 2
- POS/accounting system integration — Phase 3
- Varekostnad calculation (requires external data) — placeholder remains
- Fraud prevention (image hashing, GPS) — v2
- Gatekeeper/checkout blocking (requires Module 4 session lifecycle)
- Hour-level budget propagation
- Planning event demand multiplier impact

---

## 4. Design

### 4.1 baseRate Fix (Backend, No UI)

**Problem:** `baseRate = 0` in two locations:

- `supabase/functions/engine-dispatch/index.ts` line 875
- `apps/web/src/lib/cascade/resolve-tariff-rate.ts` line 60

**Resolution chain:**

```
schedule_shift.employee_id
  → employee_payroll_profile.profile_id (most recent valid_from)
    → employment_contract.hourly_rate (via employment_contract_id FK)
```

**Changes:**

1. **engine-dispatch cascade_cost_snapshot handler** — extend payroll query:

   ```typescript
   // Current (broken):
   .select("tariff_override_id, tariff_category, seniority_start_date, has_fagbrev")

   // Fixed:
   .select("tariff_override_id, tariff_category, seniority_start_date, has_fagbrev, employment_contract:employment_contract_id(hourly_rate)")
   ```

   Use `employment_contract.hourly_rate` as baseRate. If null, fall back to `tariff_rate_table` base rate for the employee's tariff_category. If still null, log warning and use 0 (preserving current behavior with visibility).

2. **resolve-tariff-rate.ts** — change function signature to accept `baseRate: number` as input parameter. Remove hardcoded `const baseRate = 0`. This is a pure function — caller provides the rate.

3. **Operations dashboard hook** (`use-operations-data.ts`) — replace `FALLBACK_HOURLY_RATE_NOK = 200`:
   - Primary: sum `shift_cost_snapshot.total_cost` for today's shifts per hour window
   - Fallback: if no snapshots exist, fetch `employment_contract.hourly_rate` via shift → payroll → contract join, multiply by `work_hours`
   - Last resort: 200 NOK/hour with visual indicator "(estimert)" on the chart

**Prerequisite for:** Del 5 (propagation) and operations chart — shift_cost_snapshot must contain real costs first.

### 4.2 Schema Extensions

**Migration 1: daily_reconciliation extensions**

```sql
ALTER TABLE daily_reconciliation ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES profile(profile_id);
ALTER TABLE daily_reconciliation ADD COLUMN IF NOT EXISTS cash_counted numeric(12,2);
ALTER TABLE daily_reconciliation ADD COLUMN IF NOT EXISTS cash_expected numeric(12,2);
ALTER TABLE daily_reconciliation ADD COLUMN IF NOT EXISTS cash_difference numeric(12,2);
```

These columns support the employee-initiated settlement flow from Module 4.5 without creating a new table. The existing `settled_by` + `settled_at` columns already track who initiated. `closed_by` tracks the closer role specifically.

**Migration 2: settlement_image extensions**

```sql
CREATE TYPE IF NOT EXISTS close_image_type AS ENUM (
  'isettle_settlement', 'pos_closing_screen', 'z_report',
  'cash_drawer', 'receipt_bundle', 'other'
);
ALTER TABLE settlement_image ADD COLUMN IF NOT EXISTS image_type close_image_type DEFAULT 'other';
ALTER TABLE settlement_image ADD COLUMN IF NOT EXISTS captured_by uuid REFERENCES profile(profile_id);
ALTER TABLE settlement_image ADD COLUMN IF NOT EXISTS parse_status text DEFAULT 'pending';
```

**Migration 3: financial_close_config (new table)**

```sql
CREATE TABLE IF NOT EXISTS financial_close_config (
  config_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  tolerance_type text NOT NULL DEFAULT 'fixed' CHECK (tolerance_type IN ('fixed', 'percentage')),
  tolerance_value numeric(10,2) NOT NULL DEFAULT 50,
  require_cash_count boolean NOT NULL DEFAULT true,
  cash_tolerance_type text NOT NULL DEFAULT 'fixed' CHECK (cash_tolerance_type IN ('fixed', 'percentage')),
  cash_tolerance_value numeric(10,2) NOT NULL DEFAULT 20,
  approval_required boolean NOT NULL DEFAULT true,
  approval_deadline_hours integer NOT NULL DEFAULT 24,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE financial_close_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_close_config"
  ON financial_close_config FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "workspace_admin_write_close_config"
  ON financial_close_config FOR ALL
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON financial_close_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Schema placement:** All in `public` schema. These extend existing operations tables — no new domain boundary warranted.

**No new tables for KPIs.** Fraværsrate and personalomsetning are computed from `schedule_absence` and `profile` in hooks.

### 4.3 Revenue Input — Employee Registration

**Who can register:** Any employee with an active shift on the target date. RLS enforced:

```sql
CREATE POLICY "shift_employee_can_settle"
  ON daily_reconciliation FOR UPDATE
  USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM schedule_shift ss
      JOIN profile p ON p.profile_id = ss.employee_id
      WHERE ss.shift_date = reconciliation_date
        AND ss.workspace_id = daily_reconciliation.workspace_id
        AND p.user_id = auth.uid()
        AND ss.status IN ('published', 'active', 'completed')
    )
  );
```

**Flow:**

1. Employee opens day-control drawer → selects "Økonomi" tab
2. If no reconciliation exists for this date + department: shows "Registrer dagsoppgjør" button
3. On initiation: creates `daily_reconciliation` row with `status = 'open'`, `settled_by = profile_id`
4. Input form:
   - Total omsetning (required)
   - Kort (card, optional)
   - Kontant (cash, optional)
   - Vipps/annet (optional — stored in revenue_total - card - cash)
   - MVA (optional)
   - Antall transaksjoner (optional)
   - Kontantkasse opptalt (if `financial_close_config.require_cash_count = true`)
5. Can attach images (kassarapport, terminalkvittering) → `settlement_image` with `image_type`
6. Submit → status = `submitted`, `settled_at = now()`
7. `revenue_source = 'manual'` (distinguishes from future POS integration)

**Day-control Økonomi tab displays:**

- If not registered: CTA "Registrer dagsoppgjør"
- If submitted: summary of registered values + "Venter på godkjenning"
- If approved: final numbers + budget comparison
- Always: today's budsjett target (from `workspace_budget`) vs registered/approved actuals
- Always: beregnet lønnskostnad (sum of `shift_cost_snapshot.total_cost` for the day)
- Difference indicators with color coding (green within tolerance, red outside)

### 4.4 Admin Approval

Uses the existing reconciliation approval flow (`/dashboard/reconciliation`). Extensions:

- `useApproveReconciliation` mutation already calculates `revenue_per_worked_hour` and `labor_percentage`
- Add: aggregate `shift_cost_snapshot` totals into `total_labor_cost` on approval (currently manual)
- Add: calculate `total_actual_hours` from shift data on approval
- Add: fire `reconciliation.approved` engine event (already exists)
- Add: validate against `financial_close_config` tolerance if settlement_validation exists

### 4.5 Automatic KPI Hooks

**useAbsenceRate(workspaceId, dateRange)**

```typescript
// Calculation:
// (approved absence days in period) / (total planned shift days in period) x 100
//
// Sources:
// - schedule_absence WHERE status = 'approved' AND shift_date BETWEEN start AND end
// - schedule_shift WHERE shift_date BETWEEN start AND end (all planned)
//
// Default target: 4% (from workspace_kpi_target.metric_name = 'absence_rate')
```

**useStaffTurnover(workspaceId)**

```typescript
// Calculation:
// (profiles moved to inactive/offboarding in last 90 days) / (avg active profiles) x 100
//
// Sources:
// - profile WHERE status IN ('inactive', 'offboarding') AND updated_at > now() - 90 days
// - profile WHERE status IN ('active', 'trainee') for denominator
//
// Default target: 15% (from workspace_kpi_target.metric_name = 'turnover_90d')
```

**Varekostnad:** Remains as honest placeholder. KPI card shows target from `workspace_kpi_target` with text "Kobles til regnskap" instead of "—". No fake number.

All three replace `EmptyKPICard` in `StrategicView.tsx` (lines 139-154) with real `DashboardCard` components.

### 4.6 Reconciliation Propagation

**New engine action: `cascade_reconciliation_close`**

Triggered by: `reconciliation.approved` engine event.

Steps:

1. Fetch all `shift_cost_snapshot` records for the reconciliation date + department
2. Aggregate: `SUM(total_cost)` → write to `daily_reconciliation.total_labor_cost`
3. Aggregate: `SUM(base_hours)` → write to `daily_reconciliation.total_actual_hours`
4. Calculate: `revenue_per_worked_hour = revenue_total / total_actual_hours`
5. Calculate: `labor_percentage = (total_labor_cost / revenue_total) * 100`
6. Update `daily_reconciliation` with calculated fields

This replaces the manual calculation currently in `useApproveReconciliation`.

### 4.7 Operations Chart Fix

**Current problems in `use-operations-data.ts`:**

1. Revenue evenly distributed across hours (fake hourly breakdown)
2. `FALLBACK_HOURLY_RATE_NOK = 200` used unconditionally
3. Chart hours hardcoded to 09:00-22:00

**Fixes:**

1. **Revenue distribution:** Use `workspace_budget` hour-level factors as weights for distributing `daily_reconciliation.revenue_total` across hours. Formula: `hourRevenue = revenue_total * (hourFactor / sumOfHourFactors)`. This gives a realistic distribution based on configured business patterns rather than equal splitting.

2. **Labor cost per hour:** Sum `shift_cost_snapshot.total_cost` per hour window (using `effective_start` time). Real cost, not estimated.

3. **Chart hours:** Read from `department_operating_hours` for the workspace's primary department. Fall back to 09:00-22:00 only if no operating hours configured.

### 4.8 Report Mock Data Cleanup

**Delete:** `apps/web/src/app/dashboard/reports/_components/report-data.ts`

**Replace with:** New hook `useReportFinancials(workspaceId, dateRange)` that fetches:

- `daily_reconciliation` for the period (revenue trend, labor trend)
- `workspace_budget` for the period (budget vs actual comparison)
- `workspace_kpi_target` for targets

The existing `useReportOverview` and `useReportStaffing` hooks already use real data. Only the financial section of reports uses mock data.

**Fix in useReportStaffing:** Replace hardcoded budget=600 (line 214) with actual `workspace_budget.labor_hours_target` for the period.

---

## 5. Build Sequence

Each step is independently testable. Steps 1-2 are prerequisites for everything else.

| Step | Deliverable                                                            | Dependencies               | Verification                                                              |
| ---- | ---------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------- |
| 1    | baseRate fix (engine-dispatch + resolve-tariff-rate + operations hook) | None                       | shift_cost_snapshot rows have non-zero base_cost after shift publish      |
| 2    | Migrations (3 SQL files) + regenerate types                            | None                       | `pnpm turbo typecheck` passes, new columns in database.types.ts           |
| 3    | financial_close_config hook + admin settings UI                        | Step 2                     | Config CRUD works, defaults applied                                       |
| 4    | Revenue input mutation + Økonomi tab in day-control                    | Step 2                     | Employee can submit reconciliation, admin sees it                         |
| 5    | KPI hooks (useAbsenceRate, useStaffTurnover) + replace EmptyKPICards   | None (reads existing data) | StrategicView shows real percentages                                      |
| 6    | cascade_reconciliation_close engine action + operations chart fix      | Steps 1, 2                 | Approved reconciliation auto-calculates labor cost; chart shows real data |
| 7    | Report mock data cleanup + useReportFinancials                         | Steps 1, 2, 6              | report-data.ts deleted, reports show live numbers                         |

---

## 6. Data Flow After Implementation

```
Employee registers dagsoppgjør (manual input)
  → daily_reconciliation (status: submitted, revenue_source: manual)
    → Admin reviews in /dashboard/reconciliation
      → Approves → reconciliation.approved event fires
        → cascade_reconciliation_close engine action
          → Aggregates shift_cost_snapshot → total_labor_cost
          → Calculates revenue_per_worked_hour, labor_percentage
          → All dashboards read live data:
              - Operations chart: real hourly revenue vs cost
              - Day-control Økonomi tab: budget vs actual
              - StrategicView KPI cards: live fraværsrate, personalomsetning
              - Reports: real financial trends
```

**Future POS integration** replaces only the first step — `revenue_source = 'pos_integration'` instead of `'manual'`. All downstream flow is identical. No schema changes needed.

---

## 7. RLS Summary

| Table                  | Read             | Write                                       | Notes                            |
| ---------------------- | ---------------- | ------------------------------------------- | -------------------------------- |
| daily_reconciliation   | Workspace member | On-shift employee (submit), Admin (approve) | New policy for shift-based write |
| settlement_image       | Workspace member | On-shift employee                           | Via reconciliation_id scope      |
| financial_close_config | Workspace member | Admin only                                  | 1:1 per workspace                |
| shift_cost_snapshot    | Workspace member | Engine only (service role)                  | Append-only, no user writes      |
| workspace_budget       | Workspace member | Admin (manual), Engine (propagation)        | Existing policies sufficient     |

---

## 8. Migration Path from Existing Code

| Current code                            | Change                                | Risk                                               |
| --------------------------------------- | ------------------------------------- | -------------------------------------------------- |
| `engine-dispatch` cascade_cost_snapshot | Add join to employment_contract       | Low — additive, null-safe fallback                 |
| `resolve-tariff-rate.ts`                | New parameter, callers updated        | Low — 2 callers, both in cascade lib               |
| `use-operations-data.ts`                | Replace fallback with real data       | Medium — must handle missing snapshots gracefully  |
| `StrategicView.tsx` EmptyKPICards       | Replace with real DashboardCards      | Low — additive                                     |
| `report-data.ts`                        | Delete file                           | Low — hooks already exist for most data            |
| `DayControlPanel.tsx`                   | Add Økonomi tab                       | Low — follows existing tab pattern                 |
| `useApproveReconciliation`              | Delegate calculation to engine action | Medium — existing mutation logic moves server-side |

---

## 9. Decisions

| #   | Decision                                        | Choice                                   | Rationale                                                                                                                      |
| --- | ----------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Extend existing tables vs new Module 4.5 tables | Extend                                   | `daily_reconciliation` + `settlement_image` already cover 80% of the need. New tables = migration burden + duplicate concepts. |
| 2   | Revenue input location                          | Day-control drawer Økonomi tab           | Contextual to the day being viewed. No separate page needed. Follows existing tab pattern.                                     |
| 3   | Who can register                                | On-shift employee (RLS enforced)         | Matches Module 4.5 "Closer" concept without requiring session lifecycle.                                                       |
| 4   | Varekostnad handling                            | Honest placeholder                       | Better to show "Kobles til regnskap" than a fake number. Builds trust in the dashboard.                                        |
| 5   | Labor cost aggregation                          | Engine action on approval                | Server-side ensures consistency. Replaces client-side calculation in mutation hook.                                            |
| 6   | Revenue hourly distribution                     | Hour factor weighted                     | Better approximation than equal distribution. Uses existing day/hour factor infrastructure.                                    |
| 7   | baseRate fallback chain                         | Contract → tariff table → 0 with warning | Graceful degradation. Never blocks shift publishing. Visible when estimation is used.                                          |
| 8   | Schema placement                                | All in public                            | Extensions to existing public tables. No new domain boundary.                                                                  |
