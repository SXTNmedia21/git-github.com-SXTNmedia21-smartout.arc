---
title: "Mal-modus Implementation Plan"
status: draft
created: 2026-03-25
updated: 2026-03-25
module: schedule
tags: [schedule, template, mal-modus, implementation]
---

# Mal-modus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Mal" layout mode to the schedule page that shows days as rows, shift types as columns, with employee tags, task tags, and template management.

**Architecture:** New `MalGrid` component tree renders inside the existing schedule page's `GridSurface`. Data hook lives in `packages/schedule/` for mobile parity. Two DB migrations add `slot_count` and `template_shift_id`. Telemetry events registered for all mutations.

**Tech Stack:** Next.js App Router, TanStack Query v5, Supabase client (JWT RLS), shadcn/ui (Sheet, Popover), Tailwind CSS variables, `@smartout/telemetry`

**Spec:** `docs/superpowers/specs/2026-03-25-mal-modus-schedule-view-design.md`
**Mockup:** `docs/superpowers/mockups/mal-modus.html`

---

## File Map

### New files to create

| File                                                                   | Responsibility                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| `supabase/migrations/20260325120000_mal_modus_slot_count.sql`          | Add `slot_count` to `schedule_template_shift`             |
| `supabase/migrations/20260325120001_mal_modus_template_shift_id.sql`   | Add `template_shift_id` FK to `schedule_shift`            |
| `packages/schedule/package.json`                                       | New package definition                                    |
| `packages/schedule/tsconfig.json`                                      | TypeScript config                                         |
| `packages/schedule/src/index.ts`                                       | Package exports                                           |
| `packages/schedule/src/mal-types.ts`                                   | Shared types: `MalColumn`, `MalCell`, `MalGridData`       |
| `packages/schedule/src/use-mal-data.ts`                                | Data hook: template + shifts + tasks combined             |
| `packages/schedule/src/use-mal-mutations.ts`                           | Mutation hooks: fill, publish, reset, assign              |
| `apps/web/src/app/dashboard/schedule/_components/mal-grid.tsx`         | Main grid container, owns weekOffset state                |
| `apps/web/src/app/dashboard/schedule/_components/mal-command-bar.tsx`  | Command bar with dept dropdown, oppgaver toggle, week nav |
| `apps/web/src/app/dashboard/schedule/_components/mal-template-bar.tsx` | Template selector chips + meta stats                      |
| `apps/web/src/app/dashboard/schedule/_components/mal-grid-header.tsx`  | Sticky column headers with shift type info                |
| `apps/web/src/app/dashboard/schedule/_components/mal-grid-row.tsx`     | Day row with shift cells                                  |
| `apps/web/src/app/dashboard/schedule/_components/mal-shift-cell.tsx`   | Cell with employee + task tags                            |
| `apps/web/src/app/dashboard/schedule/_components/mal-employee-tag.tsx` | Inline tag with avatar + status icons                     |
| `apps/web/src/app/dashboard/schedule/_components/mal-task-tag.tsx`     | Task tag with done/pending state                          |
| `apps/web/src/app/dashboard/schedule/_components/mal-empty-state.tsx`  | Empty state when no templates exist                       |

### Files to modify

| File                                                                      | Change                                     |
| ------------------------------------------------------------------------- | ------------------------------------------ |
| `packages/supabase/src/database.types.ts`                                 | Regenerate after migrations                |
| `apps/web/src/components/dashboard/DashboardShell.tsx:65`                 | Add `"mal"` to `ScheduleLayoutMode`        |
| `apps/web/src/components/dashboard/DashboardShell.tsx:~1660`              | Add "Mal" tab button                       |
| `apps/web/src/app/dashboard/schedule/page.tsx:~977`                       | Add `scheduleLayout === "mal"` branch      |
| `packages/schedule/src/mal-query-keys.ts`                                 | Query key factory for Mal-modus (new file) |
| `apps/web/src/app/dashboard/schedule/_components/planner-command-bar.tsx` | Export `DepartmentPopover`                 |
| `packages/telemetry/src/registry.ts`                                      | Register 6 new schedule events             |

---

## Task 1: Database Migrations

**Files:**

- Create: `supabase/migrations/20260325120000_mal_modus_slot_count.sql`
- Create: `supabase/migrations/20260325120001_mal_modus_template_shift_id.sql`

