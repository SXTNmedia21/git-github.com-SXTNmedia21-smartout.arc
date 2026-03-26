---
title: "Admin Daily Loop — Phase 1 Implementation Plan"
status: draft
updated: 2026-03-26
created: 2026-03-26
module: dashboard
tags: [plan, journeys, schedule, reconciliation, operations, daily-loop]
---

# Admin Daily Loop — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gaps in the three daily-use admin journeys (Schedule, Reconciliation, Operations) and add a Daily Status Bar to the admin dashboard.

**Architecture:** Four independent improvements that share no state: (1) wire real budget data into the schedule page via a new hook, (2) add shift conflict detection via a new hook, (3) add reconciliation day-lock enforcement + unreconciled-day prompt, (4) add deviation logging + department drill-down to operations, (5) a glanceable status bar on the admin home page. Each task is a standalone commit.

**Tech Stack:** Next.js App Router, React 19, TanStack Query v5, Supabase RPC, Tailwind v4 CSS vars, shadcn/ui, Framer Motion, `@smartout/telemetry`

**Spec:** `docs/superpowers/specs/2026-03-26-admin-dashboard-journeys-design.md`

**Key reference files to read before starting:**

- `CLAUDE.md` — conventions, code style, commit format
- `docs/design/ren-og-varm-styleguide.html` — design tokens, motion, colors
- `packages/design-tokens/src/tokens.ts` — CSS variable names
- `packages/telemetry/src/registry.ts` — telemetry event names

---

## File Structure

### New Files

| File                                                                        | Responsibility                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `apps/web/src/app/dashboard/schedule/_hooks/useScheduleBudget.ts`           | Fetches `workspace_budget` targets for a date range, returns daily labor cost targets |
| `apps/web/src/app/dashboard/schedule/_hooks/useShiftConflicts.ts`           | Detects overlapping shifts per employee, returns conflict warnings                    |
| `apps/web/src/app/dashboard/reconciliation/_hooks/useUnreconciledDays.ts`   | Queries days where `daily_reconciliation.status = 'open'` and date < today            |
| `apps/web/src/app/dashboard/operations/_components/DepartmentBreakdown.tsx` | Expandable per-department stress/staff metrics                                        |
| `apps/web/src/app/dashboard/operations/_components/DeviationDialog.tsx`     | Dialog for logging a new deviation from operations page                               |
| `apps/web/src/components/dashboard/DailyStatusBar.tsx`                      | Glanceable status bar: schedule + operations + reconciliation                         |

### Modified Files

| File                                                                        | What Changes                                                                 |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/web/src/app/dashboard/schedule/_components/day-control/BudgetTab.tsx` | Replace mock data with `useScheduleBudget` hook                              |
| `apps/web/src/app/dashboard/schedule/page.tsx`                              | Add conflict warnings from `useShiftConflicts` to shift cards                |
| `apps/web/src/app/dashboard/reconciliation/_components/DayApproval.tsx`     | Add lock button that sets `locked_at`/`locked_by`, disable edits when locked |
| `apps/web/src/app/dashboard/operations/page.tsx`                            | Add deviation button + department drill-down toggle                          |
| `apps/web/src/components/dashboard/AdminDashboard.tsx`                      | Add `DailyStatusBar` above view content                                      |
| `supabase/migrations/YYYYMMDDHHMMSS_reconciliation_lock_rls.sql`            | RLS policy: block updates when `locked_at IS NOT NULL`                       |

---

## Task 1: Schedule Budget Hook — `useScheduleBudget`

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/useScheduleBudget.ts`

- [ ] **Step 1: Create the hook file**

Read `apps/web/src/lib/cascade/propagate-budget-targets.ts` first to understand the `DailyTarget` type. Then create the hook:

