---
title: "Week Grid Schedule Redesign — Grid-First, Templates as Import"
status: draft
created: 2026-03-27
updated: 2026-03-27
module: schedule
tags: [schedule, week-grid, mal-modus, redesign, cascade-d1]
---

# Week Grid Schedule Redesign

## Summary

Redesign the schedule "Mal-modus" from a template-dependent view into a **week-first grid** that always shows the week (Mon–Sun) with shift type columns and day rows. Templates become an optional import/export mechanism, not a prerequisite for the grid to render.

**Council verdict:** APPROVE WITH CHANGES (2026-03-27). All four agents agreed on the fundamental shift. Key discovery: `payroll.shift_type` already exists as workspace-level shift type registry with FK from `schedule_shift`.

## Problem

The current implementation requires a `schedule_template` to exist before the grid renders. Without a template, users see `MalEmptyState` — a dead end. This inverts the mental model: managers think in terms of "which shifts do I need this week," not "which template do I want to load."

The grid IS the weekly schedule. Templates are a convenience shortcut.

## Architecture

### Two-Tier Shift Type Model

| Layer       | Table                                | Cascade Dimension | Purpose                                                                     |
| ----------- | ------------------------------------ | ----------------- | --------------------------------------------------------------------------- |
| Workspace   | `payroll.shift_type`                 | D3 (Rules)        | Shift type registry: name, color, payroll rules. Already exists.            |
| Department  | `department_shift_type_config` (NEW) | D1 (Envelope)     | Which shift types a department uses: default times, slot count, sort order. |
| Week        | `schedule_shift`                     | D6 (Production)   | Actual shifts with employees assigned. Already exists.                      |
| Import tool | `schedule_template` + `_shift`       | Utility           | Saved week setups for import/export. Already exists. Stays as-is.           |

**Data flow:**

```
payroll.shift_type (workspace: "Kokk", "Sous Chef", "Oppvask")
  └── department_shift_type_config (department: "Kjøkken bruker Kokk 10-18, Sous Chef 10-22")
        └── Grid columns derive from here (D1 → UI)
              └── schedule_shift rows fill cells (D6 → UI)
```

### Why Not a New Standalone Table?

`payroll.shift_type` already has `name`, `color`, `sort_order`, `is_active`, `workspace_id`. `schedule_shift.shift_type_id` already FKs to it. Creating a duplicate shift type table would violate the single-source-of-truth principle. Instead, `department_shift_type_config` is a **junction/binding table** that says "this department uses these shift types with these defaults."

## Schema: `department_shift_type_config`

```sql
CREATE TABLE department_shift_type_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id         UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  shift_type_id         UUID NOT NULL REFERENCES payroll.shift_type(id) ON DELETE CASCADE,
  default_start_time    TIME NOT NULL DEFAULT '08:00',
  default_end_time      TIME NOT NULL DEFAULT '16:00',
  default_break_minutes INTEGER NOT NULL DEFAULT 30,
  slot_count            INTEGER NOT NULL DEFAULT 1,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  day_categories        TEXT[] NOT NULL DEFAULT '{weekday,weekend}',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_dept_shift_type UNIQUE (department_id, shift_type_id)
);

-- RLS
ALTER TABLE department_shift_type_config ENABLE ROW LEVEL SECURITY;

-- JWT policy
CREATE POLICY "jwt_read_dept_shift_config" ON department_shift_type_config
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_dept_shift_config" ON department_shift_type_config
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- API key policy
CREATE POLICY "api_key_read_dept_shift_config" ON department_shift_type_config
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Indexes
CREATE INDEX idx_dept_shift_config_dept ON department_shift_type_config (department_id);
CREATE INDEX idx_dept_shift_config_workspace ON department_shift_type_config (workspace_id);

-- Updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON department_shift_type_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE department_shift_type_config IS
  'D1 Operational Envelope: binds workspace-level shift types to departments with default scheduling parameters.';
```

**Schema placement:** `public` — this is D1 structural, alongside `department`, `department_operating_hours`, etc. Not `payroll`-specific.

### Columns Explained

| Column                        | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `shift_type_id`               | FK to `payroll.shift_type` — the "what kind of shift"       |
| `default_start_time/end_time` | Department's typical times for this shift type              |
| `default_break_minutes`       | Default break length                                        |
| `slot_count`                  | How many people needed per day for this shift type          |
| `sort_order`                  | Column display order in the grid                            |
| `day_categories`              | Which day types this applies to (weekday, weekend, holiday) |
| `is_active`                   | Soft-disable without deleting                               |