- [ ] **Step 1: Create slot_count migration**

```sql
-- supabase/migrations/20260325120000_mal_modus_slot_count.sql
ALTER TABLE schedule_template_shift
ADD COLUMN slot_count integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN schedule_template_shift.slot_count
IS 'Number of employees needed for this shift type per day';
```

- [ ] **Step 2: Create template_shift_id migration**

```sql
-- supabase/migrations/20260325120001_mal_modus_template_shift_id.sql
ALTER TABLE schedule_shift
ADD COLUMN template_shift_id uuid REFERENCES schedule_template_shift(schedule_template_shift_id) ON DELETE SET NULL;

CREATE INDEX idx_schedule_shift_template_shift ON schedule_shift (template_shift_id)
WHERE template_shift_id IS NOT NULL;

COMMENT ON COLUMN schedule_shift.template_shift_id
IS 'Links this shift to the template shift that generated it. NULL for manually created shifts.';
```

- [ ] **Step 3: Run migrations against local Supabase**

Run:

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < /home/sxtnl/dev/smartout.ai/supabase/migrations/20260325120000_mal_modus_slot_count.sql
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < /home/sxtnl/dev/smartout.ai/supabase/migrations/20260325120001_mal_modus_template_shift_id.sql
```

Expected: `ALTER TABLE` for both

- [ ] **Step 4: Regenerate types**

Run:

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

Expected: `database.types.ts` now includes `slot_count` on `schedule_template_shift` and `template_shift_id` on `schedule_shift`

- [ ] **Step 5: Verify new columns in generated types**

Run: `grep -n "slot_count\|template_shift_id" packages/supabase/src/database.types.ts`
Expected: Both columns appear in Row, Insert, and Update types

- [ ] **Step 6: Update seed data with slot_count (optional — depends on local seed state)**

Run:

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
UPDATE schedule_template_shift SET slot_count = 2
WHERE role ILIKE '%kokk%' OR role ILIKE '%servit%';
"
```

Note: Uses ILIKE for resilience against exact role string variations. All other rows keep default `slot_count = 1`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260325120000_mal_modus_slot_count.sql supabase/migrations/20260325120001_mal_modus_template_shift_id.sql packages/supabase/src/database.types.ts
git commit -m "feat(schedule): add slot_count and template_shift_id for mal-modus

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: packages/schedule — Shared Types and Package Setup

**Files:**

- Create: `packages/schedule/package.json`
- Create: `packages/schedule/tsconfig.json`
- Create: `packages/schedule/src/index.ts`
- Create: `packages/schedule/src/mal-types.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@smartout/schedule",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist .turbo"
  },
  "dependencies": {
    "@smartout/supabase": "workspace:*",
    "@supabase/supabase-js": "2.49.4"
  },
  "peerDependencies": {
    "@tanstack/react-query": "^5",
    "react": "^18 || ^19"
  },
  "devDependencies": {
    "@smartout/eslint-config": "workspace:^",
    "@smartout/typescript-config": "workspace:*",
    "typescript": "^5.9.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@smartout/typescript-config/react-library.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create mal-types.ts**

```typescript
// packages/schedule/src/mal-types.ts
/**
 * Shared types for the Mal-modus (template-based schedule view).
 * Used by both web and mobile surfaces.
 */

export type MalColumn = {
  templateShiftId: string;
  role: string;
  startTime: string;
  endTime: string;
  workHours: number;
  slotCount: number;
  dayCategory: string;
  indicator: string;
};

export type MalEmployeeAssignment = {
  shiftId: string;
  employeeId: string;
  employeeName: string;
  avatarColor: string;
  initials: string;
  status: "created" | "assigned" | "published" | "active" | "completed" | "unpublished";
  hasSwapRequest: boolean;
  hasUnreadMessage: boolean;
};

export type MalTask = {
  taskId: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
};

export type MalCell = {
  dayIndex: number;
  dateId: string;
  templateShiftId: string;
  assignments: MalEmployeeAssignment[];
  tasks: MalTask[];
  emptySlots: number;
};

