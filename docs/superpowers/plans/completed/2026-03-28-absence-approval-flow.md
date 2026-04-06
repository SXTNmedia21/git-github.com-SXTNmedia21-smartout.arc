---
title: Absence Approval Flow Implementation Plan
status: draft
updated: 2026-03-28
created: 2026-03-28
module: scheduling
tags: [absence, approval, smart-cover, prerequisite, council-approved]
---

# Absence Approval Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable leaders to approve or reject pending absence requests, emit telemetry events, and wire the approval event into the Event Engine so downstream workflows (smart-cover) can trigger.

**Architecture:** Add two mutation hooks (`useApproveAbsence`, `useRejectAbsence`) following the existing `useCreateAbsence` pattern in `use-absences.ts`. Add two telemetry events to the registry. Build a compact `PendingAbsenceList` component that renders inside the existing schedule day detail panel. No new tables — uses existing `schedule_absence.status` enum (`pending | approved | rejected`).

**Tech Stack:** React 19, TanStack Query v5, Supabase client, Tailwind v4 (CSS variables), `@smartout/telemetry`, `@smartout/i18n`, shadcn/ui (new-york)

**Council verdict:** Prerequisite for Smart Cover (ADR-0067). Council session 2026-03-28.

---

## File Structure

| Action | File                                                                                | Responsibility                                                    |
| ------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Modify | `packages/telemetry/src/registry.ts`                                                | Add `AbsenceApproved` + `AbsenceRejected` event types and routing |
| Modify | `apps/web/src/app/dashboard/schedule/_hooks/use-absences.ts`                        | Add `useApproveAbsence` + `useRejectAbsence` mutation hooks       |
| Modify | `apps/web/src/app/dashboard/schedule/_hooks/schedule-keys.ts`                       | Add `pendingAbsences` query key                                   |
| Create | `apps/web/src/app/dashboard/schedule/_hooks/use-pending-absences.ts`                | Query hook for workspace-wide pending absences                    |
| Create | `apps/web/src/app/dashboard/schedule/_components/pending-absence-list.tsx`          | Admin-only list of pending absences with approve/reject actions   |
| Modify | `apps/web/src/app/dashboard/schedule/_components/day-control/day-control-panel.tsx` | Render PendingAbsenceList inside day detail (admin only)          |
| Modify | `packages/i18n/locales/nb/dashboard.json`                                           | Add `schedule.absence.*` keys                                     |
| Modify | `packages/i18n/locales/en/dashboard.json`                                           | Add `schedule.absence.*` keys                                     |

---

### Task 1: Add Telemetry Events

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add event interfaces**

After the existing `AbsenceDeleted` interface (around line 761), add:

```typescript
export interface AbsenceApproved extends BaseEvent {
  event: "absence approved";
  properties: {
    entity: EntityRef;
    data: { profile_id: string; approved_by: string; start_date: string; end_date: string };
  };
}

export interface AbsenceRejected extends BaseEvent {
  event: "absence rejected";
  properties: {
    entity: EntityRef;
    data: { profile_id: string; rejected_by: string; reason?: string };
  };
}
```

- [ ] **Step 2: Add to SmartoutEvent union type**

Find the `SmartoutEvent` union type and add `| AbsenceApproved | AbsenceRejected`.

- [ ] **Step 3: Add routing metadata**

After the `"absence deleted"` entry in the `EVENT_REGISTRY` object (around line 2414), add:

```typescript
"absence approved": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "scheduling",
},
"absence rejected": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "scheduling",
},
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @smartout/telemetry exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): add absence approved/rejected events for smart-cover prerequisite"
```

---

### Task 2: Add Mutation Hooks

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_hooks/use-absences.ts`
- Modify: `apps/web/src/app/dashboard/schedule/_hooks/schedule-mappers.ts` (import `toDbAbsenceUpdate` — already exists)

- [ ] **Step 1: Add `useApproveAbsence` hook**

Add after the existing `useDeleteAbsence` function in `use-absences.ts`:

```typescript
// ══════════════════════════════════════════════════════════════
// Mutation: Approve absence (pending → approved)
// ══════════════════════════════════════════════════════════════

