---
title: "Mal-modus — Template-Based Schedule View"
status: draft
created: 2026-03-25
updated: 2026-03-25
module: schedule
tags: [schedule, template, mal-modus, vaktplan, turnus]
---

# Mal-modus — Template-Based Schedule View

## Summary

A new schedule layout mode ("Mal") that flips the grid axis: **days as rows, shift slots as columns**. Each column represents a named shift type (Sous Chef, Kokk, Oppvask, etc.) with fixed times and a defined number of slots. Employees are assigned as inline tags within cells. The view supports both template editing (defining a standard week) and live week planning (filling a specific week from a template).

**Mockup:** `docs/superpowers/mockups/mal-modus.html`

## Problem

The current schedule views (Uke, Rullerende, Måned, Vaktliste) all use employees as the primary axis. This works for dynamic scheduling but is poor for **structured shift operations** where:

- The restaurant has fixed shift types that repeat daily (opening, closing, morning cook, etc.)
- Each shift type needs a defined number of people (1 Sous Chef, 2 Kokker)
- The manager thinks in terms of "which slots are empty" not "which employees have shifts"
- Templates should define the structure; weekly planning fills the people

## Design

### Layout Mode

Add `"mal"` to `ScheduleLayoutMode` in `DashboardShell.tsx:65`:

```typescript
export type ScheduleLayoutMode = "daily" | "weekly" | "monthly" | "list" | "mal";
```

Tab appears as "Mal" in the DashboardShell layout toggle (line ~1660, alongside Uke, Rullerende, Måned, Vaktliste). Uses the same active-state styling pattern (`border border-orange-500/30 bg-orange-500/20 text-orange-400`).

### Grid Structure

