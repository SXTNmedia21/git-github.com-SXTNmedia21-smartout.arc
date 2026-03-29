# Operating Hours Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move operating hours from department-direct to workspace base + department offset, fixing cascade tasks and enabling hours inheritance.

**Architecture:** Settings page writes to `workspace_operating_hours` (base). Department detail page writes offsets to `department_operating_hours`. All consumers use a fallback chain: department → workspace → defaults. Cascade task RPC gains workspace-level awareness.

**Tech Stack:** Next.js 16, React 19, TanStack Query v5, Supabase PostgreSQL, `@smartout/telemetry`, `@smartout/i18n`

**Spec:** `docs/superpowers/specs/2026-03-27-operating-hours-restructure-design.md`

---

## File Map

| File                                                                                          | Action | Responsibility                                                     |
| --------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| `packages/telemetry/src/registry.ts`                                                          | Modify | Add `WorkspaceOperatingHoursUpdated` event                         |
| `packages/i18n/locales/nb/dashboard.json`                                                     | Modify | Add i18n keys for workspace hours, department offset, cascade task |
| `packages/i18n/locales/en/dashboard.json`                                                     | Modify | Add i18n keys (English)                                            |
| `apps/web/src/app/dashboard/settings/_hooks/use-workspace-operating-hours.ts`                 | Create | Hook for workspace base hours CRUD                                 |
| `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts`                           | Modify | Add fallback chain: department → workspace → defaults              |
| `apps/web/src/app/dashboard/settings/_components/opening-hours-settings.tsx`                  | Modify | Rewrite to use workspace hours hook, remove department selector    |
| `apps/web/src/app/dashboard/organization/departments/[id]/_components/DepartmentHoursTab.tsx` | Create | Offset UI for department detail page                               |
| `apps/web/src/app/dashboard/organization/departments/[id]/page.tsx`                           | Modify | Add "Åpningstider" tab                                             |
| `supabase/migrations/20260426100000_resolve_cascade_tasks_rpc.sql`                            | Modify | Workspace fallback + workspace-level task                          |
| `apps/web/src/app/dashboard/schedule/_hooks/use-planned-hours.ts`                             | Modify | Add workspace fallback                                             |
| `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts`                                         | Modify | Add workspace hours query key                                      |

---

### Task 1: Telemetry — Register workspace hours event

**Files:**

- Modify: `packages/telemetry/src/registry.ts:723-728` (after OperatingHoursUpdated)
- Modify: `packages/telemetry/src/registry.ts:1867` (union type)

- [ ] **Step 1: Add the interface after `OperatingHoursUpdated`**

In `packages/telemetry/src/registry.ts`, after line 728 (closing `}` of `OperatingHoursUpdated`), add:

```typescript
export interface WorkspaceOperatingHoursUpdated extends BaseEvent {
  event: "workspace_operating_hours updated";
  properties: {
    data: Record<string, never>;
  };
}
```

- [ ] **Step 2: Add to the SmartoutEvent union type**

Find the line `| OperatingHoursUpdated` (line ~1867) and add after it:

```typescript
  | WorkspaceOperatingHoursUpdated
```

- [ ] **Step 3: Add to the registry map**

Find `"operating_hours updated":` entry (line ~2264) and add after its block:

```typescript
  "workspace_operating_hours updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter telemetry exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register workspace_operating_hours updated event"
```

---

### Task 2: i18n — Add translation keys

**Files:**

- Modify: `packages/i18n/locales/nb/dashboard.json`
- Modify: `packages/i18n/locales/en/dashboard.json`

- [ ] **Step 1: Add Norwegian keys**

In `packages/i18n/locales/nb/dashboard.json`, add these entries:

Inside the `"todo"` object (after `"dept_missing_hours_desc"`):

```json
    "workspace_missing_hours": "Virksomheten mangler base-åpningstider",
    "workspace_missing_hours_desc": "Sett opp åpningstider i innstillinger. Alle avdelinger arver disse som standard.",
```

Add a new top-level `"settings_hours"` object (after the `"todo"` object closing `}`):

