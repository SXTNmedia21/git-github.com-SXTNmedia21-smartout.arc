# Financial ESP Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all budget, revenue, and labor cost numbers in Smartout dashboards live and real — fixing baseRate=0, adding employee revenue input, connecting automatic KPIs, and cleaning up mock data.

**Architecture:** Extend existing `daily_reconciliation` table (not new Module 4.5 tables). Fix the cascade cost pipeline by loading `employment_contract.hourly_rate`. Add employee-facing revenue input in day-control drawer. Compute fraværsrate and personalomsetning from existing data in hooks.

**Tech Stack:** TypeScript, Supabase (PostgreSQL + Edge Functions), React + TanStack Query, shadcn/ui, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-03-28-financial-esp-alignment-design.md`

---

## File Map

### New files

| File                                                                         | Responsibility                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `supabase/migrations/20260328120000_financial_close_extensions.sql`          | Migration 1+2: extend daily_reconciliation + settlement_image |
| `supabase/migrations/20260328120100_financial_close_config.sql`              | Migration 3: new financial_close_config table                 |
| `supabase/migrations/20260328120200_seed_reconciliation_close_process.sql`   | Seed engine trigger for reconciliation.approved               |
| `apps/web/src/app/dashboard/_hooks/use-absence-rate.ts`                      | Fraværsrate KPI hook                                          |
| `apps/web/src/app/dashboard/_hooks/use-staff-turnover.ts`                    | Personalomsetning KPI hook                                    |
| `apps/web/src/app/dashboard/schedule/_components/day-control/OkonomiTab.tsx` | Revenue input + financial overview tab                        |
| `apps/web/src/app/dashboard/schedule/_hooks/useSettlement.ts`                | Revenue registration mutation + query                         |
| `apps/web/src/app/dashboard/_hooks/use-financial-close-config.ts`            | Config CRUD hook                                              |

### Modified files

| File                                                                              | Change                                                                                         |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `supabase/functions/engine-dispatch/index.ts`                                     | Fix baseRate in cascade_cost_snapshot (line ~816-897), add cascade_reconciliation_close action |
| `apps/web/src/lib/cascade/resolve-tariff-rate.ts`                                 | Accept baseRate as parameter (line 44, 60)                                                     |
| `apps/web/src/lib/cascade/types.ts`                                               | Add baseRate to TariffContext                                                                  |
| `apps/web/src/app/dashboard/operations/_hooks/use-operations-data.ts`             | Replace 200 NOK fallback with real costs                                                       |
| `apps/web/src/components/dashboard/StrategicView.tsx`                             | Replace EmptyKPICards (lines 139-153)                                                          |
| `apps/web/src/app/dashboard/_hooks/index.ts`                                      | Export new hooks                                                                               |
| `apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx` | Add Økonomi tab                                                                                |
| `apps/web/src/app/dashboard/reports/_hooks/use-report-staffing.ts`                | Fix hardcoded budget=600 (line ~214)                                                           |
| `packages/supabase/src/database.types.ts`                                         | Regenerated after migrations                                                                   |

### Deleted files

| File                                                            | Reason                      |
| --------------------------------------------------------------- | --------------------------- |
| `apps/web/src/app/dashboard/reports/_components/report-data.ts` | Replaced by real data hooks |

---

## Task 1: Fix baseRate in resolve-tariff-rate.ts

**Files:**

- Modify: `apps/web/src/lib/cascade/types.ts:232-242`
- Modify: `apps/web/src/lib/cascade/resolve-tariff-rate.ts:44-61`

- [ ] **Step 1: Add baseRate to TariffContext type**

In `apps/web/src/lib/cascade/types.ts`, add `baseRate` to the `TariffContext` type:

```typescript
export type TariffContext = {
  payrollProfile: {
    tariffOverrideId: string | null;
    tariffCategory: string;
    seniorityStartDate: string;
    hasFagbrev: boolean;
  } | null;
  workspaceTariffRates: TariffRateRow[];
  platformTariffRates: TariffRateRow[];
  isPublicHoliday: boolean;
  /** Hourly rate from employment_contract. Null = no contract found. */
  baseRate: number | null;
};
```

- [ ] **Step 2: Update resolveTariffRate to use context.baseRate**

In `apps/web/src/lib/cascade/resolve-tariff-rate.ts`, replace lines 59-61:

```typescript
// OLD:
const baseRate = 0; // Actual base rate comes from employment_contract.hourly_rate
const baseRateUnit = "hourly" as const;

// NEW:
const baseRate = context.baseRate ?? 0;
const baseRateUnit = "hourly" as const;
```

- [ ] **Step 3: Verify no other callers break**

Run:

```bash
cd /home/sxtnl/dev/smartout.ai && grep -r "resolveTariffRate\|TariffContext" apps/web/src/lib/cascade/ --include="*.ts" -l
```

All callers already pass a `TariffContext` object. The new `baseRate` field has a `| null` type and the function falls back to 0 via `??`, so existing callers that don't set `baseRate` will get the current behavior.

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors (baseRate is optional via null union, and TariffContext objects are typically built inline)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/cascade/types.ts apps/web/src/lib/cascade/resolve-tariff-rate.ts
git commit -m "fix(cascade): accept baseRate in resolveTariffRate instead of hardcoded 0"
```