export type MalGridData = {
  columns: MalColumn[];
  cells: Map<string, MalCell>;
  weekDays: {
    index: number;
    dateId: string;
    label: string;
    shortLabel: string;
    isWeekend: boolean;
  }[];
  templateId: string;
  templateName: string;
  stats: {
    totalSlots: number;
    filledSlots: number;
    totalHours: number;
    estimatedCost: number;
    taskCount: number;
    swapRequests: number;
    emptySlots: number;
  };
};

/** Key for cell lookup: `${dateId}::${templateShiftId}` */
export function cellKey(dateId: string, templateShiftId: string): string {
  return `${dateId}::${templateShiftId}`;
}
```

- [ ] **Step 4: Create index.ts**

```typescript
// packages/schedule/src/index.ts
export type { MalColumn, MalEmployeeAssignment, MalTask, MalCell, MalGridData } from "./mal-types";
export { cellKey } from "./mal-types";
```

- [ ] **Step 5: Install dependencies**

Run: `pnpm install`
Expected: `@smartout/schedule` appears in the workspace

- [ ] **Step 6: Verify typecheck**

Run: `pnpm --filter @smartout/schedule typecheck`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add packages/schedule/
git commit -m "feat(schedule): create @smartout/schedule package with mal-modus types

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Data Hook — use-mal-data.ts

**Files:**

- Create: `packages/schedule/src/mal-query-keys.ts`
- Create: `packages/schedule/src/use-mal-data.ts`
- Modify: `packages/schedule/src/index.ts`

- [ ] **Step 1: Create mal-query-keys.ts**

Create `packages/schedule/src/mal-query-keys.ts` with the key factory from the hook design (see code block above). Export from `index.ts`.

- [ ] **Step 2: Create use-mal-data.ts**

Create `packages/schedule/src/use-mal-data.ts`. This hook:

1. Resolves departmentId from departmentName
2. Fetches templates for the department
3. Fetches template shifts for the active template
4. Fetches schedule_shift rows for the week matched by template_shift_id
5. Fetches session_tasks via department_session join
6. Returns `MalGridData`

Key implementation notes:

- Use `useQuery` from `@tanstack/react-query`
- Supabase client via `createClient()` from `@smartout/supabase/client`
- Three parallel queries via separate `useQuery` calls (TanStack handles parallelism)
- Employee name/avatar resolved by joining `profile` on `schedule_shift.employee_id`
- Cell key format: `${dateId}::${templateShiftId}`
- `emptySlots` = `slotCount - assignments.length`
- Cost estimate: fetch `season_budget.avg_hourly_wage` for the workspace's active season. If no active season, fall back to `230` (NOK). This avoids hardcoding regulatory rates per CLAUDE.md.
- Query keys: define local key factories inside `packages/schedule/` (do NOT import from `apps/web/`). This keeps the package boundary clean:

```typescript
// packages/schedule/src/mal-query-keys.ts
export const malKeys = {
  department: (workspaceId: string, departmentName: string) =>
    ["schedule", "mal-department", workspaceId, departmentName] as const,
  template: (workspaceId: string, departmentId: string) =>
    ["schedule", "mal-template", workspaceId, departmentId] as const,
  shifts: (workspaceId: string, weekStart: string, templateId: string) =>
    ["schedule", "mal-shifts", workspaceId, weekStart, templateId] as const,
  tasks: (workspaceId: string, weekStart: string, departmentId: string) =>
    ["schedule", "mal-tasks", workspaceId, weekStart, departmentId] as const,
};
```

The hook signature:

```typescript
export function useMalData(params: {
  workspaceId: string;
  departmentName: string;
  weekStart: string;
  templateId: string | null;
  showTasks: boolean;
}): {
  data: MalGridData | null;
  isLoading: boolean;
  error: Error | null;
  templates: { id: string; name: string }[];
  departmentId: string | null;
};
```

- [ ] **Step 3: Export from index.ts**

Add to `packages/schedule/src/index.ts`:

```typescript
export { useMalData } from "./use-mal-data";
```

- [ ] **Step 4: Add @smartout/schedule dependency to apps/web**

Run:

```bash
cd apps/web && pnpm add @smartout/schedule@workspace:*
```

- [ ] **Step 5: Verify typecheck**

Run: `pnpm --filter @smartout/schedule typecheck && pnpm --filter web typecheck`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add packages/schedule/src/ apps/web/package.json pnpm-lock.yaml
git commit -m "feat(schedule): add use-mal-data hook for template grid data

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Mutation Hooks — use-mal-mutations.ts

**Files:**

- Create: `packages/schedule/src/use-mal-mutations.ts`
- Modify: `packages/schedule/src/index.ts`

- [ ] **Step 1: Create use-mal-mutations.ts**

Four mutations, each using `useMutation` from TanStack Query:

**`useFillFromTemplate`** — "Fyll fra mal":

- For each day × template_shift, count existing shifts with matching `template_shift_id + shift_date`
- For missing slots, batch insert `schedule_shift` rows with status `created`
- Emit `"template applied"` telemetry event
- Invalidate `malShifts` query key

**`usePublishWeek`** — "Publiser uke":

- Update all `created`/`assigned` shifts for the week to `published`
- Emit `"shifts published"` telemetry event
- Invalidate `malShifts` query key

**`useResetWeek`** — "Tilbakestill uke":

- Update all shifts for the week to `unpublished`
- Emit `"week reset"` telemetry event
- Invalidate `malShifts` query key

**`useAssignEmployee`** — Assign/remove employee from slot:

- Create or update `schedule_shift` with `employee_id`
- Emit `"shift assigned"` or `"shift unassigned"`
- Invalidate `malShifts` query key

All mutations use Supabase client directly (JWT RLS path). Each mutation accepts query key params for invalidation.

- [ ] **Step 2: Export from index.ts**

```typescript
export {
  useFillFromTemplate,
  usePublishWeek,
  useResetWeek,
  useAssignEmployee,
} from "./use-mal-mutations";
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @smartout/schedule typecheck`

- [ ] **Step 4: Commit**

```bash
git add packages/schedule/src/
git commit -m "feat(schedule): add mal-modus mutation hooks

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Telemetry Events

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Register 6 new events**

