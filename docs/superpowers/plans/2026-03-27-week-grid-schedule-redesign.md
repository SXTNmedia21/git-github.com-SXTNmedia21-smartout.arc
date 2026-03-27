---
title: "Week Grid Schedule Redesign — Implementation Plan"
status: in_progress
created: 2026-03-27
updated: 2026-03-27
module: schedule
tags: [schedule, week-grid, implementation, cascade-d1]
---

# Week Grid Schedule Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the schedule grid from template-dependent to week-first, where `department_shift_type_config` (D1) defines columns and templates become an optional import tool.

**Architecture:** New junction table `department_shift_type_config` links `payroll.shift_type` (D3) to departments with default times/slots. Grid always renders the week from this config. `schedule_shift` rows fill cells matched by `shift_type_id`. Existing template system stays for import/export. Component renames from `mal-*` to `week-grid-*`.

**Tech Stack:** PostgreSQL (Supabase Local), TypeScript (strict), TanStack Query v5, Next.js App Router, React 19, shadcn/ui, `@smartout/telemetry`, `@smartout/schedule` package

**Spec:** `docs/superpowers/specs/2026-03-27-week-grid-schedule-redesign.md`

---

## File Map

### New files to create

| File                                                                  | Responsibility                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------- |
| `supabase/migrations/20260327120000_department_shift_type_config.sql` | New D1 table + RLS + indexes + backfill                 |
| `packages/schedule/src/grid-types.ts`                                 | Renamed types: `GridColumn`, `GridCell`, `WeekGridData` |
| `packages/schedule/src/grid-query-keys.ts`                            | Query key factory for grid data                         |
| `packages/schedule/src/use-week-grid-data.ts`                         | Data hook reading from `department_shift_type_config`   |
| `packages/schedule/src/use-grid-mutations.ts`                         | Mutation hooks (publish, reset, assign, add shift type) |

### Files to rename (git mv)

| From                                                     | To                          |
| -------------------------------------------------------- | --------------------------- |
| `apps/web/.../schedule/_components/mal-grid.tsx`         | `week-grid.tsx`             |
| `apps/web/.../schedule/_components/mal-command-bar.tsx`  | `week-grid-command-bar.tsx` |
| `apps/web/.../schedule/_components/mal-template-bar.tsx` | `week-grid-context-bar.tsx` |
| `apps/web/.../schedule/_components/mal-grid-header.tsx`  | `week-grid-header.tsx`      |
| `apps/web/.../schedule/_components/mal-grid-row.tsx`     | `week-grid-row.tsx`         |
| `apps/web/.../schedule/_components/mal-shift-cell.tsx`   | `week-grid-cell.tsx`        |
| `apps/web/.../schedule/_components/mal-employee-tag.tsx` | `shift-employee-tag.tsx`    |
| `apps/web/.../schedule/_components/mal-task-tag.tsx`     | `shift-task-tag.tsx`        |
| `apps/web/.../schedule/_components/mal-ghost-tag.tsx`    | `shift-ghost-tag.tsx`       |
| `apps/web/.../schedule/_components/mal-empty-state.tsx`  | `week-grid-empty-state.tsx` |

### Files to modify

| File                                                                     | Change                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------- |
| `packages/supabase/src/database.types.ts`                                | Regenerate after migration                         |
| `packages/schedule/src/index.ts`                                         | Update all exports to new names                    |
| `packages/telemetry/src/registry.ts`                                     | Register 3 new events                              |
| `apps/web/src/components/dashboard/DashboardShell.tsx:66`                | `ScheduleLayoutMode`: add `"grid"`, remove `"mal"` |
| `apps/web/src/components/dashboard/DashboardShell.tsx:~1682`             | Tab button: `"mal"` → `"grid"`                     |
| `apps/web/src/app/dashboard/schedule/page.tsx:39`                        | Import rename: `MalGrid` → `WeekGrid`              |
| `apps/web/src/app/dashboard/schedule/page.tsx:~972`                      | Layout branch: `"mal"` → `"grid"`                  |
| `apps/web/src/app/dashboard/schedule/_components/schedule-types.ts:~189` | `templateShiftId` → `shiftTypeConfigId`            |

---

## Task 1: Database Migration — `department_shift_type_config`

**Files:**

