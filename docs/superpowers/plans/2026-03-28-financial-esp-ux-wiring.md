# Financial ESP UX Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the financial ESP system into the dashboard so users can discover and use it — add nav item, config UI, tab badge, and route mapping.

**Architecture:** Small targeted additions to existing components. No new pages — extend DashboardShell sidebar, settings-tabs, and day-control panel with data from hooks already built.

**Tech Stack:** TypeScript, React, shadcn/ui, Tailwind v4, TanStack Query

---

## File Map

### New files

| File                                                                           | Responsibility                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `apps/web/src/app/dashboard/settings/_components/financial-close-settings.tsx` | Admin config UI for tolerance, cash count, approval rules |

### Modified files

| File                                                                                     | Change                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `apps/web/src/components/dashboard/DashboardShell.tsx:1370-1430`                         | Add "Avstemming" NavItem in sidebar under Drift section |
| `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx:72-114`               | Add "Financial Close" tab to General section            |
| `apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx:85-100` | Add badge to Økonomi tab showing settlement status      |

---

## Task 1: Add Avstemming to sidebar navigation

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx:1370-1386`

- [ ] **Step 1: Read the current nav section to find exact insertion point**

The sidebar nav has this structure under "Drift":

```
Operations (Drift)
Reports (Rapporter)
--- Administrasjon section header ---
HMS
Sesong
...
```

We add Avstemming between Rapporter and the Administrasjon header — it's an operational view, not admin.

- [ ] **Step 2: Add NavItem for Avstemming**

In `DashboardShell.tsx`, find the `Rapporter` NavItem (around line 1380-1386). After the closing `/>` of that NavItem, add:

```tsx
<NavItem
  href="/dashboard/reconciliation"
  icon={Receipt}
  label="Avstemming"
  isDark={isDark}
  active={isActive("/dashboard/reconciliation")}
  isCollapsed={isSidebarCollapsed}
/>
```

- [ ] **Step 3: Add Receipt to icon imports**

Find the lucide-react import at the top of DashboardShell.tsx. Check if `Receipt` is already imported. If not, add it to the import:

```bash
grep "Receipt" apps/web/src/components/dashboard/DashboardShell.tsx
```

If not found, add `Receipt` to the existing lucide-react destructure.

- [ ] **Step 4: Add route to mission map**

In the `ROUTE_MISSION_MAP` object (around line 38-56), add:

```typescript
  "/dashboard/reconciliation": "mr-botsson",
```

- [ ] **Step 5: Typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(nav): add Avstemming to sidebar navigation

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add Financial Close config tab in Settings

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_components/financial-close-settings.tsx`
- Modify: `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx`

- [ ] **Step 1: Create financial-close-settings.tsx**

