# Production Readiness — 3 Independent Sub-Plans

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 3 highest-impact gaps blocking production launch: broken event chain, missing cost visibility, and incomplete admin setup.

**Architecture:** Three independent sub-plans that can be executed in parallel (separate worktrees). Each produces working, testable software. No cross-dependencies between sub-plans.

**Tech Stack:** Next.js App Router, Supabase Edge Functions (Deno), TanStack Query v5, Supabase Realtime, shadcn/ui, Zod, `@smartout/telemetry` emit(), `@smartout/notifications` package.

---

## Sub-Plan A: Event Chain Hardening

**Goal:** Fix the two broken links in the shift-to-session-to-notification chain so that publishing shifts creates sessions AND employees receive notifications.

**Context (what already works):**
- `emit()` routes events to engine-dispatch via telemetry providers
- engine_trigger rows exist: `shift.published` -> `department_session_lifecycle`, `shift.published` -> `cascade_cost_snapshot`, `shift.completed` -> `cascade_cost_snapshot`
- `upsert_session` handler creates `department_session` rows with resolved hours
- `send_notification` handler inserts into `notification_outbox`
- `process-notifications` EF (30s cron) polls outbox, resolves templates, fans out to push/SMS/email
- `@smartout/notifications` has full event config registry with templates

**What's broken:**
1. `/api/notifications/outbox` route is a **no-op** — client-side telemetry notification destination silently drops all events
2. `"settings updated"`, `"team created"`, `"team deleted"` events not registered in telemetry registry — emit calls silently drop
3. No integration test proving the full chain works

**NOT broken (council clarification):** `schedule_control` is a stub, but session hooks are already handled by `session-hook-executor` cron (every 5 min, materializes `session_task` rows by joining `session_hook` config with today's `department_session` rows). The stub can remain as-is — see Out of Scope note for ADR.

### Task A1: Fix the Notification Outbox API Route

**Files:**
- Modify: `apps/web/src/app/api/notifications/outbox/route.ts`
- Reference: `packages/notifications/src/outbox.ts` (insertOutboxNotification)
- Reference: `packages/telemetry/src/providers/notifications.ts`

The current route is a no-op that returns `{ ok: true }` without doing anything. Client-side telemetry events with `notifications` destination are silently dropped.

- [ ] **Step 1: Read the telemetry notifications provider to understand the payload shape**

```bash
cat packages/telemetry/src/providers/notifications.ts
```

Understand what payload the client sends to `/api/notifications/outbox`.

- [ ] **Step 2: Read the insertOutboxNotification helper**

```bash
cat packages/notifications/src/outbox.ts
```

Understand the expected parameters for inserting into notification_outbox.

- [ ] **Step 3: Implement the outbox route**

**IMPORTANT (council fix):** `emit.ts` sends `{ event_key, metadata }` (see `packages/telemetry/src/emit.ts` lines 70-76). The route MUST match this payload shape, NOT `{ event_type, workspace_id, ... }`.

Replace the no-op with actual outbox insertion. The route should:
1. Authenticate the user via Supabase auth cookie
2. Validate the payload with Zod matching emit.ts's actual shape
3. Look up the event config from `@smartout/notifications`
4. Derive workspace_id and recipient from auth context (emit.ts doesn't send them in the outbox payload)
5. Insert into `notification_outbox`
6. Return 202 Accepted

```typescript
// apps/web/src/app/api/notifications/outbox/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { getEventConfig, interpolateTemplate } from "@smartout/notifications";
import { z } from "zod";

// Must match emit.ts lines 73-75: { event_key, metadata }
const OutboxPayload = z.object({
  event_key: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = OutboxPayload.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { event_key, metadata } = parsed.data;

  // Convert space-separated event name to dot notation for config lookup
  const configKey = event_key.replace(/\s+/g, ".");
  const config = getEventConfig(configKey);
  if (!config) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Derive workspace and recipient from metadata (entity context)
  const meta = (metadata ?? {}) as Record<string, unknown>;
  const entity = meta.entity as Record<string, string> | undefined;
  const data = meta.data as Record<string, string> | undefined;

  // workspace_id must come from metadata — emit.ts doesn't send it separately
  const workspaceId = (meta.workspace_id as string) ?? null;
  // recipient_id: for shift events, the employee_id from data
  const recipientId = (data?.recipient_id as string) ?? (entity?.entity_id as string) ?? null;

  if (!workspaceId || !recipientId) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no_context" });
  }

  const templateData = { ...((data ?? {}) as Record<string, string>) };

  await supabase.from("notification_outbox").insert({
    workspace_id: workspaceId,
    recipient_id: recipientId,
    mode: config.mode,
    priority: config.default_priority,
    title: interpolateTemplate(config.title_template, templateData),
    body: interpolateTemplate(config.body_template ?? "", templateData),
    action_url: config.action_url_template
      ? interpolateTemplate(config.action_url_template, templateData)
      : null,
    metadata: { event_key: configKey, ...templateData },
    allowed_channels: config.allowed_channels,
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
```

- [ ] **Step 4: Verify the route works manually**

```bash
# Start dev server, then test unauthenticated -> 401
curl -s -X POST http://localhost:3060/api/notifications/outbox \
  -H "Content-Type: application/json" \
  -d '{"event_type":"test","workspace_id":"00000000-0000-0000-0000-000000000000"}' \
  -w "\n%{http_code}"
# Expected: 401
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/notifications/outbox/route.ts
git commit -m "fix(notifications): implement outbox API route for client-side telemetry

The route was a no-op placeholder that silently dropped all client-side
notification events. Now validates auth, looks up event config, and
inserts into notification_outbox for the process-notifications consumer.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task A2: Register Missing Telemetry Events (Council Fix)

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

**Council finding:** `"settings updated"`, `"team created"`, and `"team deleted"` are used in Sub-Plan C emit calls but do NOT exist in the telemetry registry. Unregistered events silently drop (emit.ts line 14).

- [ ] **Step 1: Find the insertion point in registry.ts**

Look for similar admin/settings events near `"payroll_settings updated"` (around line 1206). Add new events in the same section.

- [ ] **Step 2: Add event type interfaces**

```typescript
// Add near the payroll_settings section (~line 1206)

// --- Settings Events ---
export interface SettingsUpdated extends BaseEvent {
  event: "settings updated";
  properties: {
    entity: EntityRef;
    data: { section: string };
  };
}

export interface TeamCreated extends BaseEvent {
  event: "team created";
  properties: {
    entity: EntityRef;
    data: Record<string, unknown>;
  };
}

export interface TeamDeleted extends BaseEvent {
  event: "team deleted";
  properties: {
    entity: EntityRef;
    data: Record<string, unknown>;
  };
}
```

- [ ] **Step 3: Add routing entries to EVENT_ROUTING**

```typescript
// Add in the EVENT_ROUTING object
"settings updated": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "operations",
},
"team created": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "org_structure",
},
"team deleted": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "org_structure",
},
```

- [ ] **Step 4: Add to SmartoutEvent union type**

Find the `SmartoutEvent` union type and add `| SettingsUpdated | TeamCreated | TeamDeleted`.

- [ ] **Step 5: Typecheck**

```bash
pnpm turbo typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register settings and team events