- Create: `supabase/migrations/20260327120000_department_shift_type_config.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260327120000_department_shift_type_config.sql
-- D1 Operational Envelope: binds workspace-level shift types to departments
-- with default scheduling parameters (times, slots, sort order).

CREATE TABLE department_shift_type_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id         UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  shift_type_id         UUID NOT NULL REFERENCES payroll.shift_type(id) ON DELETE CASCADE,
  label                 TEXT NOT NULL,
  default_start_time    TIME NOT NULL DEFAULT '08:00',
  default_end_time      TIME NOT NULL DEFAULT '16:00',
  default_break_minutes INTEGER NOT NULL DEFAULT 30,
  slot_count            INTEGER NOT NULL DEFAULT 1,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  applicable_day_types  TEXT[] NOT NULL DEFAULT '{weekday,weekend}'
                        CHECK (applicable_day_types <@ ARRAY['weekday','weekend','holiday']::text[]),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_dept_shift_config UNIQUE (department_id, shift_type_id, default_start_time, default_end_time)
);

ALTER TABLE department_shift_type_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_dept_shift_config" ON department_shift_type_config
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_dept_shift_config" ON department_shift_type_config
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_dept_shift_config" ON department_shift_type_config
  FOR SELECT USING (workspace_id = get_api_workspace_id());

CREATE INDEX idx_dept_shift_config_dept ON department_shift_type_config (department_id);
CREATE INDEX idx_dept_shift_config_workspace ON department_shift_type_config (workspace_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON department_shift_type_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE department_shift_type_config IS
  'D1 Operational Envelope: binds workspace-level shift types to departments with default scheduling parameters.';

-- Backfill Step 1: Create payroll.shift_type entries from existing template roles
INSERT INTO payroll.shift_type (workspace_id, name, color, sort_order)
SELECT DISTINCT
  t.workspace_id,
  ts.role,
  '#6B7280',
  0
FROM schedule_template_shift ts
JOIN schedule_template t ON t.schedule_template_id = ts.schedule_template_id
WHERE ts.role IS NOT NULL
  AND t.workspace_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payroll.shift_type st
    WHERE st.workspace_id = t.workspace_id AND LOWER(st.name) = LOWER(ts.role)
  );

-- Backfill Step 2: Create department_shift_type_config from template shifts
INSERT INTO department_shift_type_config
  (workspace_id, department_id, shift_type_id, label, default_start_time, default_end_time, slot_count, sort_order)
SELECT DISTINCT ON (t.department_id, st.id, ts.start_time, ts.end_time)
  t.workspace_id,
  t.department_id,
  st.id,
  ts.role || ' ' || ts.start_time || '-' || ts.end_time,
  ts.start_time::TIME,
  ts.end_time::TIME,
  COALESCE(ts.slot_count, 1),
  COALESCE(ts.slot_order, 0)
FROM schedule_template_shift ts
JOIN schedule_template t ON t.schedule_template_id = ts.schedule_template_id
JOIN payroll.shift_type st ON st.workspace_id = t.workspace_id AND LOWER(st.name) = LOWER(ts.role)
WHERE t.department_id IS NOT NULL
ON CONFLICT (department_id, shift_type_id, default_start_time, default_end_time) DO NOTHING;

-- Backfill Step 3: Set shift_type_id on existing schedule_shift rows
UPDATE schedule_shift ss
SET shift_type_id = st.id
FROM schedule_template_shift ts
JOIN schedule_template t ON t.schedule_template_id = ts.schedule_template_id
JOIN payroll.shift_type st ON st.workspace_id = t.workspace_id AND LOWER(st.name) = LOWER(ts.role)
WHERE ss.template_shift_id = ts.schedule_template_shift_id
  AND ss.shift_type_id IS NULL;
```

- [ ] **Step 2: Run migration against local Supabase**

Run:

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260327120000_department_shift_type_config.sql
```

Expected: `CREATE TABLE`, `ALTER TABLE`, `CREATE POLICY` (×3), `CREATE INDEX` (×2), `CREATE TRIGGER`, `COMMENT`, `INSERT` (×2), `UPDATE`

- [ ] **Step 3: Verify table exists and backfill ran**

Run:

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT count(*) FROM department_shift_type_config;"
```

Expected: Row count ≥ 0 (0 is OK if no templates exist in local seed)

- [ ] **Step 4: Regenerate TypeScript types**

Run:

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

Expected: `database.types.ts` now includes `department_shift_type_config` in the `public` schema Tables section

- [ ] **Step 5: Verify new table in generated types**

Run: `grep -n "department_shift_type_config" packages/supabase/src/database.types.ts | head -5`

Expected: Table appears in Row, Insert, and Update type definitions

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260327120000_department_shift_type_config.sql packages/supabase/src/database.types.ts
git commit -m "$(cat <<'EOF'
feat(schedule): add department_shift_type_config table (D1)

Junction table binding payroll.shift_type to departments with default
scheduling parameters. Includes backfill from existing template data.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Package Renames — `packages/schedule/src/`

**Files:**

- Rename: `packages/schedule/src/mal-types.ts` → `grid-types.ts`
- Rename: `packages/schedule/src/mal-query-keys.ts` → `grid-query-keys.ts`
- Rename: `packages/schedule/src/use-mal-data.ts` → `use-week-grid-data.ts`
- Rename: `packages/schedule/src/use-mal-mutations.ts` → `use-grid-mutations.ts`
- Modify: `packages/schedule/src/index.ts`

- [ ] **Step 1: Rename files with git mv**

Run:

```bash
cd /home/sxtnl/dev/smartout.ai && \
git mv packages/schedule/src/mal-types.ts packages/schedule/src/grid-types.ts && \
git mv packages/schedule/src/mal-query-keys.ts packages/schedule/src/grid-query-keys.ts && \
git mv packages/schedule/src/use-mal-data.ts packages/schedule/src/use-week-grid-data.ts && \
git mv packages/schedule/src/use-mal-mutations.ts packages/schedule/src/use-grid-mutations.ts
```

- [ ] **Step 2: Update internal imports in `grid-types.ts`**

No changes needed — `grid-types.ts` has no internal imports.

- [ ] **Step 3: Update `grid-query-keys.ts` — rename `malKeys` to `gridKeys`**

Replace the entire content of `packages/schedule/src/grid-query-keys.ts`:

```typescript
export const gridKeys = {
  department: (workspaceId: string, departmentName: string) =>
    ["schedule", "grid-department", workspaceId, departmentName] as const,
  configs: (workspaceId: string, departmentId: string) =>
    ["schedule", "grid-configs", workspaceId, departmentId] as const,
  shifts: (workspaceId: string, weekStart: string, departmentId: string) =>
    ["schedule", "grid-shifts", workspaceId, weekStart, departmentId] as const,
  tasks: (workspaceId: string, weekStart: string, departmentId: string) =>
    ["schedule", "grid-tasks", workspaceId, weekStart, departmentId] as const,
};
```

Note: `templates` key replaced with `configs` (no longer template-scoped). `shifts` key now uses `departmentId` instead of `templateId`.

- [ ] **Step 4: Update imports in `use-week-grid-data.ts`**

In `packages/schedule/src/use-week-grid-data.ts`, update all import paths:

Replace:

```typescript
import type { MalColumn, MalCell, MalGridData, MalEmployeeAssignment, MalTask } from "./mal-types";
import { cellKey, addDays } from "./mal-types";
import { malKeys } from "./mal-query-keys";
```

With:

```typescript
import type { MalColumn, MalCell, MalGridData, MalEmployeeAssignment, MalTask } from "./grid-types";
import { cellKey, addDays } from "./grid-types";
import { gridKeys } from "./grid-query-keys";
```