```typescript
// apps/web/src/app/dashboard/schedule/_hooks/useScheduleBudget.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type DailyBudgetTarget = {
  date: string;
  targetRevenue: number;
  targetLaborCost: number;
  targetStaffHours: number;
};

/**
 * Fetches workspace_budget targets for a date range.
 * Returns daily labor cost and revenue targets from the active season's
 * propagated budget. Falls back to empty array if no budget exists.
 */
export function useScheduleBudget(
  workspaceId: string | undefined,
  startDate: string,
  endDate: string,
) {
  return useQuery({
    queryKey: ["schedule-budget", workspaceId, startDate, endDate],
    queryFn: async (): Promise<DailyBudgetTarget[]> => {
      if (!workspaceId) return [];

      const supabase = createClient();
      const { data, error } = await supabase
        .from("workspace_budget")
        .select("target_date, target_revenue, target_labor_cost, target_staff_hours")
        .eq("workspace_id", workspaceId)
        .gte("target_date", startDate)
        .lte("target_date", endDate)
        .order("target_date");

      if (error) throw error;
      if (!data || data.length === 0) return [];

      return data.map((row) => ({
        date: row.target_date,
        targetRevenue: row.target_revenue ?? 0,
        targetLaborCost: row.target_labor_cost ?? 0,
        targetStaffHours: row.target_staff_hours ?? 0,
      }));
    },
    enabled: !!workspaceId && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Verify the `workspace_budget` table columns exist**

Run: `grep -n "workspace_budget" packages/supabase/src/database.types.ts | head -20`

Verify columns: `target_date`, `target_revenue`, `target_labor_cost`, `target_staff_hours`, `workspace_id`. If column names differ, update the hook to match actual column names from `database.types.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_hooks/useScheduleBudget.ts
git commit -m "feat(schedule): add useScheduleBudget hook for real budget data

Fetches workspace_budget targets for date range. Replaces mock data
path in BudgetTab.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Wire Budget Hook into BudgetTab

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/day-control/BudgetTab.tsx`

- [ ] **Step 1: Read the current BudgetTab**

Read `apps/web/src/app/dashboard/schedule/_components/day-control/BudgetTab.tsx` fully. Note the mock data object at approximately line 17-23 with `laborTarget: 12600`. Understand what props the component receives (likely a `date` and `workspaceId`).

- [ ] **Step 2: Replace mock data with hook**

Replace the hardcoded mock object with the `useScheduleBudget` hook. The key change:

```typescript
// BEFORE (mock):
// const budgetData = { laborTarget: 12600, ... };

// AFTER (real):
import { useScheduleBudget } from "../../_hooks/useScheduleBudget";

// Inside component, use the selected date to fetch:
const { data: budgetTargets, isLoading } = useScheduleBudget(
  workspaceId,
  selectedDate, // single day: same start and end
  selectedDate,
);

const todayBudget = budgetTargets?.[0];
const laborTarget = todayBudget?.targetLaborCost ?? 0;
const revenueTarget = todayBudget?.targetRevenue ?? 0;
```

Update the JSX to show `laborTarget` and `revenueTarget` from real data. Show "Ingen budsjett" (via i18n key) when no data exists. Show skeleton loader when `isLoading`.

- [ ] **Step 3: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/day-control/BudgetTab.tsx
git commit -m "feat(schedule): wire real budget data into BudgetTab

Replace hardcoded laborTarget: 12600 with useScheduleBudget hook.
Shows actual workspace_budget targets per day.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Shift Conflict Detection Hook — `useShiftConflicts`

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/useShiftConflicts.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/web/src/app/dashboard/schedule/_hooks/useShiftConflicts.ts
"use client";

import { useMemo } from "react";

type ShiftSlot = {
  shiftId: string;
  profileId: string | null;
  startTime: string;
  endTime: string;
};

export type ConflictWarning = {
  shiftIdA: string;
  shiftIdB: string;
  profileId: string;
  message: string;
};

/**
 * Detects overlapping shifts for the same employee.
 * Pure client-side computation — no DB queries.
 * Runs on the shift array already loaded by the schedule page.
 */
export function useShiftConflicts(shifts: ShiftSlot[]): ConflictWarning[] {
  return useMemo(() => {
    const conflicts: ConflictWarning[] = [];
    const assigned = shifts.filter((s) => s.profileId);

    for (let i = 0; i < assigned.length; i++) {
      for (let j = i + 1; j < assigned.length; j++) {
        const a = assigned[i];
        const b = assigned[j];

        if (a.profileId !== b.profileId) continue;

        const aStart = new Date(a.startTime).getTime();
        const aEnd = new Date(a.endTime).getTime();
        const bStart = new Date(b.startTime).getTime();
        const bEnd = new Date(b.endTime).getTime();

        const overlaps = aStart < bEnd && bStart < aEnd;
        if (overlaps) {
          conflicts.push({
            shiftIdA: a.shiftId,
            shiftIdB: b.shiftId,
            profileId: a.profileId!,
            message: `Overlapping shifts for same employee`,
          });
        }
      }
    }

    return conflicts;
  }, [shifts]);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_hooks/useShiftConflicts.ts
git commit -m "feat(schedule): add useShiftConflicts hook for overlap detection

Pure client-side computation on loaded shifts. Detects same-employee
overlapping time ranges. Returns ConflictWarning array.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire Conflict Warnings into Schedule Page

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/page.tsx`