Add to the scheduling category in the registry. Follow exact pattern of existing `"template created"` events:

```typescript
// Event metadata — follows existing "entity verb" convention
"template applied": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "scheduling",
},
"shifts published": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "scheduling",
},
"week reset": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "scheduling",
},
"template_shift created": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "scheduling",
},
"shift assigned": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "scheduling",
},
"shift unassigned": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "scheduling",
},
```

Also add corresponding TypeScript event interfaces following the exact pattern of `TemplateCreated`:

```typescript
interface TemplateApplied extends BaseEvent {
  event: "template applied";
  properties: { entity: EntityRef; data: { shift_count: number; week_start: string } };
}
interface ShiftsPublished extends BaseEvent {
  event: "shifts published";
  properties: { entity: EntityRef; data: { shift_count: number; week_start: string } };
}
interface WeekReset extends BaseEvent {
  event: "week reset";
  properties: { entity: EntityRef; data: { shift_count: number; week_start: string } };
}
interface TemplateShiftCreated extends BaseEvent {
  event: "template_shift created";
  properties: { entity: EntityRef; data: { role: string; start_time: string; end_time: string } };
}
interface ShiftAssigned extends BaseEvent {
  event: "shift assigned";
  properties: { entity: EntityRef; data: { employee_id: string } };
}
interface ShiftUnassigned extends BaseEvent {
  event: "shift unassigned";
  properties: { entity: EntityRef; data: { employee_id: string } };
}
```

Add all 6 interfaces to the `SmartoutEvent` discriminated union.

- [ ] **Step 2: Typecheck telemetry**

Run: `pnpm --filter @smartout/telemetry typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register 6 mal-modus schedule events

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Layout Mode + DashboardShell

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`

- [ ] **Step 1: Add "mal" to ScheduleLayoutMode**

At line 65, change:

```typescript
export type ScheduleLayoutMode = "daily" | "weekly" | "monthly" | "list" | "mal";
```

- [ ] **Step 2: Add "Mal" tab button**

At ~line 1684 (after the "Vaktliste" button), add a new button following the exact same pattern:

```tsx
<button
  onClick={() => setScheduleLayout("mal")}
  data-autoplay="schedule-layout-mal"
  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
    scheduleLayout === "mal"
      ? "border border-orange-500/30 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]"
      : isDark
        ? "text-zinc-500 hover:text-white"
        : "text-zinc-500 hover:text-zinc-900"
  }`}