Adds settings updated, team created, team deleted to the telemetry
registry so emit() calls from settings tabs are routed correctly.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### ~~Task A2-OLD: schedule_control handler~~ BLOCKED — See Out of Scope

> **Council verdict:** `session_hook` is a **config/template table** (per-department), not a per-session scheduling table. It has `department_id`, `trigger_offset_min`, `linked_procedure_id` — no `department_session_id`, `scheduled_at`, or `status`. The `session-hook-executor` cron (every 5 min) already joins `session_hook` config with today's `department_session` rows and materializes `session_task` records. The stub handler is safe to leave as-is. See Out of Scope for ADR.

---

### Task A3: Verify Shift Completion Event Emission from ShiftClock

**Files:**
- Read: `apps/web/src/app/dashboard/shift-clock/_hooks/` or `packages/shift-clock/`
- Read: `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts` (line 698 — existing "shift completed" emit)
- Verify: the "shift completed" event is emitted when a shift is punched out via ShiftClock (not just from schedule admin)

- [ ] **Step 1: Check if "shift completed" is emitted from ShiftClock punch-out**

```bash
grep -rn "shift completed\|shift.completed" apps/web/src/app/dashboard/shift-clock/ packages/shift-clock/
```

If NOT found in ShiftClock code, the cost snapshot for actual hours will never trigger when employees punch out. The existing emit at `use-shifts.ts:698` is only for admin-side shift completion.

- [ ] **Step 2: If missing, add emit to ShiftClock punch-out mutation**

Find the punch-out mutation in the ShiftClock hooks and add `emit()` in the `onSuccess` callback:

```typescript
void emit({
  event: "shift completed",
  workspace_id: workspaceId,
  actor_id: profileId,
  properties: {
    entity: {
      entity_type: "shift",
      entity_id: shiftId,
      entity_label: "Shift punch-out",
    },
    data: {
      shift_ids: [shiftId],
      department_id: departmentId,
    },
  },
});
```

- [ ] **Step 3: Commit if changes were needed**