## Grid Behavior

### Always-Visible Week

The grid renders 7 day rows (Mon–Sun) regardless of state. Columns come from `department_shift_type_config` for the selected department. No template required.

### Column Source

```
Grid opens → fetch department_shift_type_config WHERE department_id = X AND is_active = true
  → columns = configs sorted by sort_order
  → each column header: shift_type.name, config.default_start_time – default_end_time, config.slot_count
```

### Cell Content

```
For each (day, config):
  → fetch schedule_shift WHERE department_id = X AND shift_date = day AND shift_type_id = config.shift_type_id
  → render employee tags for matched shifts
  → empty_slots = config.slot_count - matched_shifts.length
  → render "+ Tilordne" ghost tags for empty slots
```

### Ad-hoc Shifts (Overflow)

`schedule_shift` rows where `shift_type_id` is NULL or doesn't match any active config appear in an "Andre vakter" overflow column at the right edge of the grid.

### Empty Department State

When a department has zero `department_shift_type_config` rows:

- Day labels (Mon–Sun) are always visible, sticky-left
- The grid area shows a unified dashed invitation zone (not 7 separate empty rows)
- Two CTAs: "Legg til vakttype" (primary) and "Last inn fra mal" (secondary)
- Adding the first shift type animates the column in with spring physics

### Week Navigation

Navigating between weeks:

- Columns (from `department_shift_type_config`) stay constant — they are structural
- Cell content (employees, tasks) changes per week
- Animation: columns stable, cell content crossfades

## Templates — Import/Export

Templates remain in the database unchanged. Their role shifts:

| Before (wrong)                       | After (correct)                            |
| ------------------------------------ | ------------------------------------------ |
| Template is required to show grid    | Grid always shows from department config   |
| Template chips in a dedicated bar    | "Last inn fra mal" dropdown in action area |
| "Fyll fra mal" is the primary action | "Fyll fra mal" is a tertiary import action |
| Template defines columns             | Department config defines columns          |

### "Last inn fra mal" Flow

1. User clicks "Last inn fra mal" button
2. Dropdown/sheet shows saved templates for this department
3. Selecting a template: imports template shifts as `schedule_shift` rows for the selected week
4. Existing shifts for the week are preserved (additive, not destructive)
5. New shifts get `template_shift_id` for provenance

### "Lagre uke som mal" Flow

1. User clicks "Lagre som mal"
2. Dialog: enter template name
3. System saves current week's shift configuration as a new `schedule_template` + `schedule_template_shift` rows
4. Optionally includes employee assignments

## UI Changes

### Template Bar → Context Bar

The template bar transforms into a lighter context bar:

- **Left:** Live stats computed from current week: plasser/dag, timer/dag, kostnad/dag
- **Right:** "Last inn fra mal..." (ghost button) + "Lagre som mal" (text-only)
- Styling: `bg-card/50`, toolbar feel, not mode-selector feel

### Action Bar — Three Tiers

| Tier      | Button                    | Style                     |
| --------- | ------------------------- | ------------------------- |
| Primary   | Publiser uke N            | Solid orange, glow shadow |
| Secondary | Legg til vakttype         | Outlined, warm border     |
| Secondary | Opprett turnus (disabled) | Outlined, muted           |
| Tertiary  | Last inn fra mal          | Ghost/text                |
| Tertiary  | Tilbakestill uke          | Ghost, destructive-muted  |

### ScheduleLayoutMode

Remove `"mal"` from the enum. The grid becomes the `"weekly"` view (or a new `"grid"` mode that replaces both old `"weekly"` and `"mal"`). Decision on whether old weekly timeline is removed or kept as alternative is deferred — can coexist during transition.

### Component Renames