- [ ] **Step 1: Read the schedule page**

Read `apps/web/src/app/dashboard/schedule/page.tsx`. This is a 77KB file. Find:

1. Where shifts are loaded (look for `useShifts` or similar query hook)
2. Where individual shift cards are rendered (look for shift card components)
3. The shift data shape — what fields are available (id, profile_id, start_time, end_time)

- [ ] **Step 2: Add conflict hook and warnings**

At the top of the component (NOT inline in render logic — per constraint C5):

```typescript
import { useShiftConflicts } from "./_hooks/useShiftConflicts";
import type { ConflictWarning } from "./_hooks/useShiftConflicts";

// Inside component, after shifts are loaded:
const conflictShifts = useMemo(
  () =>
    (shifts ?? []).map((s) => ({
      shiftId: s.id ?? s.shift_id,
      profileId: s.profile_id,
      startTime: s.start_time,
      endTime: s.end_time,
    })),
  [shifts],
);
const conflicts = useShiftConflicts(conflictShifts);

// Helper to check if a shift has conflicts:
const conflictedShiftIds = useMemo(
  () => new Set(conflicts.flatMap((c) => [c.shiftIdA, c.shiftIdB])),
  [conflicts],
);
```

Then where shift cards are rendered, add a visual warning:

```typescript
// On the shift card wrapper, add a conditional border:
const hasConflict = conflictedShiftIds.has(shift.id);
// Add className: hasConflict ? "ring-2 ring-destructive/50" : ""
// Add tooltip or small icon: AlertTriangle from lucide-react
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/page.tsx
git commit -m "feat(schedule): show conflict warnings on overlapping shifts

Shifts assigned to the same employee with overlapping times get a
red ring indicator. Warns only, does not block assignment.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Reconciliation Lock RLS Policy

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_reconciliation_lock_rls.sql`

- [ ] **Step 1: Verify locked_at column exists**

Run: `grep -n "locked_at" packages/supabase/src/database.types.ts | head -10`
Confirm `daily_reconciliation` has `locked_at` and `locked_by` columns.

- [ ] **Step 2: Create migration**

```sql
-- supabase/migrations/20260326200000_reconciliation_lock_rls.sql

-- Prevent updates to reconciliation records after they've been locked.
-- locked_at is set when admin approves the day. After lock, no edits allowed
-- except by service_role (for admin override scenarios).

CREATE POLICY "block_update_after_lock" ON daily_reconciliation
  FOR UPDATE
  USING (locked_at IS NULL)
  WITH CHECK (locked_at IS NULL OR locked_at = (SELECT locked_at FROM daily_reconciliation WHERE reconciliation_id = daily_reconciliation.reconciliation_id));

-- Allow the lock action itself: when locked_at is NULL and we're setting it
-- This works because the USING clause checks the OLD row (locked_at IS NULL)
-- and WITH CHECK allows the NEW row to have locked_at set.
-- Simplified: just check the OLD row is unlocked.
DROP POLICY IF EXISTS "block_update_after_lock" ON daily_reconciliation;

CREATE POLICY "block_update_after_lock" ON daily_reconciliation
  FOR UPDATE
  USING (locked_at IS NULL);
```

- [ ] **Step 3: Apply migration locally**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260326200000_reconciliation_lock_rls.sql`
Expected: `CREATE POLICY`

- [ ] **Step 4: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260326200000_reconciliation_lock_rls.sql packages/supabase/src/database.types.ts
git commit -m "feat(reconciliation): add RLS policy to block updates after day lock

daily_reconciliation rows with locked_at set become immutable via RLS.
Only unlocked records can be updated. Service role can still override.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Unreconciled Days Hook

**Files:**

- Create: `apps/web/src/app/dashboard/reconciliation/_hooks/useUnreconciledDays.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/web/src/app/dashboard/reconciliation/_hooks/useUnreconciledDays.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type UnreconciledDay = {
  reconciliationId: string;
  date: string;
  departmentId: string;
  departmentName: string;
};