>
  Mal
</button>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(schedule): add 'Mal' layout mode to DashboardShell

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Export DepartmentPopover

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/planner-command-bar.tsx`

- [ ] **Step 1: Export DepartmentPopover**

Change `function DepartmentPopover` to `export function DepartmentPopover` at line ~201.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/planner-command-bar.tsx
git commit -m "refactor(schedule): export DepartmentPopover for reuse in mal-modus

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: UI Components — Atoms (Tags)

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/mal-employee-tag.tsx`
- Create: `apps/web/src/app/dashboard/schedule/_components/mal-task-tag.tsx`

- [ ] **Step 1: Create mal-employee-tag.tsx**

Compact inline tag component. Props: `MalEmployeeAssignment`. Renders:

- Avatar circle (18px, initials, deterministic color)
- Truncated name (max-width 60px)
- Trailing icons: status (published=checkmark/draft=circle), swap (arrows), chat (message bubble)
- Icon opacity 0.6, hover 1.0
- onClick → opens shift detail (callback prop)
- Follows mockup CSS: `border-radius: 8px`, oklch color variants, `transition: all 0.25s cubic-bezier(0.25,0.1,0.25,1)`
- Use Lucide icons: `Check`, `Circle`, `ArrowLeftRight`, `MessageCircle`

Ref mockup: `.tag` class in `docs/superpowers/mockups/mal-modus.html`

- [ ] **Step 2: Create mal-task-tag.tsx**

Task indicator tag. Props: `MalTask`. Renders:

- Leading icon (10px): `CheckCircle` for done, `Clock` for pending
- Task title text (9px, 700 weight)
- Two color states: done (green border/bg), pending (orange border/bg)
- `border-radius: 6px`
- onClick → opens task detail (callback prop)

Ref mockup: `.task-tag` class

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/mal-employee-tag.tsx apps/web/src/app/dashboard/schedule/_components/mal-task-tag.tsx
git commit -m "feat(schedule): add MalEmployeeTag and MalTaskTag components

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: UI Components — Grid Parts

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/mal-shift-cell.tsx`
- Create: `apps/web/src/app/dashboard/schedule/_components/mal-grid-header.tsx`
- Create: `apps/web/src/app/dashboard/schedule/_components/mal-grid-row.tsx`
- Create: `apps/web/src/app/dashboard/schedule/_components/mal-empty-state.tsx`

- [ ] **Step 1: Create mal-shift-cell.tsx**

Grid cell containing tags. Props: `MalCell`, `showTasks`, callbacks. Renders:

- Employee tags (from `assignments`) as inline flex-wrap tags
- Empty slot tags ("+ Tilordne") for `emptySlots` count, opacity 0.3 → 1.0 on cell hover
- Task tags (from `tasks`) if `showTasks` is true
- `min-height: 44px`, `padding: 5px`
- Hover background change
- Click empty slot → employee picker popover (shadcn Popover)

- [ ] **Step 2: Create mal-grid-header.tsx**

Sticky column headers. Props: `MalColumn[]`. Renders:

- CSS Grid row with `position: sticky; top: 0; z-index: 10`
- First cell: "Dag" label, `sticky left: 0; z-index: 12`
- Each shift column: role name (10px, 700, uppercase, letter-spacing 1.5px), time (Geist Mono), badge trio (slots/hours/cost)
- Click → shift type editor (callback prop)

- [ ] **Step 3: Create mal-grid-row.tsx**

Day row component. Props: day info, `MalCell[]` for that day. Renders:

- `display: contents` wrapper (CSS Grid row)
- Day label cell: `sticky left: 0; z-index: 5`, weekend = orange color
- Shift cells via `MalShiftCell` for each column

- [ ] **Step 4: Create mal-empty-state.tsx**

Empty state when no templates exist. Renders:

- Centered layout with muted text and primary button
- "Ingen maler for denne avdelingen"
- "+ Opprett mal" primary button

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/mal-shift-cell.tsx apps/web/src/app/dashboard/schedule/_components/mal-grid-header.tsx apps/web/src/app/dashboard/schedule/_components/mal-grid-row.tsx apps/web/src/app/dashboard/schedule/_components/mal-empty-state.tsx
git commit -m "feat(schedule): add MalShiftCell, MalGridHeader, MalGridRow, MalEmptyState

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: UI Components — Bars

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/mal-command-bar.tsx`
- Create: `apps/web/src/app/dashboard/schedule/_components/mal-template-bar.tsx`

