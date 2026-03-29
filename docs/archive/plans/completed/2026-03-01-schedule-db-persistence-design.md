---
title: "Design — Schedule DB Persistence with TanStack Query"
status: done
updated: 2026-03-03
created: 2026-03-01
module: schedule
tags: [schedule, persistence, tanstack-query, realtime, audit-log, rollback]
---

# Design — Schedule DB Persistence (Phase 1)

## Summary

Replace the local `useReducer` + Context state management in the schedule module with TanStack Query backed by Supabase. All schedule entities get DB persistence, Supabase Realtime sync, optimistic updates, and a trigger-based audit log with rollback.

## Decisions

| Decision          | Choice                          | Rationale                                                               |
| ----------------- | ------------------------------- | ----------------------------------------------------------------------- |
| Scope             | All entities                    | Shifts, absences, templates, open shifts, day messages, tasks, bookings |
| Architecture      | Full TanStack Query replacement | Single source of truth in query cache. No dual-state coordination.      |
| Data path         | Direct supabase-js              | Client → PostgREST → RLS. No Edge Function gateway for dashboard ops.   |
| Audit log         | Row-level changelog             | DB triggers capture INSERT/UPDATE/DELETE with old/new JSONB.            |
| Realtime scope    | Same workspace + same week      | Channel per workspace+weekStart.                                        |
| Conflict strategy | Last write wins                 | Realtime sync shows other users the updated state.                      |

---

## 1. New Database Tables

### 1.1 schedule_absence

| Column              | Type                | Notes                                                                           |
| ------------------- | ------------------- | ------------------------------------------------------------------------------- |
| schedule_absence_id | UUID PK             |                                                                                 |
| workspace_id        | UUID FK workspace   | NOT NULL                                                                        |
| employee_id         | UUID FK profile     | NOT NULL                                                                        |
| shift_date          | DATE                | NOT NULL                                                                        |
| absence_type        | absence_type enum   | sick_leave, vacation, parental_leave, unpaid_leave, military, training, welfare |
| request_type        | request_type enum   | available, not_available, prefer_not, prefer (nullable)                         |
| reason              | TEXT                | nullable                                                                        |
| start_date          | DATE                | NOT NULL                                                                        |
| end_date            | DATE                | NOT NULL                                                                        |
| is_full_day         | BOOLEAN             | DEFAULT true                                                                    |
| status              | absence_status enum | pending, approved, rejected                                                     |
| created_at          | TIMESTAMPTZ         | DEFAULT now()                                                                   |
| updated_at          | TIMESTAMPTZ         | DEFAULT now()                                                                   |

### 1.2 schedule_template

| Column               | Type              | Notes         |
| -------------------- | ----------------- | ------------- |
| schedule_template_id | UUID PK           |               |
| workspace_id         | UUID FK workspace | NOT NULL      |
| name                 | TEXT              | NOT NULL      |
| department           | TEXT              | NOT NULL      |
| include_assignments  | BOOLEAN           | DEFAULT false |
| created_by           | UUID FK profile   | NOT NULL      |
| created_at           | TIMESTAMPTZ       | DEFAULT now() |
| updated_at           | TIMESTAMPTZ       | DEFAULT now() |

### 1.3 schedule_template_shift

| Column                     | Type                      | Notes                                  |
| -------------------------- | ------------------------- | -------------------------------------- |
| schedule_template_shift_id | UUID PK                   |                                        |
| template_id                | UUID FK schedule_template | NOT NULL, CASCADE                      |
| employee_id                | UUID FK profile           | nullable (only if include_assignments) |
| role                       | TEXT                      | NOT NULL                               |
| start_time                 | TIME                      | NOT NULL                               |
| end_time                   | TIME                      | NOT NULL                               |
| work_hours                 | NUMERIC(4,2)              | calculated                             |
| breaks                     | INTEGER                   | minutes, DEFAULT 0                     |
| day_category               | day_category enum         | NOT NULL                               |
| zone                       | TEXT                      | nullable                               |
| indicator                  | TEXT                      | DEFAULT 'blue'                         |
| notes                      | TEXT                      | nullable                               |

### 1.4 schedule_open_shift

| Column                 | Type              | Notes         |
| ---------------------- | ----------------- | ------------- |
| schedule_open_shift_id | UUID PK           |               |
| workspace_id           | UUID FK workspace | NOT NULL      |
| title                  | TEXT              | NOT NULL      |
| start_time             | TIME              | NOT NULL      |
| end_time               | TIME              | NOT NULL      |
| department             | TEXT              | nullable      |
| role                   | TEXT              | nullable      |
| day_category           | day_category enum | nullable      |
| created_at             | TIMESTAMPTZ       | DEFAULT now() |
| updated_at             | TIMESTAMPTZ       | DEFAULT now() |