/**
 * Returns days that have not been reconciled (status = 'open' and date < today).
 * Used for the daily prompt card on the admin dashboard.
 */
export function useUnreconciledDays(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["unreconciled-days", workspaceId],
    queryFn: async (): Promise<UnreconciledDay[]> => {
      if (!workspaceId) return [];

      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("daily_reconciliation")
        .select(
          "reconciliation_id, reconciliation_date, department_id, department:department_id(name)",
        )
        .eq("workspace_id", workspaceId)
        .eq("status", "open")
        .lt("reconciliation_date", today)
        .order("reconciliation_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!data) return [];

      return data.map((row) => ({
        reconciliationId: row.reconciliation_id,
        date: row.reconciliation_date,
        departmentId: row.department_id,
        departmentName: (row.department as { name: string } | null)?.name ?? "",
      }));
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Verify the query shape**

Check that `daily_reconciliation` has a `status` column with value `'open'`. Run:
`grep -n "reconciliation_status" packages/supabase/src/database.types.ts | head -5`

If the enum values differ (e.g., `pending` instead of `open`), update the filter value.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/reconciliation/_hooks/useUnreconciledDays.ts
git commit -m "feat(reconciliation): add useUnreconciledDays hook

Queries daily_reconciliation for open days before today. Used by
DailyStatusBar and dashboard prompt card.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire Lock Button into DayApproval

**Files:**

- Modify: `apps/web/src/app/dashboard/reconciliation/_components/DayApproval.tsx`

- [ ] **Step 1: Read DayApproval**

Read `apps/web/src/app/dashboard/reconciliation/_components/DayApproval.tsx` fully. Find:

1. The approval button and its handler
2. How the component receives the reconciliation record
3. The Supabase client usage pattern

- [ ] **Step 2: Add lock functionality**

Add a "Godkjenn og las dag" (approve and lock day) button that:

1. Sets `locked_at = new Date().toISOString()` and `locked_by = currentProfileId` on the `daily_reconciliation` record
2. Emits telemetry: `emit("reconciliation.day_locked", { reconciliationId, workspaceId })`
3. Disables all edit controls when `locked_at` is already set
4. Shows a lock icon (Lucide `Lock`) and timestamp when locked

```typescript
import { Lock, LockOpen } from "lucide-react";
import { emit } from "@smartout/telemetry";

// In the component:
const isLocked = !!reconciliation.locked_at;

// Lock handler:
const handleLockDay = async () => {
  const supabase = createClient();
  const { error } = await supabase
    .from("daily_reconciliation")
    .update({
      locked_at: new Date().toISOString(),
      locked_by: profileId,
    })
    .eq("reconciliation_id", reconciliation.reconciliation_id);

  if (error) {
    toast.error(t("reconciliation.lock_failed"));
    return;
  }

  emit("reconciliation.day_locked", {
    reconciliationId: reconciliation.reconciliation_id,
    workspaceId,
  });

  toast.success(t("reconciliation.day_locked_success"));
  queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
};

// In JSX — lock button (only shown when not already locked):
{!isLocked && (
  <Button onClick={handleLockDay} variant="default">
    <Lock className="mr-2 h-4 w-4" />
    {t("reconciliation.lock_day")}
  </Button>
)}

// When locked — show lock status:
{isLocked && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Lock className="h-4 w-4" />
    {t("reconciliation.locked_at", { date: formatDate(reconciliation.locked_at) })}
  </div>
)}
```

- [ ] **Step 3: Add i18n keys**

Add to `packages/i18n/locales/en/dashboard.json` (or relevant namespace):

```json
{
  "reconciliation": {
    "lock_day": "Approve & lock day",
    "locked_at": "Locked {{date}}",
    "lock_failed": "Failed to lock day",
    "day_locked_success": "Day locked successfully"
  }
}
```

Add Norwegian equivalents to `packages/i18n/locales/nb/dashboard.json`:

```json
{
  "reconciliation": {
    "lock_day": "Godkjenn og las dag",
    "locked_at": "Last {{date}}",
    "lock_failed": "Kunne ikke lase dagen",
    "day_locked_success": "Dagen er last"
  }
}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/reconciliation/_components/DayApproval.tsx packages/i18n/locales/en/dashboard.json packages/i18n/locales/nb/dashboard.json
git commit -m "feat(reconciliation): add day lock button with RLS enforcement

Lock button sets locked_at/locked_by on daily_reconciliation. RLS
policy prevents further edits after lock. Emits reconciliation.day_locked
telemetry event.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Operations — Deviation Dialog

**Files:**

- Create: `apps/web/src/app/dashboard/operations/_components/DeviationDialog.tsx`
- Modify: `apps/web/src/app/dashboard/operations/page.tsx`

- [ ] **Step 1: Read the deviation table schema**

Run: `grep -A 30 '"deviation"' packages/supabase/src/database.types.ts | head -40`

Note the columns: `deviation_id`, `workspace_id`, `department_id`, `domain` (enum), `severity`, `description`, `status`, `created_by`, etc.

Also check the domain enum: `grep "deviation_domain" packages/supabase/src/database.types.ts`

- [ ] **Step 2: Create DeviationDialog**

```typescript
// apps/web/src/app/dashboard/operations/_components/DeviationDialog.tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type DeviationDialogProps = {
  workspaceId: string;
  profileId: string;
  departments: Array<{ id: string; name: string }>;
};

const DOMAIN_OPTIONS = [
  "safety",
  "customer",
  "procedure",
  "system",
  "material",
] as const;

const SEVERITY_OPTIONS = ["low", "medium", "high", "critical"] as const;

export function DeviationDialog({
  workspaceId,
  profileId,
  departments,
}: DeviationDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState<string>("");
  const [severity, setSeverity] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!domain || !severity || !description.trim()) return;

    setIsSubmitting(true);
    const supabase = createClient();

    const { error } = await supabase.from("deviation").insert({
      workspace_id: workspaceId,
      department_id: departmentId || null,
      domain,
      severity,
      description: description.trim(),
      created_by: profileId,
      status: "open",
    });

    setIsSubmitting(false);

    if (error) {
      toast.error(t("operations.deviation_failed"));
      return;
    }

    emit("operations.deviation_created", {
      workspaceId,
      domain,
      severity,
    });

    toast.success(t("operations.deviation_created_success"));
    queryClient.invalidateQueries({ queryKey: ["operations"] });
    setOpen(false);
    setDomain("");
    setSeverity("");
    setDepartmentId("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <AlertTriangle className="mr-2 h-4 w-4" />
          {t("operations.log_deviation")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("operations.new_deviation")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>{t("operations.deviation_domain")}</Label>
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger>
                <SelectValue placeholder={t("operations.select_domain")} />
              </SelectTrigger>
              <SelectContent>
                {DOMAIN_OPTIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {t(`operations.domain_${d}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>{t("operations.deviation_severity")}</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger>
                <SelectValue placeholder={t("operations.select_severity")} />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`operations.severity_${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>{t("operations.department")}</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder={t("operations.all_departments")} />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>{t("operations.description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("operations.deviation_description_placeholder")}
              rows={3}
            />
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !domain || !severity || !description.trim()}
        >
          {isSubmitting ? t("common.saving") : t("operations.save_deviation")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Wire into operations page**

Read `apps/web/src/app/dashboard/operations/page.tsx`. Find the header area where the "LIVE" badge is. Add the `DeviationDialog` next to it:

```typescript
import { DeviationDialog } from "./_components/DeviationDialog";

// In the header/toolbar area:
<DeviationDialog
  workspaceId={workspaceId}
  profileId={profileId}
  departments={departments}
/>
```

You'll need to get `departments` from the existing data. Check if the operations hook already loads departments, or add a simple query.

- [ ] **Step 4: Add i18n keys**

Add operations deviation keys to both `en` and `nb` locale files. Keys: `operations.log_deviation`, `operations.new_deviation`, `operations.deviation_domain`, `operations.select_domain`, `operations.domain_safety`, `operations.domain_customer`, `operations.domain_procedure`, `operations.domain_system`, `operations.domain_material`, `operations.deviation_severity`, `operations.select_severity`, `operations.severity_low`, `operations.severity_medium`, `operations.severity_high`, `operations.severity_critical`, `operations.department`, `operations.all_departments`, `operations.description`, `operations.deviation_description_placeholder`, `operations.save_deviation`, `operations.deviation_failed`, `operations.deviation_created_success`.

- [ ] **Step 5: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/operations/_components/DeviationDialog.tsx apps/web/src/app/dashboard/operations/page.tsx packages/i18n/locales/en/ packages/i18n/locales/nb/
git commit -m "feat(operations): add deviation logging dialog

Admin can log deviations directly from operations page. Supports
domain (safety/customer/procedure/system/material), severity, and
department selection. Emits operations.deviation_created telemetry.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Operations — Department Breakdown

**Files:**

- Create: `apps/web/src/app/dashboard/operations/_components/DepartmentBreakdown.tsx`
- Modify: `apps/web/src/app/dashboard/operations/page.tsx`

- [ ] **Step 1: Read useOperationsData hook**

Read `apps/web/src/app/dashboard/operations/_hooks/use-operations-data.ts`. Note that it fetches `department_session` with `department_id`. The data is there but aggregated workspace-wide. We need to group by department.

- [ ] **Step 2: Create DepartmentBreakdown component**

```typescript
// apps/web/src/app/dashboard/operations/_components/DepartmentBreakdown.tsx
"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Users, AlertTriangle } from "lucide-react";

type DepartmentMetric = {
  departmentId: string;
  departmentName: string;
  staffPresent: number;
  staffExpected: number;
  capacityPct: number;
  tasksDone: number;
  tasksTotal: number;
};

type DepartmentBreakdownProps = {
  sessions: Array<{
    department_id: string;
    department?: { name: string } | null;
  }>;
  shifts: Array<{
    department_id: string | null;
    profile_id: string | null;
    status: string;
  }>;
  tasks: Array<{
    department_session_id: string;
    status: string;
  }>;
  sessionMap: Map<string, string>; // session_id -> department_id
};

export function DepartmentBreakdown({
  sessions,
  shifts,
  tasks,
  sessionMap,
}: DepartmentBreakdownProps) {
  const { t } = useTranslation();

  const departments = useMemo((): DepartmentMetric[] => {
    const deptMap = new Map<string, DepartmentMetric>();

    for (const session of sessions) {
      const deptId = session.department_id;
      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, {
          departmentId: deptId,
          departmentName: (session.department as { name: string } | null)?.name ?? deptId,
          staffPresent: 0,
          staffExpected: 0,
          capacityPct: 0,
          tasksDone: 0,
          tasksTotal: 0,
        });
      }
    }

    for (const shift of shifts) {
      if (!shift.department_id) continue;
      const dept = deptMap.get(shift.department_id);
      if (!dept) continue;
      dept.staffExpected++;
      if (shift.status === "active") dept.staffPresent++;
    }

    for (const [sessionId, deptId] of sessionMap) {
      const dept = deptMap.get(deptId);
      if (!dept) continue;
      const sessionTasks = tasks.filter(
        (t) => t.department_session_id === sessionId
      );
      dept.tasksTotal += sessionTasks.length;
      dept.tasksDone += sessionTasks.filter(
        (t) => t.status === "completed"
      ).length;
    }

    for (const dept of deptMap.values()) {
      dept.capacityPct =
        dept.staffExpected > 0
          ? Math.round((dept.staffPresent / dept.staffExpected) * 100)
          : 0;
    }

    return Array.from(deptMap.values()).sort(
      (a, b) => a.capacityPct - b.capacityPct
    );
  }, [sessions, shifts, tasks, sessionMap]);

  if (departments.length === 0) return null;

  return (
    <div className="grid gap-2">
      {departments.map((dept) => {
        const isLow = dept.capacityPct < 70;
        const isMid = dept.capacityPct >= 70 && dept.capacityPct < 90;
        return (
          <div
            key={dept.departmentId}
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
          >
            <div className="flex items-center gap-3">
              {isLow && (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
              <span className="font-medium">{dept.departmentName}</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {dept.staffPresent}/{dept.staffExpected}
              </span>
              <span
                className={
                  isLow
                    ? "text-destructive font-medium"
                    : isMid
                      ? "text-warning font-medium"
                      : "text-success"
                }
              >
                {dept.capacityPct}%
              </span>
              <span>
                {dept.tasksDone}/{dept.tasksTotal} {t("operations.tasks_short")}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Wire into operations page**

In `apps/web/src/app/dashboard/operations/page.tsx`, make the stress card clickable. On click, toggle showing `DepartmentBreakdown` below it. You'll need to pass the raw session/shift/task data from the hook to the breakdown component.

```typescript
import { DepartmentBreakdown } from "./_components/DepartmentBreakdown";

const [showDeptBreakdown, setShowDeptBreakdown] = useState(false);

// On the stress card:
<div
  onClick={() => setShowDeptBreakdown(!showDeptBreakdown)}
  className="cursor-pointer"
>
  {/* existing stress card content */}
</div>

{showDeptBreakdown && (
  <DepartmentBreakdown
    sessions={rawSessions}
    shifts={rawShifts}
    tasks={rawTasks}
    sessionMap={sessionDeptMap}
  />
)}
```

Note: you'll need to expose the raw data from `useOperationsData`. If the hook only returns aggregated data, you may need to modify it to also return the raw arrays. Or create a separate query. Read the hook first to decide.

- [ ] **Step 4: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/operations/_components/DepartmentBreakdown.tsx apps/web/src/app/dashboard/operations/page.tsx
git commit -m "feat(operations): add department drill-down for stress metrics

Clicking the stress card expands per-department breakdown showing
staff present/expected, capacity %, and task completion per dept.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Daily Status Bar

**Files:**

- Create: `apps/web/src/components/dashboard/DailyStatusBar.tsx`
- Modify: `apps/web/src/components/dashboard/AdminDashboard.tsx`

- [ ] **Step 1: Read AdminDashboard**

Read `apps/web/src/components/dashboard/AdminDashboard.tsx`. Find:

1. Where the view content is rendered (the switch between TacticalView, StrategicView, etc.)
2. How `workspaceId` is accessed
3. Where to insert the status bar (above the view content)

- [ ] **Step 2: Create DailyStatusBar**

```typescript
// apps/web/src/components/dashboard/DailyStatusBar.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Calendar, Activity, ClipboardCheck } from "lucide-react";
import { useUnreconciledDays } from "@/app/dashboard/reconciliation/_hooks/useUnreconciledDays";

type StatusSegment = {
  icon: React.ReactNode;
  label: string;
  status: "success" | "warning" | "destructive" | "muted";
  href: string;
};

type DailyStatusBarProps = {
  workspaceId: string | undefined;
  schedulePublished: boolean;
  stressLevel: "Lav" | "Middels" | "Hoy" | null;
};

const statusColors = {
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
} as const;

const dotColors = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
} as const;

export function DailyStatusBar({
  workspaceId,
  schedulePublished,
  stressLevel,
}: DailyStatusBarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: unreconciledDays } = useUnreconciledDays(workspaceId);

  const unreconciledCount = unreconciledDays?.length ?? 0;

  const segments: StatusSegment[] = [
    {
      icon: <Calendar className="h-4 w-4" />,
      label: schedulePublished
        ? t("status_bar.schedule_published")
        : t("status_bar.schedule_draft"),
      status: schedulePublished ? "success" : "muted",
      href: "/dashboard/schedule",
    },
    {
      icon: <Activity className="h-4 w-4" />,
      label: stressLevel
        ? t(`status_bar.stress_${stressLevel.toLowerCase()}`)
        : t("status_bar.no_data"),
      status:
        stressLevel === "Lav"
          ? "success"
          : stressLevel === "Middels"
            ? "warning"
            : stressLevel === "Hoy"
              ? "destructive"
              : "muted",
      href: "/dashboard/operations",
    },
    {
      icon: <ClipboardCheck className="h-4 w-4" />,
      label:
        unreconciledCount > 0
          ? t("status_bar.days_pending", { count: unreconciledCount })
          : t("status_bar.reconciled"),
      status: unreconciledCount > 0 ? "warning" : "success",
      href: "/dashboard/reconciliation",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="mb-4 flex items-center gap-1 rounded-lg border bg-card/50 px-1 py-1.5 backdrop-blur-sm"
    >
      {segments.map((seg, i) => (
        <button
          key={seg.href}
          onClick={() => router.push(seg.href)}
          className="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          <span className={statusColors[seg.status]}>{seg.icon}</span>
          <span className={`${statusColors[seg.status]} font-medium`}>
            {seg.label}
          </span>
          <span
            className={`h-2 w-2 rounded-full ${dotColors[seg.status]}`}
          />
          {i < segments.length - 1 && (
            <span className="ml-2 h-4 w-px bg-border" />
          )}
        </button>
      ))}
    </motion.div>
  );
}
```

- [ ] **Step 3: Wire into AdminDashboard**

In `apps/web/src/components/dashboard/AdminDashboard.tsx`, add the status bar above the view content:

```typescript
import { DailyStatusBar } from "./DailyStatusBar";

// Inside the component, above the view switch:
<DailyStatusBar
  workspaceId={workspaceId}
  schedulePublished={/* derive from schedule data or a simple query */}
  stressLevel={/* derive from operations data or pass from state */}
/>
```

Note: You'll need to source `schedulePublished` and `stressLevel`. Options:

- Add lightweight queries inline (simplest)
- Create a `useDailyStatus` hook that combines the three data sources
- Pass data down if AdminDashboard already has access

Read the component to decide. The simplest approach that works is best.

- [ ] **Step 4: Add i18n keys**

Add to en/nb locale files:

```json
{
  "status_bar": {
    "schedule_published": "Schedule published",
    "schedule_draft": "Schedule in draft",
    "stress_lav": "Low stress",
    "stress_middels": "Medium stress",
    "stress_hoy": "High stress",
    "no_data": "No data",
    "days_pending": "{{count}} day(s) pending",
    "reconciled": "Reconciled"
  }
}
```

Norwegian:

```json
{
  "status_bar": {
    "schedule_published": "Vaktplan publisert",
    "schedule_draft": "Vaktplan i utkast",
    "stress_lav": "Lav stress",
    "stress_middels": "Middels stress",
    "stress_hoy": "Hoy stress",
    "no_data": "Ingen data",
    "days_pending": "{{count}} dag(er) venter",
    "reconciled": "Avstemt"
  }
}
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/dashboard/DailyStatusBar.tsx apps/web/src/components/dashboard/AdminDashboard.tsx packages/i18n/locales/
git commit -m "feat(dashboard): add DailyStatusBar for admin daily loop

Glanceable cockpit showing schedule status, stress level, and
unreconciled days. Each segment links to its page. Uses spring
entrance animation and status color tokens.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors across all packages

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: 0 new warnings

- [ ] **Step 3: Verify all telemetry events are in registry**

Check that these events exist in `packages/telemetry/src/registry.ts`:

- `reconciliation.day_locked`
- `operations.deviation_created`

If they don't exist, add them to the registry following the existing pattern.

- [ ] **Step 4: Manual smoke test**

If Supabase local + web dev server are running:

1. Open `/dashboard` → verify DailyStatusBar renders
2. Open `/dashboard/schedule` → verify BudgetTab shows real data (or "Ingen budsjett" if no budget exists)
3. Open `/dashboard/reconciliation` → verify lock button appears on unlocked days
4. Open `/dashboard/operations` → verify "Registrer avvik" button opens dialog
5. Click stress card → verify department breakdown expands

---

## Future Plans (Not in This Plan)

| Plan                        | Covers                                                                        | Prerequisite                     |
| --------------------------- | ----------------------------------------------------------------------------- | -------------------------------- |
| Phase 0: I1 Bootstrap       | J6 Setup (wire templates into workspace creation)                             | None                             |
| Phase 2a: Governance        | J5 Governance (full page build, CompetenceMatrix hero)                        | Phase 0                          |
| Phase 2b: Onboarding        | J3 Onboarding (pipeline view, auto-assign, readiness gate)                    | Phase 2a (shared hook)           |
| Phase 3: Season Propagation | J7 Season (wire propagateBudgetTargets to activation, budget vs. actual view) | Phase 1 (depends on budget hook) |
| Phase 3: Organization       | J8 Organization (hours editor, team member inline management)                 | None                             |
| Phase 4: Voice Tools        | All journeys (page tools via useRegisterTools)                                | All phases                       |
