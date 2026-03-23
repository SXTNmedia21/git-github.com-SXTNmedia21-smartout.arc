# Cascade Hours Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing operating hours UI to read/write `department_operating_hours` (cascade A1) instead of the legacy `operating_hours` table, backfill existing data, and populate `department_session.planned_open/close` from `resolveEffectiveHours()`.

**Architecture:** Option A — clean cutover. A backfill migration copies `operating_hours` → `department_operating_hours` for all existing workspaces (mapped to first department). The `useOperatingHours` hook is rewritten to read/write the new table with department+season awareness. Downstream consumers (OpeningHoursSettings, HourFactorsTab, SeasonOverviewTab) work unchanged because they consume the hook. Session creation is updated to call `resolveEffectiveHours()`.

**Tech Stack:** Supabase (PostgreSQL 17), TanStack Query v5, React, TypeScript (strict), Vitest

**Spec:** `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` — Section 2.2 (D1 Operational Envelope), Section 4.1 (department_operating_hours schema)

**Key codebase facts (verified):**

- `operating_hours` table: workspace_id, location_id, day_of_week, open_time, close_time, is_closed. UNIQUE(workspace_id, location_id, day_of_week).
- `department_operating_hours` table: adds department_id (NOT NULL), season_id (nullable, NULL = default). UNIQUE NULLS NOT DISTINCT(department_id, location_id, season_id, day_of_week).
- `useOperatingHours(locationId?)` — only consumer of `operating_hours` in runtime code (2 queries in 1 file)
- 3 UI consumers of the hook: OpeningHoursSettings, HourFactorsTab, SeasonOverviewTab — all use `hours`, `isLoading`, `upsertHours` return values
- `resolveEffectiveHours()` already exists at `apps/web/src/lib/cascade/resolve-hours.ts` with 9 passing tests
- `department_session` has `planned_open TIME` and `planned_close TIME` columns (added in cascade A1)
- No "default department" concept — backfill picks first active department per workspace via `sort_order ASC, created_at ASC`
- `setupActions.ts` (join wizard) writes to `company_opening_hours` — stays untouched (allowed intake)
- `SeasonSetupStep.tsx` writes to `season.opening_hours` JSONB — stays untouched (future Phase C)

---

## File Structure

| File                                                                               | Action  | Responsibility                                                      |
| ---------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| `supabase/migrations/20260422100000_cascade_backfill_operating_hours.sql`          | Create  | Backfill operating_hours → department_operating_hours               |
| `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts`                | Rewrite | Read/write department_operating_hours with department+season params |
| `apps/web/src/app/dashboard/settings/_components/opening-hours-settings.tsx`       | Modify  | Pass departmentId from dashboard context                            |
| `apps/web/src/app/dashboard/settings/_hooks/__tests__/use-operating-hours.test.ts` | Create  | Hook behavior tests                                                 |
| `apps/web/src/lib/cascade/__tests__/resolve-hours.test.ts`                         | Verify  | Existing tests still pass after integration                         |

---

## Task 1: Backfill Migration

**Files:**

- Create: `supabase/migrations/20260422100000_cascade_backfill_operating_hours.sql`

- [ ] **Step 1: Create the backfill migration**

```sql
-- ============================================
-- 20260422100000_cascade_backfill_operating_hours.sql
-- Backfill: operating_hours → department_operating_hours
-- Maps legacy workspace-level hours to first active department per workspace.
-- Existing department_operating_hours rows are preserved (ON CONFLICT DO NOTHING).
-- ============================================

SET search_path TO public, extensions;

-- Backfill: for each workspace that has operating_hours rows,
-- copy them into department_operating_hours mapped to the first active department.
-- Uses a lateral join to pick one department per workspace (sort_order ASC, created_at ASC).
INSERT INTO department_operating_hours (
  workspace_id,
  department_id,
  location_id,
  season_id,
  day_of_week,
  open_time,
  close_time,
  is_closed,
  provenance
)
SELECT
  oh.workspace_id,
  first_dept.department_id,
  oh.location_id,
  NULL,  -- season_id NULL = workspace default
  oh.day_of_week,
  oh.open_time,
  oh.close_time,
  oh.is_closed,
  jsonb_build_object(
    'source', 'backfill_from_operating_hours',
    'original_table', 'operating_hours',
    'original_id', oh.id,
    'backfill_date', now()::text
  )
FROM operating_hours oh
CROSS JOIN LATERAL (
  SELECT d.department_id
  FROM department d
  WHERE d.workspace_id = oh.workspace_id
    AND d.is_active = true
  ORDER BY d.sort_order ASC, d.created_at ASC
  LIMIT 1
) first_dept
ON CONFLICT (department_id, location_id, season_id, day_of_week) DO NOTHING;

-- Mark legacy table
COMMENT ON TABLE operating_hours IS
  'LEGACY: backfilled to department_operating_hours on 2026-04-22. Runtime reads must use department_operating_hours. Kept for rollback safety.';
```