### 1.5 schedule_day_message

| Column                  | Type                    | Notes                          |
| ----------------------- | ----------------------- | ------------------------------ |
| schedule_day_message_id | UUID PK                 |                                |
| workspace_id            | UUID FK workspace       | NOT NULL                       |
| shift_date              | DATE                    | NOT NULL                       |
| title                   | TEXT                    | NOT NULL                       |
| content                 | TEXT                    | NOT NULL                       |
| audience                | TEXT                    | 'all', 'leaders', or team name |
| visibility              | message_visibility enum | all_day, until_16, permanent   |
| author_id               | UUID FK profile         | NOT NULL                       |
| is_alert                | BOOLEAN                 | DEFAULT false                  |
| created_at              | TIMESTAMPTZ             | DEFAULT now()                  |
| updated_at              | TIMESTAMPTZ             | DEFAULT now()                  |

### 1.6 schedule_day_task

| Column               | Type              | Notes                                   |
| -------------------- | ----------------- | --------------------------------------- |
| schedule_day_task_id | UUID PK           |                                         |
| workspace_id         | UUID FK workspace | NOT NULL                                |
| shift_date           | DATE              | NOT NULL                                |
| label                | TEXT              | NOT NULL                                |
| task_status          | task_status enum  | Uses existing enum from @smartout/types |
| category             | TEXT              | 'all', 'routine', 'delegated'           |
| assigned_to          | UUID FK profile   | nullable                                |
| completed_at         | TIMESTAMPTZ       | nullable                                |
| highlight            | BOOLEAN           | DEFAULT false                           |
| created_at           | TIMESTAMPTZ       | DEFAULT now()                           |
| updated_at           | TIMESTAMPTZ       | DEFAULT now()                           |

### 1.7 schedule_day_booking

| Column                  | Type                | Notes                         |
| ----------------------- | ------------------- | ----------------------------- |
| schedule_day_booking_id | UUID PK             |                               |
| workspace_id            | UUID FK workspace   | NOT NULL                      |
| shift_date              | DATE                | NOT NULL                      |
| title                   | TEXT                | NOT NULL                      |
| guest_count             | INTEGER             | NOT NULL                      |
| menu                    | TEXT                |                               |
| booking_time            | TIME                | NOT NULL                      |
| location                | TEXT                |                               |
| status                  | booking_status enum | confirmed, pending, cancelled |
| is_vip                  | BOOLEAN             | DEFAULT false                 |
| notes                   | TEXT                | nullable                      |
| contact_person          | TEXT                | nullable                      |
| created_at              | TIMESTAMPTZ         | DEFAULT now()                 |
| updated_at              | TIMESTAMPTZ         | DEFAULT now()                 |

### 1.8 schedule_audit_log

| Column         | Type                       | Notes                         |
| -------------- | -------------------------- | ----------------------------- |
| audit_log_id   | UUID PK                    |                               |
| workspace_id   | UUID NOT NULL FK workspace |                               |
| table_name     | TEXT NOT NULL              | e.g. 'schedule_shift'         |
| row_id         | UUID NOT NULL              | PK of affected row            |
| operation      | audit_operation enum       | INSERT, UPDATE, DELETE        |
| old_data       | JSONB                      | NULL for INSERT               |
| new_data       | JSONB                      | NULL for DELETE               |
| changed_fields | TEXT[]                     | columns changed (UPDATE only) |
| user_id        | UUID FK auth.users         | auth.uid() at time of change  |
| created_at     | TIMESTAMPTZ                | DEFAULT now()                 |

### New Enums

- `absence_status`: pending, approved, rejected
- `booking_status`: confirmed, pending, cancelled
- `message_visibility`: all_day, until_16, permanent
- `audit_operation`: INSERT, UPDATE, DELETE

### RLS Pattern

All 7 new tables + audit log get the same dual-auth pattern as `schedule_shift`:

- JWT read: `workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))`
- JWT write: `is_admin_in_workspace(auth.uid(), workspace_id)`
- API key read/write: `workspace_id = get_api_workspace_id()`
- Audit log: read-only (no direct writes — trigger-only). Rollback via RPC.

### Indexes

Each table gets:

- `idx_{table}_workspace_date` on `(workspace_id, shift_date)` where applicable
- `idx_schedule_audit_log_row` on `(table_name, row_id)` for audit lookups
- `idx_schedule_audit_log_workspace` on `(workspace_id, created_at DESC)` for workspace history

### Audit Trigger