Then find-and-replace all `malKeys.` with `gridKeys.` in the file.

Note: Type names (`MalColumn`, etc.) stay unchanged in this task — they will be renamed in Task 5 when the new hook is written.

- [ ] **Step 5: Update imports in `use-grid-mutations.ts`**

In `packages/schedule/src/use-grid-mutations.ts`, update:

Replace:

```typescript
import { malKeys } from "./mal-query-keys";
import { addDays } from "./mal-types";
```

With:

```typescript
import { gridKeys } from "./grid-query-keys";
import { addDays } from "./grid-types";
```

Then find-and-replace all `malKeys.` with `gridKeys.` in the file.

- [ ] **Step 6: Update `index.ts` exports**

Replace the entire content of `packages/schedule/src/index.ts`:

```typescript
export type { MalColumn, MalEmployeeAssignment, MalTask, MalCell, MalGridData } from "./grid-types";
export { cellKey, addDays } from "./grid-types";
export { useMalData } from "./use-week-grid-data";
export { gridKeys } from "./grid-query-keys";
export {
  useFillFromTemplate,
  usePublishWeek,
  useResetWeek,
  useAssignEmployee,
} from "./use-grid-mutations";
```

Note: Export names (`useMalData`, `MalColumn`, etc.) stay unchanged here to avoid breaking consumers. They will be aliased/renamed when the new hook is added in Task 5.

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @smartout/schedule typecheck && pnpm --filter web typecheck`

Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add packages/schedule/src/
git commit -m "$(cat <<'EOF'
refactor(schedule): rename mal-* to grid-* in packages/schedule

File renames: mal-types → grid-types, mal-query-keys → grid-query-keys,
use-mal-data → use-week-grid-data, use-mal-mutations → use-grid-mutations.
Internal imports updated. Export names preserved for compatibility.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Component Renames — `apps/web/`

**Files:**

- Rename: 10 component files in `apps/web/src/app/dashboard/schedule/_components/`
- Modify: `apps/web/src/app/dashboard/schedule/page.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`

- [ ] **Step 1: Rename all 10 component files**

Run:

```bash
COMP="apps/web/src/app/dashboard/schedule/_components" && \
git mv $COMP/mal-grid.tsx $COMP/week-grid.tsx && \
git mv $COMP/mal-command-bar.tsx $COMP/week-grid-command-bar.tsx && \
git mv $COMP/mal-template-bar.tsx $COMP/week-grid-context-bar.tsx && \
git mv $COMP/mal-grid-header.tsx $COMP/week-grid-header.tsx && \
git mv $COMP/mal-grid-row.tsx $COMP/week-grid-row.tsx && \
git mv $COMP/mal-shift-cell.tsx $COMP/week-grid-cell.tsx && \
git mv $COMP/mal-employee-tag.tsx $COMP/shift-employee-tag.tsx && \
git mv $COMP/mal-task-tag.tsx $COMP/shift-task-tag.tsx && \
git mv $COMP/mal-ghost-tag.tsx $COMP/shift-ghost-tag.tsx && \
git mv $COMP/mal-empty-state.tsx $COMP/week-grid-empty-state.tsx
```

- [ ] **Step 2: Update all internal imports in renamed files**

In each renamed file, update import paths. The pattern is:

- `./mal-grid-header` → `./week-grid-header`
- `./mal-grid-row` → `./week-grid-row`
- `./mal-shift-cell` → `./week-grid-cell`
- `./mal-employee-tag` → `./shift-employee-tag`
- `./mal-task-tag` → `./shift-task-tag`
- `./mal-ghost-tag` → `./shift-ghost-tag`
- `./mal-command-bar` → `./week-grid-command-bar`
- `./mal-template-bar` → `./week-grid-context-bar`
- `./mal-empty-state` → `./week-grid-empty-state`

Files that need internal import updates:

- `week-grid.tsx` (imports MalCommandBar, MalTemplateBar, MalGridHeader, MalGridRow, MalEmptyState, CreateTemplateDialog)
- `week-grid-row.tsx` (imports MalShiftCell)
- `week-grid-cell.tsx` (imports MalEmployeeTag, MalTaskTag, MalGhostTag)

- [ ] **Step 3: Update `page.tsx` import and layout branch**

In `apps/web/src/app/dashboard/schedule/page.tsx`:

Replace line ~39:

```typescript
import { MalGrid } from "./_components/mal-grid";
```

With:

```typescript
import { MalGrid } from "./_components/week-grid";
```

Replace line ~972:

```typescript
{scheduleLayout === "mal" && (
```

With:

```typescript
{scheduleLayout === "grid" && (
```

Replace line ~982:

```typescript
{scheduleLayout !== "mal" && (
```

With:

```typescript
{scheduleLayout !== "grid" && (
```

Note: The component is still exported as `MalGrid` from `week-grid.tsx` — the function name will be changed in Task 6.

- [ ] **Step 4: Update `DashboardShell.tsx`**

In `apps/web/src/components/dashboard/DashboardShell.tsx`:

Replace line 66:

```typescript
export type ScheduleLayoutMode = "daily" | "weekly" | "monthly" | "list" | "mal";
```

With:

```typescript
export type ScheduleLayoutMode = "daily" | "weekly" | "monthly" | "list" | "grid";
```

Replace the Mal tab button (~line 1682):

```typescript
<button
  onClick={() => setScheduleLayout("mal")}
  data-autoplay="schedule-layout-mal"
  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${scheduleLayout === "mal" ? "border border-orange-500/30 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]" : isDark ? "text-zinc-500 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}
>
  Mal
</button>
```

With:

```typescript
<button
  onClick={() => setScheduleLayout("grid")}
  data-autoplay="schedule-layout-grid"
  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${scheduleLayout === "grid" ? "border border-orange-500/30 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]" : isDark ? "text-zinc-500 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}
>
  Vaktgrid
</button>
```

- [ ] **Step 5: Search for any other `"mal"` references**

Run: `grep -rn '"mal"' apps/web/src/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v '.d.ts'`

Fix any remaining `"mal"` string references to `"grid"`.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter web typecheck`

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/ apps/web/src/components/
git commit -m "$(cat <<'EOF'
refactor(schedule): rename mal-* components to week-grid-*

10 component files renamed. ScheduleLayoutMode: "mal" → "grid".
Tab button updated. All internal imports updated.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Telemetry — Register New Events

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add 3 event interfaces**

In `packages/telemetry/src/registry.ts`, after the `ShiftUnassigned` interface (~line 891), add:

```typescript
export interface ShiftTypeConfigCreated extends BaseEvent {
  event: "shift_type_config created";
  properties: {
    entity: EntityRef;
    data: {
      department_id: string;
      shift_type_id: string;
      label: string;
      start_time: string;
      end_time: string;
      slot_count: number;
    };
  };
}

export interface ShiftTypeConfigUpdated extends BaseEvent {
  event: "shift_type_config updated";
  properties: {
    entity: EntityRef;
    data: {
      department_id: string;
      shift_type_id: string;
      changes: Record<string, unknown>;
    };
  };
}

export interface ShiftTypeConfigRemoved extends BaseEvent {
  event: "shift_type_config removed";
  properties: {
    entity: EntityRef;
    data: {
      department_id: string;
      shift_type_id: string;
      label: string;
    };
  };
}
```

- [ ] **Step 2: Add events to the registry map**

In the registry map object (in the scheduling category section, after `"shift unassigned"`), add:

```typescript
"shift_type_config created": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "scheduling",
},
"shift_type_config updated": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "scheduling",
},
"shift_type_config removed": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "scheduling",
},
```

- [ ] **Step 3: Add to SmartoutEvent union**

In the `SmartoutEvent` type union (~line 1808), add:

```typescript
| ShiftTypeConfigCreated
| ShiftTypeConfigUpdated
| ShiftTypeConfigRemoved
```

- [ ] **Step 4: Typecheck telemetry**

Run: `pnpm --filter @smartout/telemetry typecheck`

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "$(cat <<'EOF'
feat(telemetry): register shift_type_config CRUD events

3 new events for department shift type config management.
All route to posthog, logger, activity_trail.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: New Data Hook — `useWeekGridData`

This is the core behavior change. The new hook reads from `department_shift_type_config` instead of templates.

**Files:**

- Modify: `packages/schedule/src/grid-types.ts` (add new types alongside old ones)
- Modify: `packages/schedule/src/use-week-grid-data.ts` (rewrite)
- Modify: `packages/schedule/src/index.ts` (add new exports)

- [ ] **Step 1: Add new types to `grid-types.ts`**

Append to `packages/schedule/src/grid-types.ts` (keep existing `Mal*` types for backward compat):

```typescript
// ── New grid-first types (week-grid redesign) ──────────────

export type GridColumn = {
  configId: string;
  shiftTypeId: string;
  shiftTypeName: string;
  shiftTypeColor: string | null;
  label: string;
  startTime: string;
  endTime: string;
  workHours: number;
  breakMinutes: number;
  slotCount: number;
  sortOrder: number;
  departmentId: string;
  departmentName: string;
};

export type GridCell = {
  dayIndex: number;
  dateId: string;
  configId: string;
  assignments: MalEmployeeAssignment[];
  tasks: MalTask[];
  emptySlots: number;
};

export type GridStats = {
  totalSlots: number;
  filledSlots: number;
  totalHours: number;
  estimatedCost: number;
  taskCount: number;
  swapRequests: number;
  emptySlots: number;
};

export type DayInfo = {
  index: number;
  dateId: string;
  label: string;
  shortLabel: string;
  isWeekend: boolean;
};

export type WeekGridData = {
  columns: GridColumn[];
  cells: Map<string, GridCell>;
  weekDays: DayInfo[];
  stats: GridStats;
};

/** Cell key for grid lookup: `${dateId}::${configId}` */
export function gridCellKey(dateId: string, configId: string): string {
  return `${dateId}::${configId}`;
}
```

- [ ] **Step 2: Rewrite `use-week-grid-data.ts`**

Replace the entire content of `packages/schedule/src/use-week-grid-data.ts`:

```typescript
"use client";

/**
 * Data hook for the week-first schedule grid.
 * Reads columns from department_shift_type_config (D1),
 * matches shifts via shift_type_id, and builds WeekGridData.
 *
 * When departmentName is "Alle avdelinger", all departments are included.
 * Columns carry departmentId + departmentName for group headers.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

import type {
  GridColumn,
  GridCell,
  WeekGridData,
  GridStats,
  DayInfo,
  MalEmployeeAssignment,
  MalTask,
} from "./grid-types";
import { gridCellKey, addDays } from "./grid-types";
import { gridKeys } from "./grid-query-keys";

// Also re-export the old hook for backward compat during transition
export { useMalData } from "./use-week-grid-data-legacy";

const DAY_LABELS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
const DAY_SHORT = ["MAN", "TIR", "ONS", "TOR", "FRE", "LØR", "SØN"];
const ALL_DEPARTMENTS = "Alle avdelinger";

const AVATAR_COLORS = ["blue", "emerald", "purple", "orange", "pink", "cyan"] as const;

function avatarColor(id: string): string {
  let hash = 0;
  for (const c of id) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

function calcWorkHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let startMin = (sh ?? 0) * 60 + (sm ?? 0);
  let endMin = (eh ?? 0) * 60 + (em ?? 0);
  if (endMin <= startMin) endMin += 24 * 60;
  return Math.max(0, (endMin - startMin) / 60);
}

export function useWeekGridData(params: {
  workspaceId: string;
  departmentName: string;
  weekStart: string;
  showTasks: boolean;
}) {
  const { workspaceId, departmentName, weekStart, showTasks } = params;
  const supabase = createClient();
  const isAllDepts = departmentName === ALL_DEPARTMENTS;

  // Step 1: Resolve department(s)
  const deptQuery = useQuery({
    queryKey: gridKeys.department(workspaceId, departmentName),
    enabled: !!workspaceId && !!departmentName,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (isAllDepts) {
        const { data, error } = await supabase
          .from("department")
          .select("department_id, name")
          .eq("workspace_id", workspaceId)
          .order("name");
        if (error) throw error;
        return data.map((d) => ({ id: d.department_id, name: d.name }));
      }
      const { data, error } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspaceId)
        .eq("name", departmentName)
        .single();
      if (error) throw error;
      return [{ id: data.department_id, name: data.name }];
    },
  });

  const departments = deptQuery.data ?? [];
  const departmentIds = departments.map((d) => d.id);
  const departmentId = departmentIds[0] ?? null;

  // Step 2: Fetch shift type configs for resolved departments
  const configQuery = useQuery({
    queryKey: gridKeys.configs(workspaceId, departmentIds.join(",")),
    enabled: departmentIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_shift_type_config")
        .select(
          `
          id,
          department_id,
          shift_type_id,
          label,
          default_start_time,
          default_end_time,
          default_break_minutes,
          slot_count,
          sort_order,
          is_active,
          shift_type:shift_type_id (
            name,
            color,
            rate_adjustment_value
          )
        `,
        )
        .in("department_id", departmentIds)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // Step 3: Fetch schedule_shift rows for the week
  const weekEnd = addDays(weekStart, 6);
  const shiftQuery = useQuery({
    queryKey: gridKeys.shifts(workspaceId, weekStart, departmentIds.join(",")),
    enabled: departmentIds.length > 0,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_shift")
        .select(
          `
          schedule_shift_id,
          shift_date,
          shift_type_id,
          employee_id,
          start_time,
          end_time,
          status,
          department_id,
          profile:employee_id (
            first_name,
            last_name
          )
        `,
        )
        .in("department_id", departmentIds)
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd);
      if (error) throw error;
      return data;
    },
  });

  // Step 4: Fetch tasks if needed
  const taskQuery = useQuery({
    queryKey: gridKeys.tasks(workspaceId, weekStart, departmentIds.join(",")),
    enabled: showTasks && departmentIds.length > 0,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_task")
        .select(
          `
          session_task_id,
          title,
          status,
          department_session!inner (
            session_date,
            department_id
          )
        `,
        )
        .in("department_session.department_id", departmentIds)
        .gte("department_session.session_date", weekStart)
        .lte("department_session.session_date", weekEnd);
      if (error) throw error;
      return data;
    },
  });

  // Build WeekGridData from resolved queries
  const isLoading = deptQuery.isLoading || configQuery.isLoading || shiftQuery.isLoading;
  const error = deptQuery.error || configQuery.error || shiftQuery.error;

  let data: WeekGridData | null = null;

  if (configQuery.data && shiftQuery.data) {
    const configs = configQuery.data;
    const shifts = shiftQuery.data;
    const tasks = taskQuery.data ?? [];

    // Build columns
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));
    const columns: GridColumn[] = configs.map((c) => {
      const st = c.shift_type as unknown as {
        name: string;
        color: string | null;
        rate_adjustment_value: number | null;
      } | null;
      return {
        configId: c.id,
        shiftTypeId: c.shift_type_id,
        shiftTypeName: st?.name ?? c.label,
        shiftTypeColor: st?.color ?? null,
        label: c.label,
        startTime: c.default_start_time,
        endTime: c.default_end_time,
        workHours: calcWorkHours(c.default_start_time, c.default_end_time),
        breakMinutes: c.default_break_minutes,
        slotCount: c.slot_count,
        sortOrder: c.sort_order,
        departmentId: c.department_id,
        departmentName: deptMap.get(c.department_id) ?? "",
      };
    });

    // Build week days
    const weekDays: DayInfo[] = Array.from({ length: 7 }, (_, i) => {
      const dateId = addDays(weekStart, i);
      const dayOfWeek = new Date(dateId + "T00:00:00").getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      return {
        index: i,
        dateId,
        label: DAY_LABELS[i] ?? "",
        shortLabel: DAY_SHORT[i] ?? "",
        isWeekend,
      };
    });

    // Initialize cells
    const cells = new Map<string, GridCell>();
    for (const day of weekDays) {
      for (const col of columns) {
        const key = gridCellKey(day.dateId, col.configId);
        cells.set(key, {
          dayIndex: day.index,
          dateId: day.dateId,
          configId: col.configId,
          assignments: [],
          tasks: [],
          emptySlots: col.slotCount,
        });
      }
    }

    // Populate cells with shifts
    const configByShiftType = new Map<string, GridColumn>();
    for (const col of columns) {
      configByShiftType.set(col.shiftTypeId, col);
    }

    const overflowShifts: typeof shifts = [];

    for (const shift of shifts) {
      const col = shift.shift_type_id ? configByShiftType.get(shift.shift_type_id) : null;
      if (!col) {
        overflowShifts.push(shift);
        continue;
      }
      const key = gridCellKey(shift.shift_date, col.configId);
      const cell = cells.get(key);
      if (!cell) continue;

      const profile = shift.profile as unknown as {
        first_name: string | null;
        last_name: string | null;
      } | null;
      const firstName = profile?.first_name ?? "";
      const lastName = profile?.last_name ?? "";
      const name = `${firstName} ${lastName.charAt(0) || ""}`.trim() || "Ikke tilordnet";
      const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "??";

      cell.assignments.push({
        shiftId: shift.schedule_shift_id,
        employeeId: shift.employee_id ?? "",
        employeeName: name,
        avatarColor: avatarColor(shift.employee_id ?? shift.schedule_shift_id),
        initials,
        status: (shift.status as MalEmployeeAssignment["status"]) ?? "created",
        hasSwapRequest: false,
        hasUnreadMessage: false,
      });
      cell.emptySlots = Math.max(0, col.slotCount - cell.assignments.length);
    }

    // Populate tasks into first column per department per day
    for (const task of tasks) {
      const session = task.department_session as unknown as {
        session_date: string;
        department_id: string;
      } | null;
      if (!session) continue;

      const firstColForDept = columns.find((c) => c.departmentId === session.department_id);
      if (!firstColForDept) continue;

      const key = gridCellKey(session.session_date, firstColForDept.configId);
      const cell = cells.get(key);
      if (!cell) continue;

      cell.tasks.push({
        taskId: task.session_task_id,
        title: task.title,
        status: (task.status as MalTask["status"]) ?? "pending",
      });
    }

    // Compute stats
    let totalSlots = 0;
    let filledSlots = 0;
    let totalHours = 0;
    let estimatedCost = 0;
    let taskCount = 0;
    let swapRequests = 0;

    for (const col of columns) {
      const st = configs.find((c) => c.id === col.configId)?.shift_type as unknown as {
        rate_adjustment_value: number | null;
      } | null;
      const hourlyRate = st?.rate_adjustment_value ?? 230;
      totalSlots += col.slotCount * 7;
      totalHours += col.workHours * col.slotCount * 7;
      estimatedCost += col.workHours * col.slotCount * 7 * hourlyRate;
    }

    for (const cell of cells.values()) {
      filledSlots += cell.assignments.length;
      taskCount += cell.tasks.length;
      swapRequests += cell.assignments.filter((a) => a.hasSwapRequest).length;
    }

    const stats: GridStats = {
      totalSlots,
      filledSlots,
      totalHours,
      estimatedCost,
      taskCount,
      swapRequests,
      emptySlots: totalSlots - filledSlots,
    };

    data = { columns, cells, weekDays, stats };
  }

  return {
    data,
    isLoading,
    error: error as Error | null,
    departmentId,
    columns: data?.columns ?? [],
  };
}
```

- [ ] **Step 3: Preserve old hook as legacy**

Rename `use-week-grid-data.ts`'s old content: the old `useMalData` function should be kept for backward compat. Before the rewrite in Step 2, copy the original file:

Run:

```bash
cp packages/schedule/src/use-week-grid-data.ts packages/schedule/src/use-week-grid-data-legacy.ts
```

Then in `use-week-grid-data-legacy.ts`, keep only the `useMalData` function and its imports (unchanged). This is temporary — it will be removed when `week-grid.tsx` is updated to use `useWeekGridData`.

- [ ] **Step 4: Update `index.ts` with new exports**

Add to `packages/schedule/src/index.ts`:

```typescript
// New grid-first types and hooks
export type { GridColumn, GridCell, GridStats, DayInfo, WeekGridData } from "./grid-types";
export { gridCellKey } from "./grid-types";
export { useWeekGridData } from "./use-week-grid-data";
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @smartout/schedule typecheck`

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add packages/schedule/src/
git commit -m "$(cat <<'EOF'
feat(schedule): add useWeekGridData hook reading from config table

New hook reads department_shift_type_config for columns and matches
schedule_shift by shift_type_id. No template gate. Old useMalData
preserved as legacy for transition.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire WeekGrid to New Hook

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/week-grid.tsx`
- Modify: `apps/web/src/app/dashboard/schedule/_components/week-grid-header.tsx`
- Modify: `apps/web/src/app/dashboard/schedule/_components/week-grid-row.tsx`
- Modify: `apps/web/src/app/dashboard/schedule/_components/week-grid-cell.tsx`

- [ ] **Step 1: Update `week-grid.tsx` to use `useWeekGridData`**

In `week-grid.tsx`, replace the `useMalData` import and call:

Replace:

```typescript
import { useMalData, useFillFromTemplate, usePublishWeek, useResetWeek } from "@smartout/schedule";
```

With:

```typescript
import {
  useWeekGridData,
  useFillFromTemplate,
  usePublishWeek,
  useResetWeek,
} from "@smartout/schedule";
import type { GridColumn } from "@smartout/schedule";
```

Replace the `useMalData` call:

```typescript
const { data, isLoading, error, templates, departmentId } = useMalData({
  workspaceId: workspace.workspace_id,
  departmentName,
  weekStart: currentWeekStart,
  templateId: searchParams.get("template"),
  showTasks,
});
```

With:

```typescript
const { data, isLoading, error, departmentId } = useWeekGridData({
  workspaceId: workspace.workspace_id,
  departmentName,
  weekStart: currentWeekStart,
  showTasks,
});
```

Remove the `searchParams`/`useSearchParams`/`useRouter` usage for template selection (no longer needed as the grid is template-independent). Remove `handleTemplateChange` callback.

Remove the `MalTemplateBar` render block (the template bar). Replace it with the new context bar (or remove for now and add in Task 7).

Remove the condition `templates.length === 0` that gates `MalEmptyState`. Instead, check `data?.columns.length === 0`:

```typescript
{!isLoading && !error && data && data.columns.length === 0 && (
  <WeekGridEmptyState onCreateShiftType={() => { /* TODO: Task 8 */ }} />
)}
```

The grid render stays the same structurally — it uses `data.columns` and `data.cells` which now come from config instead of templates.

- [ ] **Step 2: Update grid header to use `GridColumn`**

In `week-grid-header.tsx`, update the props type from `MalColumn` to `GridColumn`:

Replace:

```typescript
import type { MalColumn } from "@smartout/schedule";
```

With:

```typescript
import type { GridColumn } from "@smartout/schedule";
```

Update props:

```typescript
type WeekGridHeaderProps = {
  columns: GridColumn[];
  onColumnClick?: (column: GridColumn) => void;
};
```

In the render, replace `column.templateShiftId` with `column.configId`, `column.role` with `column.label`, and use `column.shiftTypeName` for the header text.

- [ ] **Step 3: Update grid row to use `GridCell`**

In `week-grid-row.tsx`, update from `MalColumn`/`MalCell` to `GridColumn`/`GridCell`:

Replace:

```typescript
import type { MalColumn, MalCell } from "@smartout/schedule";
import { cellKey } from "@smartout/schedule";
```

With:

```typescript
import type { GridColumn, GridCell } from "@smartout/schedule";
import { gridCellKey } from "@smartout/schedule";
```

Update the cell lookup key: `cellKey(day.dateId, col.templateShiftId)` → `gridCellKey(day.dateId, col.configId)`

- [ ] **Step 4: Update shift cell**

In `week-grid-cell.tsx`, update props from `MalCell` to `GridCell`. The internal structure is the same — `cell.assignments`, `cell.tasks`, `cell.emptySlots` all exist on both types.

- [ ] **Step 5: Update proposal filtering in `week-grid.tsx`**

The `malProposals` filtering uses `templateShiftId`. Update to check `shiftTypeConfigId` instead (or keep backward compat by checking both):

```typescript
const gridProposals = useMemo(
  () => proposals.filter((p): p is ShiftProposalCreate => p.type === "create"),
  [proposals],
);
```

For now, proposals that lack `shiftTypeConfigId` still show (they will be auto-resolved by role+time matching later in Task 9).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter web typecheck`

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/
git commit -m "$(cat <<'EOF'
feat(schedule): wire week-grid components to useWeekGridData

Grid now reads columns from department_shift_type_config instead of
templates. Template bar removed. Grid always shows the week.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Context Bar (replaces Template Bar)

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/week-grid-context-bar.tsx`
- Modify: `apps/web/src/app/dashboard/schedule/_components/week-grid.tsx`

- [ ] **Step 1: Rewrite `week-grid-context-bar.tsx`**

Replace the template chip selector with a lighter context bar:

```typescript
"use client";

/**
 * WeekGridContextBar — Lightweight stats bar showing live metrics
 * for the current week + template import/export actions.
 */

type WeekGridContextBarProps = {
  stats: {
    slotsPerDay: number;
    hoursPerDay: number;
    costPerDay: number;
  };
  onImportTemplate?: () => void;
  onSaveAsTemplate?: () => void;
};

export function WeekGridContextBar({
  stats,
  onImportTemplate,
  onSaveAsTemplate,
}: WeekGridContextBarProps) {
  return (
    <div className="border-border bg-card/50 relative z-[1] flex items-center gap-2.5 border-b px-4 py-[5px] text-xs">
      <div className="text-muted-foreground flex gap-3 text-[11px]">
        <span>
          Plasser/dag:{" "}
          <strong className="text-foreground font-mono font-bold">{stats.slotsPerDay}</strong>
        </span>
        <span>
          Timer/dag:{" "}
          <strong className="text-foreground font-mono font-bold">{stats.hoursPerDay}t</strong>
        </span>
        <span>
          Kostnad/dag:{" "}
          <strong className="text-foreground font-mono font-bold">
            kr {stats.costPerDay.toLocaleString("nb-NO")}
          </strong>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onImportTemplate}
          className="border-border text-muted-foreground hover:text-foreground cursor-pointer rounded-lg border px-3 py-1 text-[11px] font-bold transition-all"
        >
          Last inn fra mal...
        </button>
        <button
          type="button"
          onClick={onSaveAsTemplate}
          className="text-muted-foreground/60 cursor-pointer text-[11px] font-bold transition-all hover:text-orange-500"
        >
          Lagre som mal
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire context bar in `week-grid.tsx`**

Replace the `MalTemplateBar` render with `WeekGridContextBar`:

```typescript
{data && data.columns.length > 0 && (
  <WeekGridContextBar
    stats={{
      slotsPerDay: data ? Math.round(data.stats.totalSlots / 7) : 0,
      hoursPerDay: data ? Math.round(data.stats.totalHours / 7) : 0,
      costPerDay: data ? Math.round(data.stats.estimatedCost / 7) : 0,
    }}
    onImportTemplate={() => { /* TODO: wire to LoadTemplateSheet */ }}
    onSaveAsTemplate={() => { /* TODO: wire to SaveTemplateDialog */ }}
  />
)}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/week-grid-context-bar.tsx apps/web/src/app/dashboard/schedule/_components/week-grid.tsx
git commit -m "$(cat <<'EOF'
feat(schedule): replace template bar with context bar

Shows live stats (plasser, timer, kostnad per dag) and template
import/export actions as secondary controls.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Action Bar Redesign + "Legg til vakttype"

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/week-grid.tsx`

- [ ] **Step 1: Redesign the action bar section in `week-grid.tsx`**

Replace the current action bar with the three-tier design:

```typescript
{/* Action bar — three tiers of prominence */}
<div className="border-border bg-card flex items-center gap-2 rounded-b-[14px] border-t px-4 py-2">
  {/* Secondary actions — left */}
  <button
    onClick={() => setAddShiftTypeOpen(true)}
    className="border-border bg-card text-foreground hover:bg-muted rounded-[10px] border px-3.5 py-1.5 text-xs font-bold transition-all"
  >
    Legg til vakttype
  </button>

  <button
    disabled
    className="border-border bg-card text-muted-foreground cursor-not-allowed rounded-[10px] border px-3.5 py-1.5 text-xs font-bold opacity-50"
  >
    Opprett turnus
  </button>

  {/* Tertiary actions */}
  <button
    onClick={() => { /* TODO: wire template import */ }}
    className="text-muted-foreground hover:text-foreground rounded-[10px] px-3.5 py-1.5 text-xs font-bold transition-all"
  >
    Last inn fra mal
  </button>

  <div className="flex-1" />

  <button
    onClick={() => {
      if (!departmentId) return;
      resetMutation.mutate(
        { workspaceId: workspace.workspace_id, weekStart: currentWeekStart, templateId: "", departmentId, actorId: profileId ?? "" },
        { onSuccess: () => toast.success("Uke tilbakestilt"), onError: () => toast.error("Kunne ikke tilbakestille") },
      );
    }}
    disabled={resetMutation.isPending}
    className="text-destructive hover:bg-destructive/10 rounded-[10px] px-3.5 py-1.5 text-xs font-bold transition-all disabled:opacity-50"
  >
    Tilbakestill uke
  </button>

  {/* Primary action — right */}
  <button
    onClick={() => {
      if (!departmentId) return;
      publishMutation.mutate(
        { workspaceId: workspace.workspace_id, weekStart: currentWeekStart, templateId: "", departmentId, actorId: profileId ?? "" },
        { onSuccess: () => toast.success("Uke publisert"), onError: () => toast.error("Kunne ikke publisere") },
      );
    }}
    disabled={publishMutation.isPending}
    className="rounded-[10px] border border-orange-500 bg-orange-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all hover:shadow-[0_4px_16px_oklch(0.65_0.22_40/0.3)] disabled:opacity-50"
  >
    Publiser uke {weekLabel.replace("Uke ", "")}
  </button>
</div>
```

- [ ] **Step 2: Add "Legg til vakttype" dialog state**

Add state and a simple dialog for adding a new shift type config. This creates a `department_shift_type_config` row:

```typescript
const [addShiftTypeOpen, setAddShiftTypeOpen] = useState(false);
```

Wire to `CreateTemplateDialog` (already exists) or create a simpler inline dialog. For MVP, reuse the existing dialog pattern.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/week-grid.tsx
git commit -m "$(cat <<'EOF'
feat(schedule): redesign action bar with three-tier prominence

Publiser = primary, Legg til vakttype = secondary,
Last inn fra mal = tertiary. Matches spec hierarchy.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Update `ShiftProposalCreate` Type

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/schedule-types.ts`
- Modify: `apps/web/src/app/dashboard/schedule/_components/week-grid.tsx` (proposal filtering)
- Modify: `apps/web/src/app/dashboard/schedule/_components/week-grid-cell.tsx` (ghost tag props)

- [ ] **Step 1: Update `ShiftProposalCreate` type**

In `schedule-types.ts`, replace `templateShiftId` with `shiftTypeConfigId`:

Replace:

```typescript
/** Links proposal to a MalGrid column. Present when created in mal-modus. */
templateShiftId?: string;
```

With:

```typescript
/** Links proposal to a grid column (department_shift_type_config.id). */
shiftTypeConfigId?: string;
```

- [ ] **Step 2: Update proposal filtering in `week-grid.tsx`**

Update the `proposalsByCell` map to use `shiftTypeConfigId`:

```typescript
const proposalsByCell = useMemo(() => {
  const map = new Map<string, ShiftProposalCreate[]>();
  for (const p of gridProposals) {
    if (!p.shiftTypeConfigId) continue;
    const key = `${p.dateId}::${p.shiftTypeConfigId}`;
    const existing = map.get(key) ?? [];
    existing.push(p);
    map.set(key, existing);
  }
  return map;
}, [gridProposals]);
```

- [ ] **Step 3: Update ghost tag props**

In `shift-ghost-tag.tsx`, update the prop type from `ShiftProposalCreate` — the component reads `proposal.templateShiftId` nowhere (it only reads `proposal.employeeName`, `proposal.role`, `proposal.id`), so this is a no-op change. Verify by searching the file for `templateShiftId`.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web typecheck`

Expected: 0 errors. If other files reference `templateShiftId`, fix them.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/
git commit -m "$(cat <<'EOF'
refactor(schedule): rename templateShiftId to shiftTypeConfigId

Agent proposals now reference department_shift_type_config.id
instead of schedule_template_shift.id.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Empty State Redesign

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/week-grid-empty-state.tsx`

- [ ] **Step 1: Rewrite empty state as invitation zone**

Replace the content of `week-grid-empty-state.tsx`:

```typescript
"use client";

/**
 * WeekGridEmptyState — Shown when a department has zero shift type configs.
 * Renders a unified invitation zone spanning the full grid width.
 */

import { CalendarDays, Sparkles } from "lucide-react";

type WeekGridEmptyStateProps = {
  onCreateShiftType?: () => void;
  onImportTemplate?: () => void;
};

export function WeekGridEmptyState({ onCreateShiftType, onImportTemplate }: WeekGridEmptyStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-8 py-16">
      <div className="border-border flex max-w-md flex-col items-center gap-5 rounded-2xl border border-dashed p-10">
        <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-full">
          <CalendarDays className="text-muted-foreground/60 h-7 w-7" />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-foreground text-sm font-bold">Ingen vakttyper definert</p>
          <p className="text-muted-foreground/60 max-w-xs text-xs">
            Legg til vakttyper for denne avdelingen, eller last inn fra en eksisterende mal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCreateShiftType}
            className="inline-flex items-center gap-2 rounded-[10px] bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all hover:shadow-[0_4px_16px_oklch(0.65_0.22_40/0.3)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Legg til vakttype
          </button>

          <button
            type="button"
            onClick={onImportTemplate}
            className="border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-2 rounded-[10px] border px-4 py-2 text-xs font-bold transition-all"
          >
            Last inn fra mal
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/week-grid-empty-state.tsx
git commit -m "$(cat <<'EOF'
feat(schedule): redesign empty state as invitation zone

Unified dashed area with two CTAs: add shift type (primary)
and import from template (secondary).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Final Typecheck + Cleanup

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`

Expected: 0 errors across all packages

- [ ] **Step 2: Lint**

Run: `pnpm lint`

Expected: 0 errors

- [ ] **Step 3: Remove legacy file if no longer imported**

Check if `use-week-grid-data-legacy.ts` is still imported anywhere:

Run: `grep -rn "use-week-grid-data-legacy" packages/schedule/src/`

If nothing imports it, delete it:

```bash
rm packages/schedule/src/use-week-grid-data-legacy.ts
```

- [ ] **Step 4: Remove old `mal-*` type references from `index.ts`**

If no consumer imports the old `Mal*` types, remove them from `packages/schedule/src/index.ts`.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(schedule): cleanup legacy mal-modus artifacts

Remove use-week-grid-data-legacy.ts and old Mal* type exports.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```