Create `apps/web/src/app/dashboard/settings/_components/financial-close-settings.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useFinancialCloseConfig } from "@/app/dashboard/_hooks/use-financial-close-config";

export function FinancialCloseSettings() {
  const { config, isLoading, upsert } = useFinancialCloseConfig();
  const [toleranceType, setToleranceType] = useState(config.tolerance_type);
  const [toleranceValue, setToleranceValue] = useState(String(config.tolerance_value));
  const [requireCashCount, setRequireCashCount] = useState(config.require_cash_count);
  const [cashToleranceType, setCashToleranceType] = useState(config.cash_tolerance_type);
  const [cashToleranceValue, setCashToleranceValue] = useState(String(config.cash_tolerance_value));
  const [approvalRequired, setApprovalRequired] = useState(config.approval_required);
  const [deadlineHours, setDeadlineHours] = useState(String(config.approval_deadline_hours));
  const [saved, setSaved] = useState(false);

  function handleSave() {
    upsert.mutate(
      {
        tolerance_type: toleranceType,
        tolerance_value: parseFloat(toleranceValue) || 50,
        require_cash_count: requireCashCount,
        cash_tolerance_type: cashToleranceType,
        cash_tolerance_value: parseFloat(cashToleranceValue) || 20,
        approval_required: approvalRequired,
        approval_deadline_hours: parseInt(deadlineHours, 10) || 24,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  const selectClass =
    "bg-muted/30 border-border text-foreground w-full rounded-lg border px-3 py-2 text-sm";
  const inputClass = selectClass;
  const labelClass = "text-muted-foreground mb-1 block text-xs font-medium";

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-foreground text-lg font-bold">Dagsoppgjor</h3>
        <p className="text-muted-foreground text-sm">
          Innstillinger for daglig avstemming og godkjenning av omsetningstall.
        </p>
      </div>

      {/* Tolerance */}
      <section className="space-y-4">
        <h4 className="text-foreground text-sm font-bold">Toleranse for avvik</h4>
        <p className="text-muted-foreground text-xs">
          Maks avvik mellom POS og terminal for automatisk godkjenning av dagstall.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Type</label>
            <select
              value={toleranceType}
              onChange={(e) => setToleranceType(e.target.value as "fixed" | "percentage")}
              className={selectClass}
            >
              <option value="fixed">Fast belop (NOK)</option>
              <option value="percentage">Prosent (%)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Verdi ({toleranceType === "fixed" ? "NOK" : "%"})</label>
            <input
              type="number"
              step="0.01"
              value={toleranceValue}
              onChange={(e) => setToleranceValue(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Cash count */}
      <section className="space-y-4">
        <h4 className="text-foreground text-sm font-bold">Kontantkasse</h4>
        <div className="flex items-center gap-3">
          <input
            id="require-cash"
            type="checkbox"
            checked={requireCashCount}
            onChange={(e) => setRequireCashCount(e.target.checked)}
            className="accent-primary h-4 w-4 rounded"
          />
          <label htmlFor="require-cash" className="text-foreground text-sm">
            Krev opptelling av kontantkasse
          </label>
        </div>
        {requireCashCount && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Toleranse-type</label>
              <select
                value={cashToleranceType}
                onChange={(e) => setCashToleranceType(e.target.value as "fixed" | "percentage")}
                className={selectClass}
              >
                <option value="fixed">Fast belop (NOK)</option>
                <option value="percentage">Prosent (%)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                Verdi ({cashToleranceType === "fixed" ? "NOK" : "%"})
              </label>
              <input
                type="number"
                step="0.01"
                value={cashToleranceValue}
                onChange={(e) => setCashToleranceValue(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}
      </section>

      {/* Approval */}
      <section className="space-y-4">
        <h4 className="text-foreground text-sm font-bold">Godkjenning</h4>
        <div className="flex items-center gap-3">
          <input
            id="require-approval"
            type="checkbox"
            checked={approvalRequired}
            onChange={(e) => setApprovalRequired(e.target.checked)}
            className="accent-primary h-4 w-4 rounded"
          />
          <label htmlFor="require-approval" className="text-foreground text-sm">
            Krev godkjenning fra leder
          </label>
        </div>
        {approvalRequired && (
          <div className="max-w-xs">
            <label className={labelClass}>Tidsfrist (timer)</label>
            <input
              type="number"
              min="1"
              max="168"
              value={deadlineHours}
              onChange={(e) => setDeadlineHours(e.target.value)}
              className={inputClass}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Eskaleres hvis ikke godkjent innen denne fristen.
            </p>
          </div>
        )}
      </section>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={upsert.isPending}
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50"
      >
        {upsert.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saved ? "Lagret!" : "Lagre innstillinger"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add lazy import in settings-tabs.tsx**

In `settings-tabs.tsx`, after the existing lazy imports (around line 67), add:

```typescript
const FinancialCloseSettings = lazy(() =>
  import("./financial-close-settings").then((m) => ({ default: m.FinancialCloseSettings })),
);
```

- [ ] **Step 3: Add tab to General section**

In `settings-tabs.tsx`, in the `SECTIONS` array, add to the General section's tabs array (after the `security` tab, around line 81):

```typescript
      { id: "financial-close", label: "Dagsoppgjor", icon: Receipt },