export function useApproveAbsence(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryKey = scheduleKeys.absences(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async (absenceId: string) => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_absence")
        .update({ status: "approved" })
        .eq("schedule_absence_id", absenceId)
        .eq("status", "pending")
        .select()
        .single();

      if (error) throw error;

      return fromDbAbsence(data);
    },

    onMutate: async (absenceId) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<Absence[]>(queryKey);

      queryClient.setQueryData<Absence[]>(queryKey, (old) =>
        (old ?? []).map((a) => (a.id === absenceId ? { ...a, status: "approved" as const } : a)),
      );

      return { previous };
    },

    onSuccess: (data) => {
      void emit({
        event: "absence approved",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "absence",
            entity_id: data.id,
          },
          data: {
            profile_id: data.employeeId,
            approved_by: profileId ?? "",
            start_date: data.startDate,
            end_date: data.endDate,
          },
        },
      });
      toast.success("Fravær godkjent");
    },

    onError: (_err, _absenceId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke godkjenne fravær");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        queryKey: scheduleKeys.pendingAbsences(workspace.workspace_id),
      });
    },
  });
}
```

- [ ] **Step 2: Add `useRejectAbsence` hook**

Add after `useApproveAbsence`:

```typescript
// ══════════════════════════════════════════════════════════════
// Mutation: Reject absence (pending → rejected)
// ══════════════════════════════════════════════════════════════

export function useRejectAbsence(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryKey = scheduleKeys.absences(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async (absenceId: string) => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_absence")
        .update({ status: "rejected" })
        .eq("schedule_absence_id", absenceId)
        .eq("status", "pending")
        .select()
        .single();

      if (error) throw error;

      return fromDbAbsence(data);
    },

    onMutate: async (absenceId) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<Absence[]>(queryKey);

      queryClient.setQueryData<Absence[]>(queryKey, (old) =>
        (old ?? []).map((a) => (a.id === absenceId ? { ...a, status: "rejected" as const } : a)),
      );

      return { previous };
    },

    onSuccess: (data) => {
      void emit({
        event: "absence rejected",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "absence",
            entity_id: data.id,
          },
          data: {
            profile_id: data.employeeId,
            rejected_by: profileId ?? "",
          },
        },
      });
      toast.success("Fravær avslått");
    },

    onError: (_err, _absenceId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke avslå fravær");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        queryKey: scheduleKeys.pendingAbsences(workspace.workspace_id),
      });
    },
  });
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter web exec tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 0 new errors (pre-existing errors from @smartout/ai are acceptable)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_hooks/use-absences.ts
git commit -m "feat(schedule): add useApproveAbsence and useRejectAbsence mutation hooks"
```

---

### Task 3: Add Query Key and Pending Absences Hook

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_hooks/schedule-keys.ts`
- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-pending-absences.ts`

- [ ] **Step 1: Add `pendingAbsences` key to schedule-keys.ts**

Add to the `scheduleKeys` object:

```typescript
pendingAbsences: (workspaceId: string) =>
  ["schedule", "pending-absences", workspaceId] as const,
```

- [ ] **Step 2: Create use-pending-absences.ts**

```typescript
"use client";

/**
 * Query hook for workspace-wide pending absence requests.
 * Used by PendingAbsenceList to show admins what needs approval.
 * Fetches pending absences with employee profile data for display.
 */

import { useQuery } from "@tanstack/react-query";

import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

import { scheduleKeys } from "./schedule-keys";

export type PendingAbsence = {
  id: string;
  employeeId: string;
  employeeName: string;
  absenceType: string;
  shiftDate: string;
  startDate: string;
  endDate: string;
  isFullDay: boolean;
  reason: string | null;
  createdAt: string;
};

export function usePendingAbsences() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: scheduleKeys.pendingAbsences(workspace.workspace_id),
    staleTime: 30 * 1000, // 30 seconds — leader checks frequently
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_absence")
        .select(
          `
          schedule_absence_id,
          employee_id,
          absence_type,
          shift_date,
          start_date,
          end_date,
          is_full_day,
          reason,
          created_at,
          profile:employee_id(display_name)
        `,
        )
        .eq("workspace_id", workspace.workspace_id)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data ?? []).map(
        (row): PendingAbsence => ({
          id: row.schedule_absence_id,
          employeeId: row.employee_id,
          employeeName:
            (row.profile as unknown as { display_name: string | null })?.display_name ?? "Ukjent",
          absenceType: row.absence_type,
          shiftDate: row.shift_date,
          startDate: row.start_date,
          endDate: row.end_date,
          isFullDay: row.is_full_day,
          reason: row.reason,
          createdAt: row.created_at,
        }),
      );
    },
  });
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter web exec tsc --noEmit 2>&1 | grep "use-pending-absences"`
Expected: No errors from this file

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_hooks/schedule-keys.ts apps/web/src/app/dashboard/schedule/_hooks/use-pending-absences.ts
git commit -m "feat(schedule): add pending absences query hook for admin approval UI"
```