```json
  "settings_hours": {
    "title": "Base-åpningstider",
    "description": "Standard åpningstider for hele virksomheten. Avdelinger arver disse med mindre de har egne justeringer.",
    "not_saved": "Åpningstider ikke lagret",
    "not_saved_desc": "Tidene under er standardverdier. Klikk Lagre for å aktivere.",
    "closed": "Stengt",
    "open": "Åpen",
    "save": "Lagre endringer",
    "saving": "Lagrer...",
    "unsaved": "Du har ulagrede endringer"
  },
  "department_hours": {
    "tab_label": "Åpningstider",
    "title": "Avdelingsjustering",
    "description": "Juster åpningstider relativt til virksomhetens base-tid.",
    "inherits": "Arver virksomhetens åpningstider",
    "opens_earlier": "{{minutes}} min tidligere",
    "opens_later": "{{minutes}} min senere",
    "closes_earlier": "{{minutes}} min tidligere",
    "closes_later": "{{minutes}} min senere",
    "no_offset": "Ingen justering",
    "open_offset": "Åpning",
    "close_offset": "Stenging",
    "result": "Resultat",
    "base_reference": "Base",
    "save": "Lagre",
    "saving": "Lagrer...",
    "saved": "Åpningstider lagret"
  }
```

- [ ] **Step 2: Add English keys**

In `packages/i18n/locales/en/dashboard.json`, add matching entries:

Inside the `"todo"` object (after `"dept_missing_hours_desc"`):

```json
    "workspace_missing_hours": "Workspace is missing base opening hours",
    "workspace_missing_hours_desc": "Set up opening hours in settings. All departments inherit these by default.",
```

Add new top-level objects:

```json
  "settings_hours": {
    "title": "Base opening hours",
    "description": "Default opening hours for your workspace. Departments inherit these unless they have their own adjustments.",
    "not_saved": "Opening hours not saved",
    "not_saved_desc": "The times below are defaults. Click Save to activate.",
    "closed": "Closed",
    "open": "Open",
    "save": "Save changes",
    "saving": "Saving...",
    "unsaved": "You have unsaved changes"
  },
  "department_hours": {
    "tab_label": "Opening hours",
    "title": "Department adjustment",
    "description": "Adjust opening hours relative to the workspace base.",
    "inherits": "Inherits workspace opening hours",
    "opens_earlier": "{{minutes}} min earlier",
    "opens_later": "{{minutes}} min later",
    "closes_earlier": "{{minutes}} min earlier",
    "closes_later": "{{minutes}} min later",
    "no_offset": "No adjustment",
    "open_offset": "Opening",
    "close_offset": "Closing",
    "result": "Result",
    "base_reference": "Base",
    "save": "Save",
    "saving": "Saving...",
    "saved": "Opening hours saved"
  }
```

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/locales/nb/dashboard.json packages/i18n/locales/en/dashboard.json
git commit -m "feat(i18n): add operating hours restructure translation keys"
```

---

### Task 3: Hook — Create `useWorkspaceOperatingHours`

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_hooks/use-workspace-operating-hours.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts:57` (add key)

- [ ] **Step 1: Add query key to dashboard-keys**

In `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts`, after the `operatingHours` key (line 57), add:

```typescript
  workspaceOperatingHours: (workspaceId: string) =>
    ["dashboard", "workspace-operating-hours", workspaceId] as const,
```

- [ ] **Step 2: Create the hook file**

Create `apps/web/src/app/dashboard/settings/_hooks/use-workspace-operating-hours.ts`:

