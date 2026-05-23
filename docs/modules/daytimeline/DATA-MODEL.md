---
title: Day Timeline — Data Model
status: archived
superseded_by: docs/domains/day-session/
updated: 2026-05-18
created: 2026-05-17
module: daytimeline
tags: [module, daytimeline, data-model, schema, d6, area-anchored, tri-layer, adr-0367]
---

> **ARCHIVED 2026-05-22** — This module has been absorbed into `docs/domains/day-session/`. Do not update this file — update the day-session domain spine instead.

# Day Timeline — Data Model

> Every table the Dagslinjen surface reads or writes, with FK map, invariants, and the delta required for location-anchored day_line.

## 1. Tables Today

### 1.1 `department_session` — the line owner (current)

Migration: `supabase/migrations/20260304200000_department_session.sql` + `20260421100350_cascade_a1_alter_existing.sql` + `20260329100000_add_duty_leader.sql`.

| Column | Type | Notes |
|---|---|---|
| `department_session_id` | UUID PK | gen_random_uuid |
| `workspace_id` | UUID NOT NULL FK → workspace | RLS root |
| `department_id` | UUID NOT NULL FK → department | line anchor today |
| `season_id` | UUID FK → season | D4 link |
| `session_date` | DATE NOT NULL | business date |
| `status` | enum `department_session_status` | upcoming/active/closed |
| `opened_at` / `opened_by` | timestamptz / UUID FK profile | lifecycle |
| `closed_at` / `closed_by` | timestamptz / UUID FK profile | lifecycle |
| `duty_leader_profile_id` | UUID FK profile | added migration `20260329100000` |
| `signoff_notes` / `handoff_notes` | TEXT | end-of-day |
| `planned_shifts` / `actual_shifts` | int | metrics |
| `tasks_total` / `tasks_completed` | int | metrics |
| `planned_open` / `planned_close` | TIME nullable | Cascade A1 — resolved from D1 at creation |
| `created_at` / `updated_at` | timestamptz NOT NULL DEFAULT now() | audit |

Constraints:
- `uq_dept_session_date UNIQUE (workspace_id, department_id, session_date)` — one session per dept per day.

Invariants:
- One session per (workspace, dept, date). Multi-location dept = single open/close band today (the bug we are fixing).
- `planned_open` / `planned_close` resolved via `resolve_hours()` from D1 envelope at INSERT time.
- `status` enum drives RLS lock-out via `daily_reconciliation` join.

### 1.2 `session_hook` — routine parent