---

## Task 2: Fix baseRate in engine-dispatch cascade_cost_snapshot

**Files:**

- Modify: `supabase/functions/engine-dispatch/index.ts:816-897`

- [ ] **Step 1: Extend payroll query to join employment_contract**

In `supabase/functions/engine-dispatch/index.ts`, replace lines 816-822:

```typescript
// OLD:
const { data: payroll } = await supabase
  .from("employee_payroll_profile")
  .select("tariff_override_id, tariff_category, seniority_start_date, has_fagbrev")
  .eq("profile_id", shift.profile_id)
  .order("valid_from", { ascending: false })
  .limit(1)
  .single();

// NEW:
const { data: payroll } = await supabase
  .from("employee_payroll_profile")
  .select(
    "tariff_override_id, tariff_category, seniority_start_date, has_fagbrev, employment_contract:employment_contract_id(hourly_rate)",
  )
  .eq("profile_id", shift.profile_id)
  .order("valid_from", { ascending: false })
  .limit(1)
  .single();
```

- [ ] **Step 2: Resolve baseRate with 3-step fallback**

Replace line 875 (`const baseRate = 0;`) with:

```typescript
// 3-step fallback: contract -> tariff base rate -> 0 with warning
const contractRate = (payroll?.employment_contract as { hourly_rate: number | null } | null)
  ?.hourly_rate;
const tariffBaseRate = allRates.find((r) => r.rate_type === "riksavtalen")?.amount ?? null;
const baseRate = contractRate ?? tariffBaseRate ?? 0;
if (baseRate === 0) {
  console.warn(
    `[cascade_cost_snapshot] baseRate=0 for profile ${shift.profile_id} — no contract hourly_rate or tariff base rate found`,
  );
}
```

- [ ] **Step 3: Verify the rest of the cost calculation still works**

The existing lines 876-896 remain unchanged — they already use `baseRate` correctly for supplement calculation, base_cost, and total_cost. The only change is that `baseRate` is now a real number instead of 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/engine-dispatch/index.ts
git commit -m "fix(cascade): load employment_contract.hourly_rate for shift cost calculation"
```

---

## Task 3: Run migrations — extend daily_reconciliation + settlement_image

**Files:**

- Create: `supabase/migrations/20260328120000_financial_close_extensions.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260328120000_financial_close_extensions.sql`:

```sql
-- Financial Close Extensions
-- Extends daily_reconciliation and settlement_image for Module 4.5 employee-initiated settlement.
-- See spec: docs/superpowers/specs/2026-03-28-financial-esp-alignment-design.md

-- 1. Extend daily_reconciliation with cash handling columns
ALTER TABLE daily_reconciliation ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES profile(profile_id);
ALTER TABLE daily_reconciliation ADD COLUMN IF NOT EXISTS cash_counted numeric(12,2);
ALTER TABLE daily_reconciliation ADD COLUMN IF NOT EXISTS cash_expected numeric(12,2);
ALTER TABLE daily_reconciliation ADD COLUMN IF NOT EXISTS cash_difference numeric(12,2);

-- 2. Add image classification to settlement_image
DO $$ BEGIN
  CREATE TYPE close_image_type AS ENUM (
    'isettle_settlement', 'pos_closing_screen', 'z_report',
    'cash_drawer', 'receipt_bundle', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE settlement_image ADD COLUMN IF NOT EXISTS image_type close_image_type DEFAULT 'other';
ALTER TABLE settlement_image ADD COLUMN IF NOT EXISTS captured_by uuid REFERENCES profile(profile_id);
ALTER TABLE settlement_image ADD COLUMN IF NOT EXISTS parse_status text DEFAULT 'pending';

-- 3. Unique constraint for upsert support
ALTER TABLE daily_reconciliation
  ADD CONSTRAINT IF NOT EXISTS daily_reconciliation_workspace_dept_date_key
  UNIQUE (workspace_id, department_id, reconciliation_date);

-- 4. RLS: allow on-shift employees to submit reconciliation
CREATE POLICY "shift_employee_can_settle"
  ON daily_reconciliation FOR UPDATE
  USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM schedule_shift ss
      JOIN profile p ON p.profile_id = ss.employee_id
      WHERE ss.shift_date = daily_reconciliation.reconciliation_date
        AND ss.workspace_id = daily_reconciliation.workspace_id
        AND p.user_id = auth.uid()
        AND ss.status IN ('published', 'active', 'completed')
    )
  );