Single function `audit_schedule_changes()` attached to all 7 schedule tables (AFTER INSERT/UPDATE/DELETE). Captures `OLD`/`NEW` as JSONB + `auth.uid()`.

### Rollback RPC

`rollback_audit_entry(p_audit_log_id UUID)` — reverses a single audit entry:

- DELETE → re-INSERT old_data
- UPDATE → UPDATE row back to old_data
- INSERT → DELETE the row
- Creates a new audit entry recording the rollback

Admin-only via `is_admin_in_workspace()` check.

---

## 2. TanStack Query Setup

### Installation

```bash
pnpm --filter web add @tanstack/react-query @tanstack/react-query-devtools
```

### Provider

`QueryClientProvider` wraps `apps/web/src/app/dashboard/layout.tsx` (dashboard-wide, not schedule-specific).

### Query Key Factory

```typescript
// _hooks/schedule-keys.ts
export const scheduleKeys = {
  all: ["schedule"] as const,
  shifts: (wid: string, week: string) => ["schedule", "shifts", wid, week] as const,
  shift: (id: string) => ["schedule", "shift", id] as const,
  absences: (wid: string, week: string) => ["schedule", "absences", wid, week] as const,
  templates: (wid: string) => ["schedule", "templates", wid] as const,
  openShifts: (wid: string) => ["schedule", "open-shifts", wid] as const,
  dayMessages: (wid: string, week: string) => ["schedule", "messages", wid, week] as const,
  dayTasks: (wid: string, week: string) => ["schedule", "tasks", wid, week] as const,
  dayBookings: (wid: string, week: string) => ["schedule", "bookings", wid, week] as const,
  auditLog: (entityId: string) => ["schedule", "audit", entityId] as const,
};
```

### Stale Times

| Query                         | staleTime                        |
| ----------------------------- | -------------------------------- |
| Shifts, absences, day content | 30s (realtime handles freshness) |
| Templates, open shifts        | 5min                             |
| Audit log                     | 1min                             |

---

## 3. Hook Architecture

### File Structure

```
apps/web/src/app/dashboard/schedule/
  _hooks/
    schedule-keys.ts         — query key factory
    schedule-mappers.ts      — DB ↔ frontend type converters
    use-shifts.ts            — useShifts(), useCreateShift(), useUpdateShift(),
                               useDeleteShift(), useMoveShift(), usePublishShifts()
    use-absences.ts          — useAbsences(), useCreateAbsence(), useDeleteAbsence()
    use-templates.ts         — useTemplates(), useSaveTemplate(), useLoadTemplate(),
                               useDeleteTemplate()
    use-open-shifts.ts       — useOpenShifts(), useCreateOpenShift(), useAssignOpenShift()
    use-day-content.ts       — useDayMessages(), useDayTasks(), useDayBookings() + mutations
    use-audit-log.ts         — useAuditLog(entityId), useRollback()
    use-schedule-realtime.ts — realtime subscription management
```

### Mapper Layer

`schedule-mappers.ts` converts between DB snake_case rows and frontend camelCase types:

```typescript
export function fromDbShift(row: DbScheduleShift): Shift { ... }
export function toDbShift(shift: Partial<Shift>): Partial<DbScheduleShift> { ... }
// Same pattern for all entities
```

### Optimistic Update Pattern

Every mutation hook follows the same pattern:

1. `onMutate`: cancel queries → snapshot previous → optimistically update cache
2. `onError`: rollback to snapshot → show error toast
3. `onSettled`: invalidate queries (forces refetch)

### Batch Operations

Batch mutations (publish day, paste day, publish selected days) use a single `useMutation` that:

1. Performs all DB operations in sequence (or via RPC for atomicity)
2. Optimistically updates all affected rows in the cache at once
3. Invalidates the full shifts query on settle

---

## 4. Realtime Sync

### Channel Strategy

One channel per `workspace_id` + `weekStart`. Subscribe on mount/week change, unsubscribe on cleanup.

```
Channel name: schedule:{workspaceId}:{weekStart}
```

### Subscriptions

| Table                | Filter               | Action                    |
| -------------------- | -------------------- | ------------------------- |
| schedule_shift       | workspace_id=eq.{id} | invalidate shifts query   |
| schedule_absence     | workspace_id=eq.{id} | invalidate absences query |
| schedule_day_message | workspace_id=eq.{id} | invalidate messages query |
| schedule_day_task    | workspace_id=eq.{id} | invalidate tasks query    |
| schedule_day_booking | workspace_id=eq.{id} | invalidate bookings query |

Templates and open shifts: separate channel or longer polling (workspace-wide, not week-scoped).

### Self-Change Detection