```bash
git add -A
git commit -m "feat(shift-clock): emit shift-completed event on punch-out

Ensures the cascade_cost_snapshot trigger fires for actual-basis cost
calculation when employees punch out, not just when admins complete shifts.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task A4: Typecheck Gate

- [ ] **Step 1: Run typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Fix any type errors introduced by Tasks A1-A3**

---

## Sub-Plan B: Admin Cost Dashboard

**Goal:** Build a cost visibility page so admins can see labor costs by department, day, and employee — sourced from `shift_cost_snapshot` rows generated by the cascade_cost_snapshot engine process.

**Context (what already works):**
- `shift_cost_snapshot` table exists with append-only cost rows (planned + actual basis)
- `cascade_cost_snapshot` action handler in engine-dispatch computes costs with tariff resolution
- Triggers fire on `shift.published` (planned) and `shift.completed` (actual)
- Employee payroll UI exists at `/dashboard/my-salary` — but no admin-facing cost analysis

### Task B1: Cost Dashboard Data Hook

**Files:**
- Create: `apps/web/src/app/dashboard/cost/_hooks/use-cost-overview.ts`

- [ ] **Step 1: Create the data hook**

```typescript
// apps/web/src/app/dashboard/cost/_hooks/use-cost-overview.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type CostSnapshotRow = {
  id: string;
  schedule_shift_id: string;
  profile_id: string | null;
  base_hours: number;
  base_rate: number;
  base_cost: number;
  supplements: Array<{ type: string; amount: number; unit: string }>;
  overtime_cost: number;
  total_cost: number;
  basis: "planned" | "actual";
  effective_start: string | null;
  effective_end: string | null;
  calculated_at: string;
  shift: {
    shift_date: string;
    start_time: string;
    end_time: string;
    department: { name: string; department_id: string } | null;
    employee: { full_name: string; profile_id: string } | null;
  } | null;
};

export type DepartmentCostSummary = {
  departmentId: string;
  departmentName: string;
  plannedCost: number;
  actualCost: number;
  totalHours: number;
  shiftCount: number;
};

export function useCostOverview(dateFrom: string, dateTo: string) {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  return useQuery({
    queryKey: ["cost-overview", workspace.workspace_id, dateFrom, dateTo],
    enabled: !!workspace.workspace_id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_cost_snapshot")
        .select(`
          id, schedule_shift_id, profile_id,
          base_hours, base_rate, base_cost,
          supplements, overtime_cost, total_cost,
          basis, effective_start, effective_end, calculated_at,
          shift:schedule_shift_id (
            shift_date, start_time, end_time,
            department:department_id (name, department_id),
            employee:employee_id (full_name, profile_id)
          )
        `)
        .eq("workspace_id", workspace.workspace_id)
        .gte("effective_start", `${dateFrom}T00:00:00`)
        .lte("effective_start", `${dateTo}T23:59:59`)
        .order("calculated_at", { ascending: false });

      if (error) throw error;

      // Aggregate by department
      const deptMap = new Map<string, DepartmentCostSummary>();
      for (const row of (data ?? []) as CostSnapshotRow[]) {
        const dept = row.shift?.department;
        if (!dept) continue;

        const key = dept.department_id;
        const existing = deptMap.get(key) ?? {
          departmentId: key,
          departmentName: dept.name,
          plannedCost: 0,
          actualCost: 0,
          totalHours: 0,
          shiftCount: 0,
        };

        if (row.basis === "planned") {
          existing.plannedCost += row.total_cost;
        } else {
          existing.actualCost += row.total_cost;
        }
        existing.totalHours += row.base_hours;
        existing.shiftCount += 1;
        deptMap.set(key, existing);
      }

      return {
        snapshots: (data ?? []) as CostSnapshotRow[],
        byDepartment: Array.from(deptMap.values()),
        totals: {
          planned: Array.from(deptMap.values()).reduce((s, d) => s + d.plannedCost, 0),
          actual: Array.from(deptMap.values()).reduce((s, d) => s + d.actualCost, 0),
          hours: Array.from(deptMap.values()).reduce((s, d) => s + d.totalHours, 0),
        },
      };
    },
  });
}
```

- [ ] **Step 2: Verify the query structure matches the table schema**

Cross-check the select columns against `shift_cost_snapshot` migration (20260421100200 + 20260422400300) and `schedule_shift` table. **Council flag:** The join `employee:employee_id(full_name, profile_id)` may need explicit FK syntax like `profile!employee_id(full_name, profile_id)` depending on PostgREST alias resolution. Verify `schedule_shift.employee_id` FK name and test the join before committing.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/cost/_hooks/use-cost-overview.ts
git commit -m "feat(cost): add cost overview data hook with department aggregation

Queries shift_cost_snapshot with shift/department/employee joins.
Aggregates planned vs actual costs by department for a date range.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task B2: Cost Overview UI Components

**Files:**
- Create: `apps/web/src/app/dashboard/cost/_components/CostSummaryCards.tsx`
- Create: `apps/web/src/app/dashboard/cost/_components/DepartmentCostTable.tsx`
- Create: `apps/web/src/app/dashboard/cost/_components/CostOverview.tsx`
- Create: `apps/web/src/app/dashboard/cost/page.tsx`

- [ ] **Step 1: Create the summary cards component**

```typescript
// apps/web/src/app/dashboard/cost/_components/CostSummaryCards.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, Clock, TrendingUp } from "lucide-react";

