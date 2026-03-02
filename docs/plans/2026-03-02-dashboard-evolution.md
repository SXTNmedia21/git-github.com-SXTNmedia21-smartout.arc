---
title: Dashboard Evolution — Full Implementation Plan
status: draft
updated: 2026-03-02
created: 2026-03-02
module: web
tags: [dashboard, budget, settings, reconciliation, heatmap, schedule]
---

# Dashboard Evolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve the dashboard from a static demo to a fully interactive, data-driven workspace management system with persistent settings, budgets, navigation, and improved UX across all views.

**Architecture:** 9 tracks of work, starting with database migrations as foundation, then UI improvements in parallel. Each track is a separate feature branch. Budget system uses a flat `workspace_budget` table with period granularity (monthly → weekly → daily → hourly). Settings stored in dedicated tables with workspace scoping. Reconciliation gets dual-view (table + swipe).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, shadcn/ui, TanStack Query v5, Supabase PostgreSQL, Framer Motion, dnd-kit

---

## Table of Contents

1. [Track 1: Database Migrations](#track-1-database-migrations) — 4 new tables
2. [Track 2: Navigation & Interactivity](#track-2-navigation--interactivity) — Clickable tags, day click, overflow fix
3. [Track 3: KPI Target Persistence](#track-3-kpi-target-persistence) — Save targets to DB
4. [Track 4: Settings Page](#track-4-settings-page) — Opening hours, workspace config
5. [Track 5: Schedule Day Card Enhancement](#track-5-schedule-day-card-enhancement) — Bigger cards, day info
6. [Track 6: Budget System](#track-6-budget-system) — Monthly/weekly/daily/hourly targets
7. [Track 7: Reconciliation Redesign](#track-7-reconciliation-redesign) — Table + swipe views
8. [Track 8: Activity Heatmap Improvements](#track-8-activity-heatmap-improvements) — Tighter layout, date range
9. [Track 9: Seed Data & Tests](#track-9-seed-data--tests)

## Dependencies

```
Track 1 (DB) ──→ Track 3 (KPI targets)
             ├──→ Track 4 (Settings)
             ├──→ Track 5 (Day cards)
             └──→ Track 6 (Budgets)

Track 2 (Navigation) ── independent
Track 7 (Reconciliation) ── independent
Track 8 (Heatmap) ── independent
Track 9 (Seed data) ── after all tracks
```

## Recommended Execution Order

Tracks 1 + 2 + 7 + 8 can run in parallel (4 worktrees).
Then Tracks 3 + 4 + 5 + 6 after Track 1 merges.
Track 9 last.

---

## Track 1: Database Migrations

**Branch:** `feat/dashboard-evolution-db`

4 new tables + RLS policies. All tables need `workspace_id`, `created_at`, `updated_at`, and both JWT + API key RLS policies.

### Task 1.1: Create `workspace_kpi_target` table

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_workspace_kpi_target.sql`

**Step 1: Write the migration**

```sql
-- KPI targets per workspace (persists StrategicView targets)
CREATE TABLE public.workspace_kpi_target (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN (
    'cost_of_sales', 'turnover_90d', 'absence_rate',
    'time_to_job_ready', 'task_completion', 'training_readiness'
  )),
  target_value DECIMAL NOT NULL,
  benchmark_value DECIMAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, metric)
);

-- RLS
ALTER TABLE public.workspace_kpi_target ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_workspace_kpi_target" ON public.workspace_kpi_target
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_workspace_kpi_target" ON public.workspace_kpi_target
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_workspace_kpi_target" ON public.workspace_kpi_target
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Index
CREATE INDEX idx_workspace_kpi_target_ws ON public.workspace_kpi_target(workspace_id);
```

**Step 2: Run migration**

```bash
cd /home/sxtnl/dev/smartout.ai && npx supabase db reset
```

**Step 3: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

**Step 4: Verify types contain new table**

```bash
grep -n "workspace_kpi_target" packages/supabase/src/database.types.ts | head -5
```

**Step 5: Commit**

```bash
git add supabase/migrations/*_add_workspace_kpi_target.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add workspace_kpi_target table with RLS"
```

---

### Task 1.2: Create `operating_hours` table

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_operating_hours.sql`

**Step 1: Write the migration**

```sql
-- Operating hours per location (or workspace-wide if location_id is null)
CREATE TABLE public.operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.location(location_id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Monday, 6=Sunday
  open_time TIME NOT NULL DEFAULT '08:00',
  close_time TIME NOT NULL DEFAULT '22:00',
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, location_id, day_of_week)
);

-- RLS
ALTER TABLE public.operating_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_operating_hours" ON public.operating_hours
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_operating_hours" ON public.operating_hours
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_operating_hours" ON public.operating_hours
  FOR SELECT USING (workspace_id = get_api_workspace_id());

CREATE INDEX idx_operating_hours_ws ON public.operating_hours(workspace_id);
CREATE INDEX idx_operating_hours_loc ON public.operating_hours(workspace_id, location_id);
```

**Step 2: Run migration, regenerate types, verify, commit** (same pattern as 1.1)

---

### Task 1.3: Create `workspace_budget` table

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_workspace_budget.sql`

**Step 1: Write the migration**

```sql
-- Budget targets at various granularities (monthly/weekly/daily/hourly)
-- Flat table: each row is one budget entry for a specific period + scope
CREATE TYPE public.budget_period_type AS ENUM ('monthly', 'weekly', 'daily', 'hourly');

CREATE TABLE public.workspace_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.location(location_id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.department(department_id) ON DELETE CASCADE,

  -- Period identification
  period_type public.budget_period_type NOT NULL,
  period_date DATE NOT NULL,          -- first day of the period (month start for monthly, week start for weekly, exact date for daily)
  hour_slot INT CHECK (hour_slot BETWEEN 0 AND 23), -- only for hourly entries

  -- Revenue targets
  revenue_target DECIMAL,             -- expected income for this period
  food_cost_target DECIMAL,           -- food cost budget
  cost_of_sales_target DECIMAL,       -- percentage target

  -- Labor targets
  labor_cost_target DECIMAL,          -- staff cost budget
  labor_hours_target DECIMAL,         -- total staff hours budget
  overtime_limit_hours DECIMAL,       -- max overtime

  -- Other targets
  turnover_target DECIMAL,            -- turnover % target
  absence_threshold DECIMAL,          -- max absence %
  time_to_job_target DECIMAL,         -- days target

  -- Metadata
  currency TEXT NOT NULL DEFAULT 'NOK',
  notes TEXT,
  created_by UUID REFERENCES public.user_identity(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate entries for same scope + period
  UNIQUE NULLS NOT DISTINCT (workspace_id, location_id, department_id, period_type, period_date, hour_slot)
);

-- RLS
ALTER TABLE public.workspace_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_workspace_budget" ON public.workspace_budget
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_workspace_budget" ON public.workspace_budget
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_workspace_budget" ON public.workspace_budget
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Indexes for common queries
CREATE INDEX idx_workspace_budget_ws ON public.workspace_budget(workspace_id);
CREATE INDEX idx_workspace_budget_period ON public.workspace_budget(workspace_id, period_type, period_date);
CREATE INDEX idx_workspace_budget_dept ON public.workspace_budget(workspace_id, department_id, period_type);
```

**Step 2: Run migration, regenerate types, verify, commit**

---

### Task 1.4: Create `schedule_day_info` table

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_schedule_day_info.sql`

**Step 1: Write the migration**

```sql
-- Day information scoped by workspace/department/team
CREATE TYPE public.day_info_scope AS ENUM ('workspace', 'department', 'team');
CREATE TYPE public.day_info_category AS ENUM ('note', 'event', 'alert', 'budget_note');

CREATE TABLE public.schedule_day_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  scope_type public.day_info_scope NOT NULL DEFAULT 'workspace',
  scope_id UUID,  -- department_id or team_id (null for workspace scope)
  title TEXT NOT NULL,
  content TEXT,
  category public.day_info_category NOT NULL DEFAULT 'note',
  created_by UUID REFERENCES public.user_identity(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.schedule_day_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_schedule_day_info" ON public.schedule_day_info
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_schedule_day_info" ON public.schedule_day_info
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_schedule_day_info" ON public.schedule_day_info
  FOR SELECT USING (workspace_id = get_api_workspace_id());

CREATE INDEX idx_schedule_day_info_ws_date ON public.schedule_day_info(workspace_id, date);
CREATE INDEX idx_schedule_day_info_scope ON public.schedule_day_info(workspace_id, scope_type, scope_id, date);
```

**Step 2: Run migration, regenerate types, verify, commit**

**Step 3: Final commit for all migrations**

```bash
git add -A && git commit -m "feat(db): add 4 tables — kpi_target, operating_hours, workspace_budget, schedule_day_info"
```

---

## Track 2: Navigation & Interactivity

**Branch:** `feat/dashboard-navigation`

Quick wins — make static elements interactive. No DB changes needed.

### Task 2.1: Make ActionStrip chips navigate to relevant pages

**Files:**

- Modify: `apps/web/src/components/dashboard/ActionStrip.tsx`

**Step 1: Add navigation config to CHIP_CONFIG**

Each chip needs a `href` property pointing to the relevant page:

```typescript
// Add to CHIP_CONFIG items:
const CHIP_CONFIG = [
  {
    key: "shiftGaps" as const,
    icon: CalendarX,
    label: "Shift Gaps",
    href: "/dashboard/schedule", // Navigate to schedule to fill gaps
    priorityColor: {
      /* existing */
    },
  },
  {
    key: "pendingContracts" as const,
    icon: FileSignature,
    label: "Contracts",
    href: "/dashboard/people?tab=contracts",
    priorityColor: {
      /* existing */
    },
  },
  {
    key: "stuckOnboarding" as const,
    icon: UserX,
    label: "Onboarding",
    href: "/dashboard/people?tab=onboarding",
    priorityColor: {
      /* existing */
    },
  },
  {
    key: "pendingProtocols" as const,
    icon: BookOpen,
    label: "Protocols",
    href: "/dashboard/governance",
    priorityColor: {
      /* existing */
    },
  },
  {
    key: "staleInvitations" as const,
    icon: MailWarning,
    label: "Invitations",
    href: "/dashboard/people?tab=invitations",
    priorityColor: {
      /* existing */
    },
  },
];
```

**Step 2: Replace `<div>` chip with `<Link>` from next/link**

```typescript
import Link from "next/link";

// In the render, replace the chip wrapper:
// FROM: <div className={chipClasses}>
// TO:   <Link href={chip.href} className={chipClasses}>
```

**Step 3: Verify navigation works**

Run: `pnpm --filter web dev` and click each chip. Each should navigate to the right page.

**Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/ActionStrip.tsx
git commit -m "feat(dashboard): make ActionStrip chips navigate to relevant pages"
```

---

### Task 2.2: Staff coverage day click → navigate to schedule

**Files:**

- Modify: `apps/web/src/components/dashboard/TacticalView.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx` (need setScheduleDateOffset)

**Step 1: Add useRouter and click handler to TacticalView**

The weekly coverage bars in TacticalView show 7 days. Clicking a day bar should:

1. Navigate to `/dashboard/schedule`
2. Set the schedule date offset to show that specific day

```typescript
import { useRouter } from "next/navigation";
import { useDashboard } from "./DashboardShell"; // access context

// Inside TacticalView component:
const router = useRouter();
const { setScheduleDateOffset } = useDashboard(); // need to expose this from context

const handleDayClick = (dayDate: string) => {
  // Calculate offset from current week start to clicked day's week
  const clickedWeekStart = getMonday(dayDate);
  const currentWeekStart = getCurrentWeekStart();
  const weekDiff = Math.round(
    (new Date(clickedWeekStart).getTime() - new Date(currentWeekStart).getTime()) / (7 * 86400000),
  );
  setScheduleDateOffset(weekDiff);
  router.push("/dashboard/schedule");
};
```

**Step 2: Make the weekly bar rows clickable**

In the coverage bar render section, wrap each day bar in a clickable div:

```typescript
{coverage?.map((day: DayCoverage) => (
  <button
    key={day.date}
    onClick={() => handleDayClick(day.date)}
    className="group flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
  >
    {/* existing bar content */}
  </button>
))}
```

**Step 3: Verify clicking a day navigates to schedule page showing that week**

**Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/TacticalView.tsx apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(dashboard): click coverage day bar → navigate to schedule"
```

---

### Task 2.3: Training readiness — add event from TacticalView

**Files:**

- Modify: `apps/web/src/components/dashboard/TacticalView.tsx`

**Step 1: Add "Add Event" button to Upcoming Events section**

Currently the "Upcoming Events (Impact)" section is a placeholder. Add a button to create schedule_day_info entries of category 'event':

```typescript
// In the Upcoming Events sidebar widget:
<div className="flex items-center justify-between">
  <h3 className="text-sm font-semibold">Upcoming Events</h3>
  <button
    onClick={() => setShowEventDialog(true)}
    className="rounded-lg p-1.5 text-xs transition-colors hover:bg-white/5"
  >
    <Plus className="h-3.5 w-3.5" />
  </button>
</div>
```

**Step 2: Create a simple EventDialog component**

Create inline dialog (or extract to separate file) that creates a `schedule_day_info` entry with `category: 'event'`:

```typescript
// Minimal event creation dialog
function EventDialog({ open, onClose, workspaceId }: { open: boolean; onClose: () => void; workspaceId: string }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    await supabase.from("schedule_day_info").insert({
      workspace_id: workspaceId,
      date,
      title,
      category: "event",
      scope_type: "workspace",
    });
    queryClient.invalidateQueries({ queryKey: ["schedule_day_info"] });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Event</DialogTitle></DialogHeader>
        <Input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button onClick={handleCreate}>Create</Button>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Add a hook to fetch upcoming events**

```typescript
// In _hooks/use-upcoming-events.ts
export function useUpcomingEvents() {
  const { workspaceData } = useDashboard();
  return useQuery({
    queryKey: ["schedule_day_info", "events", workspaceData?.workspace_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("schedule_day_info")
        .select("*")
        .eq("workspace_id", workspaceData!.workspace_id)
        .eq("category", "event")
        .gte("date", new Date().toISOString().split("T")[0])
        .order("date", { ascending: true })
        .limit(5);
      return data ?? [];
    },
    enabled: !!workspaceData?.workspace_id,
  });
}
```

**Step 4: Display upcoming events in the widget replacing the placeholder**

**Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/TacticalView.tsx apps/web/src/app/dashboard/_hooks/use-upcoming-events.ts
git commit -m "feat(dashboard): add event creation from TacticalView upcoming events widget"
```

---

### Task 2.4: Fix overflow in TacticalView

**Files:**

- Modify: `apps/web/src/components/dashboard/TacticalView.tsx`

**Step 1: Identify the overflow**

The TacticalView outer container has `overflow-y-auto` but the weekly schedule section content can overflow horizontally. The fix:

```typescript
// The weekly coverage section needs overflow-hidden on the bar container
// Find the coverage bar wrapper and add overflow-hidden + min-w-0:
<div className="flex min-w-0 flex-col gap-2 overflow-hidden">
  {/* coverage bars */}
</div>
```

Also check the signal card grid — if 4 cards overflow on smaller screens, ensure the grid wraps:

```typescript
// Signal cards grid — ensure it doesn't overflow
<div className="grid flex-shrink-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
```

Add `min-w-0` to the parent container and any flex children that might overflow.

**Step 2: Test at various viewport widths (768px, 1024px, 1280px, 1440px)**

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/TacticalView.tsx
git commit -m "fix(dashboard): prevent overflow in TacticalView coverage section"
```

---

## Track 3: KPI Target Persistence

**Branch:** `feat/kpi-target-persistence`
**Depends on:** Track 1 (workspace_kpi_target table)

### Task 3.1: Create use-kpi-targets hook

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/use-kpi-targets.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/index.ts` (add export)

**Step 1: Write the hook**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/components/dashboard/DashboardShell";
import { dashboardKeys } from "./dashboard-keys";

type KpiMetric =
  | "cost_of_sales"
  | "turnover_90d"
  | "absence_rate"
  | "time_to_job_ready"
  | "task_completion"
  | "training_readiness";

type KpiTargets = Record<KpiMetric, number>;

const DEFAULT_TARGETS: KpiTargets = {
  cost_of_sales: 30,
  turnover_90d: 15,
  absence_rate: 4,
  time_to_job_ready: 7,
  task_completion: 90,
  training_readiness: 100,
};

export function useKpiTargets() {
  const { workspaceData } = useDashboard();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const wsId = workspaceData?.workspace_id;

  const query = useQuery({
    queryKey: dashboardKeys.kpiTargets(wsId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_kpi_target")
        .select("metric, target_value, benchmark_value")
        .eq("workspace_id", wsId!);
      if (error) throw error;

      const targets = { ...DEFAULT_TARGETS };
      for (const row of data ?? []) {
        targets[row.metric as KpiMetric] = Number(row.target_value);
      }
      return targets;
    },
    enabled: !!wsId,
  });

  const updateTarget = useMutation({
    mutationFn: async ({ metric, value }: { metric: KpiMetric; value: number }) => {
      const { error } = await supabase
        .from("workspace_kpi_target")
        .upsert(
          {
            workspace_id: wsId!,
            metric,
            target_value: value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,metric" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.kpiTargets(wsId!) });
    },
  });

  return { targets: query.data ?? DEFAULT_TARGETS, isLoading: query.isLoading, updateTarget };
}
```

**Step 2: Add query key to dashboard-keys.ts**

```typescript
// Add to dashboardKeys object:
kpiTargets: (workspaceId: string) => ["dashboard", "kpi-targets", workspaceId] as const,
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/use-kpi-targets.ts apps/web/src/app/dashboard/_hooks/dashboard-keys.ts apps/web/src/app/dashboard/_hooks/index.ts
git commit -m "feat(dashboard): add useKpiTargets hook with DB persistence"
```

---

### Task 3.2: Replace client-only state in StrategicView with useKpiTargets

**Files:**

- Modify: `apps/web/src/components/dashboard/StrategicView.tsx`

**Step 1: Replace useState targets with useKpiTargets**

```typescript
// REMOVE:
// const [targets, setTargets] = useState({ payrollTarget: 30, ... });

// REPLACE WITH:
import { useKpiTargets } from "@/app/dashboard/_hooks";

const { targets, updateTarget } = useKpiTargets();
```

**Step 2: Update the Configure Goals dialog to use updateTarget.mutate**

Each slider/input in the dialog should call `updateTarget.mutate({ metric, value })` on change (debounced):

```typescript
// In the dialog, replace direct state updates:
// FROM: setTargets(prev => ({ ...prev, payrollTarget: newVal }))
// TO:   updateTarget.mutate({ metric: "cost_of_sales", value: newVal })
```

**Step 3: Map the old target keys to new metric names**

| Old key            | New metric           |
| ------------------ | -------------------- |
| `payrollTarget`    | `cost_of_sales`      |
| `turnoverTarget`   | `turnover_90d`       |
| `absenceTarget`    | `absence_rate`       |
| `onboardingTarget` | `time_to_job_ready`  |
| `taskTarget`       | `task_completion`    |
| `complianceTarget` | `training_readiness` |

**Step 4: Add click-to-edit on individual KPI cards**

Each KPI card in the grid should open a small inline editor on click (not just the global dialog):

```typescript
// Add onClick to each KPI card:
<div onClick={() => setEditingMetric("cost_of_sales")} className="cursor-pointer">
  {/* existing KPI card content */}
</div>

// Inline edit popover:
{editingMetric === "cost_of_sales" && (
  <Popover open onOpenChange={() => setEditingMetric(null)}>
    <PopoverContent>
      <label className="text-xs font-medium">Cost of Sales Target (%)</label>
      <Input
        type="number"
        defaultValue={targets.cost_of_sales}
        onBlur={(e) => {
          updateTarget.mutate({ metric: "cost_of_sales", value: Number(e.target.value) });
          setEditingMetric(null);
        }}
      />
    </PopoverContent>
  </Popover>
)}
```

**Step 5: Verify targets persist across page refreshes**

**Step 6: Commit**

```bash
git add apps/web/src/components/dashboard/StrategicView.tsx
git commit -m "feat(dashboard): persist KPI targets to DB, click-to-edit on cards"
```

---

## Track 4: Settings Page

**Branch:** `feat/dashboard-settings`
**Depends on:** Track 1 (operating_hours table)

### Task 4.1: Build settings page skeleton with tab navigation

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/page.tsx`
- Create: `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx`

**Step 1: Replace the placeholder settings page**

```typescript
// apps/web/src/app/dashboard/settings/page.tsx
import { SettingsTabs } from "./_components/settings-tabs";

export default function SettingsPage() {
  return <SettingsTabs />;
}
```

**Step 2: Create SettingsTabs with sections**

```typescript
// settings-tabs.tsx
"use client";

import { useState } from "react";
import { Clock, Target, Building2, Users, Bell, Shield } from "lucide-react";

const TABS = [
  { id: "general", label: "General", icon: Building2 },
  { id: "hours", label: "Opening Hours", icon: Clock },
  { id: "kpis", label: "KPI Targets", icon: Target },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "teams", label: "Teams & Departments", icon: Users },
  { id: "security", label: "Security", icon: Shield },
] as const;

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState<string>("general");

  return (
    <div className="flex min-h-0 flex-1 gap-6 p-4">
      {/* Sidebar navigation */}
      <nav className="flex w-56 flex-shrink-0 flex-col gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              activeTab === tab.id
                ? "bg-white/10 text-white font-medium"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content area */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        {activeTab === "hours" && <OpeningHoursSettings />}
        {activeTab === "kpis" && <KpiTargetSettings />}
        {/* Other tabs render their components */}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/settings/
git commit -m "feat(settings): settings page skeleton with tab navigation"
```

---

### Task 4.2: Opening Hours settings tab

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_components/opening-hours-settings.tsx`
- Create: `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts`

**Step 1: Create the hook**

```typescript
// use-operating-hours.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/components/dashboard/DashboardShell";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type OperatingHour = {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  location_id: string | null;
};

export function useOperatingHours(locationId?: string) {
  const { workspaceData } = useDashboard();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const wsId = workspaceData?.workspace_id;

  const query = useQuery({
    queryKey: ["operating_hours", wsId, locationId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("operating_hours").select("*").eq("workspace_id", wsId!);

      if (locationId) {
        q = q.eq("location_id", locationId);
      } else {
        q = q.is("location_id", null);
      }

      const { data, error } = await q.order("day_of_week");
      if (error) throw error;

      // Fill in missing days with defaults
      const hours: OperatingHour[] = [];
      for (let i = 0; i < 7; i++) {
        const existing = data?.find((d) => d.day_of_week === i);
        hours.push(
          existing ?? {
            id: `new-${i}`,
            day_of_week: i,
            open_time: "08:00",
            close_time: "22:00",
            is_closed: false,
            location_id: locationId ?? null,
          },
        );
      }
      return hours;
    },
    enabled: !!wsId,
  });

  const upsertHours = useMutation({
    mutationFn: async (hours: Omit<OperatingHour, "id">[]) => {
      const rows = hours.map((h) => ({
        workspace_id: wsId!,
        location_id: h.location_id,
        day_of_week: h.day_of_week,
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: h.is_closed,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("operating_hours")
        .upsert(rows, { onConflict: "workspace_id,location_id,day_of_week" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operating_hours", wsId] });
    },
  });

  return { hours: query.data, isLoading: query.isLoading, upsertHours, DAY_NAMES };
}
```

**Step 2: Create the OpeningHoursSettings component**

```typescript
// opening-hours-settings.tsx
"use client";

import { useState } from "react";
import { useOperatingHours } from "../_hooks/use-operating-hours";
import { Switch } from "@smartout/ui";

export function OpeningHoursSettings() {
  const { hours, upsertHours, DAY_NAMES } = useOperatingHours();
  const [localHours, setLocalHours] = useState(hours);

  // Sync when data loads
  if (hours && !localHours) setLocalHours(hours);

  const handleSave = () => {
    if (!localHours) return;
    upsertHours.mutate(localHours.map(({ id, ...rest }) => rest));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Opening Hours</h2>
        <p className="text-sm text-zinc-400">Set operating hours for each day of the week.</p>
      </div>

      <div className="space-y-3">
        {localHours?.map((hour, i) => (
          <div key={hour.day_of_week} className="flex items-center gap-4 rounded-lg border border-zinc-800 p-3">
            <span className="w-24 text-sm font-medium">{DAY_NAMES[hour.day_of_week]}</span>

            <Switch
              checked={!hour.is_closed}
              onCheckedChange={(open) => {
                const updated = [...localHours];
                updated[i] = { ...hour, is_closed: !open };
                setLocalHours(updated);
              }}
            />

            {!hour.is_closed && (
              <>
                <input
                  type="time"
                  value={hour.open_time}
                  onChange={(e) => {
                    const updated = [...localHours];
                    updated[i] = { ...hour, open_time: e.target.value };
                    setLocalHours(updated);
                  }}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                />
                <span className="text-zinc-500">—</span>
                <input
                  type="time"
                  value={hour.close_time}
                  onChange={(e) => {
                    const updated = [...localHours];
                    updated[i] = { ...hour, close_time: e.target.value };
                    setLocalHours(updated);
                  }}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                />
              </>
            )}

            {hour.is_closed && <span className="text-sm text-zinc-500">Closed</span>}
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Save Hours
      </button>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/settings/
git commit -m "feat(settings): opening hours configuration with per-day time slots"
```

---

## Track 5: Schedule Day Card Enhancement

**Branch:** `feat/schedule-day-cards`
**Depends on:** Track 1 (schedule_day_info table)

### Task 5.1: Expand day column header to double height

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/daily-grid.tsx`
- Modify: `apps/web/src/app/dashboard/schedule/_components/schedule-data.ts`

**Step 1: Update DayColumn type with new fields**

```typescript
// schedule-data.ts — add new fields to DayColumn:
export type DayColumn = {
  id: string;
  label: string;
  staff: number;
  shifts: number;
  cost: string;
  isToday?: boolean;
  isHoliday?: boolean;
  coverageAlert?: string;
  messages?: number;
  tasks?: { done: number; total: number };
  situation: string;
  // NEW fields:
  budgetAmount?: number; // revenue target for the day
  laborBudget?: number; // labor cost target
  events?: { id: string; title: string }[]; // day events
  dayInfo?: { id: string; title: string; scope: string }[]; // day notes
  expectedRevenue?: number; // expected income
};
```

**Step 2: Double the header height from h-24 to h-48**

In daily-grid.tsx, find the DroppableDayHeader component:

```typescript
// Change: className="... h-24 ..."
// To:     className="... h-48 ..."

// Restructure the header content into sections:
<div className="flex h-48 cursor-pointer flex-col justify-between p-3" onClick={() => onDateClick(day.id)}>
  {/* Top: Date + alert */}
  <div className="flex items-start justify-between">
    <h2 className="text-sm font-semibold tracking-tight">{day.label}</h2>
    <DayContextMenu />
  </div>

  {/* Middle: Budget + Events */}
  <div className="flex flex-col gap-1">
    {day.budgetAmount != null && (
      <div className="flex items-center gap-1 text-[11px] text-emerald-400">
        <span>kr {day.budgetAmount.toLocaleString("no-NO")}</span>
      </div>
    )}
    {day.events?.map((evt) => (
      <div key={evt.id} className="truncate rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-400">
        {evt.title}
      </div>
    ))}
    {day.dayInfo?.map((info) => (
      <div key={info.id} className="truncate text-[10px] text-zinc-500">
        {info.title}
      </div>
    ))}
  </div>

  {/* Bottom: Stats */}
  <div className="mt-auto flex flex-col gap-1.5">
    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
      <span><Users className="h-3 w-3" /> {day.staff}</span>
      <span><Briefcase className="h-3 w-3" /> {day.shifts}</span>
    </div>
    {day.coverageAlert ? <AlertBadge /> : <OkBadge />}
  </div>
</div>
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/daily-grid.tsx apps/web/src/app/dashboard/schedule/_components/schedule-data.ts
git commit -m "feat(schedule): double-height day headers with budget, events, day info"
```

---

### Task 5.2: Create use-day-info hook and wire data into day columns

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-day-info.ts`
- Modify: `apps/web/src/app/dashboard/schedule/page.tsx` (wire data into day columns)

**Step 1: Write the hook**

```typescript
// use-day-info.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/components/dashboard/DashboardShell";

export type DayInfo = {
  id: string;
  date: string;
  title: string;
  content: string | null;
  scope_type: "workspace" | "department" | "team";
  scope_id: string | null;
  category: "note" | "event" | "alert" | "budget_note";
};

export function useDayInfo(startDate: string, endDate: string) {
  const { workspaceData } = useDashboard();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const wsId = workspaceData?.workspace_id;

  const query = useQuery({
    queryKey: ["schedule_day_info", wsId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_day_info")
        .select("*")
        .eq("workspace_id", wsId!)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");
      if (error) throw error;
      return (data ?? []) as DayInfo[];
    },
    enabled: !!wsId,
  });

  const createDayInfo = useMutation({
    mutationFn: async (info: Omit<DayInfo, "id">) => {
      const { error } = await supabase
        .from("schedule_day_info")
        .insert({ ...info, workspace_id: wsId! });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_day_info", wsId] });
    },
  });

  // Group by date for easy lookup
  const byDate = new Map<string, DayInfo[]>();
  for (const info of query.data ?? []) {
    const existing = byDate.get(info.date) ?? [];
    existing.push(info);
    byDate.set(info.date, existing);
  }

  return { dayInfoByDate: byDate, isLoading: query.isLoading, createDayInfo };
}
```

**Step 2: In page.tsx, call useDayInfo and merge into day columns**

```typescript
// In the day column building logic:
const { dayInfoByDate } = useDayInfo(weekStart, weekEnd);

// When building DayColumn[]:
const dayColumns: DayColumn[] = dates.map((date) => {
  const dayInfo = dayInfoByDate.get(date) ?? [];
  const events = dayInfo.filter((d) => d.category === "event");
  const notes = dayInfo.filter((d) => d.category !== "event");

  return {
    id: date,
    label: formatDayLabel(date),
    // ... existing fields
    events: events.map((e) => ({ id: e.id, title: e.title })),
    dayInfo: notes.map((n) => ({ id: n.id, title: n.title, scope: n.scope_type })),
  };
});
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_hooks/use-day-info.ts apps/web/src/app/dashboard/schedule/page.tsx
git commit -m "feat(schedule): wire day info into schedule columns"
```

---

### Task 5.3: Day info creation dialog with scope selection

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/day-info-dialog.tsx`
- Modify: `apps/web/src/app/dashboard/schedule/_components/day-context-menu.tsx` (add "Add Info" option)

**Step 1: Create the dialog**

```typescript
// day-info-dialog.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@smartout/ui";
import { useDayInfo } from "../_hooks/use-day-info";

type Props = {
  open: boolean;
  onClose: () => void;
  date: string;
  departments: { id: string; name: string }[];
  teams: { id: string; name: string }[];
};

export function DayInfoDialog({ open, onClose, date, departments, teams }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<"note" | "event" | "alert">("note");
  const [scopeType, setScopeType] = useState<"workspace" | "department" | "team">("workspace");
  const [scopeId, setScopeId] = useState<string | null>(null);

  const { createDayInfo } = useDayInfo(date, date);

  const handleCreate = () => {
    createDayInfo.mutate({
      date,
      title,
      content: content || null,
      category,
      scope_type: scopeType,
      scope_id: scopeType === "workspace" ? null : scopeId,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Day Information</DialogTitle></DialogHeader>

        {/* Category selector */}
        <div className="flex gap-2">
          {(["note", "event", "alert"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs capitalize ${
                category === cat ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Scope selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400">Applies to</label>
          <div className="flex gap-2">
            <button
              onClick={() => { setScopeType("workspace"); setScopeId(null); }}
              className={`rounded px-3 py-1 text-xs ${scopeType === "workspace" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
            >
              All (Strategic)
            </button>
            <button
              onClick={() => setScopeType("department")}
              className={`rounded px-3 py-1 text-xs ${scopeType === "department" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
            >
              Department
            </button>
            <button
              onClick={() => setScopeType("team")}
              className={`rounded px-3 py-1 text-xs ${scopeType === "team" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
            >
              Team
            </button>
          </div>

          {scopeType === "department" && (
            <select
              value={scopeId ?? ""}
              onChange={(e) => setScopeId(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
            >
              <option value="">Select department...</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}

          {scopeType === "team" && (
            <select
              value={scopeId ?? ""}
              onChange={(e) => setScopeId(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
            >
              <option value="">Select team...</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>

        {/* Title + content */}
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        />
        <textarea
          placeholder="Details (optional)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          rows={3}
        />

        <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
          Add
        </button>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Add "Add Day Info" to the day context menu**

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/day-info-dialog.tsx apps/web/src/app/dashboard/schedule/_components/day-context-menu.tsx
git commit -m "feat(schedule): day info dialog with scope selection (workspace/dept/team)"
```

---

## Track 6: Budget System

**Branch:** `feat/budget-system`
**Depends on:** Track 1 (workspace_budget table)

### Task 6.1: Create use-budget hook

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/use-budget.ts`

**Step 1: Write the hook with CRUD operations**

```typescript
// use-budget.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/components/dashboard/DashboardShell";

type BudgetPeriodType = "monthly" | "weekly" | "daily" | "hourly";

type BudgetEntry = {
  id: string;
  period_type: BudgetPeriodType;
  period_date: string;
  hour_slot: number | null;
  location_id: string | null;
  department_id: string | null;
  revenue_target: number | null;
  food_cost_target: number | null;
  cost_of_sales_target: number | null;
  labor_cost_target: number | null;
  labor_hours_target: number | null;
  overtime_limit_hours: number | null;
  turnover_target: number | null;
  absence_threshold: number | null;
  time_to_job_target: number | null;
  notes: string | null;
};

export function useBudget(opts: {
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string;
  locationId?: string;
  departmentId?: string;
}) {
  const { workspaceData } = useDashboard();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const wsId = workspaceData?.workspace_id;

  const query = useQuery({
    queryKey: ["workspace_budget", wsId, opts],
    queryFn: async () => {
      let q = supabase
        .from("workspace_budget")
        .select("*")
        .eq("workspace_id", wsId!)
        .eq("period_type", opts.periodType)
        .gte("period_date", opts.startDate)
        .lte("period_date", opts.endDate);

      if (opts.locationId) q = q.eq("location_id", opts.locationId);
      if (opts.departmentId) q = q.eq("department_id", opts.departmentId);

      const { data, error } = await q.order("period_date").order("hour_slot");
      if (error) throw error;
      return (data ?? []) as BudgetEntry[];
    },
    enabled: !!wsId,
  });

  const upsertBudget = useMutation({
    mutationFn: async (entries: Partial<BudgetEntry>[]) => {
      const rows = entries.map((e) => ({
        ...e,
        workspace_id: wsId!,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("workspace_budget").upsert(rows, {
        onConflict: "workspace_id,location_id,department_id,period_type,period_date,hour_slot",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace_budget", wsId] });
    },
  });

  return { budgets: query.data ?? [], isLoading: query.isLoading, upsertBudget };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/use-budget.ts
git commit -m "feat(dashboard): add useBudget hook for budget CRUD"
```

---

### Task 6.2: Budget settings panel on StrategicView

**Files:**

- Create: `apps/web/src/components/dashboard/BudgetSettingsPanel.tsx`
- Modify: `apps/web/src/components/dashboard/StrategicView.tsx`

**Step 1: Add settings icon next to departments section in StrategicView**

In StrategicView, add a small settings gear icon that toggles the BudgetSettingsPanel:

```typescript
// In StrategicView:
const [showBudgetSettings, setShowBudgetSettings] = useState(false);
const [selectedMonth, setSelectedMonth] = useState(() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
});

// Near the department/pipeline section, add:
<button
  onClick={() => setShowBudgetSettings(!showBudgetSettings)}
  className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
  title="Budget Settings"
>
  <Settings className="h-4 w-4" />
</button>
```

**Step 2: Create BudgetSettingsPanel**

```typescript
// BudgetSettingsPanel.tsx
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBudget } from "@/app/dashboard/_hooks/use-budget";

type Props = {
  isDark: boolean;
  month: string; // "2026-03"
  onMonthChange: (month: string) => void;
};

export function BudgetSettingsPanel({ isDark, month, onMonthChange }: Props) {
  const [view, setView] = useState<"monthly" | "weekly" | "daily" | "hourly">("monthly");
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());

  // Parse month into date range
  const monthStart = `${month}-01`;
  const monthEnd = getLastDayOfMonth(month);

  const { budgets, upsertBudget } = useBudget({
    periodType: view,
    startDate: monthStart,
    endDate: monthEnd,
  });

  // Month navigation
  const navigateMonth = (dir: -1 | 1) => {
    const [year, m] = month.split("-").map(Number);
    const d = new Date(year!, m! - 1 + dir, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      {/* Header: Month selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Budget Settings</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => navigateMonth(-1)}><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-medium">
            {new Date(monthStart).toLocaleDateString("no-NO", { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => navigateMonth(1)}><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Granularity tabs: Monthly → Weekly → Daily → Hourly */}
      <div className="flex gap-1 rounded-lg bg-zinc-800/50 p-1">
        {(["monthly", "weekly", "daily", "hourly"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setView(t)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              view === t ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Monthly view: single form with all targets */}
      {view === "monthly" && (
        <MonthlyBudgetForm
          budget={budgets[0]}
          onSave={(values) => upsertBudget.mutate([{ ...values, period_type: "monthly", period_date: monthStart }])}
        />
      )}

      {/* Weekly view: 4-5 week rows */}
      {view === "weekly" && (
        <WeeklyBudgetGrid
          month={month}
          budgets={budgets}
          onSave={(entries) => upsertBudget.mutate(entries)}
        />
      )}

      {/* Daily view: calendar grid with selectable days */}
      {view === "daily" && (
        <DailyBudgetGrid
          month={month}
          budgets={budgets}
          selectedDays={selectedDays}
          onToggleDay={(day) => {
            const next = new Set(selectedDays);
            next.has(day) ? next.delete(day) : next.add(day);
            setSelectedDays(next);
          }}
          onSave={(entries) => upsertBudget.mutate(entries)}
        />
      )}

      {/* Hourly view: shows hours for selected day(s) */}
      {view === "hourly" && (
        <HourlyBudgetGrid
          dates={Array.from(selectedDays)}
          budgets={budgets}
          onSave={(entries) => upsertBudget.mutate(entries)}
        />
      )}
    </div>
  );
}

// Helper sub-components:

function MonthlyBudgetForm({ budget, onSave }: { budget?: any; onSave: (v: any) => void }) {
  const [values, setValues] = useState({
    revenue_target: budget?.revenue_target ?? "",
    labor_cost_target: budget?.labor_cost_target ?? "",
    food_cost_target: budget?.food_cost_target ?? "",
    cost_of_sales_target: budget?.cost_of_sales_target ?? "",
    turnover_target: budget?.turnover_target ?? "",
    absence_threshold: budget?.absence_threshold ?? "",
    time_to_job_target: budget?.time_to_job_target ?? "",
  });

  const fields = [
    { key: "revenue_target", label: "Expected Revenue (NOK)", placeholder: "e.g. 500000" },
    { key: "labor_cost_target", label: "Labor Cost Budget (NOK)", placeholder: "e.g. 150000" },
    { key: "food_cost_target", label: "Food Cost Budget (NOK)", placeholder: "e.g. 100000" },
    { key: "cost_of_sales_target", label: "Cost of Sales Target (%)", placeholder: "e.g. 30" },
    { key: "turnover_target", label: "Turnover Target (%)", placeholder: "e.g. 15" },
    { key: "absence_threshold", label: "Absence Threshold (%)", placeholder: "e.g. 4" },
    { key: "time_to_job_target", label: "Time to Job-Ready (days)", placeholder: "e.g. 7" },
  ];

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.key} className="flex items-center gap-3">
          <label className="w-48 text-xs font-medium text-zinc-400">{f.label}</label>
          <input
            type="number"
            value={values[f.key as keyof typeof values]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
          />
        </div>
      ))}
      <button
        onClick={() => {
          const parsed: Record<string, number | null> = {};
          for (const [k, v] of Object.entries(values)) {
            parsed[k] = v === "" ? null : Number(v);
          }
          onSave(parsed);
        }}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
      >
        Save Monthly Budget
      </button>
    </div>
  );
}

function getLastDayOfMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year!, m!, 0);
  return d.toISOString().split("T")[0]!;
}

// WeeklyBudgetGrid, DailyBudgetGrid, HourlyBudgetGrid follow similar patterns
// with appropriate date grouping and input grids.
// Implementation details in subsequent tasks.
```

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/BudgetSettingsPanel.tsx apps/web/src/components/dashboard/StrategicView.tsx
git commit -m "feat(dashboard): budget settings panel with month selector and granularity tabs"
```

---

### Task 6.3: Weekly budget grid

**Files:**

- Create: `apps/web/src/components/dashboard/budget/WeeklyBudgetGrid.tsx`

**Step 1: Write the component**

Shows 4-5 rows (one per week of the month). Each row has inputs for revenue + labor targets.

```typescript
"use client";

type Props = {
  month: string;
  budgets: BudgetEntry[];
  onSave: (entries: Partial<BudgetEntry>[]) => void;
};

export function WeeklyBudgetGrid({ month, budgets, onSave }: Props) {
  const weeks = getWeeksInMonth(month); // Returns array of { start: string, end: string, label: string }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[120px_1fr_1fr_1fr] gap-2 text-[11px] font-medium text-zinc-500 uppercase">
        <span>Week</span>
        <span>Revenue (NOK)</span>
        <span>Labor (NOK)</span>
        <span>Food Cost (NOK)</span>
      </div>
      {weeks.map((week) => {
        const existing = budgets.find(
          (b) => b.period_type === "weekly" && b.period_date === week.start
        );
        return (
          <WeekRow
            key={week.start}
            week={week}
            budget={existing}
            onSave={(values) => onSave([{
              ...values,
              period_type: "weekly",
              period_date: week.start,
            }])}
          />
        );
      })}
    </div>
  );
}
```

**Step 2: Commit**

---

### Task 6.4: Daily budget grid with multi-day selection

**Files:**

- Create: `apps/web/src/components/dashboard/budget/DailyBudgetGrid.tsx`

**Step 1: Write the component**

Calendar-style grid showing all days of the month. Click to select one or more days, then set budget for selection:

```typescript
"use client";

type Props = {
  month: string;
  budgets: BudgetEntry[];
  selectedDays: Set<string>;
  onToggleDay: (day: string) => void;
  onSave: (entries: Partial<BudgetEntry>[]) => void;
};

export function DailyBudgetGrid({ month, budgets, selectedDays, onToggleDay, onSave }: Props) {
  const days = getDaysInMonth(month);
  const [bulkValues, setBulkValues] = useState({ revenue_target: "", labor_cost_target: "" });

  const applyToSelected = () => {
    const entries = Array.from(selectedDays).map((date) => ({
      period_type: "daily" as const,
      period_date: date,
      revenue_target: bulkValues.revenue_target ? Number(bulkValues.revenue_target) : null,
      labor_cost_target: bulkValues.labor_cost_target ? Number(bulkValues.labor_cost_target) : null,
    }));
    onSave(entries);
  };

  return (
    <div className="space-y-4">
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-zinc-500 uppercase">{d}</div>
        ))}
        {days.map((day) => {
          const existing = budgets.find((b) => b.period_date === day.date);
          const isSelected = selectedDays.has(day.date);
          return (
            <button
              key={day.date}
              onClick={() => onToggleDay(day.date)}
              className={`flex flex-col items-center rounded-lg border p-2 text-xs transition-all ${
                isSelected
                  ? "border-indigo-500 bg-indigo-500/10"
                  : existing?.revenue_target
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-zinc-800 hover:border-zinc-600"
              }`}
            >
              <span className="font-medium">{day.dayNum}</span>
              {existing?.revenue_target && (
                <span className="text-[9px] text-emerald-400">
                  {(existing.revenue_target / 1000).toFixed(0)}k
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bulk edit for selected days */}
      {selectedDays.size > 0 && (
        <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4">
          <p className="text-xs text-zinc-400 mb-3">
            Set budget for {selectedDays.size} selected day{selectedDays.size > 1 ? "s" : ""}
          </p>
          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Revenue target"
              value={bulkValues.revenue_target}
              onChange={(e) => setBulkValues((v) => ({ ...v, revenue_target: e.target.value }))}
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
            />
            <input
              type="number"
              placeholder="Labor cost"
              value={bulkValues.labor_cost_target}
              onChange={(e) => setBulkValues((v) => ({ ...v, labor_cost_target: e.target.value }))}
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
            />
            <button onClick={applyToSelected} className="rounded bg-indigo-600 px-4 py-1.5 text-sm text-white">
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

---

### Task 6.5: Hourly budget grid

**Files:**

- Create: `apps/web/src/components/dashboard/budget/HourlyBudgetGrid.tsx`

**Step 1: Write the component**

Shows a 24-row grid (or filtered by operating hours) for selected day(s). Each row = 1 hour with revenue + labor inputs:

```typescript
"use client";

type Props = {
  dates: string[];
  budgets: BudgetEntry[];
  onSave: (entries: Partial<BudgetEntry>[]) => void;
};

export function HourlyBudgetGrid({ dates, budgets, onSave }: Props) {
  // Show hours 06:00-23:00 (typical restaurant range)
  const hours = Array.from({ length: 18 }, (_, i) => i + 6);

  if (dates.length === 0) {
    return <p className="text-sm text-zinc-500">Select one or more days in the Daily view first, then switch to Hourly.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-400">
        Editing hourly budget for: {dates.join(", ")}
      </p>

      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900">
            <tr className="text-[11px] text-zinc-500 uppercase">
              <th className="py-2 text-left">Hour</th>
              <th className="py-2 text-right">Revenue</th>
              <th className="py-2 text-right">Labor</th>
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => {
              // Find existing budget for first selected date
              const existing = budgets.find(
                (b) => b.period_type === "hourly" && b.hour_slot === hour && dates.includes(b.period_date)
              );
              return (
                <tr key={hour} className="border-t border-zinc-800/50">
                  <td className="py-1.5 font-medium">{String(hour).padStart(2, "0")}:00</td>
                  <td className="py-1.5">
                    <input
                      type="number"
                      defaultValue={existing?.revenue_target ?? ""}
                      placeholder="—"
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-xs"
                      onBlur={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        const entries = dates.map((date) => ({
                          period_type: "hourly" as const,
                          period_date: date,
                          hour_slot: hour,
                          revenue_target: val,
                        }));
                        onSave(entries);
                      }}
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      type="number"
                      defaultValue={existing?.labor_cost_target ?? ""}
                      placeholder="—"
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-xs"
                      onBlur={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        const entries = dates.map((date) => ({
                          period_type: "hourly" as const,
                          period_date: date,
                          hour_slot: hour,
                          labor_cost_target: val,
                        }));
                        onSave(entries);
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/budget/
git commit -m "feat(budget): weekly, daily (multi-select), and hourly budget grids"
```

---

## Track 7: Reconciliation Redesign

**Branch:** `feat/reconciliation-redesign`

Replace department cards with two views: table view + Tinder-style swipe for individual shift approval.

### Task 7.1: Table view for reconciliation

**Files:**

- Modify: `apps/web/src/components/dashboard/ReconciliationView.tsx`

**Step 1: Add view toggle (Table / Swipe)**

```typescript
const [viewMode, setViewMode] = useState<"table" | "swipe">("table");

// In the header, next to date navigation:
<div className="flex items-center gap-1 rounded-lg bg-zinc-800/50 p-1">
  <button
    onClick={() => setViewMode("table")}
    className={`rounded-md px-3 py-1.5 text-xs ${viewMode === "table" ? "bg-white/10 text-white" : "text-zinc-400"}`}
  >
    Table
  </button>
  <button
    onClick={() => setViewMode("swipe")}
    className={`rounded-md px-3 py-1.5 text-xs ${viewMode === "swipe" ? "bg-white/10 text-white" : "text-zinc-400"}`}
  >
    Swipe
  </button>
</div>
```

**Step 2: Replace the department cards grid with a table**

```typescript
{viewMode === "table" && (
  <div className="overflow-x-auto rounded-xl border border-zinc-800">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
          <th className="px-4 py-3">Employee</th>
          <th className="px-4 py-3">Department</th>
          <th className="px-4 py-3">Role</th>
          <th className="px-4 py-3">Shift</th>
          <th className="px-4 py-3 text-right">Hours</th>
          <th className="px-4 py-3 text-center">Status</th>
          <th className="px-4 py-3 text-center">Action</th>
        </tr>
      </thead>
      <tbody>
        {departments?.flatMap((dept) =>
          dept.shifts.map((shift) => (
            <tr key={shift.id} className="border-b border-zinc-800/50 hover:bg-white/[0.02]">
              <td className="px-4 py-3 font-medium">{shift.employee_name ?? "Unassigned"}</td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full`} style={{ backgroundColor: dept.departmentColor }} />
                  {dept.departmentName}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-400">{shift.role}</td>
              <td className="px-4 py-3">{shift.start_time} — {shift.end_time}</td>
              <td className="px-4 py-3 text-right">{shift.work_hours}h</td>
              <td className="px-4 py-3 text-center">
                <StatusBadge status={shift.status} />
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => approveShift(shift.id)}
                    className="rounded-full bg-emerald-500/10 p-1.5 text-emerald-400 hover:bg-emerald-500/20"
                    title="Approve"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => flagShift(shift.id)}
                    className="rounded-full bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20"
                    title="Flag Issue"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
)}
```

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/ReconciliationView.tsx
git commit -m "feat(reconciliation): table view with approve/reject per shift"
```

---

### Task 7.2: Tinder-style swipe view for individual shifts

**Files:**

- Create: `apps/web/src/components/dashboard/SwipeReconciliation.tsx`
- Modify: `apps/web/src/components/dashboard/ReconciliationView.tsx`

**Step 1: Create the swipe component**

Uses Framer Motion for swipe animations. Shows one shift at a time in a centered card. Swipe right = approve, swipe left = flag issue.

```typescript
// SwipeReconciliation.tsx
"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Check, X, Clock, Users, Building2, ChevronLeft, ChevronRight } from "lucide-react";

type ShiftForReview = {
  id: string;
  employee_name: string;
  department_name: string;
  department_color: string;
  role: string;
  start_time: string;
  end_time: string;
  work_hours: number;
  status: string;
};

type Props = {
  shifts: ShiftForReview[];
  onApprove: (shiftId: string) => void;
  onReject: (shiftId: string) => void;
  isDark: boolean;
};

export function SwipeReconciliation({ shifts, onApprove, onReject, isDark }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Map<string, "approved" | "rejected">>(new Map());

  const pendingShifts = shifts.filter((s) => !decisions.has(s.id));
  const current = pendingShifts[0];

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Check className="h-12 w-12 text-emerald-400" />
        <p className="text-lg font-semibold">All shifts reviewed!</p>
        <p className="text-sm text-zinc-400">
          {decisions.size} shifts processed: {[...decisions.values()].filter((d) => d === "approved").length} approved,{" "}
          {[...decisions.values()].filter((d) => d === "rejected").length} flagged
        </p>
      </div>
    );
  }

  const handleDecision = (decision: "approved" | "rejected") => {
    if (decision === "approved") onApprove(current.id);
    else onReject(current.id);

    setDecisions((prev) => new Map(prev).set(current.id, decision));
  };

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      {/* Progress */}
      <div className="text-sm text-zinc-400">
        {decisions.size} / {shifts.length} reviewed
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <SwipeCard
          key={current.id}
          shift={current}
          isDark={isDark}
          onSwipeLeft={() => handleDecision("rejected")}
          onSwipeRight={() => handleDecision("approved")}
        />
      </AnimatePresence>

      {/* Manual buttons */}
      <div className="flex items-center gap-8">
        <button
          onClick={() => handleDecision("rejected")}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-500/30 text-red-400 transition-colors hover:bg-red-500/10"
        >
          <X className="h-6 w-6" />
        </button>
        <button
          onClick={() => handleDecision("approved")}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-500/30 text-emerald-400 transition-colors hover:bg-emerald-500/10"
        >
          <Check className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

function SwipeCard({
  shift,
  isDark,
  onSwipeLeft,
  onSwipeRight,
}: {
  shift: ShiftForReview;
  isDark: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  // Color overlays
  const greenOpacity = useTransform(x, [0, 100], [0, 0.3]);
  const redOpacity = useTransform(x, [-100, 0], [0.3, 0]);

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100) onSwipeRight();
        else if (info.offset.x < -100) onSwipeLeft();
      }}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className={`relative w-80 cursor-grab rounded-2xl border p-6 active:cursor-grabbing ${
        isDark ? "border-zinc-700 bg-zinc-900" : "border-zinc-200 bg-white"
      }`}
    >
      {/* Green/Red overlays */}
      <motion.div
        style={{ opacity: greenOpacity }}
        className="pointer-events-none absolute inset-0 rounded-2xl bg-emerald-500/20"
      />
      <motion.div
        style={{ opacity: redOpacity }}
        className="pointer-events-none absolute inset-0 rounded-2xl bg-red-500/20"
      />

      {/* Card content */}
      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold">
            {shift.employee_name.split(" ").map((n) => n[0]).join("")}
          </div>
          <div>
            <p className="font-semibold">{shift.employee_name}</p>
            <p className="text-xs text-zinc-400">{shift.role}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: shift.department_color }}
          />
          <span>{shift.department_name}</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-zinc-800/50 p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-medium">{shift.start_time} — {shift.end_time}</span>
          </div>
          <span className="text-sm font-bold">{shift.work_hours}h</span>
        </div>
      </div>
    </motion.div>
  );
}
```

**Step 2: Wire into ReconciliationView**

```typescript
// In ReconciliationView, when viewMode === "swipe":
{viewMode === "swipe" && (
  <SwipeReconciliation
    shifts={allShiftsFlat}
    onApprove={handleApprove}
    onReject={handleReject}
    isDark={isDark}
  />
)}
```

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/SwipeReconciliation.tsx apps/web/src/components/dashboard/ReconciliationView.tsx
git commit -m "feat(reconciliation): Tinder-style swipe view for shift approval"
```

---

## Track 8: Activity Heatmap Improvements

**Branch:** `feat/heatmap-improvements`

### Task 8.1: Add date range selector

**Files:**

- Modify: `apps/web/src/components/dashboard/ActivityView.tsx`

**Step 1: Replace the static timeframe with a functional date range selector**

```typescript
// Replace: const [timeframe] = useState("Siste 30 dager");
// With:
const [timeRange, setTimeRange] = useState<"7d" | "14d" | "30d" | "90d" | "today">("30d");

const RANGE_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "14d", label: "Last 14 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
] as const;

// In the header, add range selector buttons:
<div className="flex items-center gap-1 rounded-lg bg-zinc-800/50 p-1">
  {RANGE_OPTIONS.map((opt) => (
    <button
      key={opt.id}
      onClick={() => setTimeRange(opt.id)}
      className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
        timeRange === opt.id ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {opt.label}
    </button>
  ))}
</div>
```

**Step 2: Adjust heatmap column count based on range**

```typescript
const RANGE_DAYS = { today: 1, "7d": 7, "14d": 14, "30d": 30, "90d": 90 };
const days = RANGE_DAYS[timeRange];

// Regenerate heatmap data with correct day count
const generateHeatmapData = (labels: string[], numDays: number) => {
  return labels.map((label) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    data: Array.from({ length: numDays }, () => Math.floor(Math.random() * 100)),
  }));
};
```

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/ActivityView.tsx
git commit -m "feat(heatmap): date range selector (today, 7d, 14d, 30d, 90d)"
```

---

### Task 8.2: Tighten heatmap layout

**Files:**

- Modify: `apps/web/src/components/dashboard/ActivityView.tsx`

**Step 1: Reduce cell size and gap for a tighter grid**

```typescript
// Find the heatmap cell rendering and reduce sizes:
// FROM: className="h-6 w-6 rounded" or similar
// TO:   className="h-4 w-4 rounded-sm"

// Reduce row gap:
// FROM: className="flex gap-1.5" (or gap-2)
// TO:   className="flex gap-0.5"

// Reduce row label width:
// FROM: className="w-32" (or similar)
// TO:   className="w-24 truncate text-xs"

// Make the heatmap container scrollable horizontally for 90d view:
<div className="overflow-x-auto">
  <div className="min-w-fit">
    {/* heatmap rows */}
  </div>
</div>
```

**Step 2: Add day labels above the heatmap columns**

```typescript
// Add a header row with day labels (every 5th or 7th day):
<div className="flex gap-0.5 pl-24">
  {Array.from({ length: days }, (_, i) => (
    <div key={i} className="h-4 w-4 text-center text-[8px] text-zinc-600">
      {i % 7 === 0 ? i + 1 : ""}
    </div>
  ))}
</div>
```

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/ActivityView.tsx
git commit -m "fix(heatmap): tighter layout with smaller cells and day labels"
```

---

## Track 9: Seed Data & Tests

**Branch:** `feat/dashboard-seed-data`
**Depends on:** All previous tracks

### Task 9.1: Create seed data for new tables

**Files:**

- Create: `supabase/seed/dashboard-evolution.sql`

**Step 1: Write seed data**

```sql
-- Seed data for dashboard evolution tables
-- Assumes workspace_id and location_id from existing seed data

-- KPI Targets (for first workspace)
INSERT INTO public.workspace_kpi_target (workspace_id, metric, target_value, benchmark_value)
SELECT w.workspace_id, t.metric, t.target_value, t.benchmark_value
FROM public.workspace w
CROSS JOIN (VALUES
  ('cost_of_sales', 30, 30),
  ('turnover_90d', 15, 15),
  ('absence_rate', 4, 4),
  ('time_to_job_ready', 7, 7),
  ('task_completion', 90, 90),
  ('training_readiness', 100, 100)
) AS t(metric, target_value, benchmark_value)
WHERE w.slug = 'baardshaug-vegkro'
ON CONFLICT (workspace_id, metric) DO NOTHING;

-- Operating Hours (Mon-Sun for first workspace)
INSERT INTO public.operating_hours (workspace_id, day_of_week, open_time, close_time, is_closed)
SELECT w.workspace_id, d.day, d.open_time::time, d.close_time::time, d.is_closed
FROM public.workspace w
CROSS JOIN (VALUES
  (0, '07:00', '23:00', false),  -- Monday
  (1, '07:00', '23:00', false),  -- Tuesday
  (2, '07:00', '23:00', false),  -- Wednesday
  (3, '07:00', '23:00', false),  -- Thursday
  (4, '07:00', '00:00', false),  -- Friday
  (5, '10:00', '00:00', false),  -- Saturday
  (6, '10:00', '22:00', false)   -- Sunday
) AS d(day, open_time, close_time, is_closed)
WHERE w.slug = 'baardshaug-vegkro'
ON CONFLICT DO NOTHING;

-- Monthly Budget (March 2026)
INSERT INTO public.workspace_budget (
  workspace_id, period_type, period_date,
  revenue_target, labor_cost_target, food_cost_target,
  cost_of_sales_target, turnover_target, absence_threshold, time_to_job_target,
  currency
)
SELECT w.workspace_id, 'monthly', '2026-03-01',
  500000, 150000, 100000,
  30, 15, 4, 7, 'NOK'
FROM public.workspace w
WHERE w.slug = 'baardshaug-vegkro'
ON CONFLICT DO NOTHING;

-- Daily Budgets (first 2 weeks of March)
INSERT INTO public.workspace_budget (workspace_id, period_type, period_date, revenue_target, labor_cost_target, currency)
SELECT w.workspace_id, 'daily', d::date,
  CASE EXTRACT(dow FROM d::date)
    WHEN 0 THEN 12000  -- Sunday
    WHEN 5 THEN 25000  -- Friday
    WHEN 6 THEN 22000  -- Saturday
    ELSE 16000          -- Weekdays
  END,
  CASE EXTRACT(dow FROM d::date)
    WHEN 0 THEN 4000
    WHEN 5 THEN 8000
    WHEN 6 THEN 7000
    ELSE 5000
  END,
  'NOK'
FROM public.workspace w
CROSS JOIN generate_series('2026-03-01'::date, '2026-03-14'::date, '1 day') AS d
WHERE w.slug = 'baardshaug-vegkro'
ON CONFLICT DO NOTHING;

-- Day Info entries
INSERT INTO public.schedule_day_info (workspace_id, date, title, content, category, scope_type)
SELECT w.workspace_id, d.date::date, d.title, d.content, d.category::day_info_category, d.scope::day_info_scope
FROM public.workspace w
CROSS JOIN (VALUES
  ('2026-03-05', 'Wine Tasting Evening', 'Special event: 40 guests expected. Extra service staff needed.', 'event', 'workspace'),
  ('2026-03-08', 'Health Inspector Visit', 'Annual inspection. Ensure all HACCP docs ready.', 'alert', 'workspace'),
  ('2026-03-10', 'New Menu Launch', 'Spring menu starts. Kitchen needs prep time.', 'note', 'workspace'),
  ('2026-03-12', 'Staff Training Day', 'Wine training for all service staff 10:00-12:00', 'event', 'workspace')
) AS d(date, title, content, category, scope)
WHERE w.slug = 'baardshaug-vegkro';
```

**Step 2: Run seed**

```bash
cd /home/sxtnl/dev/smartout.ai && npx supabase db reset
```

**Step 3: Commit**

```bash
git add supabase/seed/dashboard-evolution.sql
git commit -m "feat(seed): seed data for KPI targets, hours, budgets, day info"
```

---

### Task 9.2: Typecheck all changes

**Step 1: Run typecheck**

```bash
pnpm turbo typecheck
```

**Step 2: Fix any type errors**

**Step 3: Commit fixes**

---

### Task 9.3: Basic E2E test for dashboard navigation

**Files:**

- Create: `apps/e2e/tests/dashboard-evolution.spec.ts`

**Step 1: Write E2E test**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Dashboard Evolution", () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("ActionStrip chips navigate to correct pages", async ({ page }) => {
    const shiftGapsChip = page.locator('a:has-text("Shift Gaps")');
    if (await shiftGapsChip.isVisible()) {
      await shiftGapsChip.click();
      await expect(page).toHaveURL(/\/dashboard\/schedule/);
    }
  });

  test("Staff coverage day click navigates to schedule", async ({ page }) => {
    // Click on a day bar in the tactical view coverage section
    const dayBar = page.locator('[data-testid="coverage-day-bar"]').first();
    if (await dayBar.isVisible()) {
      await dayBar.click();
      await expect(page).toHaveURL(/\/dashboard\/schedule/);
    }
  });

  test("Strategic view KPI targets persist", async ({ page }) => {
    // Switch to strategic view
    await page.click('button:has-text("Strategic")');
    await page.waitForLoadState("networkidle");

    // Click configure goals
    await page.click('button:has-text("Configure Goals")');

    // Change a target value
    const input = page.locator('input[type="number"]').first();
    await input.fill("25");
    await input.blur();

    // Reload and verify persistence
    await page.reload();
    await page.click('button:has-text("Strategic")');
    await page.click('button:has-text("Configure Goals")');
    const value = await page.locator('input[type="number"]').first().inputValue();
    expect(value).toBe("25");
  });

  test("Reconciliation view has table and swipe modes", async ({ page }) => {
    await page.click('button:has-text("Reconciliation")');

    // Table mode should be default
    await expect(page.locator("table")).toBeVisible();

    // Switch to swipe
    await page.click('button:has-text("Swipe")');
    await expect(page.locator("table")).not.toBeVisible();
  });

  test("Settings page has tabs", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page.locator('button:has-text("Opening Hours")')).toBeVisible();
    await expect(page.locator('button:has-text("KPI Targets")')).toBeVisible();
  });

  test("Heatmap date range selector works", async ({ page }) => {
    await page.click('button:has-text("Activity")');
    await page.click('button:has-text("Last 7 days")');
    // Heatmap should re-render with fewer columns
    await page.waitForTimeout(500);
    // Visual check — columns should be narrower
  });
});
```

**Step 2: Commit**

```bash
git add apps/e2e/tests/dashboard-evolution.spec.ts
git commit -m "test(e2e): basic dashboard evolution E2E tests"
```

---

## Summary of All Files

### New Files (Create)

| File                                                                         | Track | Purpose             |
| ---------------------------------------------------------------------------- | ----- | ------------------- |
| `supabase/migrations/*_add_workspace_kpi_target.sql`                         | 1     | KPI targets table   |
| `supabase/migrations/*_add_operating_hours.sql`                              | 1     | Opening hours table |
| `supabase/migrations/*_add_workspace_budget.sql`                             | 1     | Budget table        |
| `supabase/migrations/*_add_schedule_day_info.sql`                            | 1     | Day info table      |
| `apps/web/src/app/dashboard/_hooks/use-kpi-targets.ts`                       | 3     | KPI targets hook    |
| `apps/web/src/app/dashboard/_hooks/use-upcoming-events.ts`                   | 2     | Events hook         |
| `apps/web/src/app/dashboard/_hooks/use-budget.ts`                            | 6     | Budget CRUD hook    |
| `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx`          | 4     | Settings shell      |
| `apps/web/src/app/dashboard/settings/_components/opening-hours-settings.tsx` | 4     | Hours config UI     |
| `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts`          | 4     | Hours hook          |
| `apps/web/src/app/dashboard/schedule/_hooks/use-day-info.ts`                 | 5     | Day info hook       |
| `apps/web/src/app/dashboard/schedule/_components/day-info-dialog.tsx`        | 5     | Day info creation   |
| `apps/web/src/components/dashboard/BudgetSettingsPanel.tsx`                  | 6     | Budget settings UI  |
| `apps/web/src/components/dashboard/budget/WeeklyBudgetGrid.tsx`              | 6     | Weekly budget       |
| `apps/web/src/components/dashboard/budget/DailyBudgetGrid.tsx`               | 6     | Daily budget        |
| `apps/web/src/components/dashboard/budget/HourlyBudgetGrid.tsx`              | 6     | Hourly budget       |
| `apps/web/src/components/dashboard/SwipeReconciliation.tsx`                  | 7     | Swipe view          |
| `supabase/seed/dashboard-evolution.sql`                                      | 9     | Seed data           |
| `apps/e2e/tests/dashboard-evolution.spec.ts`                                 | 9     | E2E tests           |

### Modified Files

| File                                                                   | Track | Change                            |
| ---------------------------------------------------------------------- | ----- | --------------------------------- |
| `apps/web/src/components/dashboard/ActionStrip.tsx`                    | 2     | Add navigation links              |
| `apps/web/src/components/dashboard/TacticalView.tsx`                   | 2     | Day click + events + overflow fix |
| `apps/web/src/components/dashboard/StrategicView.tsx`                  | 3, 6  | KPI persistence + budget panel    |
| `apps/web/src/components/dashboard/DashboardShell.tsx`                 | 2     | Expose setScheduleDateOffset      |
| `apps/web/src/components/dashboard/ReconciliationView.tsx`             | 7     | Table + swipe modes               |
| `apps/web/src/components/dashboard/ActivityView.tsx`                   | 8     | Date range + tighter layout       |
| `apps/web/src/app/dashboard/settings/page.tsx`                         | 4     | Replace placeholder               |
| `apps/web/src/app/dashboard/schedule/page.tsx`                         | 5     | Wire day info into columns        |
| `apps/web/src/app/dashboard/schedule/_components/daily-grid.tsx`       | 5     | Double-height headers             |
| `apps/web/src/app/dashboard/schedule/_components/schedule-data.ts`     | 5     | Extended DayColumn type           |
| `apps/web/src/app/dashboard/schedule/_components/day-context-menu.tsx` | 5     | Add day info option               |
| `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts`                  | 3     | Add kpiTargets key                |
| `apps/web/src/app/dashboard/_hooks/index.ts`                           | 2, 3  | Export new hooks                  |
| `packages/supabase/src/database.types.ts`                              | 1     | Regenerated                       |