Migration: `supabase/migrations/20260412100300_session_infrastructure.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK | RLS root |
| `department_id` | UUID NOT NULL FK | dept anchor (NOT location-aware today) |
| `hook_type` | enum `session_hook_type` | opening/closing/scheduled/timer |
| `trigger_offset_min` | int NOT NULL DEFAULT 0 | minutes from session anchor |
| `repeat_interval_min` | int nullable | repeating hooks |
| `linked_procedure_id` | UUID FK procedure | optional |
| `linked_routine_id` | UUID FK routine | optional |
| `is_active` | bool DEFAULT true | soft toggle |

No `location_id` column today. **Gap** — this is the load-bearing reason hooks/oppgaver/notater are not location-merket per the warning banner in `TimelineTab.tsx:238-249`.

### 1.3 `session_task` — single task or routine child

Same migration.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK | RLS root |
| `department_session_id` | UUID NOT NULL FK → department_session | anchor to day |
| `session_hook_id` | UUID nullable FK → session_hook | NULL = single ad-hoc task; non-null = routine child |
| `title` | TEXT NOT NULL | |
| `description` | TEXT | |
| `status` | enum `session_task_status` | pending/available/in_progress/completed/etc. |
| `assigned_to` | UUID FK profile | owner |
| `completed_by` / `completed_at` | UUID FK profile / timestamptz | audit |
| `evidence` | JSONB | photo/text/checkbox |
| `is_compliance_required` | bool DEFAULT false | gates closure |

Indexes:
- `idx_session_task_session_status` on `(department_session_id, status)`
- `idx_session_task_assigned_active` on `(assigned_to, status)` partial WHERE status IN ('pending','available','in_progress')

No `location_id` column today. **Gap** — same.

### 1.4 `schedule_day_task` — ad-hoc per-day-not-per-session task

Migration: `supabase/migrations/20260301600003_schedule_persistence_tables.sql:305`.

Used by managers from the schedule planning surface to drop ad-hoc tasks on a date that may not yet have a session. Part of Task Ontology source `day_ad_hoc` per ADR-0298. Lives in the day-line read RPC `fn_list_my_tasks`.

### 1.5 `schedule_day_booking` — table booking

Same migration line 353. Carries `booking_time`, `guest_count`, optional free-text `location` (not FK), `status`, `is_vip`, `contact_person`. Read by `useDayTimelineEvents` to draw booking markers on the strip.

### 1.6 `schedule_day_info` — day handover

Migration: `20260302152749_add_dashboard_evolution_tables.sql:157`. One row per (workspace, department, date). Holds duty-leader notes, weather, day-level free text. Read by `useDayInfo` (mobile + web).

### 1.7 `deviation` — D6 deviation

Read into the strip as event type `deviation`. Mutated via `report-deviation-action` + `update-deviation-action`. Already gated per `pre-m5-mutation-closure` sortie.

### 1.8 `timeline_template` — saved-timeline (ADR-0335)

| Column | Notes |
|---|---|
| `id`, `workspace_id`, `name`, `notes` | identity + label |
| `scope_type` enum `team \| department \| location \| shift` | polymorphic anchor |
| `scope_id` UUID | validated app-side at save + apply (no FK) |
| `items_json` JSONB | Zod-validated 6-kind discriminated union (`schedule_shift`, `session_hook`, `session_task`, `session_note`, `deviation`, `free_form`) |
| `is_archived` bool | soft-delete |
| `created_by`, `created_at`, `updated_at` | audit |

RLS per ADR-0313: SELECT (workspace member), INSERT (admin), UPDATE (creator or admin).

---

## 2. Tables Adjacent (read-only joins)

| Table | What we read | Where |
|---|---|---|
| `department` | name, color, location_id | strip color, scope filter |
| `location` | location_id, name | scope filter — but NOT yet on session-tied event rows |
| `team` | team_id, name, color | scope filter, owner field |
| `profile` | display_name, role | owner/assignee/duty-leader |
| `schedule_shift` | start_time, end_time, profile_id, position_id, location_id | shift markers (already has `location_id` per Cascade A1) |
| `schedule_absence` | absence_type, period | red-band overlays |
| `department_operating_hours` | open/close per weekday | D1 source for `planned_open`/`planned_close` |
| `daily_reconciliation` | status | lock the day for edits |

---

## 3. Telemetry Events Today

Search `packages/telemetry/src/registry.ts`:

| Event | Source |
|---|---|
| `"task.added_manual"` | AddTaskDialog → addTaskAction (canonical creation event under `task.*` namespace per ADR-0298) |
| `"session_task completed"` | toggle-session-task / complete-session-task |
| `"task.list_mine"` | `task.list_mine` capability tool (read) |
| `"session_hook created"` | (manager-authoring path) |
| `"session_hook deleted"` | (manager-authoring path) |
| `"deviation viewed"` | M5 Sortie 4 — hms/deviations |
| `"deviation reported"` / `"deviation updated"` / `"deviation resolved"` | report-deviation / update-deviation actions |
| `"day_info created"` / `"day_info updated"` / `"day_info deleted"` | DailyNoteSheet + create-day-info-action |
| `"booking created"` | add-booking-action (entity_type: booking → schedule_day_booking) |

All routed through `EVENT_ROUTING` to: PostHog (analytics), Logger (stdout), `activity_trail` (audit), `engine_event` (workflow). Per the registry-recurrence pattern documented in MEMORY, every new event MUST be added to both the `SmartoutEvent` union and `EVENT_ROUTING` map (catches one builder per sortie).

---

## 4. RLS Today

| Table | JWT SELECT | JWT WRITE |
|---|---|---|
| `department_session` | workspace member | manager+ (insert) / admin+ (close) |
| `session_hook` | workspace member | admin+ |
| `session_task` | workspace member | workspace member (update — for completion) |
| `schedule_day_task` | workspace member | manager+ |
| `schedule_day_booking` | workspace member | manager+ |
| `schedule_day_info` | workspace member | manager+ |
| `deviation` | workspace member | reporter (insert) + manager+ (resolve/escalate via `gate_action`) |
| `timeline_template` | workspace member | admin only (INSERT WITH CHECK), creator-or-admin (UPDATE) |

All policies join through `get_workspace_ids_for_user(auth.uid())`. Service-role policies exist for SECURITY DEFINER paths (RPC writes).

---

## 5. Schema Delta — Tri-Layer Model (ADR-0367)

ADR-0367 introduces **three new tables** (`day_line`, `shift_session`, `shift_session_day_line`), one new junction in core-structure (`department_location`), one new enum pair, and nullable FK additions on existing child tables. Existing `department_session` is untouched. Full schema lives in the spec: `docs/superpowers/specs/2026-05-18-dagslinje-area-anchored-design.md` §4.

### 5.1 New table: `day_line`

```sql
CREATE TABLE public.day_line (
  day_line_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_session_id  UUID NOT NULL REFERENCES department_session(department_session_id) ON DELETE CASCADE,
  department_id          UUID NOT NULL REFERENCES department(department_id),
  location_id            UUID NOT NULL REFERENCES location(location_id) ON DELETE RESTRICT,
  business_date          DATE NOT NULL,
  planned_open           TIME NOT NULL,
  planned_close          TIME NOT NULL,
  source_template_id     UUID REFERENCES timeline_template(id),
  notes                  TEXT,
  status                 day_line_status NOT NULL DEFAULT 'upcoming',
  created_by             UUID REFERENCES profile(profile_id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_day_line UNIQUE (department_session_id, location_id)
);
```

Key facts:
- `department_id` denormalized for filter / RLS performance (resolved from parent session).
- `location_id` is the area anchor (per Core Structure V1 — every `location` is an area).
- `(department_session_id, location_id)` UNIQUE — at most one day_line per (dept-session × area).
- Team is NOT an axis V1 (deferred to later ADR if needed).

### 5.2 New table: `shift_session`

```sql
CREATE TABLE public.shift_session (
  shift_session_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_session_id  UUID NOT NULL REFERENCES department_session(department_session_id),
  -- schedule_shift PK column is `schedule_shift_id` (verified 2026-05-18
  -- against supabase/migrations/20260301300000_schedule_shift_table.sql:45)
  schedule_shift_id      UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  -- schedule_shift assignee column is `employee_id` — mirror that name here
  employee_id            UUID NOT NULL REFERENCES profile(profile_id),
  business_date          DATE NOT NULL,
  location_id            UUID NOT NULL REFERENCES location(location_id),
  department_id          UUID NOT NULL REFERENCES department(department_id),
  status                 shift_session_status NOT NULL DEFAULT 'scheduled',
  clocked_in_at          TIMESTAMPTZ,
  clocked_out_at         TIMESTAMPTZ,
  push_topic             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_shift_session UNIQUE (schedule_shift_id)
);
```

Auto-created by trigger on `schedule_shift` insert/update; lifecycle managed by `shift-lifecycle` capability (existing) extended to flip status + manage push subscription. Trigger skips when `employee_id`, `location_id`, or `shift_date` is NULL (ad-hoc/unassigned shifts).

### 5.3 New junction: `shift_session_day_line`

```sql
CREATE TABLE public.shift_session_day_line (
  shift_session_id  UUID NOT NULL REFERENCES shift_session(shift_session_id) ON DELETE CASCADE,
  day_line_id       UUID NOT NULL REFERENCES day_line(day_line_id) ON DELETE CASCADE,
  PRIMARY KEY (shift_session_id, day_line_id)
);
```

Trigger-populated by joining `(business_date, department_id, location_id)` on insert.

### 5.4 New junction (Core Structure): `department_location`

Lives in the core-structure module conceptually but ships with this migration set:

```sql
CREATE TABLE public.department_location (
  department_id  UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  location_id    UUID NOT NULL REFERENCES location(location_id) ON DELETE CASCADE,
  created_by     UUID REFERENCES profile(profile_id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (department_id, location_id)
);
```

See `docs/domains/core-structure/DATA-MODEL.md` for semantics.

### 5.5 Enums

```sql
CREATE TYPE day_line_status AS ENUM ('upcoming', 'active', 'closed');
CREATE TYPE shift_session_status AS ENUM ('scheduled', 'clocked_in', 'clocked_out', 'cancelled');
```

### 5.6 Child FK additions

`session_hook` is **NOT** in this list. Code-trace 2026-05-18 confirmed `session_hook` is a template per `(workspace_id, department_id, hook_type)` — see `supabase/migrations/20260412100300_session_infrastructure.sql:15-27`. Binding to a single `day_line` would freeze the template against one day, breaking lifecycle-fire semantics. See ADR-0367 Rule 2 (amended).

```sql
-- session_task has department_session_id (NOT NULL FK) per existing schema.
-- Adding day_line_id gives the per-session instance an optional area-anchor.
-- Also add scheduled_at for push-pipeline time-based items (notes, reminders, scheduled tasks).
ALTER TABLE session_task         ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);
ALTER TABLE session_task         ADD COLUMN scheduled_at TIMESTAMPTZ;

-- schedule_day_booking.location is free-text TEXT (not FK).
-- day_line_id added as FK path forward; legacy `.location` retained for one release.
-- Backfill leaves day_line_id NULL — admin re-pins via UI; new INSERTs require non-NULL.
ALTER TABLE schedule_day_booking ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);