```
┌──────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Dag      │ Sous Chef    │ Kokk         │ Kokk Kveld   │ Oppvask      │ Prep         │
│          │ 10:00–22:00  │ 10:00–18:00  │ 15:00–23:00  │ 11:00–19:00  │ 08:00–14:00  │
│          │ 1 plass 12t  │ 2 plasser 8t │ 2 plasser 8t │ 1 plass 8t   │ 1 plass 6t   │
│          │ kr 3 240     │ kr 1 840     │ kr 2 080     │ kr 1 520     │ kr 1 140     │
├──────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ MAN      │ [Erik P. ✓]  │ [Anna O. ✓]  │ [Ida S. ✓]   │ [Jon D. ✓]   │ [Anna O. ✓]  │
│ Mandag   │              │ [Thomas B. ✓]│ [Jonas B. ✓]  │ ☑Varemottak  │              │
├──────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ TIR      │ [Erik P. ✓]  │ [Thomas B. ✓]│ [Anna O. ✓]  │ [Jon D. ⇄💬✓]│ [Thomas B. ✓]│
│ Tirsdag  │              │ [Ida S. 💬✓] │ [Jonas B. ○] │ ⏱Rengj.fryser│              │
├──────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ TOR      │ [Erik P. ○]  │ [Anna O. ○]  │ [Jonas B. ○] │ + Tilordne   │ [Ida S. ○]   │
│ Torsdag  │              │ [Thomas B. ○]│ + Tilordne   │ ⏱Temp.logg   │              │
└──────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

- **Y-axis:** Weekdays (Man–Søn), sticky left column
- **X-axis:** Shift types from the active template, sticky top headers
- **Cells:** Inline employee tags + task tags, flowing as tags (flex-wrap)
- **Empty slots:** Dashed "+ Tilordne" tag, visible on hover

### Column Headers (Shift Types)

Each column header shows:

| Field | Source                                | Example         |
| ----- | ------------------------------------- | --------------- |
| Name  | `schedule_template_shift.role`        | "Sous Chef"     |
| Time  | `start_time` – `end_time`             | "10:00 – 22:00" |
| Slots | `slot_count` (new field)              | "2 plasser"     |
| Hours | Calculated from times                 | "8t"            |
| Cost  | Hours × rate from `tariff_rate_table` | "kr 1 840"      |

**Cost calculation:** Hours × hourly rate resolved from `tariff_rate_table` (D3 Rules dimension). Falls back to workspace average hourly rate from `season_budget.avg_hourly_wage` if no tariff match. Cost is display-only — not persisted, not a C3 Commercial artifact.

Clicking a column header opens the shift type editor (template-level: change times, name, slot count).

### Employee Tags

Compact inline tags with trailing icon indicators:

```
[Avatar Name Icons...]
```

**Icons (trailing, inline):**

| Icon          | Meaning      | CSS variable            | When shown                             |
| ------------- | ------------ | ----------------------- | -------------------------------------- |
| ✓ (checkmark) | Published    | `text-emerald-500`      | Shift status = `published`             |
| ○ (circle)    | Draft        | `text-muted-foreground` | Shift status = `created` or `assigned` |
| ⇄ (arrows)    | Swap request | `text-orange-500`       | Employee requested shift swap          |
| 💬 (chat)     | Message      | `text-blue-500`         | Unread message on this shift           |

Note: `shift_status` enum includes `unpublished` — used by "Tilbakestill uke" to revert published shifts.

Clicking an employee tag opens a shift detail sheet (shadcn `Sheet`) where you can:

- Adjust start/end time for this specific shift (override template)
- View/respond to swap request
- View/send messages
- Remove employee from slot

### Task Tags

Visually distinct from employee tags (bordered, smaller, with task icon):

| Style                    | Meaning        | Example               |
| ------------------------ | -------------- | --------------------- |
| Green border + checkmark | Completed task | "☑ Varemottak"        |
| Orange border + clock    | Pending task   | "⏱ Rengjøring fryser" |

Tasks are queried by first resolving the `department_session` for the given department + date, then fetching `session_task` rows via `department_session_id` FK. Toggle "Oppgaver" in command bar shows/hides them.

All Norwegian UI labels must use i18n keys — no hardcoded strings in TSX.

### Multi-Slot Columns

A shift type can require N people. The `slot_count` field on `schedule_template_shift` defines how many slots exist.

- **Kokk: 2 plasser** → cell shows 2 employee tags (or 1 tag + 1 "Tilordne")
- **Sous Chef: 1 plass** → cell shows 1 employee tag
- Empty slots show as dashed "+ Tilordne" tags

### Command Bar

Mal-modus uses its own `MalCommandBar` component (not extending `PlannerCommandBar`) because the controls differ significantly:

| Control                      | Type                         | Purpose                      |
| ---------------------------- | ---------------------------- | ---------------------------- |
| Department dropdown          | `DepartmentPopover` (reused) | Filter by department         |
| "Vakter" label               | Static                       | View mode indicator          |
| Vakter / Oppgaver toggle     | `toggle-group` (new)         | Show/hide task tags in cells |
| Week navigation (← Uke 14 →) | Buttons + label              | Navigate between weeks       |

**State ownership:** `MalGrid` owns its own `weekOffset` state internally (not shared with other layout modes). The `activeDepartment` name comes from `DashboardContext`. The department UUID is resolved inside `use-mal-data.ts` by querying the `department` table filtered by workspace + name.

### Template Bar

New bar below command bar, visible only in Mal mode:

| Element        | Action                                                    |
| -------------- | --------------------------------------------------------- |
| Template chips | Switch between templates for this department              |
| "+ Ny mal"     | Create new template                                       |
| Meta stats     | "Plasser/dag: 7 · Timer/dag: 50t · Kostnad/dag: kr 9 820" |

**Active template persistence:** Stored as URL search param `?template=<id>` so it survives navigation and refresh. Defaults to the first template for the department if param is absent.

**Empty state:** If a department has no templates, show a centered empty state with "Ingen maler for denne avdelingen" and a primary "+ Opprett mal" button.

### Summary Bar

Bottom bar showing aggregate stats:

| Stat       | Description                               |
| ---------- | ----------------------------------------- |
| Plasser    | Total slots for the week (slots × 7 days) |
| Bemannet   | Filled slots                              |
| Timer      | Total scheduled hours                     |
| Kostnad    | Total labor cost (display-only estimate)  |
| Oppgaver   | Task count (if toggle on)                 |
| Bytter     | Pending swap requests (orange)            |
| Ubemannede | Empty slots (red)                         |

### Action Bar

| Button                        | Action                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| **Publiser uke N** (primary)  | Publish all draft shifts for the week                         |
| Fyll fra mal                  | Populate empty slots from the active template                 |
| Legg til vakttype             | Add a new column (shift type) to the template                 |
| Opprett turnus                | Create a rotation plan from this template (phase 2, disabled) |
| Tilbakestill uke (ghost, red) | Set all shifts for the week to `unpublished` status           |

## Data Model

### Existing tables used

| Table                     | Role                                | Changes                                                                        |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| `schedule_template`       | Template definition per department  | No changes. Filter by `department_id` (FK), fall back to `department` (string) |
| `schedule_template_shift` | Shift types within a template       | **Add `slot_count`** column                                                    |
| `schedule_shift`          | Actual assigned shifts (week-level) | **Add `template_shift_id`** FK                                                 |
| `session_task`            | Tasks linked to department sessions | No changes. Query via `department_session_id` join                             |
| `department_session`      | Session per department per date     | No changes. Used to resolve tasks by date                                      |

### Migration: `schedule_template_shift` — add `slot_count`

```sql
ALTER TABLE schedule_template_shift
ADD COLUMN slot_count integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN schedule_template_shift.slot_count
IS 'Number of employees needed for this shift type per day';
```

### Migration: `schedule_shift` — add `template_shift_id` FK

```sql
ALTER TABLE schedule_shift
ADD COLUMN template_shift_id uuid REFERENCES schedule_template_shift(schedule_template_shift_id) ON DELETE SET NULL;