---

### Task 4: Add i18n Keys

**Files:**

- Modify: `packages/i18n/locales/nb/dashboard.json`
- Modify: `packages/i18n/locales/en/dashboard.json`

- [ ] **Step 1: Add Norwegian keys**

Add inside the `"schedule"` object in `nb/dashboard.json`:

```json
"absence_approval": {
  "title": "Fraværsforespørsler",
  "empty": "Ingen ventende forespørsler",
  "approve": "Godkjenn",
  "reject": "Avslå",
  "approved": "Godkjent",
  "rejected": "Avslått",
  "pending": "Venter",
  "confirm_reject": "Er du sikker på at du vil avslå denne forespørselen?",
  "type_sick": "Sykdom",
  "type_vacation": "Ferie",
  "type_parental": "Foreldrepermisjon",
  "type_unpaid": "Ulønnet permisjon",
  "type_military": "Militærtjeneste",
  "type_training": "Opplæring",
  "type_welfare": "Velferdspermisjon",
  "date_range": "{{start}} – {{end}}",
  "full_day": "Hele dagen",
  "days_count_one": "{{count}} dag",
  "days_count_other": "{{count}} dager"
}
```

- [ ] **Step 2: Add English keys**

Add inside the `"schedule"` object in `en/dashboard.json`:

```json
"absence_approval": {
  "title": "Absence Requests",
  "empty": "No pending requests",
  "approve": "Approve",
  "reject": "Reject",
  "approved": "Approved",
  "rejected": "Rejected",
  "pending": "Pending",
  "confirm_reject": "Are you sure you want to reject this request?",
  "type_sick": "Sick leave",
  "type_vacation": "Vacation",
  "type_parental": "Parental leave",
  "type_unpaid": "Unpaid leave",
  "type_military": "Military service",
  "type_training": "Training",
  "type_welfare": "Welfare leave",
  "date_range": "{{start}} – {{end}}",
  "full_day": "Full day",
  "days_count_one": "{{count}} day",
  "days_count_other": "{{count}} days"
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/locales/nb/dashboard.json packages/i18n/locales/en/dashboard.json
git commit -m "feat(i18n): add absence approval keys for nb and en"
```

---

### Task 5: Build PendingAbsenceList Component

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/pending-absence-list.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

/**
 * Compact list of pending absence requests for admin approval.
 * Renders inside the schedule day detail panel.
 * Each row shows employee name, dates, type, and approve/reject buttons.
 */

import { useState } from "react";
import { Check, X, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@smartout/i18n";

import { usePendingAbsences } from "../_hooks/use-pending-absences";
import { useApproveAbsence, useRejectAbsence } from "../_hooks/use-absences";
import { useWeekRange } from "../_hooks/use-week-range";
import type { PendingAbsence } from "../_hooks/use-pending-absences";

const ABSENCE_TYPE_KEYS: Record<string, string> = {
  sick_leave: "type_sick",
  vacation: "type_vacation",
  parental_leave: "type_parental",
  unpaid_leave: "type_unpaid",
  military: "type_military",
  training: "type_training",
  welfare: "type_welfare",
};

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  return start === end ? fmt(s) : `${fmt(s)} – ${fmt(e)}`;
}

