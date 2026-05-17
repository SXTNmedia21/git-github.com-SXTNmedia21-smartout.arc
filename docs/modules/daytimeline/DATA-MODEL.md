---
title: Day Timeline — Data Model
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: daytimeline
tags: [module, daytimeline, data-model, schema, d6]
---

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

## 5. Schema Delta — Planned (Location-Anchored Day-Line)

Target ADR (TBD) introduces `day_line`:

```sql
CREATE TABLE public.day_line (
  day_line_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  business_date      DATE NOT NULL,
  location_id        UUID NOT NULL REFERENCES location(location_id) ON DELETE RESTRICT,
  department_id      UUID REFERENCES department(department_id) ON DELETE RESTRICT,
  team_id            UUID REFERENCES team(team_id) ON DELETE RESTRICT,
  planned_open       TIME NOT NULL,
  planned_close      TIME NOT NULL,
  status             department_session_status NOT NULL DEFAULT 'upcoming',
  -- Optional bridge to legacy session — drop after migration completes:
  legacy_department_session_id UUID REFERENCES department_session(department_session_id),
  created_by         UUID REFERENCES profile(profile_id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT day_line_dept_xor_team
    CHECK ((department_id IS NULL) <> (team_id IS NULL)),
  CONSTRAINT day_line_unique
    UNIQUE (workspace_id, business_date, location_id, department_id, team_id)
);
```

And **mandatory** new columns:

```sql
ALTER TABLE session_hook ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);
ALTER TABLE session_task ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);
ALTER TABLE schedule_day_task ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);
ALTER TABLE schedule_day_booking ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);
ALTER TABLE deviation ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);
```

Backfill strategy:
- For every existing `department_session` row: insert one `day_line` row with `location_id` = department's primary location, `department_id` = session's department, `team_id = NULL`, `planned_open` / `planned_close` carried over.
- Update child rows (`session_hook`, `session_task`, `deviation`, etc.) to point to the new `day_line_id`.
- Hold `department_session` writable as a legacy bridge for one release; flip RPC writes to `day_line`.

Capability seeds (engine_authority_config):
- `timeline.create_day_line` (manager+, chat)
- `timeline.edit_opening_closing` (manager+, chat)
- `routine.attach_to_line` (manager+, chat)

Telemetry seeds (registry):
- `"day_line created"`
- `"day_line opening_changed"`
- `"day_line closing_changed"`
- `"routine attached"`

See [BLUEPRINT.md](./BLUEPRINT.md) for the phased migration plan.

---

## 6. Read RPCs

| RPC | Purpose | File |
|---|---|---|
| `fn_list_my_tasks` | unions session_task + schedule_day_task + personal_task + emma_task (ADR-0298) | migrations under `supabase/migrations/2026051*_fn_list_my_tasks*.sql` |
| `useDayTimelineEvents` (web) | merges all event types into a single `DayEvent[]` for the strip | `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts` |
| `useCalendarItems` (mobile) | reads shifts + bookings + notes for the date | `apps/mobile/src/hooks/queries/use-calendar-items.ts` |

After `day_line` lands, all read paths add `day_line_id` to the projection and group results by line.

---

## 7. Open Questions

1. **Cascade dimension of `day_line`** — does it count as D6 production (same as `department_session`), or does adding `location_id` push it into a D1/D6 hybrid? Resolve at council.
2. **Backfill primary location** — departments may have multiple locations historically. Pick first location alphabetically vs require admin to assign vs hold backfill until admin tags each dept. Default proposed: first-by-name, with admin override before flip-over.
3. **Concurrent location + team line** — when a team spans multiple locations, do we permit a `team`-anchored line that ignores location? CHECK forces XOR with department; location is mandatory. → Yes, location is mandatory; team is "what subset of profiles", location is "where".
4. **Legacy `department_session.uq_dept_session_date`** — drop after backfill, or keep for one release as guard? Drop, but soft-deprecate the table.
5. **Timeline template `scope_type` widening** — currently `team|department|location|shift`. Do we add `day_line`? Probably no — templates are pre-day artifacts; day_line is per-day. Templates resolve to day_line at apply-time.