CREATE INDEX idx_schedule_shift_template_shift ON schedule_shift (template_shift_id)
WHERE template_shift_id IS NOT NULL;

COMMENT ON COLUMN schedule_shift.template_shift_id
IS 'Links this shift to the template shift that generated it. NULL for manually created shifts.';
```

This FK enables:

- Determining which grid column a `schedule_shift` belongs to
- Idempotent "Fyll fra mal" (skip slots already filled for a given template_shift + date)
- Tracing provenance of shifts back to their template origin

RLS note: `schedule_shift` already has workspace-scoped RLS via `department_id`. The new `template_shift_id` column does not change RLS policies. No new RLS needed.

### Data flow

```
schedule_template (per department)
  └── schedule_template_shift[] (columns: Sous Chef, Kokk, etc.)
        ├── role, start_time, end_time, slot_count
        └── Used as column definitions for the grid

schedule_shift (per week, per employee)
  └── template_shift_id FK → identifies which column
  └── employee_id + shift_date → identifies the cell
  └── Can override start_time/end_time from template
  └── Status: created → assigned → published → active → completed | unpublished
```

**"Fyll fra mal"** creates `schedule_shift` rows via Supabase client (JWT RLS path):

1. For each day in the week
2. For each template shift in the active template
3. Count existing shifts with matching `template_shift_id` + `shift_date`
4. For each missing slot (up to `slot_count`), create a `schedule_shift` with status `created`

**"Publiser"** updates status from `created`/`assigned` → `published` and triggers notifications.

**"Tilbakestill uke"** updates all shifts for the week to status `unpublished`.

## Component Architecture

### New files

```
apps/web/src/app/dashboard/schedule/
  _components/
    mal-grid.tsx              — Main grid component (MalGrid), owns weekOffset state
    mal-command-bar.tsx       — Mal-specific command bar (dept, oppgaver toggle, week nav)
    mal-template-bar.tsx      — Template selector bar with chips + meta stats
    mal-grid-header.tsx       — Sticky column headers with shift type info
    mal-grid-row.tsx          — Day row with shift cells
    mal-shift-cell.tsx        — Cell containing employee + task tags
    mal-employee-tag.tsx      — Inline tag with avatar + trailing status/swap/chat icons
    mal-task-tag.tsx          — Task tag with status icon
    mal-empty-state.tsx       — Empty state when no templates exist

packages/schedule/
  src/
    use-mal-data.ts           — Data hook: combines template + shifts + tasks for the grid
    mal-types.ts              — Shared types for Mal-modus (MalColumn, MalCell, etc.)
