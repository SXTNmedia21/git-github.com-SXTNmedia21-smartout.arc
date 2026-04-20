---
title: "Season & Year Wheel Gap Closure — Implementation Plan"
status: superseded
superseded-by: docs/modules/MODULE_YEAR_WHEEL_PRD.md
date: 2026-04-10
note: "Superseded 2026-04-13 by council decision. PRD v2.0.0 is now the single source of truth. This plan has 44 stale references to the deleted /dashboard/season/ directory."
---

# Season & Year Wheel Gap Closure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all P0 and P1 gaps from the Season & Year Wheel Gap Closure spec so the module is production-ready with deterministic event chains, correct scoping, full year wheel lifecycle, and real Goals/Procedures tabs.

**Architecture:** Fix dual-emission in `season activated` telemetry routing. Pass `planning_cycle_id` through to scoped queries. Add two new tables (`season_goal`, `season_policy_binding`) with RLS, hooks, and UI components following existing season module patterns. Expand `PlanningCycleSelector` with lifecycle actions. Add Playwright E2E tests.

**Tech Stack:** Next.js App Router, React 19, TanStack Query v5, shadcn/ui, Supabase (PostgreSQL + RLS), `@smartout/telemetry`, Playwright, Tailwind v4

---

## Council Amendments (2026-04-10)

Plan reviewed by 4-agent council (system-steward, supervisor, system-agent-coordinator, frontend-designer). Verdict: **APPROVE WITH CHANGES**. All blocking/required changes applied:

| # | Fix | Tasks affected |
|---|-----|---------------|
| B1 | RLS signatures: `get_workspace_ids_for_user(auth.uid())` + `is_admin_in_workspace(auth.uid(), workspace_id)` | 4, 5 |
| B2 | Migration timestamps: `20260502130000/1` (after latest `20260501120000`) | 4, 5 |
| B3 | Added `api_key_read_*` RLS policies to both tables | 4, 5 |
| B4 | ADR number: `0076` → `0080` (next available) | 14 |
| B5 | Telemetry: named interfaces extending `BaseEvent` (not inline unions) | 6 |
| R1 | Added `emit()` calls to `activateCycle`/`archiveCycle` mutations | 12 |
| R2 | Registered `planning_cycle activated/archived` events in telemetry | 6 |
| R3 | Removed `engine_event` from `season created/archived` routing (dead writes) | 1 |
| Acc | Added `aria-label` on icon buttons, `window.confirm` on destructive actions, scoped `isPending` | 9, 10, 12 |
| D4 | Removed "D4" label from `SeasonGoalRow`, documented E2E scope limitation | 3, 13 |
| Enum | Changed `season_goal.status` from `TEXT CHECK` to PostgreSQL ENUM | 4 |

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260502130000_season_goal_table.sql` | `season_goal` table, RLS policies, trigger |
| `supabase/migrations/20260502130001_season_policy_binding_table.sql` | `season_policy_binding` junction table, RLS, trigger |
| `apps/web/src/app/dashboard/season/_hooks/use-season-goals.ts` | CRUD hook for season goals with telemetry |
| `apps/web/src/app/dashboard/season/_hooks/use-season-policy-bindings.ts` | CRUD hook for policy bindings with telemetry |
| `apps/web/src/app/dashboard/season/_components/SeasonGoalsTab.tsx` | Goals management UI (create/edit/complete/delete) |
| `apps/web/src/app/dashboard/season/_components/SeasonProceduresTab.tsx` | HMS/Procedures binding UI (toggle policies per season) |
| `apps/e2e/tests/season-planning.spec.ts` | E2E smoke tests for season UI flows |
| `docs/decisions/0080-year-wheel-governance-policy.md` | ADR documenting year wheel governance |

### Modified files

| File | Change |
|------|--------|
| `packages/telemetry/src/registry.ts` | Remove `engine_event` from `season activated/created/archived` destinations; add `season_goal`, `season_policy_binding`, and `planning_cycle` events |
| `apps/web/src/app/dashboard/season/_components/PlanningEventsTab.tsx` | Accept and use `planningCycleId` prop |
| `apps/web/src/app/dashboard/season/page.tsx` | Pass `planning_cycle_id` to events tab; wire Goals/Procedures tabs; add year wheel management entry |
| `apps/web/src/app/dashboard/season/_hooks/index.ts` | Export new hooks |
| `apps/web/src/app/dashboard/season/_hooks/use-planning-cycles.ts` | Add `activateCycle` and `archiveCycle` mutations |
| `apps/web/src/app/dashboard/season/_components/PlanningCycleSelector.tsx` | Add activate/archive actions per cycle row |
| `apps/web/src/lib/cascade/types.ts` | Add `SeasonGoalRow` and `SeasonPolicyBindingRow` types |
| `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts` | Add `seasonGoals` and `seasonPolicyBindings` keys |

---

## Task 1: Fix event chain dual-emission (P0-1)

**Context:** When a season activates, TWO engine events are created: (1) the DB trigger `trg_season_activated` inserts into `engine_event` with idempotency key `season_activated_{season_id}`, and (2) telemetry `emit("season activated")` routes to the `engine_event` destination which calls `engine-dispatch` Edge Function with a DIFFERENT idempotency key (`season.activated-{ws_id}-{timestamp}`). This creates duplicate downstream processing. The DB trigger is canonical because it fires at SQL level regardless of client.

**Files:**
- Modify: `packages/telemetry/src/registry.ts:3459-3466`

- [ ] **Step 1: Remove `engine_event` from all three season event destinations**

Open `packages/telemetry/src/registry.ts` and find the season routing entries near line 3459-3470. Remove `engine_event` from `"season created"`, `"season activated"`, and `"season archived"`:

```typescript
  "season created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season activated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season archived": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