Skip invalidation when the realtime payload's user matches the current user (optimistic update already applied).

### Supabase Realtime Setup

Requires enabling Realtime on all schedule tables in Supabase dashboard or via migration:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_shift, schedule_absence, ...;
```

---

## 5. UI-Only State

These stay in a lightweight React Context (no DB persistence):

| State              | Purpose                                   |
| ------------------ | ----------------------------------------- |
| selectedShiftId    | Currently selected shift for detail modal |
| selectedDayId      | Currently selected day for day inspector  |
| clipboard          | Copy/paste buffer (ephemeral)             |
| selectedDays       | Batch-selected days for bulk ops          |
| createShiftContext | Pre-fill context for new shift dialog     |
| absencePopover     | Absence popover trigger state             |

New file: `schedule-ui-context.tsx` (~80 lines)

### Computed Values

`useScheduleComputed()` hook derives stats from TanStack Query data:

- `getDayStats(dateId)` — staff count, shift count, costs
- `getEmployeeStats(employeeId)` — total hours, overtime
- `getCoverageForDay(dateId)` — team coverage gaps
- `getStatusSummary()` — draft/published/active counts

---

## 6. Migration Strategy

### Order of Operations

1. Install `@tanstack/react-query` + devtools
2. Add `QueryClientProvider` to dashboard layout
3. Create all new DB tables via migrations
4. Add audit trigger + rollback RPC
5. Enable Realtime on all schedule tables
6. Build `schedule-mappers.ts`
7. Build `schedule-keys.ts`
8. Build hook files (one per entity)
9. Build `use-schedule-realtime.ts`
10. Create `schedule-ui-context.tsx` (UI-only state)
11. Create `useScheduleComputed()` hook
12. Update `page.tsx` — swap `ScheduleProvider` for new providers
13. Update components — swap `dispatch()` for mutation hooks
14. Delete `schedule-context.tsx` (1283 lines)
15. Delete `schedule-data.ts` (dummy data)
16. Regenerate `database.types.ts`

### Component Migration Pattern

```typescript
// Before
const { dispatch } = useSchedule();
dispatch({ type: "UPDATE_SHIFT", payload: { id, changes } });

// After
const updateShift = useUpdateShift();
updateShift.mutate({ id, changes });
```

### What Stays Unchanged

- All visual components (ShiftCard, GridSurface, DayInspector, etc.)
- DnD Kit integration (just calls different mutation)
- Computed value signatures (same return types)
- All component props interfaces

### What Gets Deleted

- `schedule-context.tsx` — entire 1283-line reducer + context
- `schedule-data.ts` — dummy data
- `buildInitialState()` and all legacy mapping functions
- `generateId()` — UUIDs come from database

---

## 7. File Impact Summary

### New Files

| File                                                | Purpose                                         |
| --------------------------------------------------- | ----------------------------------------------- |
| `supabase/migrations/2026030131XXXX_schedule_*.sql` | 6 new tables + audit log + enums + triggers     |
| `_hooks/schedule-keys.ts`                           | Query key factory                               |
| `_hooks/schedule-mappers.ts`                        | DB ↔ frontend type converters                   |
| `_hooks/use-shifts.ts`                              | Shift queries + mutations                       |
| `_hooks/use-absences.ts`                            | Absence queries + mutations                     |
| `_hooks/use-templates.ts`                           | Template queries + mutations                    |
| `_hooks/use-open-shifts.ts`                         | Open shift queries + mutations                  |
| `_hooks/use-day-content.ts`                         | Day messages/tasks/bookings queries + mutations |
| `_hooks/use-audit-log.ts`                           | Audit log queries + rollback                    |
| `_hooks/use-schedule-realtime.ts`                   | Realtime subscriptions                          |
| `_components/schedule-ui-context.tsx`               | UI-only state context                           |
| `_hooks/use-schedule-computed.ts`                   | Derived stats/metrics                           |

### Modified Files

| File                                           | Change                                 |
| ---------------------------------------------- | -------------------------------------- |
| `apps/web/package.json`                        | Add @tanstack/react-query              |
| `apps/web/src/app/dashboard/layout.tsx`        | Add QueryClientProvider                |
| `apps/web/src/app/dashboard/schedule/page.tsx` | Swap provider, update data flow        |
| All schedule `_components/*.tsx`               | Replace dispatch() with mutation hooks |
| `packages/supabase/src/database.types.ts`      | Regenerate after migrations            |

### Deleted Files

| File                               | Reason                           |
| ---------------------------------- | -------------------------------- |
| `_components/schedule-context.tsx` | Replaced by TanStack Query hooks |
| `_components/schedule-data.ts`     | Dummy data no longer needed      |