-- 5. RLS: allow on-shift employees to insert reconciliation
CREATE POLICY "shift_employee_can_create_settlement"
  ON daily_reconciliation FOR INSERT
  WITH CHECK (
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

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260328120000_financial_close_extensions.sql
```

Expected: No errors. Columns added, policies created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260328120000_financial_close_extensions.sql
git commit -m "feat(db): extend daily_reconciliation and settlement_image for financial close"
```

---

## Task 4: Create financial_close_config table

**Files:**

- Create: `supabase/migrations/20260328120100_financial_close_config.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260328120100_financial_close_config.sql`:

```sql
-- Financial Close Configuration — per-workspace tolerance and approval settings.
-- 1:1 with workspace. Seeded by bootstrap or created on first admin visit.

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
  ON financial_close_config FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "workspace_admin_update_close_config"
  ON financial_close_config FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON financial_close_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260328120100_financial_close_config.sql
```

- [ ] **Step 3: Regenerate types**

```bash
cd /home/sxtnl/dev/smartout.ai && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260328120100_financial_close_config.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add financial_close_config table with RLS and defaults"
```

---

## Task 5: Create financial_close_config hook

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/use-financial-close-config.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/index.ts`

- [ ] **Step 1: Create the hook**

Create `apps/web/src/app/dashboard/_hooks/use-financial-close-config.ts`:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";

export type FinancialCloseConfig = {
  config_id: string;
  workspace_id: string;
  tolerance_type: "fixed" | "percentage";
  tolerance_value: number;
  require_cash_count: boolean;
  cash_tolerance_type: "fixed" | "percentage";
  cash_tolerance_value: number;
  approval_required: boolean;
  approval_deadline_hours: number;
};

const DEFAULTS: Omit<FinancialCloseConfig, "config_id" | "workspace_id"> = {
  tolerance_type: "fixed",
  tolerance_value: 50,
  require_cash_count: true,
  cash_tolerance_type: "fixed",
  cash_tolerance_value: 20,
  approval_required: true,
  approval_deadline_hours: 24,
};

export function useFinancialCloseConfig() {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const wsId = workspace.workspace_id;

  const query = useQuery({
    queryKey: ["financial-close-config", wsId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_close_config")
        .select("*")
        .eq("workspace_id", wsId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async (
      updates: Partial<Omit<FinancialCloseConfig, "config_id" | "workspace_id">>,
    ) => {
      const { data, error } = await supabase
        .from("financial_close_config")
        .upsert({ workspace_id: wsId, ...updates }, { onConflict: "workspace_id" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void emit({
        event: "financial_close_config updated",
        workspace_id: wsId,
        actor_id: "",
        properties: { data: {} },
      });
      queryClient.invalidateQueries({ queryKey: ["financial-close-config", wsId] });
    },
  });

  const config: FinancialCloseConfig = query.data
    ? (query.data as FinancialCloseConfig)
    : { config_id: "", workspace_id: wsId, ...DEFAULTS };

  return { config, isLoading: query.isLoading, upsert };
}
```

- [ ] **Step 2: Export from barrel**

In `apps/web/src/app/dashboard/_hooks/index.ts`, add at the end:

```typescript
export { useFinancialCloseConfig } from "./use-financial-close-config";
export type { FinancialCloseConfig } from "./use-financial-close-config";
```

- [ ] **Step 3: Typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/use-financial-close-config.ts apps/web/src/app/dashboard/_hooks/index.ts
git commit -m "feat(hooks): add useFinancialCloseConfig for tolerance and approval settings"
```

---

## Task 6: Create settlement mutation hook

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/useSettlement.ts`

- [ ] **Step 1: Create the hook**

Create `apps/web/src/app/dashboard/schedule/_hooks/useSettlement.ts`:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";

export type SettlementInput = {
  departmentId: string;
  reconciliationDate: string;
  revenueTotal: number;
  revenueCard?: number | null;
  revenueCash?: number | null;
  revenueVat?: number | null;
  revenueTransactions?: number | null;
  cashCounted?: number | null;
};

/** Fetch existing reconciliation for a date + department (if any). */
export function useSettlementForDate(departmentId: string | undefined, date: string | null) {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  return useQuery({
    queryKey: ["settlement", workspace.workspace_id, departmentId, date],
    enabled: !!departmentId && !!date,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_reconciliation")
        .select(
          "reconciliation_id, status, revenue_total, revenue_card, revenue_cash, revenue_vat, revenue_transactions, cash_counted, cash_expected, cash_difference, settled_by, settled_at, approved_by, approved_at, total_labor_cost, revenue_per_worked_hour, labor_percentage",
        )
        .eq("workspace_id", workspace.workspace_id)
        .eq("department_id", departmentId!)
        .eq("reconciliation_date", date!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

/** Submit a new settlement or update an existing one. */
export function useSubmitSettlement() {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ input, profileId }: { input: SettlementInput; profileId: string }) => {
      const cashExpected = input.revenueCash ?? null;
      const cashDiff =
        input.cashCounted != null && cashExpected != null ? input.cashCounted - cashExpected : null;

      const { data, error } = await supabase
        .from("daily_reconciliation")
        .upsert(
          {
            workspace_id: workspace.workspace_id,
            department_id: input.departmentId,
            reconciliation_date: input.reconciliationDate,
            revenue_total: input.revenueTotal,
            revenue_card: input.revenueCard ?? null,
            revenue_cash: input.revenueCash ?? null,
            revenue_vat: input.revenueVat ?? null,
            revenue_transactions: input.revenueTransactions ?? null,
            cash_counted: input.cashCounted ?? null,
            cash_expected: cashExpected,
            cash_difference: cashDiff,
            revenue_source: "manual" as const,
            status: "submitted" as const,
            settled_by: profileId,
            settled_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,department_id,reconciliation_date" },
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { profileId, input }) => {
      void emit({
        event: "reconciliation settlement_submitted",
        workspace_id: workspace.workspace_id,
        actor_id: profileId,
        properties: {
          data: {
            department_id: input.departmentId,
            date: input.reconciliationDate,
            revenue_total: input.revenueTotal,
          },
        },
      });
      queryClient.invalidateQueries({ queryKey: ["settlement"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-list"] });
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_hooks/useSettlement.ts
git commit -m "feat(hooks): add useSettlement for employee revenue registration"
```

---

## Task 7: Create Økonomi tab in day-control drawer

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/day-control/OkonomiTab.tsx`
- Modify: `apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx`

- [ ] **Step 1: Create OkonomiTab component**

Create `apps/web/src/app/dashboard/schedule/_components/day-control/OkonomiTab.tsx`:

```typescript
"use client";

import { useContext, useState } from "react";
import { Loader2, CheckCircle2, Clock, AlertCircle, Send } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useScheduleBudget } from "../../_hooks/useScheduleBudget";
import { useSettlementForDate, useSubmitSettlement } from "../../_hooks/useSettlement";
import { SectionHeader, KpiCard, formatNok } from "./shared";

type FormState = {
  revenueTotal: string;
  revenueCard: string;
  revenueCash: string;
  revenueVat: string;
  revenueTransactions: string;
  cashCounted: string;
};

const EMPTY_FORM: FormState = {
  revenueTotal: "",
  revenueCard: "",
  revenueCash: "",
  revenueVat: "",
  revenueTransactions: "",
  cashCounted: "",
};

export function OkonomiTab({ dateId }: { dateId: string | null }) {
  const { isDark } = useContext(DashboardContext);
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;
  const departmentId = ctx?.departments?.[0]?.department_id;

  const { data: budgetTargets, isLoading: budgetLoading } = useScheduleBudget(
    workspaceId,
    dateId ?? "",
    dateId ?? "",
  );
  const { data: settlement, isLoading: settlementLoading } = useSettlementForDate(
    departmentId,
    dateId,
  );
  const submitMutation = useSubmitSettlement();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  if (!dateId || !workspaceId) return null;

  if (budgetLoading || settlementLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  const todayBudget = budgetTargets?.[0];
  const hasSettlement = !!settlement;
  const isApproved = settlement?.status === "approved" || settlement?.status === "locked";
  const isSubmitted = settlement?.status === "submitted";

  function handleSubmit() {
    if (!departmentId || !dateId) return;
    const total = parseFloat(form.revenueTotal);
    if (isNaN(total) || total <= 0) return;

    submitMutation.mutate({
      profileId: ctx?.profile?.profile_id ?? "",
      input: {
        departmentId,
        reconciliationDate: dateId,
        revenueTotal: total,
        revenueCard: form.revenueCard ? parseFloat(form.revenueCard) : null,
        revenueCash: form.revenueCash ? parseFloat(form.revenueCash) : null,
        revenueVat: form.revenueVat ? parseFloat(form.revenueVat) : null,
        revenueTransactions: form.revenueTransactions
          ? parseInt(form.revenueTransactions, 10)
          : null,
        cashCounted: form.cashCounted ? parseFloat(form.cashCounted) : null,
      },
    });
  }

  const field = (label: string, key: keyof FormState, placeholder: string, required = false) => (
    <div>
      <label className="text-muted-foreground mb-1 block text-xs font-medium">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type="number"
        step="0.01"
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        className={`w-full rounded-lg border px-3 py-2 text-sm ${
          isDark
            ? "border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/50"
            : "border-border bg-card text-foreground placeholder:text-muted-foreground/50"
        }`}
      />
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-200">
      {/* Status banner */}
      {hasSettlement && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
            isApproved
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : isSubmitted
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-border bg-muted/20 text-muted-foreground"
          }`}
        >
          {isApproved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isSubmitted ? (
            <Clock className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {isApproved
            ? "Godkjent"
            : isSubmitted
              ? "Venter pa godkjenning"
              : `Status: ${settlement?.status}`}
        </div>
      )}

      {/* Budget vs Actual */}
      <section>
        <SectionHeader label="Budsjett vs Faktisk" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <KpiCard
            label="Budsjett"
            value={todayBudget ? formatNok(todayBudget.targetRevenue) : "---"}
          />
          <KpiCard
            label="Registrert"
            value={settlement ? formatNok(Number(settlement.revenue_total ?? 0)) : "---"}
          />
          <KpiCard
            label="Lonnskostnad"
            value={
              settlement?.total_labor_cost
                ? formatNok(Number(settlement.total_labor_cost))
                : "Beregnes ved godkjenning"
            }
          />
        </div>
      </section>

      {/* KPI cards when approved */}
      {isApproved && settlement && (
        <section>
          <SectionHeader label="Nokkeltall" />
          <div className="grid grid-cols-2 gap-2">
            <KpiCard
              label="Omsetning/time"
              value={
                settlement.revenue_per_worked_hour
                  ? `${formatNok(Number(settlement.revenue_per_worked_hour))}/t`
                  : "---"
              }
            />
            <KpiCard
              label="Lonnsprosent"
              value={
                settlement.labor_percentage
                  ? `${Number(settlement.labor_percentage).toFixed(1)}%`
                  : "---"
              }
            />
          </div>
        </section>
      )}

      {/* Registration form */}
      {!hasSettlement && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-xl px-4 py-3 text-sm font-bold transition-colors"
        >
          Registrer dagsoppgjor
        </button>
      )}

      {!hasSettlement && showForm && (
        <section>
          <SectionHeader label="Dagsoppgjor" />
          <div className="space-y-3">
            {field("Total omsetning", "revenueTotal", "0.00", true)}
            <div className="grid grid-cols-2 gap-3">
              {field("Kort", "revenueCard", "0.00")}
              {field("Kontant", "revenueCash", "0.00")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("MVA", "revenueVat", "0.00")}
              {field("Transaksjoner", "revenueTransactions", "0")}
            </div>
            {field("Kontantkasse opptalt", "cashCounted", "0.00")}

            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending || !form.revenueTotal}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send inn
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Økonomi tab to DayControlPanel**

In `apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx`:

Add import at line ~31 (after other tab imports):

```typescript
import { OkonomiTab } from "./OkonomiTab";
```

Add `"okonomi"` to the TabId type at line 38:

```typescript
type TabId =
  | "oversikt"
  | "meldinger"
  | "bookings"
  | "oppgaver"
  | "budsjett"
  | "bemanning"
  | "okonomi";
```

Add tab button after the "bemanning" TabButton (after line 229):

```typescript
          <TabButton
            active={activeTab === "okonomi"}
            onClick={() => setActiveTab("okonomi")}
            icon={<DollarSign className="h-3 w-3" />}
            label="Okonomi"
          />
```

Add tab content in the rendering section (after line 240):

```typescript
        {activeTab === "okonomi" && <OkonomiTab dateId={date} />}
```

Note: `DollarSign` is already imported (line 15 of DayControlPanel.tsx).

- [ ] **Step 3: Verify workspace context shape**

Check what `useWorkspaceOptional()` returns — specifically whether it has `departments` and `profile`:

```bash
grep -r "useWorkspaceOptional" apps/web/src/lib/workspace-context.ts --include="*.ts" -A 5
```

If the context doesn't expose `departments` or `profile`, the OkonomiTab will need to fetch them separately via their own hooks. Adjust accordingly.

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck --filter=web`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/day-control/OkonomiTab.tsx apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx
git commit -m "feat(schedule): add Okonomi tab for employee revenue registration"
```

---

## Task 8: Create KPI hooks — useAbsenceRate and useStaffTurnover

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/use-absence-rate.ts`
- Create: `apps/web/src/app/dashboard/_hooks/use-staff-turnover.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/index.ts`

- [ ] **Step 1: Create useAbsenceRate**

Create `apps/web/src/app/dashboard/_hooks/use-absence-rate.ts`:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

/**
 * Calculates absence rate for the workspace over a rolling 30-day window.
 * Formula: (approved absence days) / (total planned shift days) x 100
 */
export function useAbsenceRate() {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const wsId = workspace.workspace_id;

  return useQuery({
    queryKey: ["absence-rate", wsId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const fromDate = thirtyDaysAgo.toISOString().split("T")[0]!;
      const toDate = today.toISOString().split("T")[0]!;

      const [absenceResult, shiftResult] = await Promise.all([
        supabase
          .from("schedule_absence")
          .select("schedule_absence_id", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .eq("status", "approved")
          .gte("shift_date", fromDate)
          .lte("shift_date", toDate),
        supabase
          .from("schedule_shift")
          .select("schedule_shift_id", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .gte("shift_date", fromDate)
          .lte("shift_date", toDate),
      ]);

      const absenceDays = absenceResult.count ?? 0;
      const totalShiftDays = shiftResult.count ?? 0;
      const rate = totalShiftDays > 0 ? (absenceDays / totalShiftDays) * 100 : 0;

      return {
        rate: Math.round(rate * 10) / 10,
        absenceDays,
        totalShiftDays,
        periodDays: 30,
      };
    },
  });
}
```

- [ ] **Step 2: Create useStaffTurnover**

Create `apps/web/src/app/dashboard/_hooks/use-staff-turnover.ts`:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

/**
 * Calculates 90-day staff turnover rate.
 * Formula: (profiles moved to inactive/offboarding in 90 days) / (avg active profiles) x 100
 */
export function useStaffTurnover() {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const wsId = workspace.workspace_id;

  return useQuery({
    queryKey: ["staff-turnover", wsId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const today = new Date();
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const cutoff = ninetyDaysAgo.toISOString();

      const [departedResult, activeResult] = await Promise.all([
        supabase
          .from("profile")
          .select("profile_id", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .in("status", ["inactive", "offboarding"])
          .gte("updated_at", cutoff),
        supabase
          .from("profile")
          .select("profile_id", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .in("status", ["active", "trainee"]),
      ]);

      const departed = departedResult.count ?? 0;
      const activeNow = activeResult.count ?? 0;
      const avgActive = activeNow + departed / 2;
      const rate = avgActive > 0 ? (departed / avgActive) * 100 : 0;

      return {
        rate: Math.round(rate * 10) / 10,
        departed,
        activeNow,
        periodDays: 90,
      };
    },
  });
}
```

- [ ] **Step 3: Export from barrel**

In `apps/web/src/app/dashboard/_hooks/index.ts`, add at the end:

```typescript
export { useAbsenceRate } from "./use-absence-rate";
export { useStaffTurnover } from "./use-staff-turnover";
export { useFinancialCloseConfig } from "./use-financial-close-config";
export type { FinancialCloseConfig } from "./use-financial-close-config";
```

Note: Remove the exports added in Task 5 Step 2 to avoid duplicates — consolidate all new exports here.

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck --filter=web`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/use-absence-rate.ts apps/web/src/app/dashboard/_hooks/use-staff-turnover.ts apps/web/src/app/dashboard/_hooks/index.ts
git commit -m "feat(hooks): add useAbsenceRate and useStaffTurnover KPI hooks"
```

---

## Task 9: Replace EmptyKPICards in StrategicView

**Files:**

- Modify: `apps/web/src/components/dashboard/StrategicView.tsx:1-153`

- [ ] **Step 1: Add imports**

In `apps/web/src/components/dashboard/StrategicView.tsx`, update the imports from `@/app/dashboard/_hooks` (line 18-23):

```typescript
import {
  useWorkforcePipeline,
  useTrainingReadiness,
  useKpiTargets,
  useKpiCopy,
  useActiveSeason,
  useAbsenceRate,
  useStaffTurnover,
} from "@/app/dashboard/_hooks";
```

- [ ] **Step 2: Add hook calls**

After line 40 (`const { data: training } = useTrainingReadiness();`), add:

```typescript
const { data: absenceData } = useAbsenceRate();
const { data: turnoverData } = useStaffTurnover();
```

- [ ] **Step 3: Replace EmptyKPICards**

Replace lines 139-153 (the three EmptyKPICard blocks) with:

```typescript
          <KPICard
            isDark={isDark}
            title="Varekostnad %"
            value={null}
            targetDisplay={`< ${targets.cost_of_sales}%`}
            status={null}
            icon={<BarChart3 className="h-5 w-5" />}
            explanation="Kobles til regnskap. Krever integrasjon med varesystem."
            metric="cost_of_sales"
            targetValue={targets.cost_of_sales}
            unit="%"
            onTargetSave={handleTargetSave}
          />
          <KPICard
            isDark={isDark}
            title="Personalomsetning"
            value={turnoverData ? `${turnoverData.rate}%` : null}
            targetDisplay={`< ${targets.turnover_90d}%`}
            status={
              turnoverData
                ? turnoverData.rate > targets.turnover_90d
                  ? "bad"
                  : "good"
                : null
            }
            icon={<Users className="h-5 w-5" />}
            explanation={kpiCopy.turnover_90d}
            metric="turnover_90d"
            targetValue={targets.turnover_90d}
            unit="%"
            onTargetSave={handleTargetSave}
          />
          <KPICard
            isDark={isDark}
            title="Fravaersrate"
            value={absenceData ? `${absenceData.rate}%` : null}
            targetDisplay={`< ${targets.absence_rate}%`}
            status={
              absenceData
                ? absenceData.rate > targets.absence_rate
                  ? "bad"
                  : "good"
                : null
            }
            icon={<Target className="h-5 w-5" />}
            explanation={kpiCopy.absence_rate}
            metric="absence_rate"
            targetValue={targets.absence_rate}
            unit="%"
            onTargetSave={handleTargetSave}
          />
```

- [ ] **Step 4: Remove EmptyKPICard function**

Search for the `EmptyKPICard` function definition (near the bottom of the file) and delete it entirely — it is no longer referenced.

- [ ] **Step 5: Typecheck**

Run: `pnpm turbo typecheck --filter=web`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/dashboard/StrategicView.tsx
git commit -m "feat(dashboard): replace empty KPI cards with live fraværsrate and personalomsetning"
```

---

## Task 10: Fix operations chart — real labor costs

**Files:**

- Modify: `apps/web/src/app/dashboard/operations/_hooks/use-operations-data.ts`

- [ ] **Step 1: Add shift_cost_snapshot query**

In `use-operations-data.ts`, add a new query after `hourlyBudgetPromise` (after line ~125):

```typescript
// ── 8. Fetch today's shift cost snapshots (real labor cost) ───────
const shiftCostPromise = supabase
  .from("shift_cost_snapshot")
  .select("total_cost, effective_start, base_rate")
  .eq("workspace_id", wsId)
  .gte("effective_start", `${today}T00:00:00.000Z`)
  .lte("effective_start", `${today}T23:59:59.999Z`)
  .eq("basis", "planned");
```

- [ ] **Step 2: Add to Promise.all**

Update the Promise.all destructuring (lines 136-149) to include the new query:

```typescript
const [
  { data: sessions, error: sessionsError },
  { data: shifts, error: shiftsError },
  { data: deviations, error: deviationsError },
  { data: reconciliation, error: reconciliationError },
  { data: hourlyBudgets }, // payrollSettingsPromise result unused
  ,
  { data: shiftCosts },
] = await Promise.all([
  sessionsPromise,
  shiftsPromise,
  deviationsPromise,
  reconciliationPromise,
  hourlyBudgetPromise,
  payrollSettingsPromise,
  shiftCostPromise,
]);
```

- [ ] **Step 3: Replace FALLBACK_HOURLY_RATE_NOK with real costs**

Delete line 49 (`const FALLBACK_HOURLY_RATE_NOK = 200;`).

Replace the shift cost calculation block (lines ~248-256) with:

```typescript
// Build real labor cost per hour from shift_cost_snapshot
const shiftCostByHour = new Map<number, number>();
const hasRealCosts = (shiftCosts ?? []).some((sc) => sc.base_rate > 0);

if (hasRealCosts) {
  for (const sc of shiftCosts ?? []) {
    if (!sc.effective_start) continue;
    const startHour = new Date(sc.effective_start).getHours();
    shiftCostByHour.set(startHour, (shiftCostByHour.get(startHour) ?? 0) + sc.total_cost);
  }
} else {
  // Fallback: estimate from shift hours x 200 NOK
  for (const shift of shiftList) {
    if (!shift.start_time) continue;
    const startHour = parseInt(shift.start_time.slice(0, 2), 10);
    const shiftCost = shift.work_hours * 200;
    shiftCostByHour.set(startHour, (shiftCostByHour.get(startHour) ?? 0) + shiftCost);
  }
}
```

- [ ] **Step 4: Add laborCostEstimated flag to return type and value**

Add to the `OperationsData` type (around line 29):

```typescript
/** True when labor costs are estimated (no real shift_cost_snapshot data) */
laborCostEstimated: boolean;
```

Add to the return statement (around line 302):

```typescript
        laborCostEstimated: !hasRealCosts,
```

- [ ] **Step 5: Typecheck and fix downstream**

Run: `pnpm turbo typecheck --filter=web`

If `operations/page.tsx` destructures `OperationsData` and fails, add `laborCostEstimated` to the destructuring. This flag can be used to show "(estimert)" text on the chart.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/operations/_hooks/use-operations-data.ts
git commit -m "fix(operations): use real shift_cost_snapshot for labor costs with fallback indicator"
```

---

## Task 11: Fix report staffing hardcoded budget

**Files:**

- Modify: `apps/web/src/app/dashboard/reports/_hooks/use-report-staffing.ts:~195-215`

- [ ] **Step 1: Add workspace_budget query for weekly targets**

Before the `laborHours4w` mapping (around line 195), add a budget query. This should be added to the main Promise.all or as a separate fetch before the mapping:

```typescript
// Fetch daily labor_hours_target for the 4-week period
const fourWeeksAgoStr = fourWeeksAgo.toISOString().split("T")[0]!;
const { data: weeklyBudgets } = await supabase
  .from("workspace_budget")
  .select("period_date, labor_hours_target")
  .eq("workspace_id", wsId)
  .eq("period_type", "daily")
  .gte("period_date", fourWeeksAgoStr)
  .lte("period_date", toDate);

// Sum daily targets per ISO week
const budgetByWeek = new Map<number, number>();
for (const b of weeklyBudgets ?? []) {
  if (!b.labor_hours_target) continue;
  const d = new Date(b.period_date + "T00:00:00");
  const wk = getISOWeek(d);
  budgetByWeek.set(wk, (budgetByWeek.get(wk) ?? 0) + Number(b.labor_hours_target));
}
```

- [ ] **Step 2: Replace hardcoded budget**

In the `laborHours4w` mapping (line ~214), replace:

```typescript
          budget: 600,
```

with:

```typescript
          budget: budgetByWeek.get(weekNum) ?? 0,
```

- [ ] **Step 3: Ensure getISOWeek exists**

If `getISOWeek` is not already defined in the file, add this utility before the hook:

```typescript
function getISOWeek(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck --filter=web`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/reports/_hooks/use-report-staffing.ts
git commit -m "fix(reports): replace hardcoded budget=600 with real workspace_budget targets"
```

---

## Task 12: Delete report mock data

**Files:**

- Delete: `apps/web/src/app/dashboard/reports/_components/report-data.ts`

- [ ] **Step 1: Check all imports of report-data.ts**

```bash
grep -r "report-data" apps/web/src/app/dashboard/reports/ --include="*.ts" --include="*.tsx" -l
```

- [ ] **Step 2: Remove imports and replace with hooks**

For each file that imports from `report-data.ts`:

- Remove the import statement
- Verify the component uses `useReportOverview` or `useReportStaffing` instead
- If any component still depends on a constant from report-data.ts that has no hook equivalent, extract just that constant to the consuming file

- [ ] **Step 3: Delete the file**

```bash
rm apps/web/src/app/dashboard/reports/_components/report-data.ts
```

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck --filter=web`

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src/app/dashboard/reports/
git commit -m "refactor(reports): remove mock report-data.ts, all data now from real hooks"
```

---

## Task 13: Add cascade_reconciliation_close engine action

**Files:**

- Modify: `supabase/functions/engine-dispatch/index.ts`
- Create: `supabase/migrations/20260328120200_seed_reconciliation_close_process.sql`

- [ ] **Step 1: Add the action handler**

In `supabase/functions/engine-dispatch/index.ts`, find the `switch (step.action_type)` block. Add a new case before the default:

```typescript
    case "cascade_reconciliation_close": {
      const ctx = state.context as Record<string, unknown>;
      const payload = (ctx.data as Record<string, unknown>) ?? {};
      const reconciliationId = payload.reconciliation_id as string;
      const departmentId = payload.department_id as string;
      const reconDate = payload.reconciliation_date as string;

      if (!reconciliationId || !departmentId || !reconDate) {
        console.error("[cascade_reconciliation_close] missing context fields");
        await advanceToNextStep(supabase, state, step);
        break;
      }

      // Get shift IDs for this date + department
      const { data: dayShifts } = await supabase
        .from("schedule_shift")
        .select("schedule_shift_id")
        .eq("workspace_id", state.workspace_id)
        .eq("shift_date", reconDate)
        .eq("department_id", departmentId);

      const shiftIds = (dayShifts ?? []).map((s) => s.schedule_shift_id);

      // Fetch cost snapshots for those shifts
      let totalLaborCost = 0;
      let totalActualHours = 0;

      if (shiftIds.length > 0) {
        const { data: costSnapshots } = await supabase
          .from("shift_cost_snapshot")
          .select("total_cost, base_hours")
          .eq("workspace_id", state.workspace_id)
          .in("schedule_shift_id", shiftIds)
          .eq("basis", "planned");

        totalLaborCost = (costSnapshots ?? []).reduce(
          (sum, s) => sum + Number(s.total_cost ?? 0),
          0,
        );
        totalActualHours = (costSnapshots ?? []).reduce(
          (sum, s) => sum + Number(s.base_hours ?? 0),
          0,
        );
      }

      // Fetch revenue for KPI calculation
      const { data: recon } = await supabase
        .from("daily_reconciliation")
        .select("revenue_total")
        .eq("reconciliation_id", reconciliationId)
        .single();

      const revenueTotal = Number(recon?.revenue_total ?? 0);
      const revenuePerHour = totalActualHours > 0 ? revenueTotal / totalActualHours : null;
      const laborPercentage = revenueTotal > 0 ? (totalLaborCost / revenueTotal) * 100 : null;

      await supabase
        .from("daily_reconciliation")
        .update({
          total_labor_cost: totalLaborCost,
          total_actual_hours: totalActualHours,
          total_planned_hours: totalActualHours,
          revenue_per_worked_hour: revenuePerHour,
          labor_percentage: laborPercentage,
        })
        .eq("reconciliation_id", reconciliationId);

      await advanceToNextStep(supabase, state, step);
      break;
    }
```

- [ ] **Step 2: Create engine process seed migration**

Create `supabase/migrations/20260328120200_seed_reconciliation_close_process.sql`:

```sql
-- Seed cascade_reconciliation_close engine process + trigger
-- Fires on reconciliation.approved to aggregate shift costs

INSERT INTO engine_process (process_id, workspace_id, name, description, action_type, is_active)
VALUES (
  gen_random_uuid(),
  NULL,
  'cascade_reconciliation_close',
  'Aggregate shift costs into daily reconciliation on approval',
  'cascade_reconciliation_close',
  true
) ON CONFLICT DO NOTHING;

INSERT INTO engine_trigger (trigger_id, process_id, event_type, is_active)
SELECT
  gen_random_uuid(),
  p.process_id,
  'reconciliation.approved',
  true
FROM engine_process p
WHERE p.name = 'cascade_reconciliation_close'
ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: Run seed migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260328120200_seed_reconciliation_close_process.sql
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/engine-dispatch/index.ts supabase/migrations/20260328120200_seed_reconciliation_close_process.sql
git commit -m "feat(engine): add cascade_reconciliation_close to aggregate shift costs on approval"
```

---

## Task 14: Final typecheck and integration verification

**Files:** None new — verification only.

- [ ] **Step 1: Full typecheck**

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm turbo typecheck
```

Expected: 0 errors across all packages.

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

Fix any lint issues introduced by new files.

- [ ] **Step 3: Verify all connections**

Checklist:

- [ ] `resolve-tariff-rate.ts` uses `context.baseRate ?? 0` — not hardcoded 0
- [ ] `engine-dispatch` cascade_cost_snapshot joins `employment_contract.hourly_rate`
- [ ] `use-operations-data.ts` reads `shift_cost_snapshot` — no `FALLBACK_HOURLY_RATE_NOK`
- [ ] `StrategicView.tsx` has no `EmptyKPICard` — all 6 cards use `KPICard`
- [ ] `report-data.ts` is deleted
- [ ] `use-report-staffing.ts` reads `workspace_budget` — no hardcoded `budget: 600`
- [ ] `OkonomiTab.tsx` exists and is wired into `DayControlPanel.tsx`
- [ ] `financial_close_config` table exists with RLS
- [ ] `daily_reconciliation` has `cash_counted`, `cash_expected`, `cash_difference` columns
- [ ] Engine trigger for `reconciliation.approved` -> `cascade_reconciliation_close` is seeded

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve typecheck and lint issues from financial ESP alignment"
```