```typescript
"use client";

/**
 * Reads and writes workspace-level base operating hours.
 * Used by the Settings page. Departments inherit these unless overridden.
 */

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";
import { dashboardKeys } from "../../_hooks/dashboard-keys";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DayName = (typeof DAY_NAMES)[number];

export type WorkspaceHoursEntry = {
  day_of_week: number;
  day_name: DayName;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

const DEFAULT_ENTRY = {
  open_time: "08:00",
  close_time: "22:00",
  is_closed: false,
} as const;

export function useWorkspaceOperatingHours() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dashboardKeys.workspaceOperatingHours(wsId ?? "none"),
    queryFn: async (): Promise<{ entries: WorkspaceHoursEntry[]; persistedCount: number }> => {
      const { data, error } = await supabase
        .from("workspace_operating_hours")
        .select("id, workspace_id, day_of_week, open_time, close_time, is_closed")
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);

      const persistedCount = data?.length ?? 0;
      const rowsByDay = new Map<number, (typeof data)[number]>();
      for (const row of data ?? []) {
        rowsByDay.set(row.day_of_week, row);
      }

      const entries = DAY_NAMES.map((name, index) => {
        const row = rowsByDay.get(index);
        return {
          day_of_week: index,
          day_name: name,
          open_time: row?.open_time ?? DEFAULT_ENTRY.open_time,
          close_time: row?.close_time ?? DEFAULT_ENTRY.close_time,
          is_closed: row?.is_closed ?? DEFAULT_ENTRY.is_closed,
        };
      });

      return { entries, persistedCount };
    },
    enabled: !!wsId,
    staleTime: 10 * 60_000,
  });

  const upsertHours = useMutation({
    mutationFn: async (entries: WorkspaceHoursEntry[]) => {
      const rows = entries.map((entry) => ({
        workspace_id: wsId!,
        day_of_week: entry.day_of_week,
        open_time: entry.open_time,
        close_time: entry.close_time,
        is_closed: entry.is_closed,
      }));

      const { error } = await supabase.from("workspace_operating_hours").upsert(rows, {
        onConflict: "workspace_id,day_of_week",
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void emit({
        event: "workspace_operating_hours updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: { data: {} },
      });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.workspaceOperatingHours(wsId!),
      });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.cascadeTasks(wsId!),
      });
      toast.success("Opening hours saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const defaultHours: WorkspaceHoursEntry[] = DAY_NAMES.map((name, index) => ({
    day_of_week: index,
    day_name: name,
    ...DEFAULT_ENTRY,
  }));

  return {
    hours: query.data?.entries ?? defaultHours,
    isSaved: (query.data?.persistedCount ?? 0) > 0,
    isLoading: query.isLoading,
    upsertHours,
  };
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_hooks/use-workspace-operating-hours.ts apps/web/src/app/dashboard/_hooks/dashboard-keys.ts
git commit -m "feat(settings): create useWorkspaceOperatingHours hook"
```

---

### Task 4: Hook — Add fallback chain to `useOperatingHours`

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts`

This is the critical change. The hook must return workspace base hours when no department rows exist.

- [ ] **Step 1: Update the return type and computation**

In `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts`, replace the return block (lines ~223-229) with:

```typescript
const source: "department" | "workspace" | "default" = query.data
  ? query.data.persistedCount > 0
    ? "department"
    : baseHoursQuery.data
      ? "workspace"
      : "default"
  : "default";

/**
 * Fallback chain: department hours → workspace base hours → hardcoded defaults.
 * This ensures season tabs and schedule views get correct data even when
 * departments have no explicit rows (inheriting workspace base).
 */
const resolvedHours: OperatingHoursEntry[] =
  query.data && query.data.persistedCount > 0
    ? query.data.entries
    : baseHoursQuery.data
      ? baseHoursQuery.data.map((base) => ({
          day_of_week: base.day_of_week,
          day_name: base.day_name,
          open_time: base.open_time,
          close_time: base.close_time,
          is_closed: base.is_closed,
          open_offset_minutes: 0,
          close_offset_minutes: 0,
          is_derived: true,
        }))
      : defaultHours;

return {
  hours: resolvedHours,
  isSaved: (query.data?.persistedCount ?? 0) > 0,
  source,
  baseHours: baseHoursQuery.data ?? null,
  isLoading: query.isLoading,
  upsertHours,
};
```

- [ ] **Step 2: Verify season tab consumers still work**

`HourFactorsTab.tsx` destructures `{ hours: operatingHours, isLoading: loadingHours }` — still works.
`SeasonOverviewTab.tsx` destructures `{ hours: operatingHours }` — still works.
`opening-hours-settings.tsx` destructures `{ hours, isSaved, isLoading, upsertHours }` — still works (new `source` field ignored).

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts
git commit -m "feat(hooks): add workspace fallback chain to useOperatingHours"
```

---

### Task 5: Settings UI — Rewrite to use workspace hours

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/_components/opening-hours-settings.tsx`

- [ ] **Step 1: Replace the component implementation**

Rewrite `opening-hours-settings.tsx` to use `useWorkspaceOperatingHours` instead of `useOperatingHours`. Remove the department selector. Use i18n keys.

```typescript
"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@smartout/ui";
import { Switch } from "@/components/ui/switch";
import { Input } from "@smartout/ui";
import { Label } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import {
  useWorkspaceOperatingHours,
  type WorkspaceHoursEntry,
} from "../_hooks/use-workspace-operating-hours";