function dayCount(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

export function PendingAbsenceList() {
  const { t } = useTranslation("dashboard");
  const { data: pending, isLoading } = usePendingAbsences();
  const { weekStart } = useWeekRange();
  const approve = useApproveAbsence(weekStart);
  const reject = useRejectAbsence(weekStart);
  const [rejectTarget, setRejectTarget] = useState<PendingAbsence | null>(null);

  if (isLoading || !pending?.length) return null;

  const handleApprove = (id: string) => {
    approve.mutate(id);
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    reject.mutate(rejectTarget.id);
    setRejectTarget(null);
  };

  return (
    <div className="space-y-2">
      <div className="text-foreground flex items-center gap-2 text-sm font-medium">
        <AlertCircle className="text-warning h-4 w-4" />
        {t("schedule.absence_approval.title")} ({pending.length})
      </div>

      <div className="space-y-1.5">
        {pending.map((absence) => {
          const typeKey = ABSENCE_TYPE_KEYS[absence.absenceType] ?? absence.absenceType;
          const days = dayCount(absence.startDate, absence.endDate);

          return (
            <div
              key={absence.id}
              className="border-border bg-card flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Clock className="text-warning h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{absence.employeeName}</p>
                  <p className="text-muted-foreground text-xs">
                    {t(`schedule.absence_approval.${typeKey}`)} ·{" "}
                    {formatDateRange(absence.startDate, absence.endDate)} ·{" "}
                    {t("schedule.absence_approval.days_count", { count: days })}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-success hover:bg-success/10 h-7 w-7"
                  onClick={() => handleApprove(absence.id)}
                  disabled={approve.isPending}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10 h-7 w-7"
                  onClick={() => setRejectTarget(absence)}
                  disabled={reject.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("schedule.absence_approval.reject")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("schedule.absence_approval.confirm_reject")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("schedule.absence_approval.reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter web exec tsc --noEmit 2>&1 | grep "pending-absence-list"`
Expected: No errors from this file

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/pending-absence-list.tsx
git commit -m "feat(schedule): add PendingAbsenceList component for admin absence approval"
```

---

### Task 6: Integrate Into Schedule Day Panel

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/day-control/day-control-panel.tsx` (or equivalent day detail component)

- [ ] **Step 1: Read the file to find the right insertion point**

Read `day-control-panel.tsx` completely. Find where admin-only content is rendered (look for `isAdminMode` checks from `DashboardContext`).

- [ ] **Step 2: Import and render PendingAbsenceList**

Add import:

```typescript
import { PendingAbsenceList } from "../pending-absence-list";
```

Render inside the admin section, above the existing content (session table, shift list, etc.):

```tsx
{
  isAdminMode && <PendingAbsenceList />;
}
```

The exact insertion point depends on the file structure — place it as the first element inside the admin panel content area, before the day's shift list or session table.

- [ ] **Step 3: Verify the page renders**

Run: `pnpm --filter web dev` and navigate to `/dashboard/schedule`. Open a day detail panel. If you are admin, the pending absence list should render (or be empty if no pending absences exist).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/day-control/day-control-panel.tsx
git commit -m "feat(schedule): render PendingAbsenceList in day control panel for admins"
```

---

### Task 7: Verify End-to-End Flow

- [ ] **Step 1: Verify telemetry event types compile**

Run: `pnpm --filter @smartout/telemetry exec tsc --noEmit`

- [ ] **Step 2: Verify web app compiles**

Run: `pnpm --filter web exec tsc --noEmit 2>&1 | tail -5`
Expected: Only pre-existing errors from @smartout/ai and @smartout/types

- [ ] **Step 3: Verify event routing would trigger engine**

Confirm that `"absence approved"` has `engine_event` in its destinations array in `registry.ts`. This ensures that when `emit()` is called after approval, the event is written to `engine_event` table, which `engine-dispatch` polls to resume any `wait_for_event` steps.

- [ ] **Step 4: Commit final state**

```bash
git add -A
git commit -m "feat(schedule): complete absence approval flow — prerequisite for smart-cover (ADR-0067)"
```

---

## Verification Checklist

| Check                                                          | Expected      |
| -------------------------------------------------------------- | ------------- |
| `pnpm --filter @smartout/telemetry exec tsc --noEmit`          | 0 errors      |
| `pnpm --filter web exec tsc --noEmit`                          | No new errors |
| `AbsenceApproved` and `AbsenceRejected` in SmartoutEvent union | Yes           |
| Both events route to `engine_event` destination                | Yes           |
| `useApproveAbsence` guards with `.eq("status", "pending")`     | Yes           |
| `useRejectAbsence` guards with `.eq("status", "pending")`      | Yes           |
| Optimistic updates revert on error                             | Yes           |
| `emit()` called in `onSuccess` for both mutations              | Yes           |
| `pendingAbsences` query key exists in `schedule-keys.ts`       | Yes           |
| PendingAbsenceList only renders for admin                      | Yes           |
| i18n keys added for both `nb` and `en`                         | Yes           |
| Reject has confirmation dialog                                 | Yes           |
| No hardcoded Norwegian text in components                      | Yes           |

---

## What This Unblocks

With this ticket done:

- **Smart Cover (Ticket 2)** can create an `engine_process` that starts with `wait_for_event` on `"absence approved"`
- **Guardian** can emit signals when absences are approved but no cover is found
- **Payroll** can track approved absence days accurately
- **Activity Trail** logs approval/rejection with actor_id for audit