| Current                | New                                      |
| ---------------------- | ---------------------------------------- |
| `mal-grid.tsx`         | `week-grid.tsx`                          |
| `mal-command-bar.tsx`  | `week-grid-command-bar.tsx`              |
| `mal-template-bar.tsx` | `week-grid-context-bar.tsx`              |
| `mal-grid-header.tsx`  | `week-grid-header.tsx`                   |
| `mal-grid-row.tsx`     | `week-grid-row.tsx`                      |
| `mal-shift-cell.tsx`   | `week-grid-cell.tsx`                     |
| `mal-employee-tag.tsx` | `shift-employee-tag.tsx`                 |
| `mal-task-tag.tsx`     | `shift-task-tag.tsx`                     |
| `mal-ghost-tag.tsx`    | `shift-ghost-tag.tsx`                    |
| `mal-empty-state.tsx`  | `week-grid-empty-state.tsx`              |
| `MalColumn` type       | `GridColumn`                             |
| `MalCell` type         | `GridCell`                               |
| `MalGridData` type     | `WeekGridData`                           |
| `useMalData`           | `useWeekGridData`                        |
| `useMalMutations`      | stays, but `templateId` becomes optional |

## Data Hook: `useWeekGridData`

Replaces `useMalData`. No template gate.

```typescript
function useWeekGridData(params: {
  workspaceId: string;
  departmentId: string; // resolved, not name
  weekStart: string; // ISO date
  showTasks: boolean;
}): {
  columns: GridColumn[]; // from department_shift_type_config
  cells: Map<string, GridCell>;
  weekDays: DayInfo[];
  stats: GridStats;
  overflowShifts: ScheduleShift[]; // shifts without matching config
  isLoading: boolean;
  error: Error | null;
};
```

**Query strategy:**

1. Fetch `department_shift_type_config` joined with `payroll.shift_type` for columns
2. Fetch `schedule_shift` for the week + department (no template filter)
3. Match shifts to columns via `shift_type_id`
4. Unmatched shifts go to overflow
5. Fetch tasks via `department_session` if `showTasks` is true

**Rate calculation:** Use `payroll.shift_type.rate_adjustment_value` or `employee_payroll_profile` rate instead of hardcoded 230kr.

## Agent Integration

### Proposal Targeting

- `ShiftProposalCreate.templateShiftId` renamed to `shiftTypeConfigId` (optional)
- Voice tool resolves `role + time` to a `department_shift_type_config` entry for precise slot targeting
- Fallback: proposals without `shiftTypeConfigId` are auto-resolved by matching role + time against grid columns

### New Agent Tool: `getGridSlots`

Returns the department's shift type configs and empty slot counts per day for the current week. Enables the agent to propose shifts that fill specific gaps.

## Telemetry

Existing events preserved. New events:

| Event                       | Destinations                    |
| --------------------------- | ------------------------------- |
| `shift_type_config created` | posthog, logger, activity_trail |
| `shift_type_config updated` | posthog, logger, activity_trail |
| `shift_type_config removed` | posthog, logger, activity_trail |

## Migration Strategy

### Backfill Existing Data

For departments that have templates with `schedule_template_shift` rows:

1. For each unique (department, shift type pattern), create a `department_shift_type_config` row
2. Match or create `payroll.shift_type` entries by name + workspace
3. Update existing `schedule_shift` rows: set `shift_type_id` where `template_shift_id` can be traced to a shift type

### Data Preservation

- `schedule_template` and `schedule_template_shift` tables stay unchanged
- `schedule_shift.template_shift_id` stays as provenance FK
- No data is deleted or moved — only new config rows are created

## i18n Fix

All hardcoded Norwegian strings in the grid components must be replaced with i18n keys during this work. This includes day names, button labels, toast messages, and empty state text.

## Phases

### Phase 1: Schema + Data Layer

- Create `department_shift_type_config` table (migration)
- Backfill from existing template data
- New `useWeekGridData` hook in `packages/schedule/`
- Regenerate types

### Phase 2: UI Restructure

- Rename components (`mal-*` → `week-grid-*`)
- Grid renders from `department_shift_type_config` columns
- Template bar → context bar
- Action bar tier redesign
- Empty state redesign
- i18n all strings

### Phase 3: Integration

- `ScheduleLayoutMode` update
- Schedule page integration
- Agent proposal targeting update
- Telemetry events

### Phase 4: Polish

- Week navigation crossfade animation
- Column add/remove spring animation
- Accessibility (ARIA roles on grid)
- Rate lookup from `payroll.shift_type` instead of hardcoded 230kr

## Out of Scope

- Drag-and-drop between cells (future)
- Turnus/rotation plans (future, button disabled)
- Mobile view (data layer enables it, UI deferred)
- Removing old weekly timeline view (can coexist during transition)
- AI auto-staffing suggestions beyond ghost proposals
