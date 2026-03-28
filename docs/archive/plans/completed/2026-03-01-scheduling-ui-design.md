---
title: Scheduling UI — DB Persistence, Views & AI
status: done
created: 2026-03-01
author: Pontus + Claude
module: MODULE_03
related_adrs: [ADR-0032, ADR-0036]
---

# Scheduling UI — DB Persistence, Views & AI

## Context

The scheduling module has ~6,500 lines of working UI with drag-and-drop, 3 view modes (Ansa/Jobb/Team), shift modals, templates, open shifts, and day operations — all in **local React state** (ADR-0032). The `schedule_shift` table exists in Supabase with full RLS and indexes. The shift-mcp service provides AI agent access.

**Problem:** Shifts don't persist across page reloads. The UI needs fewer clicks for common actions. Multiple planners can't collaborate. No AI assistance.

**Users:** Restaurant managers and department heads — both need speed and overview.

## Design

### Phase 1: DB Persistence + Audit + Realtime

#### 1.1 Server State with TanStack Query

Replace `shifts[]` in the reducer with TanStack Query:

```
schedule-context.tsx (UI-only state: selection, clipboard, modals)
        │
useScheduleQuery()     → fetches shifts for current workspace + date range
useScheduleMutations() → create, update, delete with optimistic updates
        │
        ▼
  Supabase client → schedule_shift table
```

**What stays in the reducer (local-only):**

- `selectedShiftId`, `selectedDayId`, `clipboard`, `selectedDays`
- `createShiftContext`, `absencePopover`
- Templates, messages, tasks, bookings (no DB tables yet)

**What moves to DB:**

- `shifts[]` — full CRUD via `schedule_shift`
- `shiftHistory[]` → replaced by `schedule_shift_audit` table

**Type mapper:** Thin function converting `Shift` (camelCase) ↔ `schedule_shift` (snake_case). Types already map 1:1 by design (ADR-0032).

#### 1.2 Audit Log Table

New table: `schedule_shift_audit`

| Column              | Type                     | Purpose                                                    |
| ------------------- | ------------------------ | ---------------------------------------------------------- |
| `audit_id`          | UUID PK                  | Generated                                                  |
| `workspace_id`      | UUID FK → company        | Workspace isolation                                        |
| `schedule_shift_id` | UUID FK → schedule_shift | The shift that changed                                     |
| `action`            | ENUM (`audit_action`)    | created, updated, deleted, status_changed, assigned, moved |
| `before_state`      | JSONB (nullable)         | Full shift row snapshot before change                      |
| `after_state`       | JSONB (nullable)         | Full shift row snapshot after change                       |
| `changed_fields`    | TEXT[]                   | Which columns changed (quick filtering)                    |
| `actor_id`          | UUID FK → user_identity  | Who made the change                                        |
| `reverted_at`       | TIMESTAMPTZ (nullable)   | If this change was rolled back                             |
| `created_at`        | TIMESTAMPTZ              | Auto-set                                                   |

**Implementation:** Database trigger on `schedule_shift` INSERT/UPDATE/DELETE that captures before/after state automatically. No application-level audit code needed.

**Rollback:** To revert a change:

1. Read `before_state` from audit entry
2. UPDATE `schedule_shift` with the snapshot
3. Mark audit entry with `reverted_at = now()`
4. This UPDATE itself creates a new audit entry (action: 'updated')

Can chain rollbacks to reach any historical state.

**RLS:** Same dual-auth pattern as `schedule_shift`. Read: all workspace members. Write: admin/manager only.

#### 1.3 Supabase Realtime

Subscribe to `schedule_shift` changes filtered by:

- `workspace_id` = current workspace
- `shift_date` within currently viewed date range

When another planner modifies a shift:

- TanStack Query cache invalidation triggers re-render
- Toast: "Anna updated Thursday shifts" (non-blocking)
- Conflict resolution: **last-write-wins** — if you had unsaved changes to the same shift, you get a toast warning showing what changed

Channel pattern: `schedule:{workspace_id}:{week_start}`

---

### Phase 2: Quick Interactions + New Views

#### 2.1 Click-to-Create

Click empty grid cell → shift appears instantly with smart defaults:

- **Time:** Based on `day_category` heuristics (lunch = 10:00-15:00, dinner = 16:00-23:00)
- **Role:** Employee's most common role from last 4 weeks
- **Status:** `created` (unpublished)
- **Indicator:** `blue` (default)

Single click = create. Card appears inline, immediately editable.

#### 2.2 Inline Time Editing

Click on time text ("08:00 - 16:00") on any shift card:

- Time inputs appear in-place (start, end, break)
- Tab between fields
- Enter or blur to save (triggers mutation)
- Escape to cancel
- No modal needed for time-only changes

#### 2.3 Grid View Improvements (existing)