```

Note: `use-mal-data.ts` and `mal-types.ts` live in `packages/schedule/` (not `apps/web/`) to enable future mobile support per CLAUDE.md mobile parity rule. The `packages/schedule/` package does not exist yet — create it with the standard workspace package structure.

### Integration with existing schedule page

In `schedule/page.tsx`, add alongside existing layout branches:

```tsx
{
  scheduleLayout === "mal" && <MalGrid departmentName={activeDepartment} weekStart={weekStart} />;
}
```

`MalGrid` is self-contained — it resolves `departmentId` from `departmentName` internally and fetches its own data via `use-mal-data.ts`.

### Data hook: `use-mal-data.ts`

Combines three queries in parallel (`Promise.all`):

1. **Template + shifts:** `schedule_template` filtered by department → `schedule_template_shift` for active template
2. **Week shifts:** `schedule_shift` filtered by `shift_date` range + `template_shift_id IN template_shifts`
3. **Week tasks:** `department_session` filtered by department + date range → `session_task` via `department_session_id`

Returns a structured `MalGridData` object with columns, cells, and tasks mapped by day × shift.

### Shared components

Reuses from existing schedule:

- `DepartmentPopover` from `planner-command-bar.tsx`
- `GridSurface` (container — MalGrid renders inside `centerContent`)
- Employee avatar colors from `use-employees.ts`
- Shift status types from `schedule-types.ts`
- shadcn `Sheet` for shift detail view
- shadcn `Popover` for employee picker

## Interactions

| Action               | Result                                                              |
| -------------------- | ------------------------------------------------------------------- |
| Click employee tag   | Opens shift detail sheet (shadcn Sheet: adjust time, swap, message) |
| Click column header  | Opens shift type editor (template-level: name, time, slots, cost)   |
| Click "+ Tilordne"   | Opens employee picker popover (shadcn Popover) for that slot        |
| Click task tag       | Opens task detail                                                   |
| Click "Fyll fra mal" | Generates schedule_shift rows from template (JWT RLS, batch insert) |
| Click "Publiser"     | Publishes all draft shifts, sends notifications                     |
| Toggle "Oppgaver"    | Shows/hides task tags in cells                                      |
| Navigate weeks (← →) | Updates weekOffset, loads different week's data                     |

**Error states:**

| Scenario                               | Behavior                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| No template for department             | Empty state with "Opprett mal" button                                                                                             |
| Template has no shifts                 | Grid shows "Legg til vakttype" prompt                                                                                             |
| "Fyll fra mal" partial failure         | Toast error, already-created shifts remain (idempotent retry)                                                                     |
| Week has shifts from modified template | Grid shows shifts in their original columns; orphaned shifts (template_shift deleted) appear in an "Andre vakter" overflow column |
| Network error on load                  | Standard error boundary with retry                                                                                                |

## Telemetry

Each mutation emits via `@smartout/telemetry`:

| Mutation                  | Event name                        | Destinations                          |
| ------------------------- | --------------------------------- | ------------------------------------- |
| Fyll fra mal              | `schedule.template_applied`       | PostHog, activity_trail               |
| Publiser uke              | `schedule.shifts_published`       | PostHog, activity_trail, engine_event |
| Tilbakestill uke          | `schedule.week_reset`             | PostHog, activity_trail               |
| Legg til vakttype         | `schedule.template_shift_created` | PostHog, activity_trail               |
| Assign employee to slot   | `schedule.shift_assigned`         | PostHog, activity_trail               |
| Remove employee from slot | `schedule.shift_unassigned`       | PostHog, activity_trail               |

New events must be registered in `packages/telemetry/src/registry.ts`.

## AI Council Validation

Validated against 7 restaurant industry personas:

| Persona                | Verdict                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Multi-site Manager     | Needs turnus (phase 2). Template + week-by-week is MVP.                              |
| Back-office Admin      | Audit trail via schedule_shift status + activity_trail. Turnus compliance = phase 2. |
| Consultant             | Correct phasing: templates first, turnus as opt-in.                                  |
| Kitchen Professional   | Grid layout matches mental model. Week navigation is key.                            |
| Entry Worker           | Sees only "Min vaktplan" — backend structure is transparent.                         |
| Low-literacy Worker    | Visual tags with avatars and colors. Minimal text.                                   |
| Sommelier / Specialist | Ad-hoc shifts work alongside template — override times per assignment.               |

## Phases

### Phase 1 (this spec): Mal-modus grid + template editing

- New layout tab "Mal" in DashboardShell
- MalGrid with days × shift types
- Employee tag assignment with status/swap/chat icons
- Task tags with toggle
- "Fyll fra mal" + "Publiser" + "Tilbakestill uke"
- Template bar with template switching + empty state
- 2 migrations: `slot_count` + `template_shift_id`
- `packages/schedule/` with shared data hook + types
- Telemetry events registered

### Phase 2 (future): Turnus — Rotation plans

- "Opprett turnus" creates a `rotation_plan` (N weeks that repeat)
- Rotation plan references N `schedule_template` IDs (uke 1–6)
- Auto-fill future weeks from the rotation
- Legal compliance: drøfting workflow, 14-day notice, audit trail
- Copy turnus between departments/locations
- Drag-and-drop between cells

## Out of Scope

- Drag-and-drop between cells (phase 2)
- Budget integration (D4 cascade) — costs shown are display-only estimates
- Mobile view of Mal-modus (data layer in `packages/` enables future support)
- AI auto-staffing suggestions