- [ ] **Step 1: Create mal-command-bar.tsx**

Mal-specific command bar. Props: departmentOptions, showTasks toggle, weekOffset nav. Renders:

- Vaktplan title with CalendarDays icon
- DepartmentPopover (imported from planner-command-bar.tsx)
- "Vakter" static label
- Toggle group: Vakter / Oppgaver (both can be on/off)
- Week navigation: ← Uke N → with weekOffset callbacks
- Right side: week label in Geist Mono

- [ ] **Step 2: Create mal-template-bar.tsx**

Template selector. Props: templates list, activeTemplateId, callbacks. Renders:

- "Aktiv mal:" label
- Template chips (active = orange bg/border, inactive = muted)
- "+ Ny mal" dashed button
- Right-aligned meta stats: Plasser/dag, Timer/dag, Kostnad/dag (Geist Mono for numbers)

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/mal-command-bar.tsx apps/web/src/app/dashboard/schedule/_components/mal-template-bar.tsx
git commit -m "feat(schedule): add MalCommandBar and MalTemplateBar

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: MalGrid — Main Container

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/mal-grid.tsx`

- [ ] **Step 1: Create mal-grid.tsx**

Main container component. Props: `departmentName`, `weekStart`. Renders:

- Owns `weekOffset` state (useState, internal to Mal mode)
- Reads `?template=<id>` from URL search params via `useSearchParams()` — requires Suspense boundary at integration point (see Task 12)
- Calls `useMalData()` hook with workspace/department/week/template
- Calls individual mutation hooks: `useFillFromTemplate()`, `usePublishWeek()`, `useResetWeek()`, `useAssignEmployee()` from `@smartout/schedule`
- Renders: `MalCommandBar` → `MalTemplateBar` → CSS Grid (MalGridHeader + MalGridRow × 7) → Summary bar → Action bar
- Grid uses `display: grid; grid-template-columns: 110px repeat(N, 1fr)` where N = columns.length
- Summary bar: Plasser, Bemannet, Timer, Kostnad, Oppgaver, Bytter, Ubemannede
- Action bar: Publiser, Fyll fra mal, Legg til vakttype, Opprett turnus (disabled), Tilbakestill uke
- Loading state: skeleton matching grid shape
- Error state: standard error boundary with retry
- Empty state: `MalEmptyState` when no templates

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/mal-grid.tsx
git commit -m "feat(schedule): add MalGrid main container component

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Integration — Schedule Page

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/page.tsx`

- [ ] **Step 1: Add MalGrid import**

Add at the top of the file with other component imports:

```typescript
import { Suspense } from "react";
import { MalGrid } from "./_components/mal-grid";
```

Note: `Suspense` may already be imported — check before adding duplicate.

- [ ] **Step 2: Add layout branch with Suspense boundary**

After the `scheduleLayout === "list"` block (~line 1020), add:

```tsx
{
  scheduleLayout === "mal" && (
    <Suspense fallback={<div className="bg-muted/20 flex-1 animate-pulse" />}>
      <MalGrid departmentName={activeDepartment} weekStart={weekStart} />
    </Suspense>
  );
}
```

The `Suspense` boundary is required because `MalGrid` uses `useSearchParams()` internally (Next.js App Router requirement).

Note: MalGrid renders inside `GridSurface`'s `centerContent` slot.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

- [ ] **Step 4: Manual test**

Run: `pnpm --filter web dev`
Navigate to `/dashboard/schedule`, click "Mal" tab. Verify:

- Grid renders with template data from seeded `schedule_template` + `schedule_template_shift`
- Department dropdown filters templates
- Week navigation works
- Employee tags show for assigned shifts
- Empty slots show "+ Tilordne" on hover
- "Fyll fra mal" creates shifts
- "Publiser" updates shift status

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/page.tsx
git commit -m "feat(schedule): integrate MalGrid into schedule page

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Final Typecheck + Lint

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: 0 errors across all packages

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(schedule): lint and typecheck fixes for mal-modus

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