ALTER TABLE deviation            ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);
```

Nullable. `NULL` on `session_task.day_line_id` = department-level task (e.g. open/close routine child not pinned to area). `NOT NULL` = area-anchored.

`schedule_day_task` does NOT receive `day_line_id` in V1 — it remains the dept-day-ad-hoc surface per ADR-0298. If V2 requires area-pinning, ALTER then.

### 5.7 Backfill strategy

Phase A migration:
1. For every `department_session` row, pick the dept's first `department_location.location_id` alphabetically (or fall back to first `location` row in workspace if pairing absent).
2. INSERT one `day_line` per session with `is_backfilled=true` flag (temp column dropped after 7 days).
3. `session_task.day_line_id` UPDATE: leave NULL for existing rows; manager pins via UI when ready (existing dept-level tasks render in the dept-level header band, not on a strip).
4. `schedule_day_booking.day_line_id`: leave NULL for all existing rows — `.location` is free-text TEXT (not FK), no auto-resolve possible. New bookings get `day_line_id` set at create time via capability layer.
5. `deviation.day_line_id`: leave NULL on existing rows; pin on new deviations going forward.
6. Admin-override window: 7-day flag period where admin can reseat the backfilled location via UI before flip.

Reversible: `DELETE FROM day_line WHERE is_backfilled=true AND created_at < now() - interval '7 days'` rolls back if needed.

`session_hook` is NOT migrated (template-per-dept, not per-session). Existing hooks continue to fire per the existing engine; the session_tasks they create gain `day_line_id` only when the engine decides to materialize them onto a specific day_line (V1: all areas the dept staffs, fan-out at fire time — design point for Phase B routine engine).

### 5.8 Capability seeds (`engine_authority_config`)

- `day_line.create` (manager+, chat) — capability folder `packages/ai/src/capabilities/day-line/`
- `day_line.add_item` (manager+, chat)
- `day_line.instantiate_template` (manager+, chat)
- `routine.attach_to_line` (manager+, chat)
- `org.update_dept_areas` (admin+, chat)

**Note:** Capability namespace renamed from `timeline.*` → `day_line.*` to avoid collision with existing `packages/ai/src/capabilities/timeline-template/` folder. Telemetry events (§5.9) follow the same namespace.

### 5.9 Telemetry seeds (registry)

Both `SmartoutEvent` union AND `EVENT_ROUTING` map (ADR-0358):
- `"day_line.created"`
- `"day_line.opening_changed"`
- `"day_line.closing_changed"`
- `"day_line_item.added"`
- `"day_line_item.notified"`
- `"shift_session.bound"`
- `"shift_session.clocked_in"`
- `"shift_session.clocked_out"`
- `"routine.attached"`

See [BLUEPRINT.md](./BLUEPRINT.md) for the phased delivery and `docs/superpowers/specs/2026-05-18-dagslinje-area-anchored-design.md` for full spec.

### 5.10 ADR-0367 Council Amendments (post-v1.1, accepted 2026-05-18)

The following amendments were folded into ADR-0367 v1.1 after the Council Phase 5 verdict. This section captures the delta from the original draft spec to the accepted model.

**1. No stored `day_line_status` column.**
The `CREATE TABLE day_line` DDL in §5.1 above shows a `status day_line_status NOT NULL DEFAULT 'upcoming'` column. This is DRAFT notation. **The accepted model per ADR-0367 Rule 1 drops this column.** `day_line_status` is derived at read time from `(parent department_session.status, daily_reconciliation.locked, day_line.cancelled_at)` by the helper at `apps/web/src/lib/cascade/derive-day-line-status.ts`. Follows ADR-0156 precedent — stored status drifts under concurrent writes. The `day_line_status` TYPE may still be created as a Postgres enum for use in read-side computed columns or views, but it is NOT a stored column on `day_line`.

**2. `department_location` RLS dual-auth pattern (ADR-0367 Rule 6 + council must-fix #5).**
`department_location` requires both JWT and API key RLS policies per the workspace dual-auth convention:

```sql
-- JWT path (browser): member read, admin write
CREATE POLICY "department_location_jwt_select" ON department_location
  FOR SELECT TO authenticated
  USING (department_id IN (
    SELECT d.department_id FROM department d
    WHERE d.workspace_id = ANY(get_workspace_ids_for_user(auth.uid()))
  ));