- [ ] **Step 2: Run migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422100000_cascade_backfill_operating_hours.sql`
Expected: INSERT with row count (may be 0 if no existing data). No errors.

- [ ] **Step 3: Verify backfill**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT count(*) as legacy FROM operating_hours; SELECT count(*) as cascade FROM department_operating_hours;"`
Expected: cascade count >= legacy count (or both 0 if no test data).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260422100000_cascade_backfill_operating_hours.sql
git commit -m "$(cat <<'EOF'
feat(cascade): backfill operating_hours → department_operating_hours

Maps legacy workspace-level hours to first active department per
workspace. Provenance tracks original source. ON CONFLICT DO NOTHING
preserves any existing cascade rows.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Rewrite useOperatingHours Hook

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts`

The hook signature changes from `useOperatingHours(locationId?)` to `useOperatingHours(departmentId, options?)` where options includes `locationId` and `seasonId`. The return shape (`hours`, `isLoading`, `upsertHours`) stays identical so consumers don't break.

- [ ] **Step 1: Rewrite the hook**

```typescript
"use client";

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type DayName = (typeof DAY_NAMES)[number];

export type OperatingHoursEntry = {
  day_of_week: number;
  day_name: DayName;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

type OperatingHoursOptions = {
  locationId?: string;
  seasonId?: string;
};

const DEFAULT_ENTRY = {
  open_time: "08:00",
  close_time: "22:00",
  is_closed: false,
} as const;

function operatingHoursKeys(
  workspaceId: string,
  departmentId: string,
  locationId?: string,
  seasonId?: string,
) {
  return [
    "settings",
    "department-operating-hours",
    workspaceId,
    departmentId,
    locationId ?? "default",
    seasonId ?? "default",
  ] as const;
}

/**
 * Fetches and persists operating hours for a department.
 * Reads/writes department_operating_hours table (cascade A1).
 * Falls back to 08:00-22:00, open all days when no DB rows exist.
 *
 * The return shape (hours, isLoading, upsertHours) is identical to the
 * legacy hook so downstream consumers (OpeningHoursSettings, HourFactorsTab,
 * SeasonOverviewTab) work unchanged.
 */
export function useOperatingHours(
  departmentId: string | undefined,
  options?: OperatingHoursOptions,
) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();
  const locationId = options?.locationId;
  const seasonId = options?.seasonId;

  const query = useQuery({
    queryKey: operatingHoursKeys(wsId ?? "none", departmentId ?? "none", locationId, seasonId),
    queryFn: async (): Promise<OperatingHoursEntry[]> => {
      let q = supabase
        .from("department_operating_hours")
        .select(
          "id, workspace_id, department_id, location_id, season_id, day_of_week, open_time, close_time, is_closed",
        )
        .eq("workspace_id", wsId!)
        .eq("department_id", departmentId!);

      // Season: prefer season-specific rows, fall back to default (NULL)
      if (seasonId) {
        q = q.eq("season_id", seasonId);
      } else {
        q = q.is("season_id", null);
      }

      // Location: prefer location-specific rows, fall back to default (NULL)
      if (locationId) {
        q = q.eq("location_id", locationId);
      } else {
        q = q.is("location_id", null);
      }

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      const rowsByDay = new Map<number, (typeof data)[number]>();
      for (const row of data ?? []) {
        rowsByDay.set(row.day_of_week, row);
      }

      return DAY_NAMES.map((name, index) => {
        const row = rowsByDay.get(index);
        return {
          day_of_week: index,
          day_name: name,
          open_time: row?.open_time ?? DEFAULT_ENTRY.open_time,
          close_time: row?.close_time ?? DEFAULT_ENTRY.close_time,
          is_closed: row?.is_closed ?? DEFAULT_ENTRY.is_closed,
        };
      });
    },
    enabled: !!wsId && !!departmentId,
    staleTime: 10 * 60 * 1000,
  });

  const upsertHours = useMutation({
    mutationFn: async (entries: OperatingHoursEntry[]) => {
      const rows = entries.map((entry) => ({
        workspace_id: wsId!,
        department_id: departmentId!,
        location_id: locationId ?? null,
        season_id: seasonId ?? null,
        day_of_week: entry.day_of_week,
        open_time: entry.open_time,
        close_time: entry.close_time,
        is_closed: entry.is_closed,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("department_operating_hours").upsert(rows, {
        onConflict: "department_id,location_id,season_id,day_of_week",
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void emit({
        event: "department_operating_hours updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            department_id: departmentId,
            location_id: locationId,
            season_id: seasonId,
          },
        },
      });
      queryClient.invalidateQueries({
        queryKey: operatingHoursKeys(wsId!, departmentId!, locationId, seasonId),
      });
      toast.success("Opening hours saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const defaultHours: OperatingHoursEntry[] = DAY_NAMES.map((name, index) => ({
    day_of_week: index,
    day_name: name,
    ...DEFAULT_ENTRY,
  }));

  return {
    hours: query.data ?? defaultHours,
    isLoading: query.isLoading,
    upsertHours,
  };
}
```

- [ ] **Step 2: Verify file compiles**

Run: `cd /home/sxtnl/dev/wt-2 && pnpm turbo typecheck --filter=web 2>&1 | tail -5`
Note: This will show errors in consumers that haven't been updated yet (OpeningHoursSettings calls with old signature). That's expected — fixed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts
git commit -m "$(cat <<'EOF'
feat(cascade): rewrite useOperatingHours to use department_operating_hours

Hook now reads/writes department_operating_hours (cascade A1) instead
of legacy operating_hours. Signature: useOperatingHours(departmentId,
options?). Return shape unchanged (hours, isLoading, upsertHours).

Telemetry event: "department_operating_hours updated".

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update OpeningHoursSettings to Pass Department Context

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/_components/opening-hours-settings.tsx`

The component currently calls `useOperatingHours()` with no args. It needs to pass a `departmentId`. The dashboard context provides the current department via route or a selector. We need to check what's available.

- [ ] **Step 1: Check what department context is available**

Read these files to understand how to get the current department:

- `apps/web/src/components/dashboard/DashboardShell.tsx` — check what `DashboardContext` provides
- `apps/web/src/app/dashboard/settings/page.tsx` — check if department is already in scope

The implementer must determine the department source. Options:

1. If `DashboardContext` provides `departmentId` → use it directly
2. If the settings page has a department selector → use that state
3. If neither → add a department selector to `OpeningHoursSettings` that lists workspace departments

- [ ] **Step 2: Update OpeningHoursSettings**

The minimal change: pass `departmentId` to `useOperatingHours(departmentId)`. The rest of the component (local state, save handler, 7-day editor UI) stays identical.

If no department context exists, add a simple `<select>` dropdown at the top of the component that fetches departments via:

```typescript
const { data: departments } = useQuery({
  queryKey: ["departments", wsId],
  queryFn: async () => {
    const { data } = await supabase
      .from("department")
      .select("department_id, name")
      .eq("workspace_id", wsId!)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    return data ?? [];
  },
  enabled: !!wsId,
});
```

The first department is selected by default. The hook call becomes:

```typescript
const { hours, isLoading, upsertHours } = useOperatingHours(selectedDeptId);
```

- [ ] **Step 3: Update HourFactorsTab and SeasonOverviewTab**

These both call `useOperatingHours()`. They need the same fix — pass `departmentId`. Both are season components, so they likely have department context available.

Read these files:

- `apps/web/src/app/dashboard/season/_components/HourFactorsTab.tsx` (lines 29-45)
- `apps/web/src/app/dashboard/season/_components/SeasonOverviewTab.tsx` (lines 35-46)

Check what props they receive and how to get `departmentId` in their scope. Apply the same pattern as Step 2.

- [ ] **Step 4: Run typecheck**

Run: `cd /home/sxtnl/dev/wt-2 && pnpm turbo typecheck --filter=web --force 2>&1 | tail -10`
Expected: 0 errors (all consumers now pass departmentId).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_components/opening-hours-settings.tsx apps/web/src/app/dashboard/season/_components/HourFactorsTab.tsx apps/web/src/app/dashboard/season/_components/SeasonOverviewTab.tsx
git commit -m "$(cat <<'EOF'
feat(cascade): update hours consumers to pass departmentId

OpeningHoursSettings, HourFactorsTab, SeasonOverviewTab now pass
departmentId to useOperatingHours(). Adds department selector
to settings if not already in context.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire department_session planned_open/close

**Files:**

- Modify: wherever `department_session` rows are created/updated

- [ ] **Step 1: Find session creation code**

Search for code that inserts into `department_session`:

```
rg "\.from\(['\"]department_session['\"\)]" --type ts -n apps/web/src/
rg "department_session.*insert\|upsert.*department_session" --type ts -n apps/web/src/
```

Also check Edge Functions:

```
rg "department_session" --type ts -n supabase/functions/
```

- [ ] **Step 2: Add resolveEffectiveHours() call at session creation**

At the point where a `department_session` row is created, add:

```typescript
import { resolveEffectiveHours } from "@/lib/cascade/resolve-hours";
import type { DepartmentOperatingHoursRow, DepartmentHoursOverrideRow } from "@/lib/cascade/types";

// Fetch hours data for this department + date
const { data: weeklyHours } = await supabase
  .from("department_operating_hours")
  .select(
    "id, department_id, location_id, season_id, day_of_week, open_time, close_time, is_closed",
  )
  .eq("department_id", departmentId)
  .eq("workspace_id", workspaceId);

const { data: overrides } = await supabase
  .from("department_hours_override")
  .select("id, department_id, location_id, override_date, open_time, close_time, is_closed, reason")
  .eq("department_id", departmentId)
  .eq("override_date", sessionDate);

const effectiveHours = resolveEffectiveHours(
  departmentId,
  null, // locationId — null for department-level default
  sessionDate,
  (weeklyHours ?? []) as DepartmentOperatingHoursRow[],
  (overrides ?? []) as DepartmentHoursOverrideRow[],
);

// Include planned_open/close in the session insert
const sessionRow = {
  // ... existing fields ...
  planned_open: effectiveHours.isOpen ? effectiveHours.openTime : null,
  planned_close: effectiveHours.isOpen ? effectiveHours.closeTime : null,
};
```

The exact integration point depends on where session creation lives. The implementer must find it and wire this in.

- [ ] **Step 3: Run typecheck**

Run: `cd /home/sxtnl/dev/wt-2 && pnpm turbo typecheck --filter=web --force 2>&1 | tail -10`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add <modified files>
git commit -m "$(cat <<'EOF'
feat(cascade): populate department_session planned_open/close

Session creation now calls resolveEffectiveHours() to set
planned_open and planned_close from department_operating_hours.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Regenerate Types and Full Validation

**Files:**

- Modify: `packages/supabase/src/database.types.ts` (regenerated)

- [ ] **Step 1: Run supabase db reset**

Run: `cd /home/sxtnl/dev/wt-2 && npx supabase db reset 2>&1 | tail -10`
Expected: All migrations apply cleanly including the new backfill migration.

- [ ] **Step 2: Regenerate types**

Run: `npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts`

- [ ] **Step 3: Run full typecheck**

Run: `pnpm turbo typecheck --filter=web --filter=@smartout/supabase --force 2>&1 | tail -10`
Expected: 0 errors.

- [ ] **Step 4: Run all cascade tests**

Run: `cd apps/web && npx vitest run src/lib/cascade/ 2>&1`
Expected: 29+ tests pass.

- [ ] **Step 5: Run full lint**

Run: `pnpm lint 2>&1 | tail -5`
Expected: All pass.

- [ ] **Step 6: Commit types if changed**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "$(cat <<'EOF'
chore(cascade): regenerate types after hours backfill migration

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update WORKLOG and Legacy Inventory

- [ ] **Step 1: Update WORKLOG**

Add to `docs/worklogs/WORKLOG-cascade-core-foundation.md`:

- [x] Backfill migration: operating_hours → department_operating_hours
- [x] useOperatingHours hook rewritten to use cascade table
- [x] OpeningHoursSettings, HourFactorsTab, SeasonOverviewTab updated
- [x] department_session.planned_open/close wired to resolveEffectiveHours()

- [ ] **Step 2: Update legacy inventory**

Update `docs/cascade-legacy-usage-inventory.md`:

- `use-operating-hours.ts` — reclassify from "Must Refactor" to "Done"
- `HourFactorsTab.tsx` — reclassify from "Safe to Defer" to "Done"
- `SeasonOverviewTab.tsx` — reclassify from "Safe to Defer" to "Done"

- [ ] **Step 3: Commit**

```bash
git add docs/worklogs/WORKLOG-cascade-core-foundation.md docs/cascade-legacy-usage-inventory.md
git commit -m "$(cat <<'EOF'
docs(cascade): update worklog and legacy inventory after hours integration

3 must-refactor files resolved. useOperatingHours now reads cascade table.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```