- Existing 3 sub-views: Ansa (employees), Jobb (roles), Team
- Existing period selection: Day, Week, 2-Weeks, Month, Custom
- Add: click-to-create + inline editing from 2.1/2.2
- Add: coverage indicators per column (green/yellow/red)

#### 2.4 Timeline View (new)

| Aspect      | Detail                                          |
| ----------- | ----------------------------------------------- |
| X-axis      | Hours of day (6:00 - 24:00 default, scrollable) |
| Y-axis      | Employees (grouped by department/team)          |
| Shifts      | Horizontal blocks positioned by start/end time  |
| Interaction | Drag block to move time, drag edges to resize   |
| Snap        | 15-minute increments                            |
| Use case    | Fine-tuning daily coverage, seeing overlaps     |

Implementation: CSS Grid with calculated column positions. dnd-kit for drag interactions. Visual overlap detection.

#### 2.5 Calendar Month View (new)

| Aspect   | Detail                                                              |
| -------- | ------------------------------------------------------------------- |
| Layout   | Standard month calendar grid                                        |
| Cells    | Day number + shift count + coverage heatmap color                   |
| Colors   | Green (fully staffed), Yellow (needs attention), Red (understaffed) |
| Click    | Opens day in Grid view                                              |
| Use case | Long-term planning, spotting patterns and gaps                      |

No drag-and-drop in this view — it's read-only overview with navigation.

---

### Phase 3: AI-Assisted Scheduling

#### 3.1 Auto-Fill Suggestions

**Trigger:** "AI Fill Week" button in the command bar.

**Input to AI (via shift-mcp `suggest_shifts` tool — new):**

- Current week's existing shifts (partial schedule)
- Employee availability and absences
- Historical shift patterns (last 4 weeks)
- Position requirements per department (from team/position config)
- Norwegian labor law constraints (11h rest, weekly hour limits)

**Output:** Array of suggested shifts.

**UI:** Ghost cards — dashed border, muted/transparent colors, distinct from real shifts.

- Each ghost card has Accept (checkmark) and Reject (X) buttons
- Batch action: "Accept All" / "Reject All" in command bar
- Accepted → creates real `schedule_shift` with status `created`
- Rejected → removed from UI

#### 3.2 Conflict Warnings

Real-time validation panel (sidebar or bottom strip):

| Warning               | Rule                                             | Visual                        |
| --------------------- | ------------------------------------------------ | ----------------------------- |
| Overtime risk         | > 37.5h/week or approaching limit                | Orange badge on employee row  |
| Rest period violation | < 11h between end of one shift and start of next | Red badge on shift card       |
| Missing coverage      | Position has fewer people than minimum           | Red column highlight in grid  |
| Double-booking        | Same employee, overlapping shift times           | Red badge on both shift cards |
| Consecutive days      | > 6 consecutive work days                        | Orange badge on employee row  |

**Implementation:** Edge Function or client-side computation. Runs on every shift change. Results cached per workspace+week.

---

### Phase 4 (Deferred): Voice/Chat Scheduling

Chat panel using shift-mcp service for natural language commands:

- "Schedule Maria for Thursday evening as Servitør"
- "Who's available Friday lunch?"
- "Swap Anna and Lars on Wednesday"

Confirmation step before persisting. Deferred to after Phases 1-3 are stable.

---

## Tech Choices

| Choice             | Tool                                  | Rationale                                                               |
| ------------------ | ------------------------------------- | ----------------------------------------------------------------------- |
| Server state       | TanStack Query                        | Already in project, optimistic updates, cache invalidation              |
| DnD                | dnd-kit                               | Already in use, mature, accessible                                      |
| Timeline rendering | CSS Grid + dnd-kit                    | Custom gives control over snap/resize behavior                          |
| Realtime           | Supabase Realtime                     | Native to our stack, channel-based filtering                            |
| Audit trigger      | PostgreSQL trigger                    | Application-agnostic, captures all changes including from MCP           |
| AI suggestions     | shift-mcp + new `suggest_shifts` tool | Reuses existing service, adds one tool                                  |
| Conflict checking  | Client-side + Edge Function           | Client for instant feedback, Edge Function for authoritative validation |

## Risks

| Risk                                          | Mitigation                                               |
| --------------------------------------------- | -------------------------------------------------------- |
| Optimistic update conflicts with Realtime     | Last-write-wins + toast. Audit log enables recovery.     |
| Timeline view performance with many employees | Virtualize rows (react-window), limit visible time range |
| AI suggestions quality                        | Ghost card pattern means manager always reviews          |
| Audit table growth                            | Partition by month, retention policy (configurable)      |

## Success Criteria

1. Shifts persist across page reloads
2. Two planners can work on the same week simultaneously
3. Full audit trail with point-in-time rollback
4. Creating a shift takes 1 click (vs. current multiple)
5. Timeline view enables visual time adjustments
6. AI suggestions reduce manual planning time by 50%+