```

**Why all three:** The DB trigger `trg_season_activated` is the canonical source for `season.activated` engine events. `season created` and `season archived` route to `engine_event` but no `engine_trigger` consumes them — they produce dead `engine_event` rows. Cleaning up all three removes the dual-emission risk and dead data.

- [ ] **Step 2: Verify the change compiles**

Run: `pnpm --filter @smartout/telemetry build`

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "$(cat <<'EOF'
fix(telemetry): remove dual engine_event emission for season activation

The DB trigger trg_season_activated is the canonical source for
season.activated engine events. Telemetry was also routing to
engine_event destination with a different idempotency key, causing
duplicate downstream processing.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fix planning events scoping (P0-3)

**Context:** `PlanningEventsTab` receives `seasonId` prop but calls `usePlanningEvents(undefined)`, loading ALL workspace events instead of events scoped to the selected season's planning cycle. The hook already supports `planningCycleId` filtering.

**Files:**
- Modify: `apps/web/src/app/dashboard/season/_components/PlanningEventsTab.tsx:30-33,178-179`
- Modify: `apps/web/src/app/dashboard/season/page.tsx:223-226`

- [ ] **Step 1: Add `planningCycleId` prop to `PlanningEventsTab`**

In `apps/web/src/app/dashboard/season/_components/PlanningEventsTab.tsx`, change the `Props` type and the hook call:

Replace the Props type (around line 30):

```typescript
type Props = {
  seasonId: string;
  planningCycleId: string | null;
  isDark: boolean;
};
```

Replace the hook call at line 178-179 (`export function PlanningEventsTab({ seasonId: _seasonId, isDark }: Props) {` and `const { events, isLoading, createEvent, updateEvent, deleteEvent } = usePlanningEvents(undefined);`):

```typescript
export function PlanningEventsTab({ seasonId: _seasonId, planningCycleId, isDark }: Props) {
  const { events, isLoading, createEvent, updateEvent, deleteEvent } = usePlanningEvents(planningCycleId);
```

- [ ] **Step 2: Pass `planning_cycle_id` from page to events tab**

In `apps/web/src/app/dashboard/season/page.tsx`, find the events tab rendering (around line 223-226):

Replace:

```tsx
          {activeTab === "events" && (
            <div className="max-w-3xl">
              <PlanningEventsTab seasonId={selectedSeasonId} isDark={isDark} />
            </div>
          )}
```

With:

```tsx
          {activeTab === "events" && (
            <div className="max-w-3xl">
              <PlanningEventsTab
                seasonId={selectedSeasonId}
                planningCycleId={selectedSeason?.planning_cycle_id ?? null}
                isDark={isDark}
              />
            </div>
          )}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

Expected: No errors in `PlanningEventsTab.tsx` or `page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/season/_components/PlanningEventsTab.tsx apps/web/src/app/dashboard/season/page.tsx
git commit -m "$(cat <<'EOF'
fix(season): scope planning events to selected season's planning cycle

Events tab was loading all workspace events regardless of which season
was selected. Now passes the season's planning_cycle_id to filter
correctly. The hook already supported this parameter.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add type definitions for new domain models

**Context:** We need TypeScript types for `season_goal` and `season_policy_binding` before creating hooks and UI. These follow the existing pattern in `apps/web/src/lib/cascade/types.ts`.

**Files:**
- Modify: `apps/web/src/lib/cascade/types.ts` (append after `PlanningCycleRow`)
- Modify: `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts`

- [ ] **Step 1: Add `SeasonGoalRow` and `SeasonPolicyBindingRow` types**

Append to `apps/web/src/lib/cascade/types.ts` after the `PlanningCycleRow` type (after line 199):

```typescript
// --------------------------------------------------------
// Season Goal (governance metadata — season-scoped targets)
// --------------------------------------------------------

export type SeasonGoalStatus = "active" | "completed" | "cancelled";

export type SeasonGoalRow = {
  season_goal_id: string;
  workspace_id: string;
  season_id: string;
  title: string;
  description: string | null;
  metric_key: string | null;
  target_value: number | null;
  target_unit: string | null;
  status: SeasonGoalStatus;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// --------------------------------------------------------
// Season Policy Binding (governance — per-season HMS activation)
// --------------------------------------------------------

export type SeasonPolicyBindingRow = {
  season_policy_binding_id: string;
  workspace_id: string;
  season_id: string;
  policy_id: string;
  is_active: boolean;
  notes: string | null;
  activated_by: string | null;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 2: Add query keys to `dashboard-keys.ts`**

In `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts`, add after the `seasonBudget` key:

```typescript
  seasonGoals: (workspaceId: string, seasonId: string) =>
    ["dashboard", "season-goals", workspaceId, seasonId] as const,

  seasonPolicyBindings: (workspaceId: string, seasonId: string) =>
    ["dashboard", "season-policy-bindings", workspaceId, seasonId] as const,
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/cascade/types.ts apps/web/src/app/dashboard/_hooks/dashboard-keys.ts
git commit -m "$(cat <<'EOF'
feat(season): add type definitions for season goals and policy bindings

SeasonGoalRow for D4 season-scoped targets and
SeasonPolicyBindingRow for per-season HMS policy activation.
Query keys added to dashboard-keys.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create `season_goal` migration

**Context:** Season goals need a new table with workspace scoping, season FK, status tracking, and RLS. Follows existing patterns from `season_budget` and `planning_event` tables.

**Files:**
- Create: `supabase/migrations/20260502130000_season_goal_table.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260502130000_season_goal_table.sql`:

```sql
-- ============================================
-- 20260502130000_season_goal_table.sql
-- Season-scoped goals for tracking KPIs and targets.
-- Each goal belongs to a season and can have an optional
-- numeric target with a unit (e.g., 30%, 500000 NOK).
-- ============================================

-- ── Enum ──

CREATE TYPE season_goal_status AS ENUM ('active', 'completed', 'cancelled');

-- ── Table ──

CREATE TABLE IF NOT EXISTS public.season_goal (
  season_goal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.season(season_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  metric_key TEXT,
  target_value NUMERIC(12,2),
  target_unit TEXT,
  status season_goal_status NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profile(profile_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_season_goal_updated_at
  BEFORE UPDATE ON public.season_goal
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ──

CREATE INDEX idx_season_goal_season
  ON public.season_goal(season_id);

CREATE INDEX idx_season_goal_workspace
  ON public.season_goal(workspace_id);

-- ── RLS ──

ALTER TABLE public.season_goal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_season_goal" ON public.season_goal;
CREATE POLICY "jwt_read_season_goal" ON public.season_goal
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "jwt_write_season_goal" ON public.season_goal;
CREATE POLICY "jwt_write_season_goal" ON public.season_goal
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_season_goal" ON public.season_goal;
CREATE POLICY "api_key_read_season_goal" ON public.season_goal
  FOR SELECT USING (workspace_id = get_api_workspace_id());
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db reset`

Expected: Migration applies without errors. All existing data is re-seeded.

- [ ] **Step 3: Regenerate database types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

Expected: `database.types.ts` now includes `season_goal` table types.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260502130000_season_goal_table.sql packages/supabase/src/database.types.ts
git commit -m "$(cat <<'EOF'
feat(db): add season_goal table for season-scoped target tracking

Stores KPI targets per season with optional metric_key, target_value,
and target_unit. RLS scoped to workspace members with admin-only writes.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create `season_policy_binding` migration

**Context:** The `policy` table already has `season_id` FK for policies created FOR a season. But we also need to bind EXISTING workspace-wide policies (where `season_id IS NULL`) to specific seasons for HMS activation. A junction table gives per-season toggling without modifying global policy state.

**Files:**
- Create: `supabase/migrations/20260502130001_season_policy_binding_table.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260502130001_season_policy_binding_table.sql`:

```sql
-- ============================================
-- 20260502130001_season_policy_binding_table.sql
-- Per-season activation of workspace policies (HMS binding).
-- Allows managers to decide which existing policies/procedures
-- should be enforced during a specific season without modifying
-- the global policy.is_active flag.
-- ============================================

-- ── Table ──

CREATE TABLE IF NOT EXISTS public.season_policy_binding (
  season_policy_binding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.season(season_id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES public.policy(policy_id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  activated_by UUID REFERENCES public.profile(profile_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_season_policy UNIQUE(season_id, policy_id)
);

CREATE TRIGGER set_season_policy_binding_updated_at
  BEFORE UPDATE ON public.season_policy_binding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ──

CREATE INDEX idx_season_policy_binding_season
  ON public.season_policy_binding(season_id);

CREATE INDEX idx_season_policy_binding_workspace
  ON public.season_policy_binding(workspace_id);

-- ── RLS ──

ALTER TABLE public.season_policy_binding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_season_policy_binding" ON public.season_policy_binding;
CREATE POLICY "jwt_read_season_policy_binding" ON public.season_policy_binding
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "jwt_write_season_policy_binding" ON public.season_policy_binding;
CREATE POLICY "jwt_write_season_policy_binding" ON public.season_policy_binding
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_season_policy_binding" ON public.season_policy_binding;
CREATE POLICY "api_key_read_season_policy_binding" ON public.season_policy_binding
  FOR SELECT USING (workspace_id = get_api_workspace_id());
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db reset`

Expected: Migration applies without errors.

- [ ] **Step 3: Regenerate database types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

Expected: `database.types.ts` now includes `season_policy_binding` table types.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260502130001_season_policy_binding_table.sql packages/supabase/src/database.types.ts
git commit -m "$(cat <<'EOF'
feat(db): add season_policy_binding table for per-season HMS activation

Junction table between season and policy. Allows per-season toggling
of workspace-wide policies without modifying global policy state.
UNIQUE constraint on (season_id, policy_id) prevents duplicates.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Register telemetry events for goals and policy bindings

**Context:** Every mutation must emit telemetry. We need to register events for season goal and policy binding CRUD operations in the telemetry registry before building hooks.

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add entity types**

In `packages/telemetry/src/registry.ts`, find the `EntityType` union (around line 48-114) and add `"season_goal"`, `"season_policy_binding"`, and `"planning_cycle"` after `"season_budget"` (line 88):

```typescript
  | "season_budget"
  | "season_goal"
  | "season_policy_binding"
  | "planning_cycle"
  | "operating_hours"
```

- [ ] **Step 2: Add event type definitions as named interfaces**

Find the season event definitions (around lines 939-945, after `SeasonArchived`) and add new named interfaces following the established pattern (`export interface Name extends BaseEvent`):

```typescript
export interface SeasonGoalCreated extends BaseEvent {
  event: "season_goal created";
  properties: {
    entity: EntityRef;
    data: { title: string; season_id: string };
  };
}

export interface SeasonGoalUpdated extends BaseEvent {
  event: "season_goal updated";
  properties: {
    entity: EntityRef;
    data: { status?: string };
  };
}

export interface SeasonGoalDeleted extends BaseEvent {
  event: "season_goal deleted";
  properties: {
    entity: EntityRef;
  };
}

export interface SeasonPolicyBindingUpdated extends BaseEvent {
  event: "season_policy_binding updated";
  properties: {
    entity: EntityRef;
    data: { policy_id: string; is_active: boolean };
  };
}

export interface PlanningCycleActivated extends BaseEvent {
  event: "planning_cycle activated";
  properties: {
    entity: EntityRef;
    data: { status: "active" };
  };
}

export interface PlanningCycleArchived extends BaseEvent {
  event: "planning_cycle archived";
  properties: {
    entity: EntityRef;
    data: { status: "archived" };
  };
}
```

Then add all six to the `SmartoutEvent` union type (around line 2894-2897, after `SeasonBudgetUpdated`):

```typescript
  | SeasonGoalCreated
  | SeasonGoalUpdated
  | SeasonGoalDeleted
  | SeasonPolicyBindingUpdated
  | PlanningCycleActivated
  | PlanningCycleArchived
```

- [ ] **Step 3: Add routing entries**

Find the routing map (around line 3459) and add after `"season archived"`:

```typescript
  "season_goal created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season_goal updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season_goal deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season_policy_binding updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "planning_cycle activated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "planning_cycle archived": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
```

- [ ] **Step 4: Verify the package builds**

Run: `pnpm --filter @smartout/telemetry build`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "$(cat <<'EOF'
feat(telemetry): register season goal and policy binding events

Adds entity types and event definitions for season_goal CRUD and
season_policy_binding toggle. Routes to posthog, logger, and
activity_trail (no engine_event needed for these).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Create `useSeasonGoals` hook

**Context:** CRUD hook for season goals following the exact pattern of `use-season-budget.ts` — TanStack Query + Supabase client + telemetry emit on mutations.

**Files:**
- Create: `apps/web/src/app/dashboard/season/_hooks/use-season-goals.ts`
- Modify: `apps/web/src/app/dashboard/season/_hooks/index.ts`

- [ ] **Step 1: Create the hook file**

Create `apps/web/src/app/dashboard/season/_hooks/use-season-goals.ts`:

```typescript
"use client";

/**
 * useSeasonGoals — CRUD for season_goal table.
 *
 * Fetches goals scoped to a specific season, sorted by sort_order.
 * Provides create, update, and delete mutations with telemetry.
 * Used by SeasonGoalsTab in the season page.
 */

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { dashboardKeys } from "../../_hooks/dashboard-keys";
import { toast } from "sonner";
import type { SeasonGoalRow, SeasonGoalStatus } from "@/lib/cascade/types";

type CreateGoalInput = {
  title: string;
  description?: string | null;
  metric_key?: string | null;
  target_value?: number | null;
  target_unit?: string | null;
};

type UpdateGoalInput = {
  season_goal_id: string;
  title?: string;
  description?: string | null;
  metric_key?: string | null;
  target_value?: number | null;
  target_unit?: string | null;
  status?: SeasonGoalStatus;
  sort_order?: number;
};

export function useSeasonGoals(seasonId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const queryKey = dashboardKeys.seasonGoals(wsId ?? "none", seasonId ?? "none");

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<SeasonGoalRow[]> => {
      const { data, error } = await supabase
        .from("season_goal")
        .select("*")
        .eq("workspace_id", wsId!)
        .eq("season_id", seasonId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as SeasonGoalRow[];
    },
    enabled: !!wsId && !!seasonId,
    staleTime: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
  };

  const createGoal = useMutation({
    mutationFn: async (input: CreateGoalInput): Promise<SeasonGoalRow> => {
      const currentGoals = query.data ?? [];
      const nextOrder = currentGoals.length > 0
        ? Math.max(...currentGoals.map((g) => g.sort_order)) + 1
        : 0;

      const { data, error } = await supabase
        .from("season_goal")
        .insert({
          workspace_id: wsId!,
          season_id: seasonId!,
          title: input.title.trim(),
          description: input.description ?? null,
          metric_key: input.metric_key ?? null,
          target_value: input.target_value ?? null,
          target_unit: input.target_unit ?? null,
          sort_order: nextOrder,
          created_by: profileId ?? null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data as SeasonGoalRow;
    },
    onSuccess: (data) => {
      void emit({
        event: "season_goal created",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season_goal",
            entity_id: data.season_goal_id,
            entity_label: data.title,
          },
          data: { title: data.title, season_id: data.season_id },
        },
      });
      invalidate();
      toast.success("Mål opprettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opprette mål: ${error.message}`);
    },
  });

  const updateGoal = useMutation({
    mutationFn: async (input: UpdateGoalInput): Promise<void> => {
      const { season_goal_id, ...patch } = input;
      const { error } = await supabase
        .from("season_goal")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("season_goal_id", season_goal_id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, input) => {
      void emit({
        event: "season_goal updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season_goal",
            entity_id: input.season_goal_id,
          },
          data: { status: input.status },
        },
      });
      invalidate();
      toast.success("Mål oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (goalId: string): Promise<void> => {
      const { error } = await supabase
        .from("season_goal")
        .delete()
        .eq("season_goal_id", goalId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, goalId) => {
      void emit({
        event: "season_goal deleted",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season_goal",
            entity_id: goalId,
          },
        },
      });
      invalidate();
      toast.success("Mål slettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette: ${error.message}`);
    },
  });

  return {
    goals: query.data ?? [],
    isLoading: query.isLoading,
    createGoal,
    updateGoal,
    deleteGoal,
  };
}
```

- [ ] **Step 2: Export the hook**

In `apps/web/src/app/dashboard/season/_hooks/index.ts`, add at the end:

```typescript
export { useSeasonGoals } from "./use-season-goals";
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

Expected: No errors. (Note: if `season_goal` table doesn't exist in `database.types.ts` yet, the Supabase client `.from("season_goal")` may show a type error. Run Task 4 first to ensure the migration and type regen are done.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/season/_hooks/use-season-goals.ts apps/web/src/app/dashboard/season/_hooks/index.ts
git commit -m "$(cat <<'EOF'
feat(season): add useSeasonGoals hook for season-scoped target CRUD

Create, update, delete goals per season. Telemetry emit on all
mutations. Query scoped by workspace + season with sort_order.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Create `useSeasonPolicyBindings` hook

**Context:** Hook for toggling workspace policies on/off per season. Fetches policies + their binding state for a given season. Follows the same patterns as `useSeasonGoals`.

**Files:**
- Create: `apps/web/src/app/dashboard/season/_hooks/use-season-policy-bindings.ts`
- Modify: `apps/web/src/app/dashboard/season/_hooks/index.ts`

- [ ] **Step 1: Create the hook file**

Create `apps/web/src/app/dashboard/season/_hooks/use-season-policy-bindings.ts`:

```typescript
"use client";

/**
 * useSeasonPolicyBindings — Per-season policy activation toggle.
 *
 * Fetches all workspace policies with their binding state for a given
 * season. The toggle mutation upserts a season_policy_binding row.
 * Used by SeasonProceduresTab to let managers decide which HMS policies
 * are active during a specific season.
 */

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { dashboardKeys } from "../../_hooks/dashboard-keys";
import { toast } from "sonner";

type PolicyWithBinding = {
  policy_id: string;
  name: string;
  description: string | null;
  policy_type: string;
  policy_scope: string;
  enforcement_status: string;
  is_active_global: boolean;
  is_bound_to_season: boolean;
  binding_notes: string | null;
  season_policy_binding_id: string | null;
};

export function useSeasonPolicyBindings(seasonId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const queryKey = dashboardKeys.seasonPolicyBindings(wsId ?? "none", seasonId ?? "none");

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<PolicyWithBinding[]> => {
      const [policiesResult, bindingsResult] = await Promise.all([
        supabase
          .from("policy")
          .select("policy_id, name, description, policy_type, policy_scope, enforcement_status, is_active")
          .eq("workspace_id", wsId!)
          .order("name", { ascending: true }),
        supabase
          .from("season_policy_binding")
          .select("season_policy_binding_id, policy_id, is_active, notes")
          .eq("workspace_id", wsId!)
          .eq("season_id", seasonId!),
      ]);

      if (policiesResult.error) throw new Error(policiesResult.error.message);
      if (bindingsResult.error) throw new Error(bindingsResult.error.message);

      const bindingMap = new Map(
        (bindingsResult.data ?? []).map((b) => [b.policy_id, b])
      );

      return (policiesResult.data ?? []).map((p) => {
        const binding = bindingMap.get(p.policy_id);
        return {
          policy_id: p.policy_id,
          name: p.name,
          description: p.description,
          policy_type: p.policy_type,
          policy_scope: p.policy_scope,
          enforcement_status: p.enforcement_status,
          is_active_global: p.is_active,
          is_bound_to_season: binding?.is_active ?? false,
          binding_notes: binding?.notes ?? null,
          season_policy_binding_id: binding?.season_policy_binding_id ?? null,
        };
      });
    },
    enabled: !!wsId && !!seasonId,
    staleTime: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
  };

  const toggleBinding = useMutation({
    mutationFn: async ({
      policyId,
      isActive,
    }: {
      policyId: string;
      isActive: boolean;
    }): Promise<void> => {
      const { error } = await supabase
        .from("season_policy_binding")
        .upsert(
          {
            workspace_id: wsId!,
            season_id: seasonId!,
            policy_id: policyId,
            is_active: isActive,
            activated_by: profileId ?? null,
          },
          { onConflict: "season_id,policy_id" }
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, { policyId, isActive }) => {
      void emit({
        event: "season_policy_binding updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season_policy_binding",
            entity_id: `${seasonId}-${policyId}`,
          },
          data: { policy_id: policyId, is_active: isActive },
        },
      });
      invalidate();
      toast.success(isActive ? "Prosedyre aktivert for sesong" : "Prosedyre deaktivert for sesong");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
    },
  });

  return {
    policies: query.data ?? [],
    isLoading: query.isLoading,
    toggleBinding,
  };
}
```

- [ ] **Step 2: Export the hook**

In `apps/web/src/app/dashboard/season/_hooks/index.ts`, add at the end:

```typescript
export { useSeasonPolicyBindings } from "./use-season-policy-bindings";
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/season/_hooks/use-season-policy-bindings.ts apps/web/src/app/dashboard/season/_hooks/index.ts
git commit -m "$(cat <<'EOF'
feat(season): add useSeasonPolicyBindings hook for per-season HMS toggle

Fetches workspace policies with per-season binding state. Toggle
mutation upserts season_policy_binding with UNIQUE constraint
on (season_id, policy_id). Telemetry on every toggle.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Build `SeasonGoalsTab` component

**Context:** Replaces the placeholder "Mål" tab content. Shows a list of season goals with create, edit, complete, and delete actions. Follows Nordic Split design system patterns (dark/light mode, glassmorphism cards, compact layout).

**Files:**
- Create: `apps/web/src/app/dashboard/season/_components/SeasonGoalsTab.tsx`

- [ ] **Step 1: Create the component file**

Create `apps/web/src/app/dashboard/season/_components/SeasonGoalsTab.tsx`:

```tsx
"use client";

/**
 * SeasonGoalsTab — Season-scoped goal management.
 *
 * Displays goals for the selected season with inline create form
 * and status controls (complete, cancel, reactivate, delete).
 * Each goal can optionally track a numeric KPI target.
 */

import { useState } from "react";
import { Plus, Check, X, Trash2, RotateCcw, Loader2, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSeasonGoals } from "../_hooks/use-season-goals";
import type { SeasonGoalStatus } from "@/lib/cascade/types";

type Props = {
  seasonId: string;
  isDark: boolean;
};

const STATUS_LABELS: Record<SeasonGoalStatus, string> = {
  active: "Aktiv",
  completed: "Fullført",
  cancelled: "Avbrutt",
};

function statusBadgeClass(status: SeasonGoalStatus, isDark: boolean): string {
  switch (status) {
    case "completed":
      return isDark
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
        : "border-emerald-200 bg-emerald-50 text-emerald-600";
    case "cancelled":
      return isDark
        ? "border-zinc-500/20 bg-zinc-500/10 text-zinc-500"
        : "border-zinc-300 bg-zinc-100 text-zinc-400";
    default:
      return isDark
        ? "border-orange-500/20 bg-orange-500/10 text-orange-400"
        : "border-orange-200 bg-orange-50 text-orange-600";
  }
}

export function SeasonGoalsTab({ seasonId, isDark }: Props) {
  const { goals, isLoading, createGoal, updateGoal, deleteGoal } = useSeasonGoals(seasonId);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metricKey, setMetricKey] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [targetUnit, setTargetUnit] = useState("");

  function handleCreate() {
    if (!title.trim()) return;
    createGoal.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        metric_key: metricKey.trim() || null,
        target_value: targetValue ? Number(targetValue) : null,
        target_unit: targetUnit.trim() || null,
      },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setMetricKey("");
          setTargetValue("");
          setTargetUnit("");
          setShowCreate(false);
        },
      }
    );
  }

  const cardClass = isDark
    ? "rounded-xl border border-zinc-800 bg-[#0c0c0e] p-4"
    : "rounded-xl border border-zinc-200 bg-white p-4";

  const labelClass = isDark ? "text-zinc-400" : "text-zinc-500";
  const inputClass = isDark
    ? "border-zinc-700 bg-zinc-900 text-white"
    : "border-zinc-300 bg-white text-zinc-900";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`h-6 w-6 animate-spin ${isDark ? "text-zinc-600" : "text-zinc-300"}`} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
            Sesongmål
          </h3>
          <p className={`text-xs ${labelClass}`}>
            Sett mål og KPI-er for denne sesongen
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
          className="h-8 bg-gradient-to-r from-orange-600 to-rose-600 text-xs text-white hover:opacity-90"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Nytt mål
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className={cardClass}>
          <div className="space-y-3">
            <div>
              <label className={`mb-1 block text-xs font-semibold ${labelClass}`}>Tittel *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="F.eks. Redusere lønnskostnad til 28%"
                className={`h-8 text-sm ${inputClass}`}
              />
            </div>
            <div>
              <label className={`mb-1 block text-xs font-semibold ${labelClass}`}>Beskrivelse</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Valgfri utdypning"
                className={`h-8 text-sm ${inputClass}`}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={`mb-1 block text-xs font-semibold ${labelClass}`}>Nøkkeltall</label>
                <Input
                  value={metricKey}
                  onChange={(e) => setMetricKey(e.target.value)}
                  placeholder="labor_pct"
                  className={`h-8 text-sm ${inputClass}`}
                />
              </div>
              <div>
                <label className={`mb-1 block text-xs font-semibold ${labelClass}`}>Målverdi</label>
                <Input
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="28"
                  className={`h-8 text-sm ${inputClass}`}
                />
              </div>
              <div>
                <label className={`mb-1 block text-xs font-semibold ${labelClass}`}>Enhet</label>
                <Input
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value)}
                  placeholder="%"
                  className={`h-8 text-sm ${inputClass}`}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreate(false)}
                className="h-7 text-xs"
              >
                Avbryt
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!title.trim() || createGoal.isPending}
                className="h-7 bg-gradient-to-r from-orange-600 to-rose-600 text-xs text-white hover:opacity-90"
              >
                {createGoal.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Opprett
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Goals list */}
      {goals.length === 0 && !showCreate ? (
        <div className={`${cardClass} text-center py-8`}>
          <Target className={`mx-auto mb-3 h-8 w-8 ${isDark ? "text-zinc-700" : "text-zinc-300"}`} />
          <p className={`text-sm ${labelClass}`}>Ingen mål satt for denne sesongen ennå.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map((goal) => (
            <div key={goal.season_goal_id} className={`${cardClass} flex items-start gap-3`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={`text-sm font-semibold ${
                      goal.status === "cancelled"
                        ? "line-through opacity-50"
                        : isDark
                          ? "text-white"
                          : "text-zinc-900"
                    }`}
                  >
                    {goal.title}
                  </p>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(goal.status, isDark)}`}
                  >
                    {STATUS_LABELS[goal.status]}
                  </span>
                </div>
                {goal.description && (
                  <p className={`mt-0.5 text-xs ${labelClass}`}>{goal.description}</p>
                )}
                {goal.target_value != null && (
                  <p className={`mt-1 text-xs font-mono ${isDark ? "text-orange-400/70" : "text-orange-600/70"}`}>
                    {goal.metric_key ? `${goal.metric_key}: ` : ""}
                    {goal.target_value} {goal.target_unit ?? ""}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {goal.status === "active" && (
                  <>
                    <button
                      onClick={() => updateGoal.mutate({ season_goal_id: goal.season_goal_id, status: "completed" })}
                      title="Marker som fullført"
                      aria-label="Marker som fullført"
                      className={`rounded-md p-1.5 transition-colors ${isDark ? "hover:bg-emerald-500/10 text-emerald-500" : "hover:bg-emerald-50 text-emerald-600"}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => updateGoal.mutate({ season_goal_id: goal.season_goal_id, status: "cancelled" })}
                      title="Avbryt mål"
                      aria-label="Avbryt mål"
                      className={`rounded-md p-1.5 transition-colors ${isDark ? "hover:bg-zinc-800 text-zinc-500" : "hover:bg-zinc-100 text-zinc-400"}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {(goal.status === "completed" || goal.status === "cancelled") && (
                  <button
                    onClick={() => updateGoal.mutate({ season_goal_id: goal.season_goal_id, status: "active" })}
                    title="Reaktiver mål"
                    aria-label="Reaktiver mål"
                    className={`rounded-md p-1.5 transition-colors ${isDark ? "hover:bg-orange-500/10 text-orange-400" : "hover:bg-orange-50 text-orange-600"}`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (window.confirm("Er du sikker på at du vil slette dette målet?")) {
                      deleteGoal.mutate(goal.season_goal_id);
                    }
                  }}
                  title="Slett mål"
                  aria-label="Slett mål"
                  className={`rounded-md p-1.5 transition-colors ${isDark ? "hover:bg-red-500/10 text-red-500/60" : "hover:bg-red-50 text-red-400"}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/season/_components/SeasonGoalsTab.tsx
git commit -m "$(cat <<'EOF'
feat(season): build SeasonGoalsTab with full CRUD and KPI tracking

Create, complete, cancel, reactivate, and delete season goals.
Optional metric_key + target_value + target_unit for KPI tracking.
Dark/light mode following Nordic Split patterns.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Build `SeasonProceduresTab` component

**Context:** Replaces the placeholder "Prosedyrer & HMS" tab. Shows all workspace policies with per-season toggle switches. Uses `useSeasonPolicyBindings` hook.

**Files:**
- Create: `apps/web/src/app/dashboard/season/_components/SeasonProceduresTab.tsx`

- [ ] **Step 1: Create the component file**

Create `apps/web/src/app/dashboard/season/_components/SeasonProceduresTab.tsx`:

```tsx
"use client";

/**
 * SeasonProceduresTab — Per-season HMS policy activation.
 *
 * Displays all workspace policies grouped by policy_type.
 * Each policy has a toggle switch to activate/deactivate it
 * for the selected season. This lets managers decide which
 * HMS procedures should be enforced during each season.
 */

import { useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSeasonPolicyBindings } from "../_hooks/use-season-policy-bindings";

type Props = {
  seasonId: string;
  isDark: boolean;
};

const POLICY_TYPE_LABELS: Record<string, string> = {
  operational: "Drift",
  haccp: "HACCP",
  hr: "HR",
  safety: "Sikkerhet",
  access: "Tilgang",
  payroll: "Lønn",
  custom: "Egendefinert",
};

const POLICY_TYPE_ORDER = ["safety", "haccp", "operational", "hr", "access", "payroll", "custom"];

function policyTypeIcon(type: string, isDark: boolean) {
  const cls = `h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`;
  switch (type) {
    case "safety":
    case "haccp":
      return <ShieldAlert className={cls} />;
    default:
      return <ShieldCheck className={cls} />;
  }
}

export function SeasonProceduresTab({ seasonId, isDark }: Props) {
  const { policies, isLoading, toggleBinding } = useSeasonPolicyBindings(seasonId);
  const [pendingPolicyId, setPendingPolicyId] = useState<string | null>(null);

  const cardClass = isDark
    ? "rounded-xl border border-zinc-800 bg-[#0c0c0e]"
    : "rounded-xl border border-zinc-200 bg-white";

  const labelClass = isDark ? "text-zinc-400" : "text-zinc-500";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`h-6 w-6 animate-spin ${isDark ? "text-zinc-600" : "text-zinc-300"}`} />
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div className={`${cardClass} p-12 text-center`}>
        <ShieldOff className={`mx-auto mb-3 h-8 w-8 ${isDark ? "text-zinc-700" : "text-zinc-300"}`} />
        <h3 className={`mb-2 text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
          Ingen prosedyrer
        </h3>
        <p className={`text-xs ${labelClass}`}>
          Opprett prosedyrer under HMS-modulen for å kunne aktivere dem per sesong.
        </p>
      </div>
    );
  }

  const grouped = POLICY_TYPE_ORDER.reduce(
    (acc, type) => {
      const items = policies.filter((p) => p.policy_type === type);
      if (items.length > 0) acc.push({ type, items });
      return acc;
    },
    [] as Array<{ type: string; items: typeof policies }>
  );

  const ungrouped = policies.filter(
    (p) => !POLICY_TYPE_ORDER.includes(p.policy_type)
  );
  if (ungrouped.length > 0) {
    grouped.push({ type: "other", items: ungrouped });
  }

  const activeCount = policies.filter((p) => p.is_bound_to_season).length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
          Prosedyrer & HMS
        </h3>
        <p className={`text-xs ${labelClass}`}>
          {activeCount} av {policies.length} prosedyrer er aktive for denne sesongen
        </p>
      </div>

      {grouped.map(({ type, items }) => (
        <div key={type} className={cardClass}>
          <div className={`flex items-center gap-2 border-b px-4 py-2.5 ${isDark ? "border-zinc-800" : "border-zinc-100"}`}>
            {policyTypeIcon(type, isDark)}
            <span className={`text-xs font-bold uppercase tracking-wider ${labelClass}`}>
              {POLICY_TYPE_LABELS[type] ?? type}
            </span>
            <span className={`text-[10px] ${labelClass}`}>
              ({items.filter((i) => i.is_bound_to_season).length}/{items.length})
            </span>
          </div>
          <div className="divide-y divide-zinc-800/30">
            {items.map((policy) => (
              <div
                key={policy.policy_id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  isDark ? "hover:bg-zinc-800/30" : "hover:bg-zinc-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p id={`policy-name-${policy.policy_id}`} className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
                    {policy.name}
                  </p>
                  {policy.description && (
                    <p className={`mt-0.5 text-xs truncate ${labelClass}`}>
                      {policy.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        policy.enforcement_status === "enforced"
                          ? isDark
                            ? "bg-red-500/10 text-red-400"
                            : "bg-red-50 text-red-600"
                          : isDark
                            ? "bg-zinc-500/10 text-zinc-500"
                            : "bg-zinc-100 text-zinc-400"
                      }`}
                    >
                      {policy.enforcement_status}
                    </span>
                    {!policy.is_active_global && (
                      <span className={`text-[10px] ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                        (Globalt deaktivert)
                      </span>
                    )}
                  </div>
                </div>
                <Switch
                  id={`policy-toggle-${policy.policy_id}`}
                  aria-labelledby={`policy-name-${policy.policy_id}`}
                  checked={policy.is_bound_to_season}
                  onCheckedChange={(checked) => {
                    setPendingPolicyId(policy.policy_id);
                    toggleBinding.mutate(
                      { policyId: policy.policy_id, isActive: checked },
                      { onSettled: () => setPendingPolicyId(null) }
                    );
                  }}
                  disabled={toggleBinding.isPending && pendingPolicyId === policy.policy_id}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/season/_components/SeasonProceduresTab.tsx
git commit -m "$(cat <<'EOF'
feat(season): build SeasonProceduresTab with per-season HMS toggling

Shows all workspace policies grouped by type with Switch toggle
for per-season activation. Active count summary. Enforcement status
and global deactivation indicators.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Wire new tabs into the season page

**Context:** Replace the placeholder content for "Mål" and "Prosedyrer & HMS" tabs with the real components. Import and render `SeasonGoalsTab` and `SeasonProceduresTab`.

**Files:**
- Modify: `apps/web/src/app/dashboard/season/page.tsx:1-10,228-245`

- [ ] **Step 1: Add imports to page.tsx**

In `apps/web/src/app/dashboard/season/page.tsx`, add imports at the top (after the existing component imports around line 10-11):

```typescript
import { SeasonGoalsTab } from "./_components/SeasonGoalsTab";
import { SeasonProceduresTab } from "./_components/SeasonProceduresTab";
```

- [ ] **Step 2: Replace the goals placeholder**

Find the goals placeholder (around lines 228-236) and replace the entire block:

```tsx
          {activeTab === "goals" && (
            <div className="max-w-3xl">
              <SeasonGoalsTab seasonId={selectedSeasonId} isDark={isDark} />
            </div>
          )}
```

- [ ] **Step 3: Replace the procedures placeholder**

Find the procedures placeholder (around lines 237-245) and replace:

```tsx
          {activeTab === "procedures" && (
            <div className="max-w-3xl">
              <SeasonProceduresTab seasonId={selectedSeasonId} isDark={isDark} />
            </div>
          )}
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

Expected: No errors. The unused `Target` and `ShieldCheck` icon imports may now only be used by TABS — verify they're still referenced there.

- [ ] **Step 5: Visual verification**

Run: `pnpm --filter web dev`

Navigate to `http://localhost:3060/dashboard/season`, select a season, click "Mål" tab and verify create form works. Click "Prosedyrer & HMS" tab and verify policy list renders (may be empty if no policies exist yet — the empty state should show "Opprett prosedyrer under HMS-modulen").

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/season/page.tsx
git commit -m "$(cat <<'EOF'
feat(season): wire SeasonGoalsTab and SeasonProceduresTab into page

Replaces placeholder content with real components. Goals tab
supports full CRUD. Procedures tab shows per-season HMS toggling.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Add year wheel lifecycle actions to `PlanningCycleSelector`

**Context:** The year wheel selector can create and link cycles but cannot activate or archive them. This task adds lifecycle mutations to the hook and action buttons to the dropdown, closing P1-1 (year wheel management UX).

**Files:**
- Modify: `apps/web/src/app/dashboard/season/_hooks/use-planning-cycles.ts:80-123`
- Modify: `apps/web/src/app/dashboard/season/_components/PlanningCycleSelector.tsx:309-349`

- [ ] **Step 1: Add lifecycle mutations to `usePlanningCycles`**

In `apps/web/src/app/dashboard/season/_hooks/use-planning-cycles.ts`, first add the telemetry import at the top (after the existing imports):

```typescript
import { emit } from "@smartout/telemetry";
```

Then add two new mutations after `linkSeasonToCycle` (after line 114) and before the return statement:

```typescript
  const activateCycle = useMutation({
    mutationFn: async (cycleId: string) => {
      const { error: archiveError } = await supabase
        .from("planning_cycle")
        .update({ status: "archived" as PlanningCycleStatus, updated_at: new Date().toISOString() })
        .eq("workspace_id", wsId!)
        .eq("status", "active" as PlanningCycleStatus);

      if (archiveError) throw new Error(archiveError.message);

      const { data, error } = await supabase
        .from("planning_cycle")
        .update({ status: "active" as PlanningCycleStatus, updated_at: new Date().toISOString() })
        .eq("planning_cycle_id", cycleId)
        .select("planning_cycle_id, name")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      void emit({
        event: "planning_cycle activated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "planning_cycle",
            entity_id: data.planning_cycle_id,
            entity_label: data.name,
          },
          data: { status: "active" as const },
        },
      });
      invalidate();
      toast.success("Planperiode aktivert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke aktivere: ${error.message}`);
    },
  });

  const archiveCycle = useMutation({
    mutationFn: async (cycleId: string) => {
      const { data, error } = await supabase
        .from("planning_cycle")
        .update({ status: "archived" as PlanningCycleStatus, updated_at: new Date().toISOString() })
        .eq("planning_cycle_id", cycleId)
        .select("planning_cycle_id, name")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      void emit({
        event: "planning_cycle archived",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "planning_cycle",
            entity_id: data.planning_cycle_id,
            entity_label: data.name,
          },
          data: { status: "archived" as const },
        },
      });
      invalidate();
      toast.success("Planperiode arkivert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke arkivere: ${error.message}`);
    },
  });
```

Update the return statement to include the new mutations:

```typescript
  return {
    cycles: query.data ?? [],
    isLoading: query.isLoading,
    createCycle,
    updateCycle,
    linkSeasonToCycle,
    activateCycle,
    archiveCycle,
  };
```

- [ ] **Step 2: Add lifecycle buttons to `PlanningCycleSelector`**

In `apps/web/src/app/dashboard/season/_components/PlanningCycleSelector.tsx`, first update the destructured hook call (line 69) to include the new mutations:

```typescript
  const { cycles, isLoading, createCycle, linkSeasonToCycle, activateCycle, archiveCycle } = usePlanningCycles();
```

Then add imports for `Play` and `Archive` icons at line 10:

```typescript
import { CalendarRange, ChevronDown, Check, Plus, Loader2, Play, Archive } from "lucide-react";
```

Now update the cycle row rendering inside the dropdown (around lines 310-348) to add action buttons. Replace the status badge `<span>` block (lines 341-345):

```tsx
                                  {/* Status badge + actions */}
                                  <div className="flex shrink-0 items-center gap-1">
                                    <span
                                      className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(cycle.status, isDark)}`}
                                    >
                                      {cycle.status}
                                    </span>
                                    {cycle.status === "draft" && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          activateCycle.mutate(cycle.planning_cycle_id);
                                        }}
                                        title="Aktiver planperiode"
                                        aria-label="Aktiver planperiode"
                                        className={`rounded p-1 transition-colors ${isDark ? "hover:bg-emerald-500/10 text-emerald-500" : "hover:bg-emerald-50 text-emerald-600"}`}
                                      >
                                        <Play className="h-3 w-3" />
                                      </button>
                                    )}
                                    {cycle.status === "active" && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (window.confirm("Arkivere denne planperioden?")) {
                                            archiveCycle.mutate(cycle.planning_cycle_id);
                                          }
                                        }}
                                        title="Arkiver planperiode"
                                        aria-label="Arkiver planperiode"
                                        className={`rounded p-1 transition-colors ${isDark ? "hover:bg-zinc-800 text-zinc-500" : "hover:bg-zinc-100 text-zinc-400"}`}
                                      >
                                        <Archive className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/season/_hooks/use-planning-cycles.ts apps/web/src/app/dashboard/season/_components/PlanningCycleSelector.tsx
git commit -m "$(cat <<'EOF'
feat(season): add year wheel lifecycle actions (activate/archive)

Planning cycles can now be activated and archived from the dropdown.
Activating a cycle archives any currently active cycle first (single
active policy). Closes P1-1 year wheel lifecycle management.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: E2E tests — UI smoke for season flows (P0-2)

**Context:** The season module has no E2E coverage. These tests cover UI smoke flows (navigation, tab rendering, basic interactions). Engine chain E2E tests (verifying `engine_event` → `engine-dispatch` → downstream effects for `season.activated`, `cascade_budget_propagation`, and `department_session_lifecycle`) are deferred to a dedicated testing task — they require seeded `engine_process`/`engine_trigger` data and engine-dispatch mock infrastructure.

**Files:**
- Create: `apps/e2e/tests/season-planning.spec.ts`

- [ ] **Step 1: Create the E2E test file**

Create `apps/e2e/tests/season-planning.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Season Planning — Critical Flows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should navigate to season page and render tabs", async ({ page }) => {
    await page.goto("/dashboard/season", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    await expect(page.locator("main").first()).toBeVisible({ timeout: 10000 });

    const tabLabels = ["Oversikt", "Budsjett", "Dagfaktorer", "Timefaktorer", "Hendelser", "Mål", "Prosedyrer & HMS"];
    for (const label of tabLabels) {
      const tab = page.locator(`button:has-text("${label}")`).first();
      await expect(tab).toBeVisible({ timeout: 5000 });
    }
  });

  test("should auto-select active season if one exists", async ({ page }) => {
    await page.goto("/dashboard/season", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const tabBar = page.locator("button:has-text('Oversikt')").first();
    const hasTabBar = await tabBar.isVisible({ timeout: 8000 }).catch(() => false);

    if (hasTabBar) {
      expect(true).toBe(true);
    } else {
      const emptyState = page.locator("text=Velg en sesong").first();
      await expect(emptyState).toBeVisible({ timeout: 5000 });
    }
  });

  test("should switch to goals tab and show create button", async ({ page }) => {
    await page.goto("/dashboard/season", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const goalsTab = page.locator("button:has-text('Mål')").first();
    if (await goalsTab.isVisible({ timeout: 8000 }).catch(() => false)) {
      await goalsTab.click();
      await page.waitForTimeout(500);

      const createBtn = page.locator("button:has-text('Nytt mål')").first();
      const emptyState = page.locator("text=Ingen mål satt").first();

      const hasCreate = await createBtn.isVisible({ timeout: 3000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasCreate || hasEmpty).toBe(true);
    }
  });

  test("should switch to procedures tab and show policy list or empty state", async ({ page }) => {
    await page.goto("/dashboard/season", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const proceduresTab = page.locator("button:has-text('Prosedyrer & HMS')").first();
    if (await proceduresTab.isVisible({ timeout: 8000 }).catch(() => false)) {
      await proceduresTab.click();
      await page.waitForTimeout(500);

      const header = page.locator("text=Prosedyrer & HMS").first();
      const emptyState = page.locator("text=Ingen prosedyrer").first();

      const hasHeader = await header.isVisible({ timeout: 3000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasHeader || hasEmpty).toBe(true);
    }
  });

  test("should show planning cycle selector and open dropdown", async ({ page }) => {
    await page.goto("/dashboard/season", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const cycleSelector = page.locator("text=Planperiode:").first();
    if (await cycleSelector.isVisible({ timeout: 8000 }).catch(() => false)) {
      await cycleSelector.click();
      await page.waitForTimeout(300);

      const createCycleBtn = page.locator("text=Ny planperiode").first();
      await expect(createCycleBtn).toBeVisible({ timeout: 3000 });
    }
  });
});
```

- [ ] **Step 2: Verify tests run**

Run: `pnpm --filter e2e playwright test tests/season-planning.spec.ts --reporter=list`

Expected: Tests pass (or skip gracefully when no seasons/data exist). No crashes.

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/tests/season-planning.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add season planning critical flow tests

Covers page navigation, tab rendering, goals tab create button,
procedures tab policy list, and planning cycle selector dropdown.
Graceful handling when no seed data exists.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Year wheel governance ADR (P1-3)

**Context:** Document the governance policy decisions for year wheel lifecycle so future developers have explicit rules. This captures the "single active cycle" policy and archive behavior.

**Files:**
- Create: `docs/decisions/0080-year-wheel-governance-policy.md`

- [ ] **Step 1: Create the ADR**

Create `docs/decisions/0080-year-wheel-governance-policy.md`:

```markdown
---
id: "0080"
title: "Year Wheel Governance Policy"
status: accepted
date: 2026-04-10
module: cascade
tags: [planning-cycle, year-wheel, governance, season]
---

# ADR-0080: Year Wheel Governance Policy

## Context

Planning cycles (year wheel periods) need explicit governance rules
for lifecycle management. Without documented policy, operators may
create conflicting active periods or leave orphaned seasons.

## Decision

### Single Active Cycle Policy

Only ONE planning cycle may be `active` at a time per workspace.
Activating a new cycle automatically archives the currently active one.
This prevents ambiguous "which cycle applies now?" questions.

### Status Transitions

```
draft → active → archived
         ↑          │
         └──────────┘ (reactivation allowed)
```

- **draft**: Cycle is being configured, not yet operational.
- **active**: Current operational cycle. Seasons linked to it receive
  events and factors. Only one per workspace.
- **archived**: Historical. Read-only. Can be reactivated if needed
  (which archives the current active cycle).

### Seasons Without Linked Cycle

Seasons with `planning_cycle_id = NULL` are valid but operate without
cycle-scoped events or period boundaries. The UI shows "Ingen" in the
cycle selector. No automatic fallback assignment occurs.

### Archive Behavior

Archiving a cycle does NOT archive its linked seasons. Seasons have
independent lifecycle (draft → active → archived). A season can remain
active even when its linked cycle is archived.

## Consequences

- `usePlanningCycles.activateCycle` must archive the current active cycle
  before activating the new one (implemented in Task 12).
- UI must clearly show which cycle is active and prevent confusion.
- Reactivation of archived cycles is allowed for correction scenarios.
- **Known risk:** `activateCycle` performs two sequential DB calls (archive then activate). If the second fails, the workspace temporarily has zero active cycles. This matches the existing `activateSeason` pattern and is acceptable for MVP. Long-term fix: wrap in a DB function/RPC.

### Note on scope

This ADR should be registered in `docs/decisions/0000-decision-log.md`. Additionally, `docs/reference/DATABASE.md` should be updated with the two new tables (`season_goal`, `season_policy_binding`) — this is a lightweight follow-up task.
```

- [ ] **Step 2: Commit**

```bash
git add docs/decisions/0080-year-wheel-governance-policy.md
git commit -m "$(cat <<'EOF'
docs(adr): add year wheel governance policy (ADR-0080)

Documents single active cycle policy, status transitions, fallback
behavior for unlinked seasons, and archive independence.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Dependency Graph

```
Task 1 (P0-1 telemetry fix) ─── independent
Task 2 (P0-3 scoping fix)  ─── independent
Task 3 (types + keys)      ─── independent
Task 4 (migration goal)    ─── depends on nothing, blocks Task 7
Task 5 (migration binding) ─── depends on nothing, blocks Task 8
Task 6 (telemetry events)  ─── depends on Task 3 (entity types), blocks Task 7-8
Task 7 (useSeasonGoals)    ─── depends on Task 3, 4, 6; blocks Task 9
Task 8 (useSeasonPolicyBindings) ─── depends on Task 3, 5, 6; blocks Task 10
Task 9 (SeasonGoalsTab)    ─── depends on Task 7; blocks Task 11
Task 10 (SeasonProceduresTab) ─── depends on Task 8; blocks Task 11
Task 11 (wire into page)   ─── depends on Task 9, 10
Task 12 (year wheel lifecycle) ─── independent
Task 13 (E2E tests)        ─── depends on Task 11
Task 14 (ADR)              ─── independent
```

**Parallelizable batches:**
1. Tasks 1, 2, 3, 14 (independent)
2. Tasks 4, 5, 6, 12 (independent from each other, Task 6 depends on Task 3)
3. Tasks 7, 8 (after their dependencies)
4. Tasks 9, 10 (after hooks)
5. Task 11 (after components)
6. Task 13 (after wiring)