CREATE POLICY "department_location_jwt_insert" ON department_location
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_in_workspace(auth.uid(),
      (SELECT d.workspace_id FROM department d WHERE d.department_id = department_location.department_id))
  );

-- API key path: covered by service-role bypass for capability-layer writes
```

The capability `org.update_dept_areas` writes `department_location` via service-role within `gatedMutation`. Direct browser INSERT is admin-only.

**3. Per-type dispatch table for `day_line.add_item` (council must-fix #6).**
The `add_item` tool routes item creation to the owning capability per `item_type`:

| `item_type` | Owning capability | Method |
|---|---|---|
| `session_task` | `task.create_session` | Pattern B delegation (ADR-0356) |
| `deviation` | `hms.report_deviation` | Pattern B delegation |
| `session_note` | `operations.create_note` | Pattern B delegation |
| `free_form` | `day-line` (internal) | Direct `day_line_item` insert |
| `booking` | DEFERRED V2 | `day_line.add_item` returns NOT_SUPPORTED for `booking` type in V1 |

No direct `session_task.insert()` from `day-line/tools.ts` — all writes go through the owning capability. This is per ADR-0240 (cross-namespace DML prohibition).

**4. `session_hook` UNIQUE constraint (ADR-0367 Rule 1b — Phase A migration gate).**
```sql
ALTER TABLE public.session_hook
  ADD CONSTRAINT uq_session_hook_template
  UNIQUE (workspace_id, department_id, hook_type);