export function OpeningHoursSettings() {
  const { t } = useTranslation("dashboard");
  const { hours, isSaved, isLoading, upsertHours } = useWorkspaceOperatingHours();
  const [localHours, setLocalHours] = useState<WorkspaceHoursEntry[]>(hours);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalHours(hours);
    setHasChanges(false);
  }, [hours]);

  function updateDay(index: number, updates: Partial<WorkspaceHoursEntry>) {
    setLocalHours((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, ...updates } : entry)),
    );
    setHasChanges(true);
  }

  function handleSave() {
    upsertHours.mutate(localHours);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-foreground text-lg font-semibold">
          {t("settings_hours.title")}
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("settings_hours.description")}
        </p>
      </div>

      {!isSaved && (
        <div className="border-warning/30 bg-warning/5 flex items-start gap-3 rounded-lg border p-4">
          <AlertTriangle className="text-warning mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-foreground text-sm font-medium">
              {t("settings_hours.not_saved")}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {t("settings_hours.not_saved_desc")}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {localHours.map((entry, index) => (
          <div
            key={entry.day_of_week}
            className="bg-card border-border flex items-center gap-4 rounded-lg border p-4"
          >
            <span className="text-foreground w-24 text-sm font-medium">{entry.day_name}</span>

            <div className="flex items-center gap-2">
              <Switch
                id={`day-${entry.day_of_week}`}
                checked={!entry.is_closed}
                onCheckedChange={(checked) => updateDay(index, { is_closed: !checked })}
              />
              <Label htmlFor={`day-${entry.day_of_week}`} className="text-muted-foreground text-xs">
                {entry.is_closed ? t("settings_hours.closed") : t("settings_hours.open")}
              </Label>
            </div>

            {entry.is_closed ? (
              <span className="text-muted-foreground ml-4 text-sm">
                {t("settings_hours.closed")}
              </span>
            ) : (
              <div className="ml-4 flex items-center gap-2">
                <Input
                  type="time"
                  value={entry.open_time}
                  onChange={(e) => updateDay(index, { open_time: e.target.value })}
                  className="w-32"
                />
                <span className="text-muted-foreground text-sm">–</span>
                <Input
                  type="time"
                  value={entry.close_time}
                  onChange={(e) => updateDay(index, { close_time: e.target.value })}
                  className="w-32"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={(hasChanges === false && isSaved) || upsertHours.isPending}
        >
          {upsertHours.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("settings_hours.saving")}
            </>
          ) : (
            t("settings_hours.save")
          )}
        </Button>
        {hasChanges && (
          <span className="text-muted-foreground text-xs">
            {t("settings_hours.unsaved")}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_components/opening-hours-settings.tsx
git commit -m "refactor(settings): rewrite opening hours to use workspace base"
```

---

### Task 6: Cascade RPC — Add workspace fallback + workspace-level task

**Files:**

- Modify: `supabase/migrations/20260426100000_resolve_cascade_tasks_rpc.sql`

- [ ] **Step 1: Update the RPC**

Replace the `dept_with_hours` CTE and add workspace-level checks. The key changes:

1. Add `workspace_hours_check` CTE at the top (after `dept_all`)
2. Update `dept_with_hours` to also check workspace hours
3. Add `workspace_hours_task` for missing workspace base hours
4. Include workspace task in `all_dept_tasks` and `all_tasks`

Replace lines 22-26 (`dept_with_hours` CTE):

```sql
  workspace_hours_check AS (
    SELECT count(*) AS cnt
    FROM workspace_operating_hours
    WHERE workspace_id = p_workspace_id
  ),
  dept_with_hours AS (
    SELECT DISTINCT d.department_id
    FROM dept_all d
    WHERE EXISTS (
      SELECT 1 FROM department_operating_hours doh
      WHERE doh.department_id = d.department_id
    )
    OR (SELECT cnt FROM workspace_hours_check) > 0
  ),
```

After `dept_none_task` (before `all_dept_tasks`), add:

```sql
  workspace_hours_task AS (
    SELECT jsonb_build_object(
      'id', 'workspace.missing_base_hours',
      'group', 'departments',
      'dimension', 'D1',
      'title_key', 'dashboard.todo.workspace_missing_hours',
      'description_key', 'dashboard.todo.desc.workspace_missing_hours',
      'urgency', 'critical',
      'href', '/dashboard/settings'
    ) AS task
    WHERE (SELECT cnt FROM workspace_hours_check) = 0
  ),
```

Update `all_dept_tasks` to include:

```sql
  all_dept_tasks AS (
    SELECT task FROM dept_tasks
    UNION ALL SELECT task FROM dept_no_positions
    UNION ALL SELECT task FROM dept_no_location_task
    UNION ALL SELECT task FROM dept_none_task
    UNION ALL SELECT task FROM workspace_hours_task
  ),
```

Update `dept_summary` done count to account for workspace hours:

```sql
  dept_summary AS (
    SELECT jsonb_build_object(
      'group', 'departments',
      'dimension', 'D1',
      'label_key', 'dashboard.todo.group.departments',
      'icon', 'Building2',
      'done', (SELECT count(*) FROM dept_with_hours),
      'total', (SELECT count(*) FROM dept_all),
      'tasks', COALESCE((SELECT jsonb_agg(task) FROM all_dept_tasks), '[]'::jsonb)
    ) AS summary
  ),
```

- [ ] **Step 2: Apply the migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260426100000_resolve_cascade_tasks_rpc.sql`
Expected: `CREATE FUNCTION`, `GRANT`, `COMMENT`

- [ ] **Step 3: Verify RPC works**

Run:

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
SELECT task->>'id' AS id, task->>'urgency' AS urgency
FROM (
  SELECT jsonb_array_elements(g->'tasks') AS task
  FROM jsonb_array_elements(
    (SELECT resolve_cascade_tasks(w.workspace_id)->'groups'
     FROM workspace w LIMIT 1)
  ) AS g
) sub
WHERE task->>'id' LIKE '%hours%' OR task->>'id' LIKE '%workspace%';
"
```

Expected: Should show `workspace.missing_base_hours` as critical (since workspace_operating_hours is empty). Should NOT show per-department `departments.missing_hours` tasks.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260426100000_resolve_cascade_tasks_rpc.sql
git commit -m "feat(cascade): add workspace hours fallback to resolve_cascade_tasks RPC"
```

---

### Task 7: Schedule hook — Add workspace fallback to `usePlannedHours`

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_hooks/use-planned-hours.ts`

- [ ] **Step 1: Add workspace fallback query**

After the `weeklyQuery` (line 67), add a workspace fallback query:

```typescript
const workspaceHoursQuery = useQuery({
  queryKey: ["workspace-operating-hours-fallback", wsId],
  queryFn: async () => {
    const { data } = await supabase
      .from("workspace_operating_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .eq("workspace_id", wsId!);
    return (data ?? []) as Array<{
      day_of_week: number;
      open_time: string;
      close_time: string;
      is_closed: boolean;
    }>;
  },
  enabled: !!wsId && !sessionQuery.data && (weeklyQuery.data?.length ?? 0) === 0,
  staleTime: 10 * 60_000,
});
```

- [ ] **Step 2: Update the weekly hours resolution to include fallback**

Replace line 117 (`const weeklyHours = weeklyQuery.data ?? [];`):

```typescript
const deptHours = weeklyQuery.data ?? [];
const weeklyHours: DepartmentOperatingHoursRow[] =
  deptHours.length > 0
    ? deptHours
    : ((workspaceHoursQuery.data ?? []).map((wh) => ({
        id: `ws-fallback-${wh.day_of_week}`,
        department_id: departmentId!,
        location_id: null,
        season_id: null,
        day_of_week: wh.day_of_week,
        open_time: wh.open_time,
        close_time: wh.close_time,
        is_closed: wh.is_closed,
      })) as DepartmentOperatingHoursRow[]);
```

- [ ] **Step 3: Update isLoading to include new query**

Replace line 86:

```typescript
const isLoading =
  sessionQuery.isLoading ||
  weeklyQuery.isLoading ||
  overrideQuery.isLoading ||
  workspaceHoursQuery.isLoading;
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_hooks/use-planned-hours.ts
git commit -m "feat(schedule): add workspace hours fallback to usePlannedHours"
```

---

### Task 8: Department detail — Add "Åpningstider" tab

**Files:**

- Create: `apps/web/src/app/dashboard/organization/departments/[id]/_components/DepartmentHoursTab.tsx`
- Modify: `apps/web/src/app/dashboard/organization/departments/[id]/page.tsx`

- [ ] **Step 1: Create the DepartmentHoursTab component**

Create `apps/web/src/app/dashboard/organization/departments/[id]/_components/DepartmentHoursTab.tsx`:

```typescript
"use client";

/**
 * Department offset tab — shows workspace base hours and lets admin set
 * per-day offsets. Writes to department_operating_hours with computed
 * absolute times and stored offsets.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Clock, Info } from "lucide-react";
import { Button } from "@smartout/ui";
import { Input } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { createClient } from "@smartout/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";
import { dashboardKeys } from "@/app/dashboard/_hooks/dashboard-keys";

type DayEntry = {
  day_of_week: number;
  day_name: string;
  base_open: string;
  base_close: string;
  base_closed: boolean;
  open_offset: number;
  close_offset: number;
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h! * 60 + m! + minutes;
  const clampedH = Math.max(0, Math.min(23, Math.floor(total / 60)));
  const clampedM = Math.max(0, Math.min(59, total % 60));
  return `${String(clampedH).padStart(2, "0")}:${String(clampedM).padStart(2, "0")}`;
}

type Props = {
  departmentId: string;
  profileId: string;
  isDark: boolean;
};

export function DepartmentHoursTab({ departmentId, profileId, isDark }: Props) {
  const { t } = useTranslation("dashboard");
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();
  const queryClient = useQueryClient();

  const baseQuery = useQuery({
    queryKey: dashboardKeys.workspaceOperatingHours(wsId ?? "none"),
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_operating_hours")
        .select("day_of_week, open_time, close_time, is_closed")
        .eq("workspace_id", wsId!);
      return data ?? [];
    },
    enabled: !!wsId,
    staleTime: 10 * 60_000,
  });

  const deptQuery = useQuery({
    queryKey: ["department-hours-offset", wsId, departmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("department_operating_hours")
        .select("day_of_week, open_offset_minutes, close_offset_minutes")
        .eq("workspace_id", wsId!)
        .eq("department_id", departmentId)
        .is("location_id", null)
        .is("season_id", null);
      return data ?? [];
    },
    enabled: !!wsId,
    staleTime: 10 * 60_000,
  });

  const hasDeptRows = (deptQuery.data?.length ?? 0) > 0;
  const hasBaseHours = (baseQuery.data?.length ?? 0) > 0;

  const entries: DayEntry[] = useMemo(() => {
    const baseMap = new Map<number, (typeof baseQuery.data extends (infer T)[] | null ? T : never)>();
    for (const row of baseQuery.data ?? []) {
      baseMap.set(row.day_of_week, row);
    }
    const deptMap = new Map<number, { open_offset_minutes: number; close_offset_minutes: number }>();
    for (const row of deptQuery.data ?? []) {
      deptMap.set(row.day_of_week, row);
    }
    return DAY_NAMES.map((name, i) => {
      const base = baseMap.get(i);
      const dept = deptMap.get(i);
      return {
        day_of_week: i,
        day_name: name,
        base_open: base?.open_time ?? "08:00",
        base_close: base?.close_time ?? "22:00",
        base_closed: base?.is_closed ?? false,
        open_offset: dept?.open_offset_minutes ?? 0,
        close_offset: dept?.close_offset_minutes ?? 0,
      };
    });
  }, [baseQuery.data, deptQuery.data]);

  const [localEntries, setLocalEntries] = useState<DayEntry[]>(entries);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalEntries(entries);
    setHasChanges(false);
  }, [entries]);

  const updateOffset = useCallback((dayIndex: number, field: "open_offset" | "close_offset", value: number) => {
    setLocalEntries((prev) =>
      prev.map((e, i) => (i === dayIndex ? { ...e, [field]: value } : e)),
    );
    setHasChanges(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (entriesToSave: DayEntry[]) => {
      const rows = entriesToSave.map((e) => ({
        workspace_id: wsId!,
        department_id: departmentId,
        location_id: null,
        season_id: null,
        day_of_week: e.day_of_week,
        open_time: e.base_closed ? null : addMinutes(e.base_open, e.open_offset),
        close_time: e.base_closed ? null : addMinutes(e.base_close, e.close_offset),
        is_closed: e.base_closed,
        open_offset_minutes: e.open_offset,
        close_offset_minutes: e.close_offset,
        is_derived: false,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("department_operating_hours").upsert(rows, {
        onConflict: "department_id,location_id,season_id,day_of_week",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void emit({
        event: "operating_hours updated",
        workspace_id: wsId ?? null,
        actor_id: profileId,
        properties: { data: {} },
      });
      queryClient.invalidateQueries({ queryKey: ["department-hours-offset", wsId, departmentId] });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.cascadeTasks(wsId!) });
      toast.success(t("department_hours.saved"));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (baseQuery.isLoading || deptQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!hasBaseHours) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 ${
        isDark ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-200 bg-zinc-50"
      }`}>
        <Clock className={`mb-4 h-8 w-8 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
        <p className={`text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          {t("department_hours.inherits")}
        </p>
        <p className={`mt-1 text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          {t("settings_hours.not_saved_desc")}
        </p>
      </div>
    );
  }

  const cardBase = `rounded-2xl border p-5 transition-all ${
    isDark
      ? "border-zinc-800/50 bg-zinc-950 hover:border-zinc-700/50"
      : "border-zinc-200 bg-white hover:border-zinc-300"
  }`;

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
          {t("department_hours.title")}
        </h3>
        <p className={`mt-1 text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          {t("department_hours.description")}
        </p>
      </div>

      {!hasDeptRows && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
          <p className="text-xs text-blue-300">{t("department_hours.inherits")}</p>
        </div>
      )}

      <div className="space-y-3">
        {localEntries.map((entry, index) => {
          const resultOpen = addMinutes(entry.base_open, entry.open_offset);
          const resultClose = addMinutes(entry.base_close, entry.close_offset);

          return (
            <div key={entry.day_of_week} className={cardBase}>
              <div className="flex items-center justify-between">
                <span className={`w-24 text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                  {entry.day_name}
                </span>

                {entry.base_closed ? (
                  <span className="text-muted-foreground text-sm">{t("settings_hours.closed")}</span>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                        {t("department_hours.open_offset")}
                      </span>
                      <Input
                        type="number"
                        value={entry.open_offset}
                        onChange={(e) => updateOffset(index, "open_offset", Number(e.target.value))}
                        className="w-20 text-center"
                        step={15}
                      />
                      <span className="text-muted-foreground text-xs">min</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                        {t("department_hours.close_offset")}
                      </span>
                      <Input
                        type="number"
                        value={entry.close_offset}
                        onChange={(e) => updateOffset(index, "close_offset", Number(e.target.value))}
                        className="w-20 text-center"
                        step={15}
                      />
                      <span className="text-muted-foreground text-xs">min</span>
                    </div>

                    <div className={`ml-2 rounded-md px-2 py-1 font-mono text-xs ${isDark ? "bg-zinc-900 text-zinc-300" : "bg-zinc-100 text-zinc-600"}`}>
                      {resultOpen}–{resultClose}
                    </div>
                  </div>
                )}
              </div>

              {!entry.base_closed && (
                <div className={`mt-1 text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                  {t("department_hours.base_reference")}: {entry.base_open}–{entry.base_close}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        onClick={() => saveMutation.mutate(localEntries)}
        disabled={(!hasChanges && hasDeptRows) || saveMutation.isPending}
      >
        {saveMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("department_hours.saving")}
          </>
        ) : (
          t("department_hours.save")
        )}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Add the tab to the department detail page**

In `apps/web/src/app/dashboard/organization/departments/[id]/page.tsx`:

Add import at the top:

```typescript
import { DepartmentHoursTab } from "./_components/DepartmentHoursTab";
```

Add a new tab entry in the `tabs` array (after the "policies" tab, before "settings"):

```typescript
          {
            value: "hours",
            label: "Åpningstider",
            content: (
              <DepartmentHoursTab
                departmentId={department.department_id}
                profileId={profiles.find((p) => p.profile_id === department.manager_profile_id)?.profile_id ?? ""}
                isDark={isDark}
              />
            ),
          },
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/organization/departments/[id]/_components/DepartmentHoursTab.tsx apps/web/src/app/dashboard/organization/departments/[id]/page.tsx
git commit -m "feat(organization): add department hours offset tab"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full typecheck**

Run: `pnpm turbo typecheck`
Expected: all packages pass

- [ ] **Step 2: Lint check**

Run: `pnpm lint`
Expected: no new errors

- [ ] **Step 3: Manual smoke test**

1. Open Settings → verify workspace hours form (no department selector)
2. Save workspace hours → verify toast + cascade tasks update
3. Open Organization → Kitchen → Åpningstider tab → verify base reference shown
4. Set offset → save → verify toast
5. Check "Å gjøre" tab → verify no false "missing hours" tasks
6. Check Season → Hour Factors tab → verify hours reflect workspace base

- [ ] **Step 4: Commit any fixes from smoke test**