type Props = {
  planned: number;
  actual: number;
  hours: number;
};

function formatNOK(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CostSummaryCards({ planned, actual, hours }: Props) {
  const variance = planned > 0 ? ((actual - planned) / planned) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Planlagt kostnad</CardTitle>
          <Banknote className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNOK(planned)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Faktisk kostnad</CardTitle>
          <TrendingUp className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNOK(actual)}</div>
          {variance !== 0 && (
            <p className={`text-xs ${variance > 0 ? "text-destructive" : "text-success"}`}>
              {variance > 0 ? "+" : ""}{variance.toFixed(1)}% vs planlagt
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Timer totalt</CardTitle>
          <Clock className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{hours.toFixed(1)}t</div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create the department cost table**

```typescript
// apps/web/src/app/dashboard/cost/_components/DepartmentCostTable.tsx
"use client";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { DepartmentCostSummary } from "../_hooks/use-cost-overview";

function formatNOK(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DepartmentCostTable({ departments }: { departments: DepartmentCostSummary[] }) {
  if (departments.length === 0) {
    return (
      <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
        Ingen kostnadsdata for valgt periode
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Avdeling</TableHead>
          <TableHead className="text-right">Planlagt</TableHead>
          <TableHead className="text-right">Faktisk</TableHead>
          <TableHead className="text-right">Avvik</TableHead>
          <TableHead className="text-right">Timer</TableHead>
          <TableHead className="text-right">Vakter</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {departments.map((dept) => {
          const variance = dept.plannedCost > 0
            ? ((dept.actualCost - dept.plannedCost) / dept.plannedCost) * 100
            : 0;
          return (
            <TableRow key={dept.departmentId}>
              <TableCell className="font-medium">{dept.departmentName}</TableCell>
              <TableCell className="text-right">{formatNOK(dept.plannedCost)}</TableCell>
              <TableCell className="text-right">{formatNOK(dept.actualCost)}</TableCell>
              <TableCell className={`text-right ${variance > 0 ? "text-destructive" : "text-success"}`}>
                {variance !== 0 ? `${variance > 0 ? "+" : ""}${variance.toFixed(1)}%` : "\u2014"}
              </TableCell>
              <TableCell className="text-right">{dept.totalHours.toFixed(1)}</TableCell>
              <TableCell className="text-right">{dept.shiftCount}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Create the CostOverview wrapper component**

```typescript
// apps/web/src/app/dashboard/cost/_components/CostOverview.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCostOverview } from "../_hooks/use-cost-overview";
import { CostSummaryCards } from "./CostSummaryCards";
import { DepartmentCostTable } from "./DepartmentCostTable";

function getWeekRange(offset: number): { from: string; to: string; label: string } {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
    label: `${monday.toLocaleDateString("nb-NO", { day: "numeric", month: "short" })} \u2014 ${sunday.toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}`,
  };
}

export function CostOverview() {
  const [weekOffset, setWeekOffset] = useState(0);
  const { from, to, label } = getWeekRange(weekOffset);
  const { data, isLoading } = useCostOverview(from, to);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Lonnsoversikt</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{label}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekOffset((w) => w + 1)}
            disabled={weekOffset >= 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
              Denne uken
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground py-12 text-center text-sm">
          Laster kostnadsdata...
        </div>
      ) : (
        <>
          <CostSummaryCards
            planned={data?.totals.planned ?? 0}
            actual={data?.totals.actual ?? 0}
            hours={data?.totals.hours ?? 0}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kostnad per avdeling</CardTitle>
            </CardHeader>
            <CardContent>
              <DepartmentCostTable departments={data?.byDepartment ?? []} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create the page**

```typescript
// apps/web/src/app/dashboard/cost/page.tsx
import { CostOverview } from "./_components/CostOverview";

export default function CostPage() {
  return <CostOverview />;
}
```

- [ ] **Step 5: Add sidebar link for the cost page**

Read `apps/web/src/components/dashboard/DashboardShell.tsx` to find where nav items are defined. Add a link for `/dashboard/cost` with the `Banknote` icon, visible only to admin/owner roles. The exact insertion point depends on the current sidebar structure.

- [ ] **Step 6: Typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/cost/
git commit -m "feat(cost): add admin cost dashboard with department breakdown

New /dashboard/cost page showing planned vs actual labor costs,
week navigation, department-level summary table with variance.
Data sourced from shift_cost_snapshot rows.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Sub-Plan C: Settings Completion & My-Schedule Realtime

**Goal:** Complete the 3 placeholder settings tabs (general, KPI, teams) and add Realtime subscription to my-schedule so employees see shift changes instantly.

**Context:**
- `workspace` table has all fields for general settings (name, logo_url, timezone, currency, language, phone, email, address)
- `team` + `team_member` tables exist with full schema (CRUD ready)
- `workspace_kpi_target` table exists for KPI targets
- `use-my-shifts.ts` polls every 2min via TanStack Query staleTime — no Supabase Realtime subscription

**Note on trainee redirect:** Trainee first-day routing requires an ADR because it touches the onboarding finalization architecture (shell + /onboarding pattern). It should NOT be implemented as a status-based redirect in the dashboard layout. This is out of scope for this plan and tracked as a separate design task.

### Task C1: General Settings Tab

**Files:**
- Create: `apps/web/src/app/dashboard/settings/_components/general-settings.tsx`
- Modify: `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx` (import + wire)

- [ ] **Step 1: Create the GeneralSettings component**

```typescript
// apps/web/src/app/dashboard/settings/_components/general-settings.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { emit } from "@smartout/telemetry";

const GeneralSettingsSchema = z.object({
  name: z.string().min(1, "Navn er pakrevd"),
  timezone: z.string(),
  currency: z.string(),
  language: z.string(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address_line_1: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
});

type GeneralSettingsForm = z.infer<typeof GeneralSettingsSchema>;

export function GeneralSettings() {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  const form = useForm<GeneralSettingsForm>({
    resolver: zodResolver(GeneralSettingsSchema),
    defaultValues: {
      name: "",
      timezone: "Europe/Oslo",
      currency: "NOK",
      language: "no",
    },
  });

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("workspace")
        .select(
          "name, timezone, currency, language, phone, email, address_line_1, postal_code, city",
        )
        .eq("workspace_id", workspace.workspace_id)
        .single();

      if (data) {
        form.reset({
          name: data.name ?? "",
          timezone: data.timezone ?? "Europe/Oslo",
          currency: data.currency ?? "NOK",
          language: data.language ?? "no",
          phone: data.phone ?? "",
          email: data.email ?? "",
          address_line_1: data.address_line_1 ?? "",
          postal_code: data.postal_code ?? "",
          city: data.city ?? "",
        });
      }
    }
    load();
  }, [workspace.workspace_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(values: GeneralSettingsForm) {
    setSaving(true);
    const { error } = await supabase
      .from("workspace")
      .update({
        name: values.name,
        timezone: values.timezone,
        currency: values.currency,
        language: values.language,
        phone: values.phone || null,
        email: values.email || null,
        address_line_1: values.address_line_1 || null,
        postal_code: values.postal_code || null,
        city: values.city || null,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspace.workspace_id);

    setSaving(false);

    if (error) {
      toast.error("Kunne ikke lagre innstillinger");
      return;
    }

    toast.success("Innstillinger lagret");

    void emit({
      event: "settings updated",
      workspace_id: workspace.workspace_id,
      actor_id: profileId ?? user.id, // COUNCIL FIX: never use empty string
      properties: {
        entity: {
          entity_type: "workspace",
          entity_id: workspace.workspace_id,
          entity_label: values.name,
        },
        data: { section: "general" },
      },
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Bedriftsnavn</Label>
          <Input id="name" {...form.register("name")} />
          {form.formState.errors.name && (
            <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="timezone">Tidssone</Label>
            <Select
              value={form.watch("timezone")}
              onValueChange={(v) => form.setValue("timezone", v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Oslo">Europe/Oslo</SelectItem>
                <SelectItem value="Europe/Stockholm">Europe/Stockholm</SelectItem>
                <SelectItem value="Europe/Copenhagen">Europe/Copenhagen</SelectItem>
                <SelectItem value="Europe/Helsinki">Europe/Helsinki</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Valuta</Label>
            <Select
              value={form.watch("currency")}
              onValueChange={(v) => form.setValue("currency", v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NOK">NOK</SelectItem>
                <SelectItem value="SEK">SEK</SelectItem>
                <SelectItem value="DKK">DKK</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" {...form.register("phone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-post</Label>
            <Input id="email" type="email" {...form.register("email")} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_line_1">Adresse</Label>
          <Input id="address_line_1" {...form.register("address_line_1")} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="postal_code">Postnummer</Label>
            <Input id="postal_code" {...form.register("postal_code")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Sted</Label>
            <Input id="city" {...form.register("city")} />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Lagrer..." : "Lagre innstillinger"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Wire GeneralSettings into settings-tabs.tsx**

In `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx`:

Add lazy import at the top (after existing lazy imports, around line 70):

```typescript
const GeneralSettings = lazy(() =>
  import("./general-settings").then((m) => ({ default: m.GeneralSettings })),
);
```

In the `TabContent` function (line 148), add a case for `"general"` before the default fallback:

```typescript
case "general":
  return (
    <Suspense fallback={<SettingsLoadingSkeleton />}>
      <GeneralSettings />
    </Suspense>
  );
```

- [ ] **Step 3: Typecheck**

```bash
pnpm turbo typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_components/general-settings.tsx
git add apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx
git commit -m "feat(settings): implement general settings tab

Workspace name, timezone, currency, contact details, and address.
Replaces the placeholder tab with a working form backed by the
workspace table.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task C2: Teams & Departments Settings Tab

**Files:**
- Create: `apps/web/src/app/dashboard/settings/_components/teams-settings.tsx`
- Modify: `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx` (import + wire)

- [ ] **Step 1: Create the TeamsSettings component**

```typescript
// apps/web/src/app/dashboard/settings/_components/teams-settings.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { emit } from "@smartout/telemetry";

type Team = {
  team_id: string;
  name: string;
  team_type: string;
  is_active: boolean;
  leader_profile_id: string | null;
  department: { name: string } | null;
  team_member: { count: number }[];
};

const TEAM_TYPES = [
  { value: "operational", label: "Operativt" },
  { value: "access", label: "Tilgang" },
  { value: "cross_department", label: "Tverrfaglig" },
  { value: "seasonal", label: "Sesong" },
  { value: "custom", label: "Egendefinert" },
] as const;

export function TeamsSettings() {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("operational");

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["teams", workspace.workspace_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("team")
        .select(
          "team_id, name, team_type, is_active, leader_profile_id, " +
          "department:department_id(name), team_member(count)",
        )
        .eq("workspace_id", workspace.workspace_id)
        .order("name");
      return (data ?? []) as Team[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, teamType }: { name: string; teamType: string }) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { error } = await supabase.from("team").insert({
        workspace_id: workspace.workspace_id,
        name,
        slug,
        team_type: teamType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Team opprettet");
      setDialogOpen(false);
      setFormName("");
      void emit({
        event: "team created",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? user.id, // COUNCIL FIX: never use empty string
        properties: {
          entity: { entity_type: "team", entity_id: "", entity_label: formName },
          data: {},
        },
      });
    },
    onError: () => toast.error("Kunne ikke opprette team"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (team: { team_id: string; name: string }) => {
      const { error } = await supabase.from("team").delete().eq("team_id", team.team_id);
      if (error) throw error;
      return team;
    },
    onSuccess: (_data, team) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Team slettet");
      // COUNCIL FIX: every mutation must emit
      void emit({
        event: "team deleted",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? user.id, // COUNCIL FIX: never use empty string
        properties: {
          entity: { entity_type: "team", entity_id: team.team_id, entity_label: team.name },
          data: {},
        },
      });
    },
    onError: () => toast.error("Kunne ikke slette team"),
  });

  function openCreateDialog() {
    setFormName("");
    setFormType("operational");
    setDialogOpen(true);
  }

  if (isLoading) {
    return (
      <div className="text-muted-foreground py-12 text-center text-sm">Laster team...</div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Administrer team og grupper i arbeidsplassen.
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="mr-1 h-4 w-4" />
              Nytt team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opprett team</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Navn</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEAM_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => {
                  if (formName.trim()) createMutation.mutate({ name: formName.trim(), teamType: formType });
                }}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Oppretter..." : "Opprett"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {teams.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center text-sm">
          Ingen team opprettet enna.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Navn</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Avdeling</TableHead>
              <TableHead className="text-right">Medlemmer</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => (
              <TableRow key={team.team_id}>
                <TableCell className="font-medium">{team.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {TEAM_TYPES.find((t) => t.value === team.team_type)?.label ?? team.team_type}
                  </Badge>
                </TableCell>
                <TableCell>{team.department?.name ?? "\u2014"}</TableCell>
                <TableCell className="text-right">
                  {team.team_member?.[0]?.count ?? 0}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate({ team_id: team.team_id, name: team.name })}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire TeamsSettings into settings-tabs.tsx**

Add lazy import:

```typescript
const TeamsSettings = lazy(() =>
  import("./teams-settings").then((m) => ({ default: m.TeamsSettings })),
);
```

Add case in `TabContent` function (line 148):

```typescript
case "teams":
  return (
    <Suspense fallback={<SettingsLoadingSkeleton />}>
      <TeamsSettings />
    </Suspense>
  );
```

- [ ] **Step 3: Typecheck and commit**

```bash
pnpm turbo typecheck
git add apps/web/src/app/dashboard/settings/_components/teams-settings.tsx
git add apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx
git commit -m "feat(settings): implement teams management tab

List, create, and delete teams with type selection. Shows member count
and department association. Replaces placeholder tab.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task C3: KPI Targets Settings Tab

**Files:**
- Create: `apps/web/src/app/dashboard/settings/_components/kpi-targets-settings.tsx`
- Modify: `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx`

- [ ] **Step 1: Check workspace_kpi_target table schema**

```bash
grep -rn "workspace_kpi_target\|workspace_kpi" supabase/migrations/ | head -20
```

Verify whether a `target_value` NUMERIC column exists. The research found `workspace_kpi_copy` with metric/explanation but no target_value. If missing, a migration is needed first:

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_kpi_target_value.sql
ALTER TABLE workspace_kpi_target ADD COLUMN IF NOT EXISTS target_value NUMERIC(10,2);
-- If workspace_kpi_target doesn't exist, check workspace_kpi_copy instead
```

Adapt the component to whichever table and columns actually exist.

- [ ] **Step 2: Create the KpiTargetsSettings component**

```typescript
// apps/web/src/app/dashboard/settings/_components/kpi-targets-settings.tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { emit } from "@smartout/telemetry";

const KPI_METRICS = [
  { key: "cost_of_sales", label: "Varekostnad %", unit: "%", defaultTarget: 30 },
  { key: "turnover_90d", label: "Turnover (90 dager)", unit: "%", defaultTarget: 10 },
  { key: "absence_rate", label: "Fraversrate", unit: "%", defaultTarget: 5 },
  { key: "time_to_job_ready", label: "Tid til jobbklar", unit: "dager", defaultTarget: 14 },
  { key: "task_completion", label: "Oppgavefullforelse", unit: "%", defaultTarget: 90 },
  { key: "training_readiness", label: "Opplaeringsgrad", unit: "%", defaultTarget: 85 },
] as const;

type KpiTarget = { metric: string; target_value: number };

export function KpiTargetsSettings() {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [targets, setTargets] = useState<Record<string, number>>(() =>
    Object.fromEntries(KPI_METRICS.map((m) => [m.key, m.defaultTarget])),
  );

  const { data: savedTargets } = useQuery({
    queryKey: ["kpi-targets", workspace.workspace_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_kpi_target")
        .select("metric, target_value")
        .eq("workspace_id", workspace.workspace_id);
      return (data ?? []) as KpiTarget[];
    },
  });

  useEffect(() => {
    if (savedTargets) {
      const updated = { ...targets };
      for (const t of savedTargets) {
        if (t.target_value != null) updated[t.metric] = t.target_value;
      }
      setTargets(updated);
    }
  }, [savedTargets]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(targets).map(([metric, target_value]) => ({
        workspace_id: workspace.workspace_id,
        metric,
        target_value,
      }));

      const { error } = await supabase
        .from("workspace_kpi_target")
        .upsert(rows, { onConflict: "workspace_id,metric" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-targets"] });
      toast.success("KPI-mal lagret");
      void emit({
        event: "settings updated",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? user.id, // COUNCIL FIX: never use empty string
        properties: {
          entity: {
            entity_type: "workspace",
            entity_id: workspace.workspace_id,
            entity_label: "KPI",
          },
          data: { section: "kpis" },
        },
      });
    },
    onError: () => toast.error("Kunne ikke lagre KPI-mal"),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-muted-foreground text-sm">
        Sett malverdier for de viktigste driftsindikatorene. Disse brukes i dashboardet for a
        sammenligne faktiske resultater mot mal.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {KPI_METRICS.map((metric) => (
          <Card key={metric.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={targets[metric.key] ?? metric.defaultTarget}
                  onChange={(e) =>
                    setTargets((prev) => ({ ...prev, [metric.key]: Number(e.target.value) }))
                  }
                  className="w-24"
                />
                <span className="text-muted-foreground text-sm">{metric.unit}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? "Lagrer..." : "Lagre KPI-mal"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Wire into settings-tabs.tsx**

Add lazy import:

```typescript
const KpiTargetsSettings = lazy(() =>
  import("./kpi-targets-settings").then((m) => ({ default: m.KpiTargetsSettings })),
);
```

Add case:

```typescript
case "kpis":
  return (
    <Suspense fallback={<SettingsLoadingSkeleton />}>
      <KpiTargetsSettings />
    </Suspense>
  );
```

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm turbo typecheck
git add apps/web/src/app/dashboard/settings/_components/kpi-targets-settings.tsx
git add apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx
git commit -m "feat(settings): implement KPI targets tab

Six KPI metrics with editable target values. Uses workspace_kpi_target
table with upsert on save. Replaces placeholder tab.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task C4: My-Schedule Realtime Subscription

**Files:**
- Modify: `apps/web/src/app/dashboard/my-schedule/_hooks/use-my-shifts.ts`

The current hook polls via TanStack Query staleTime (2min). When a manager publishes or modifies shifts, employees don't see changes until the next poll. Add a Supabase Realtime subscription that invalidates the query cache on shift changes.

- [ ] **Step 1: Read the current hook**

```bash
cat apps/web/src/app/dashboard/my-schedule/_hooks/use-my-shifts.ts
```

Understand the query key structure and how `profileId` is used.

- [ ] **Step 2: Add Realtime subscription alongside the query**

Create a custom hook that combines the existing query with a Realtime channel:

```typescript
// Add to use-my-shifts.ts, after the existing useMyScheduleShifts hook

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Subscribe to Realtime changes on schedule_shift for the current employee.
 * Invalidates the TanStack Query cache when shifts are inserted, updated, or deleted.
 */
export function useMyShiftsRealtime(profileId: string | null) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel(`my-shifts:${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_shift",
          filter: `employee_id=eq.${profileId}`,
        },
        () => {
          // Invalidate all shift queries for this profile
          queryClient.invalidateQueries({
            queryKey: myScheduleKeys.all(profileId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, queryClient, supabase]);
}
```

- [ ] **Step 3: Use the Realtime hook in MyWeekView**

In `apps/web/src/app/dashboard/my-schedule/_components/MyWeekView.tsx`, add the call:

```typescript
// Near the top of the component, after useMyScheduleShifts
useMyShiftsRealtime(profileId);
```

- [ ] **Step 4: Verify the queryKey structure**

Check that `myScheduleKeys.all(profileId)` matches the pattern used in the existing query. If the keys module uses a different structure, adjust the invalidation pattern.

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm turbo typecheck
git add apps/web/src/app/dashboard/my-schedule/_hooks/use-my-shifts.ts
git add apps/web/src/app/dashboard/my-schedule/_components/MyWeekView.tsx
git commit -m "feat(my-schedule): add Realtime subscription for shift changes

Employees now see shift updates instantly when managers publish or
modify shifts, instead of waiting for the 2-minute polling interval.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task C5: Final Typecheck Gate

- [ ] **Step 1: Run full typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: no new errors (warnings acceptable).

---

## Execution Notes

### Sub-Plan Independence

| Sub-Plan | Branch name | Can run in parallel | Files touched |
|----------|------------|---------------------|---------------|
| A | `feat/event-chain-hardening` | Yes | `supabase/functions/engine-dispatch/`, `apps/web/src/app/api/notifications/`, shift-clock hooks |
| B | `feat/admin-cost-dashboard` | Yes | `apps/web/src/app/dashboard/cost/` (new directory), sidebar nav |
| C | `feat/settings-realtime` | Yes | `apps/web/src/app/dashboard/settings/_components/`, `my-schedule/_hooks/` |

No file overlaps between sub-plans. Safe for parallel worktrees.

### Out of Scope (requires separate ADR/design)

- **Session hook scheduling model (ADR needed)** — `session_hook` is a config/template table (per-department: hook_type, trigger_offset_min, linked_procedure_id). The `session-hook-executor` cron (5min) already joins config with `department_session` rows and materializes `session_task` records. The `schedule_control` stub in engine-dispatch can remain as-is. If more granular scheduling is needed later, an ADR should decide between: (a) new `session_hook_instance` table, (b) using `engine_state` wait_for_event steps, or (c) enhancing the cron executor.
- **Trainee first-day redirect** — needs ADR to define how trainee routing works within the onboarding finalization architecture (shell + /onboarding pattern). Must NOT be a status-based redirect in dashboard layout.
- **Phase D adapters** (Tripletex payroll sync) — large integration, separate project
- **Phase E control planes** (EWMA calibration, change proposal lifecycle) — architectural work

### Verification Checklist (post-implementation)

- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] Shift publish creates `department_session` rows + `session_hook` rows in DB
- [ ] Shift publish creates notification in employee notification bell
- [ ] Shift completion creates `shift_cost_snapshot` row with `basis: 'actual'`
- [ ] `/dashboard/cost` shows planned vs actual costs per department
- [ ] Settings > General tab saves workspace name/timezone
- [ ] Settings > Teams tab creates/deletes teams
- [ ] Settings > KPI tab saves target values
- [ ] My-schedule updates in real-time when manager publishes shifts