```
Must be applied AFTER any de-duplication backfill. If duplicates exist, the migration `RAISE NOTICE`s per row before attempting constraint addition.

**5. `is_admin_or_manager_in_workspace()` does not exist.**
Verified pre-migration code-trace 2026-05-18. Only `is_admin_in_workspace(uid, wid)` exists with `(uid, wid)` argument order. Phase A migration adds a new helper:
```sql
CREATE OR REPLACE FUNCTION is_manager_or_above_in_workspace(user_id UUID, ws_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profile p
    WHERE p.profile_id = user_id AND p.workspace_id = ws_id
      AND p.role IN ('manager', 'admin', 'owner')
  );
$$ LANGUAGE sql SECURITY DEFINER;
```
Existing `is_admin_in_workspace()` calls keep their `(uid, wid)` order unchanged.

---

## 6. Read RPCs

| RPC | Purpose | File |
|---|---|---|
| `fn_list_my_tasks` | unions session_task + schedule_day_task + personal_task + emma_task (ADR-0298) | migrations under `supabase/migrations/2026051*_fn_list_my_tasks*.sql` |
| `useDayTimelineEvents` (web) | merges all event types into a single `DayEvent[]` for the strip | `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts` |
| `useCalendarItems` (mobile) | reads shifts + bookings + notes for the date | `apps/mobile/src/hooks/queries/use-calendar-items.ts` |

After `day_line` lands, all read paths add `day_line_id` to the projection and group results by line.

---

## 7. Open Questions (resolved by ADR-0367 unless noted)

1. ~~Cascade dimension of `day_line`~~ — **RESOLVED**: D6 Production, child of `department_session`. Not a new dimension.
2. **Backfill primary location** — OPEN. Default per ADR-0367 §5.7: first `department_location` alphabetically with 7-day admin-override window. Will be set during Phase A migration.
3. ~~Concurrent location + team line~~ — **RESOLVED**: team axis dropped V1. Location (area) + department both mandatory. Team may return in V2.
4. ~~Legacy `department_session.uq_dept_session_date`~~ — **RESOLVED**: kept as-is. `day_line` is a child of session, no legacy bridge needed. Session aggregate preserved for payroll + C1.
5. ~~Timeline template `scope_type` widening~~ — **RESOLVED**: `scope_type='location'` already exists in ADR-0335. Templates resolve to day_line at apply-time via `day_line.instantiate_template`. No schema change to `timeline_template`.
6. **Cross-workspace shift** — OPEN. Employee with shifts at multiple workspaces same day? Each workspace owns its own `shift_session` row; no cross-tenant linkage V1. ADR-amendable later.
7. **`notify=false` opt-out on day_line_item** — OPEN. Add column with DEFAULT TRUE; admin UI hides until V2 needs it. Schema-only V1.