```

- [ ] **Step 4: Add Receipt to icon imports**

In `settings-tabs.tsx`, add `Receipt` to the lucide-react import (line 4-22).

- [ ] **Step 5: Add tab content rendering**

Find the tab content rendering switch/conditional in `settings-tabs.tsx`. It should be a section that maps tab IDs to components. Add:

```typescript
        {activeTab === "financial-close" && (
          <Suspense fallback={<SettingsLoadingSkeleton />}>
            <FinancialCloseSettings />
          </Suspense>
        )}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm turbo typecheck --filter=web`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_components/financial-close-settings.tsx apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx
git commit -m "feat(settings): add financial close config UI (tolerance, cash count, approval)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add status badge to Økonomi tab

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx:85-240`

- [ ] **Step 1: Add settlement query for badge data**

In `DayControlPanelContent` function (starts around line 73), we need to know if a settlement exists for the selected date. Add a lightweight query.

After the existing `useDaySession` call (line 85), add:

```typescript
const ctx = useWorkspaceOptional();
const workspaceId = ctx?.workspace.workspace_id;

// Lightweight check for settlement status — drives the Økonomi tab badge
const { data: settlementStatus } = useQuery({
  queryKey: ["settlement-status", workspaceId, date],
  enabled: !!workspaceId && !!date,
  staleTime: 2 * 60 * 1000,
  queryFn: async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("daily_reconciliation")
      .select("status")
      .eq("workspace_id", workspaceId!)
      .eq("reconciliation_date", date)
      .maybeSingle();
    return data?.status ?? null;
  },
});
```

- [ ] **Step 2: Add imports**

At the top of `DayControlPanel.tsx`, add these imports if not already present:

```typescript
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";
```

Note: `useWorkspaceOptional` is likely already imported via `DashboardContext`. Check first — if `useContext(DashboardContext)` provides it, skip the import.

- [ ] **Step 3: Add badge to Økonomi TabButton**

Find the Økonomi TabButton (the one we added in the previous plan). Update it to show a badge:

```tsx
<TabButton
  active={activeTab === "okonomi"}
  onClick={() => setActiveTab("okonomi")}
  icon={<DollarSign className="h-3 w-3" />}
  label="Okonomi"
  badge={
    settlementStatus === "submitted"
      ? 1
      : settlementStatus === "approved" || settlementStatus === "locked"
        ? 0
        : undefined
  }
/>
```

The badge shows `1` when submitted (needs approval), nothing when approved/locked, nothing when no data.

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck --filter=web`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx
git commit -m "feat(schedule): add status badge to Økonomi tab in day-control

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Write user journeys document

**Files:**

- Create: `docs/journeys/JOURNEY-financial-esp.md`

- [ ] **Step 1: Create journey document**

Create `docs/journeys/JOURNEY-financial-esp.md`:

```markdown
---
title: Financial ESP — User Journeys
status: done
updated: 2026-03-28
created: 2026-03-28
module: operations
tags: [journey, financial-close, reconciliation, kpi, budget]
---

# Financial ESP — User Journeys

## Journey 1: Employee Submits Daily Settlement

**Role:** Employee (on closing shift)
**Precondition:** Employee has a published/active/completed shift on the target date.

1. Employee opens Schedule page → clicks on today's date in the grid
2. Day Control drawer opens → Employee clicks "Okonomi" tab
3. System shows: Budget vs Actual section (budget target from workspace_budget, no registered data yet)
4. Employee clicks "Registrer dagsoppgjor" button
5. Form appears: Total omsetning (required), Kort, Kontant, MVA, Transaksjoner, Kontantkasse opptalt
6. Employee fills in values from POS closing screen and terminal settlement
7. Employee clicks "Send inn"
8. System: creates/upserts daily_reconciliation row (status=submitted, revenue_source=manual)
9. System: emits "reconciliation submitted" telemetry event
10. Employee sees: "Venter pa godkjenning" amber banner
11. Budget vs Actual section now shows registered values alongside budget targets

**Postcondition:** daily_reconciliation row exists with status=submitted. Admin can see it in Avstemming view.

**Error paths:**

- No shift on this date → Employee can view but not submit (RLS blocks insert/update)
- Total omsetning = 0 or empty → Submit button disabled
- Network error → Toast error, form state preserved for retry

---

## Journey 2: Admin Approves Daily Settlement

**Role:** Admin / Manager
**Precondition:** At least one daily_reconciliation with status=submitted exists.

1. Admin opens Dashboard → sees "Avstemming" in sidebar navigation
2. Admin clicks "Avstemming" → Reconciliation page loads
3. Left panel: DayList shows submitted days with amber "Innsendt" badge
4. Admin clicks a submitted day
5. Right panel: DayApproval shows 3 tabs:
   - Revenue: total, card, cash, VAT, transaction count (from employee input)
   - Shifts: all shifts for the day with planned vs calculated hours
   - Deviations: any system-flagged or manual deviations
6. Admin reviews revenue numbers against their own records
7. Admin approves individual shift hours (or edits with justification)
8. Admin resolves any blocking deviations
9. Admin clicks "Godkjenn" button
10. System: updates daily_reconciliation status=approved
11. System: fires reconciliation.approved engine event
12. System: cascade_reconciliation_close action triggers:
    - Aggregates shift_cost_snapshot → total_labor_cost
    - Calculates revenue_per_worked_hour and labor_percentage
13. System: KPIs now visible in all dashboards

**Postcondition:** Day is approved. Labor cost, revenue/hour, and labor % calculated. Data flows to Operations chart, StrategicView KPIs, and Reports.

**Error paths:**

- Deviations not resolved → Approve button disabled
- Admin rejects → status reverts to open, rejection reason stored, closer notified
- Shift hours disputed → Admin edits with required justification

---

## Journey 3: Admin Configures Financial Close Rules

**Role:** Admin / Owner
**Precondition:** Workspace exists with admin access.

1. Admin opens Settings → General section → "Dagsoppgjor" tab
2. Settings page shows 3 sections:
   - Toleranse for avvik: type (fast belop/prosent) + verdi
   - Kontantkasse: toggle for required cash count + tolerance
   - Godkjenning: toggle for required approval + deadline hours
3. Admin adjusts values (e.g., tolerance from 50 NOK to 100 NOK)
4. Admin clicks "Lagre innstillinger"
5. System: upserts financial_close_config row
6. System: shows "Lagret!" confirmation

**Postcondition:** financial_close_config updated. New tolerance applied to future settlements.

**Error paths:**

- No config row exists → defaults used (50 NOK fixed, cash required, approval required, 24h deadline)
- Network error → Toast error, form state preserved

---

## Journey 4: Admin Reads Live Financial Dashboards

**Role:** Admin / Manager
**Precondition:** At least one approved reconciliation exists.

1. Admin opens Dashboard → StrategicView (top section)
2. Sees 6 KPI cards:
   - Opplaeringsberedskap: real % from protocol_assignment
   - Oppgavefullfoering: placeholder (null)
   - Tid til jobbklar: placeholder (null)
   - Varekostnad %: "Kobles til regnskap" (honest placeholder)
   - Personalomsetning: real % (departed profiles / avg active, 90 days)
   - Fravaersrate: real % (approved absences / planned shifts, 30 days)
3. Each KPI shows target, actual value, and good/bad status color

4. Admin navigates to Operations (/dashboard/operations)
5. Hourly revenue vs labor cost chart shows:
   - Green bars: revenue distributed by hour factors
   - Red bars: real labor cost from shift_cost_snapshot
   - "(estimert)" label if no real cost data exists
6. Stress level, staff presence, task completion — all real

7. Admin navigates to Schedule → clicks a day → Okonomi tab
8. Sees: Budget target, registered revenue, calculated labor cost
9. If approved: sees revenue/hour and labor % KPIs

10. Admin navigates to Reports
11. Staffing section shows labor hours trend with real budget targets (not 600)
12. Overview KPIs computed from real workspace data

**Postcondition:** Admin has full visibility into financial performance — all numbers are real.
```

- [ ] **Step 2: Commit**

```bash
git add docs/journeys/JOURNEY-financial-esp.md
git commit -m "docs(journeys): add 4 user journeys for financial ESP system

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
