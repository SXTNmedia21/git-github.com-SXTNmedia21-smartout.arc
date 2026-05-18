---
title: Dagslinje — Area-Anchored Tri-Layer D6 Design
status: accepted
version: 1.2
updated: 2026-05-18
created: 2026-05-18
module: daytimeline
tags: [spec, dagslinje, day-line, shift-session, d6, area-anchored]
---

**v1.2 (2026-05-18, post-council)** — Council Phase 5 APPROVE WITH CHANGES. 9 must-fix items folded:
1. `day_line_status` enum DROPPED — derive from parent per ADR-0156 (closes L-0064 risk)
2. Tool names BARE per convention (`create`, `add_item`, `instantiate_template`) — NOT dot-prefixed
3. `session_hook` UNIQUE `(workspace_id, department_id, hook_type)` added to Phase A migrations
4. `engine_event.idempotency_key` (existing TEXT + UNIQUE column) used — no new column needed
5. `department_location` RLS + API-key path policies added to Phase A
6. Per-type dispatch table for `day-line.add_item` added at §5.2.1 (cross-namespace per ADR-0240)
7. ADR-0112 intent-enum + system-prompt prose listed as Phase B pre-flight gate (5th recurrence)
8. `session_task.scheduled_at` ALTER kept in scope (push pipeline requires it) — explicit in ADR-0367 Decision Outcome
9. Pattern B audit-symmetry MANDATORY on `task.create_session` extension (cascade ADR-0356 precedent)

**v1.1 (2026-05-18)** — Code-trace amendments: schedule_shift PK + column names, session_hook conceptual model corrected, capability folder renamed `timeline/` → `day-line/`, `is_admin_or_manager_in_workspace` helper added to Phase A migration set, schedule_day_booking backfill caveat documented. See ADR-0367 §Pre-Migration Code-Trace Findings.


# Dagslinje — Area-Anchored Tri-Layer D6 Design

> Implementation spec for ADR-0367. Phased delivery plan covering backend (schema + capabilities), frontend web (TimelineTab + dialogs), mobile (shift_session read + push), source-of-truth (telemetry + RLS + ADR refs). Falsifiable acceptance per phase.

## 1. Goal

Turn the Dagslinje surface into the canonical pre-day / active-day / post-day communication portal between manager and employee, anchored on **area** (existing `location` table) inside the existing `department_session` aggregate. Reuse existing infrastructure (`timeline_template`, `schedule_shift.location_id`, `expo_push_token`, `engine_event` idempotency, `shift-lifecycle` clock-in capability) instead of parallel-tracking.

Out of scope for this spec:
- Property layer (multi-site chain)
- Zone-grained shift assignment (V2)
- Asset attachment to day-line items (Phase 2)
- Post-day review surface (Phase 3 — separate spec)

## 2. Tri-Layer Model

```
department_session  [AGGREGATE — exists]
  └── day_line      [PROGRAM — NEW, child of session, anchored on area]
        └── session_hook / session_task / schedule_day_booking / deviation
              (existing tables, gain day_line_id nullable FK)

department_session
  └── shift_session [RUNTIME — NEW, per (employee, schedule_shift)]
        └── shift_session_day_line (M:N: shift can cover multiple areas)
```

| Layer | Question Answered | Reader |
|---|---|---|
| `department_session` | "Hva er statusen på avdelingen i dag?" | C1 + payroll |
| `day_line` | "Hva skal skje på denne plassen i dag?" | Manager (admin UI), Manager+Employee (mobile shift card) |
| `shift_session` | "Hva må DU gjøre på ditt skift?" | Employee (mobile) |

## 3. Cross-Perspective Summary

This spec covers all four perspectives. Each is a checklist of work the relevant agent / developer must own.

### Backend

| # | Item |
|---|---|
| B1 | Migration: `day_line` table + UNIQUE on `(department_session_id, location_id)` |
| B2 | Migration: `shift_session` table + UNIQUE on `schedule_shift_id` |
| B3 | Migration: `shift_session_day_line` junction (M:N) |
| B4 | Migration: `department_location` M:N junction |
| B5 | Migration: ADD COLUMN `day_line_id` (nullable FK) to `session_task`, `schedule_day_booking`, `deviation`. **NOT** `session_hook` — that table is a per-`(workspace, department, hook_type)` template and binding to a single day_line breaks lifecycle-fire semantics (see ADR-0367 Rule 2 amended). Also ADD COLUMN `session_task.scheduled_at TIMESTAMPTZ` for push-pipeline time-based items. |
| B6 | Backfill migration: one `day_line` per existing `department_session` using first `department_location` alphabetically; admin override flag column allows reseat before flip |
| B7 | Capability seed migration: `day_line.create`, `day_line.add_item`, `day_line.instantiate_template`, `routine.attach_to_line` |
| B8 | RLS: `day_line` SELECT workspace member, INSERT/UPDATE via `gate_action`; `shift_session` SELECT self or manager+, INSERT/UPDATE via `gate_action`; junction tables follow parent |
| B9 | Trigger: `schedule_shift` insert → ensure `shift_session` row exists with status `scheduled`; on `clock_in` capability call → flip to `clocked_in` |
| B10 | Trigger: `shift_session` insert → populate `shift_session_day_line` by joining matching `(business_date, department_id, location_id)` |
| B11 | Three new capability folders: `packages/ai/src/capabilities/day-line/{gate.ts,index.ts,tools.ts,__tests__/}`, `routine/`, `org/` (for `update_dept_areas`). **NOTE:** folder is `day-line/`, NOT `timeline/` — `timeline-template/` already exists and the naming would collide. |
| B12 | Extension to `task.create_session`, `task.complete`, `hms.report_deviation` capabilities — accept optional `day_line_id` (server-resolved, never body) |
| B13 | Three new Server Actions: `create-day-line-action.ts`, `add-day-line-item-action.ts`, `instantiate-template-action.ts` |
| B14 | Engine-dispatch cron extension: new selector for `day_line_item` push, idempotency via `engine_event` |
| B15 | Workforce snapshot (ADR-0297) extension: include `day_lines[]` + `my_shift_session{}` slice |

### Frontend (Web)

| # | Item |
|---|---|
| W1 | `TimelineTab.tsx` refactor — render stack of `<DayLineStrip>` per `day_line` of the active session |
| W2 | New component `DayLineStripHeader` — area name + open/close + edit button |
| W3 | New popover `OpenCloseEditPopover` — inline two-input editor (planned_open, planned_close) |
| W4 | New dialog `DayLineCreateSheet` — manager creates new day_line; area picker filtered by `department_location` for current dept |
| W5 | New dialog `AttachRoutineDialog` — pick `timeline_template` (scope_type='location') + preview + submit |
| W6 | `SlotPicker.tsx` accepts `day_line_id` prop; dialogs forward to actions |
| W7 | `ScopeFilterPopover.tsx` — multi-select per dimension (Avdeling, Lok, Vakt) per Skjermbilde 2026-05-18; OR within dim, AND between |
| W8 | `useDayLines` hook — fetch all `day_line` rows for `(workspace_id, date)` joined with location, dept; sorted by location.name → planned_open |
| W9 | Aggregated overview (no scope selected): collapsible accordion per `day_line`, peek of next 3 items, status chip |
| W10 | Telemetry: emit `day_line.created`, `day_line.opening_changed`, `day_line.closing_changed`, `day_line_item.added`, `routine.attached` per success path |
| W11 | Nordic Split audit pass — confirm no hardcoded OKLCH (ADR-0366), spring physics from `motionTokens` (smartout-nordic-split skill) |

### Mobile

| # | Item |
|---|---|
| M1 | New hook `useShiftSession` — reads viewer's `shift_session` row for active shift |
| M2 | `app/(app)/(calendar)/day/[date].tsx` rewires: read `shift_session_day_line` + per-line items via existing `useCalendarItems` joined on `day_line_id` |
| M3 | Shift card on home screen shows day_line preview (next 3 items by `scheduled_at`) |
| M4 | Push subscribe: on `clock_in` capability success → subscribe to topic `shift_session:<id>`; on `clock_out` → unsubscribe |
| M5 | Item tap → opens existing detail sheet (no new authoring affordances; ADR-0133 read+execute only) |
| M6 | Telemetry: emit `shift_session.bound`, `shift_session.clocked_in`, `shift_session.clocked_out` via `getProfileContext()` (ADR-0134 fail-fast) |
| M7 | Defensive client-side filter — drop items where `shift_session_day_line` not matching viewer; emit `shift_session.item_leak_detected` if observed |

### Source-of-Truth + Telemetry + Audit

| # | Item |
|---|---|
| S1 | Telemetry registry: add 9 events to BOTH `SmartoutEvent` union AND `EVENT_ROUTING` map (ADR-0358 recurrence trap): `day_line.created`, `day_line.opening_changed`, `day_line.closing_changed`, `day_line_item.added`, `day_line_item.notified`, `shift_session.bound`, `shift_session.clocked_in`, `shift_session.clocked_out`, `routine.attached` |
| S2 | `activity_trail` + `engine_event` routing on all 9 events |
| S3 | New journey docs in `docs/journeys/`: J-day-line-create, J-day-line-edit-hours, J-day-line-attach-routine, J-day-line-employee-view-mobile, J-day-line-push-notification-flow |
| S4 | E2E (Playwright): one spec per web journey (J-create, J-edit-hours, J-attach-routine) |
| S5 | E2E (Maestro/Detox): one spec for mobile employee view + clock-in + push |
| S6 | `/audit smoke` run post-merge to confirm ADR drift clean |
| S7 | Update `docs/modules/daytimeline/*` to reflect tri-layer model |
| S8 | Update `CLAUDE.md` ADR table entry for ADR-0367 |

## 4. Schema Detail (Backend)

### 4.1 `day_line`

```sql
CREATE TABLE public.day_line (
  day_line_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_session_id  UUID NOT NULL REFERENCES department_session(department_session_id) ON DELETE CASCADE,
  -- denormalized for filter / RLS perf:
  department_id          UUID NOT NULL REFERENCES department(department_id),
  location_id            UUID NOT NULL REFERENCES location(location_id) ON DELETE RESTRICT,
  business_date          DATE NOT NULL,
  -- line-specific hours (may differ from session aggregate):
  planned_open           TIME NOT NULL,
  planned_close          TIME NOT NULL,
  source_template_id     UUID REFERENCES timeline_template(id),
  notes                  TEXT,
  -- NO stored status column. Derive at read time per ADR-0156 precedent.
  -- See apps/web/src/lib/cascade/derive-day-line-status.ts (Phase B).
  cancelled_at           TIMESTAMPTZ,  -- NULL = active; non-NULL = explicit manager cancel
  is_backfilled          BOOLEAN NOT NULL DEFAULT false,  -- 7-day admin-override window; drop after window
  created_by             UUID REFERENCES profile(profile_id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_day_line UNIQUE (department_session_id, location_id)
);

CREATE INDEX idx_day_line_workspace_date ON day_line (workspace_id, business_date);
CREATE INDEX idx_day_line_session ON day_line (department_session_id);
CREATE INDEX idx_day_line_location ON day_line (location_id);

CREATE TRIGGER set_day_line_updated_at
  BEFORE UPDATE ON day_line FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 4.2 `shift_session`

```sql
CREATE TABLE public.shift_session (
  shift_session_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_session_id  UUID NOT NULL REFERENCES department_session(department_session_id),
  -- schedule_shift PK column is `schedule_shift_id` (NOT `id`).
  -- Verified 2026-05-18 against supabase/migrations/20260301300000_schedule_shift_table.sql:45.
  schedule_shift_id      UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  -- schedule_shift assignee column is `employee_id` (NOT `profile_id`).
  -- Mirroring the upstream name here for join clarity.
  employee_id            UUID NOT NULL REFERENCES profile(profile_id),
  -- derived for query speed (read-only after insert):
  business_date          DATE NOT NULL,
  location_id            UUID NOT NULL REFERENCES location(location_id),
  department_id          UUID NOT NULL REFERENCES department(department_id),
  status                 shift_session_status NOT NULL DEFAULT 'scheduled',
                         -- scheduled | clocked_in | clocked_out | cancelled
  clocked_in_at          TIMESTAMPTZ,
  clocked_out_at         TIMESTAMPTZ,
  push_topic             TEXT,  -- 'shift_session:<id>' (idempotent on read)
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_shift_session UNIQUE (schedule_shift_id)
);

CREATE INDEX idx_shift_session_employee_active
  ON shift_session (employee_id, status)
  WHERE status IN ('scheduled', 'clocked_in');

CREATE INDEX idx_shift_session_date
  ON shift_session (workspace_id, business_date);

CREATE TRIGGER set_shift_session_updated_at
  BEFORE UPDATE ON shift_session FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 4.3 Junction `shift_session_day_line`

```sql
CREATE TABLE public.shift_session_day_line (
  shift_session_id  UUID NOT NULL REFERENCES shift_session(shift_session_id) ON DELETE CASCADE,
  day_line_id       UUID NOT NULL REFERENCES day_line(day_line_id) ON DELETE CASCADE,
  PRIMARY KEY (shift_session_id, day_line_id)
);

CREATE INDEX idx_ssdl_day_line ON shift_session_day_line (day_line_id);
```

### 4.4 `department_location`

```sql
CREATE TABLE public.department_location (
  department_id  UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  location_id    UUID NOT NULL REFERENCES location(location_id) ON DELETE CASCADE,
  workspace_id   UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  created_by     UUID REFERENCES profile(profile_id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (department_id, location_id)
);

CREATE INDEX idx_department_location_department ON department_location (department_id);
CREATE INDEX idx_department_location_location ON department_location (location_id);
CREATE INDEX idx_department_location_workspace ON department_location (workspace_id);

-- RLS — dual-auth per ADR-0039 + per-verb per ADR-0313 (NOT FOR ALL).
ALTER TABLE department_location ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_department_location" ON department_location FOR SELECT
USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_department_location" ON department_location FOR SELECT
USING (workspace_id = get_api_workspace_id());

CREATE POLICY "jwt_insert_department_location" ON department_location FOR INSERT
WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND is_admin_in_workspace(auth.uid(), workspace_id)
);

CREATE POLICY "jwt_delete_department_location" ON department_location FOR DELETE
USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND is_admin_in_workspace(auth.uid(), workspace_id)
);

CREATE POLICY "service_role_department_location" ON department_location FOR ALL
USING (auth.role() = 'service_role');
```

`workspace_id` denormalized here for RLS performance — populated by trigger on INSERT from `department.workspace_id`. Cascade-delete on workspace cleanup matches existing pattern.

### 4.5 Enums

```sql
-- day_line_status DROPPED per Council Phase 5 + ADR-0156 precedent.
-- Status derived at read time from (parent department_session.status,
-- daily_reconciliation.locked, day_line.cancelled_at) via helper
-- apps/web/src/lib/cascade/derive-day-line-status.ts (Phase B).
-- See ADR-0367 Rule 1 amendment.

CREATE TYPE shift_session_status AS ENUM ('scheduled', 'clocked_in', 'clocked_out', 'cancelled');
```

The `day_line` table accordingly drops the `status` column. Add a nullable `cancelled_at TIMESTAMPTZ` for explicit manager cancellation; derive everything else.

### 4.6 Child FK additions

`session_hook` is **NOT** in this list. Code-trace 2026-05-18 confirmed `session_hook` is a template per `(workspace_id, department_id, hook_type)` — it has no `department_session_id` column. Binding a template to a single `day_line` would freeze it across days, breaking lifecycle-fire semantics. See ADR-0367 Rule 2 (amended).

```sql
-- session_task already has department_session_id (NOT NULL FK).
-- Adding day_line_id gives the per-session-instance an optional area-anchor.
-- NULL = department-level task (e.g. dept-wide open routine child).
-- NOT NULL = area-anchored task on a specific day_line.
ALTER TABLE session_task         ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);

-- schedule_day_booking has a free-text `location` TEXT column (NOT FK).
-- New day_line_id is the FK path forward; legacy `.location` text retained for now.
-- Backfill: leave day_line_id = NULL (no auto-resolve possible from free text).
-- Manager re-pins via admin UI; new bookings always set day_line_id at create time.
ALTER TABLE schedule_day_booking ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);

ALTER TABLE deviation            ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);

CREATE INDEX idx_session_task_day_line         ON session_task(day_line_id) WHERE day_line_id IS NOT NULL;
CREATE INDEX idx_schedule_day_booking_day_line ON schedule_day_booking(day_line_id) WHERE day_line_id IS NOT NULL;
CREATE INDEX idx_deviation_day_line            ON deviation(day_line_id) WHERE day_line_id IS NOT NULL;
```

`day_line_id = NULL` on `session_task` means department-level task (open/close routine child not pinned to area). Backfill is non-destructive. `schedule_day_booking` backfill leaves `day_line_id = NULL` for all existing rows; admin re-pins via UI.

### 4.7 RLS Policies

First, add a new helper function (existing schema only has `is_admin_in_workspace(uid, wid)` per `supabase/migrations/00004_rls_policies.sql:33`). The argument order for the existing helper is `(uid, wid)` — preserve that pattern in the new helper:

```sql
-- New helper — mirrors is_admin_in_workspace but admits 'manager' role too.
CREATE OR REPLACE FUNCTION public.is_admin_or_manager_in_workspace(uid uuid, wid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile
    WHERE user_id = uid
      AND workspace_id = wid
      AND role IN ('manager', 'admin', 'owner')
  );
$$;
```

Then apply RLS:

```sql
-- day_line: SELECT workspace member, INSERT/UPDATE via gate_action
ALTER TABLE day_line ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_day_line" ON day_line FOR SELECT
USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- Helper signature is (uid, wid) — match existing is_admin_in_workspace pattern.
CREATE POLICY "jwt_insert_day_line" ON day_line FOR INSERT
WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND is_admin_or_manager_in_workspace(auth.uid(), workspace_id)
);

CREATE POLICY "jwt_update_day_line" ON day_line FOR UPDATE
USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND is_admin_or_manager_in_workspace(auth.uid(), workspace_id)
);

-- shift_session: viewer reads own + manager+ reads all
ALTER TABLE shift_session ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_shift_session_self_or_manager" ON shift_session FOR SELECT
USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND (
    employee_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    OR is_admin_or_manager_in_workspace(auth.uid(), workspace_id)
  )
);

-- API key paths (Phase A also seeds) — required by ADR-0039 dual-auth pattern
-- on workspace-scoped tables. Pattern mirrors existing schedule_shift policies
-- in supabase/migrations/20260301300000_schedule_shift_table.sql.
CREATE POLICY "api_key_read_day_line" ON day_line FOR SELECT
USING (workspace_id = get_api_workspace_id());

CREATE POLICY "api_key_read_shift_session" ON shift_session FOR SELECT
USING (workspace_id = get_api_workspace_id());
```

The helper migration is part of Phase A (not assumed to exist). It is a thin extension of `is_admin_in_workspace` — same SECURITY DEFINER + locked search_path per L-0172. ADR-0039 dual-auth (JWT + API key) mandates both policy paths for any workspace-scoped read.

## 5. Capability Detail (Backend)

### 5.1 `day_line.create`

```ts
// packages/ai/src/capabilities/day-line/tools.ts
export const timelineCreateDayLine: SmartoutTool = {
  name: "day_line.create",
  description: "Create a day line for a given (date, department, area). Server-resolves workspace + actor. Auto-fills planned_open/planned_close from department_operating_hours unless overridden.",
  schema: z.object({
    department_session_id: z.string().uuid(),
    location_id: z.string().uuid(),
    planned_open: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    planned_close: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    source_template_id: z.string().uuid().optional(),
    notes: z.string().max(2000).optional(),
  }),
  execute: gatedMutation({
    capability: "day_line.create",
    requiredRole: "manager",
    channel: "chat",
  })(async (ctx, input) => {
    // 1. Resolve workspace + dept from department_session
    // 2. Verify department_location pairing exists
    // 3. Resolve planned_open/close from department_operating_hours if absent
    // 4. INSERT day_line
    // 5. emit("day_line.created", { day_line_id, location_id, department_id, planned_open, planned_close })
    // 6. Return { day_line_id }
  }),
};
```

### 5.2 `day-line.add_item` (tool name: `add_item`)

Delegating dispatcher. Schema `.strict()` includes `day_line_id` (server-validated against parent session) + `item_type` discriminator + per-type payload. Body fans out to owning capability per type. ADR-0240 cross-namespace delegation — NEVER INSERT directly into another namespace's table.

### 5.2.1 Per-type dispatch table (V1 scope decision)

| `item_type` | Owning capability | Delegate tool | Audit fields (Pattern B MANDATORY) | V1 scope |
|---|---|---|---|---|
| `task` | `task` (ADR-0298) | `task.create_session` (extension accepts `day_line_id` + Pattern B fields) | `actor_capability="task"`, `delegated_via="day-line"` | ✅ V1 |
| `routine` | `timeline-template` (ADR-0335) | `timeline-template.apply_template` scoped to single hook (extension accepts `day_line_id`) | `actor_capability="timeline-template"`, `delegated_via="day-line"` | ✅ V1 (delegate to existing apply path; avoids 300-line duplicate) |
| `booking` | NO capability today (only `add-booking-action.ts` Server Action) | DEFERRED V2 — requires new `booking.create` capability tool | n/a | ❌ V2 |
| `note` | NO capability today (only `create-day-info-action.ts` Server Action) | DEFERRED V2 — requires new `day_info.create` capability tool | n/a | ❌ V2 |
| `reminder` | Unclear owning table (`personal_task` vs `emma_task` vs `session_task.is_reminder` flag) | DEFERRED V2 — design choice in own ADR | n/a | ❌ V2 |

**V1 `add_item` accepts only `item_type IN ('task', 'routine')`.** Zod schema enforces. V2 follow-on sortier add types one at a time, each gated on its own capability ADR.

### 5.3 `day-line.instantiate_template` (tool name: `instantiate_template`)

Reads `timeline_template` row by `scope_type='location'` + `scope_id=<location_id>`. Delegates to `timeline-template.apply_template` (existing per ADR-0335) extended to accept `day_line_id` — the apply path internally calls `task.create_session` per item with Pattern B audit fields set. Emits `routine.attached` (event-namespace `day-line`) once after batch completes. Per-item telemetry routes through `task.*` events; correlation back to day_line via `delegated_via` field.

**Cross-namespace contract for `apply_template` extension:**
- Existing schema accepts `(template_id, scope_id, scope_type, target_date)`
- Extended schema adds optional `day_line_id` — when present, all created `session_task` rows inherit it
- Pattern B fields propagate: `actor_capability="timeline-template"`, `delegated_via="day-line"` set per emitted event

### 5.4 `routine.attach_to_line` (separate capability folder `routine/`)

Cross-namespace per ADR-0240. Body MUST call `task.create_session` for each `session_task` row — direct `session_task.insert()` from `routine/tools.ts` FORBIDDEN. Verified via Phase B unit test: grep `routine/tools.ts` for `.from("session_task")` — must return zero matches outside test fixtures.

### 5.5 `org.update_dept_areas` (separate capability folder `org/`)

Writes `department_location` (own namespace — no cross-namespace concern). Admin+ only. Adds or removes a `(department_id, location_id)` pair. Emits `org.dept_areas_updated`.

### 5.6 Trigger function for `schedule_shift` → `shift_session`

*(formerly §5.4 in v1.1; renumbered 2026-05-18 v1.2)*

The trigger must guard against multiple nullable columns:

- `schedule_shift.employee_id` nullable (created/unassigned state)
- `schedule_shift.position_id` nullable (post-Cascade-A1)
- `schedule_shift.department_id` nullable (post-Cascade-A1, BACKFILL from position)
- `schedule_shift.location_id` nullable (post-Cascade-A1)

If any of these is NULL, skip — the shift is not yet "fully addressed" and cannot anchor a runtime row.

```sql
CREATE OR REPLACE FUNCTION public.ensure_shift_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department_id    UUID;
  v_session_id       UUID;
  v_shift_session_id UUID;
BEGIN
  -- Skip ad-hoc / unassigned shifts: any missing critical field → no runtime row.
  IF NEW.employee_id IS NULL
     OR NEW.location_id IS NULL
     OR NEW.shift_date IS NULL
  THEN
    RETURN NEW;
  END IF;

  -- Resolve department: prefer direct FK (post-Cascade-A1), fall back to position.
  v_department_id := COALESCE(
    NEW.department_id,
    (SELECT p.department_id FROM public.position p WHERE p.position_id = NEW.position_id)
  );
  IF v_department_id IS NULL THEN
    RETURN NEW;  -- no dept resolvable, skip
  END IF;

  -- Resolve parent department_session (1 per dept × date).
  -- Creating department_session if missing is OUT OF SCOPE for this trigger;
  -- it is managed by the existing session-open path. If absent, skip — the
  -- shift will be re-evaluated when the session is opened (separate trigger).
  SELECT ds.department_session_id INTO v_session_id
  FROM public.department_session ds
  WHERE ds.workspace_id = NEW.workspace_id
    AND ds.department_id = v_department_id
    AND ds.session_date = NEW.shift_date
  LIMIT 1;
  IF v_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotent insert (UNIQUE on schedule_shift_id).
  INSERT INTO public.shift_session (
    workspace_id, department_session_id, schedule_shift_id, employee_id,
    business_date, location_id, department_id, status, push_topic
  )
  VALUES (
    NEW.workspace_id,
    v_session_id,
    NEW.schedule_shift_id,            -- PK column on schedule_shift
    NEW.employee_id,                  -- assignee column on schedule_shift
    NEW.shift_date,
    NEW.location_id,
    v_department_id,
    'scheduled',
    'shift_session:' || gen_random_uuid()::text
  )
  ON CONFLICT (schedule_shift_id) DO NOTHING
  RETURNING shift_session_id INTO v_shift_session_id;

  -- If conflict (already exists), fetch the existing row's id.
  IF v_shift_session_id IS NULL THEN
    SELECT shift_session_id INTO v_shift_session_id
    FROM public.shift_session
    WHERE schedule_shift_id = NEW.schedule_shift_id;
  END IF;

  -- Populate junction with matching day_lines for this (session, location).
  INSERT INTO public.shift_session_day_line (shift_session_id, day_line_id)
  SELECT v_shift_session_id, dl.day_line_id
  FROM public.day_line dl
  WHERE dl.department_session_id = v_session_id
    AND dl.location_id = NEW.location_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ensure_shift_session
  AFTER INSERT OR UPDATE OF location_id, position_id, department_id, employee_id, shift_date
    ON public.schedule_shift
  FOR EACH ROW EXECUTE FUNCTION public.ensure_shift_session();
```

Notes:
- All column refs verified against `supabase/migrations/20260301300000_schedule_shift_table.sql:45-71` + `20260421100350_cascade_a1_alter_existing.sql:66-76`.
- SECURITY DEFINER with locked `search_path = public` per L-0172.
- Trigger does NOT create `department_session` — that path stays with the existing session-open capability. If session does not exist yet, trigger skips and re-fires on next `schedule_shift` update OR on session-open follow-up trigger (Phase B may add a back-fill trigger from `department_session` insert to populate `shift_session` for already-existing shifts).
- Counterpart trigger on `day_line` INSERT (also Phase B) should populate `shift_session_day_line` for any active shift_sessions matching the new line's `(department_session_id, location_id)`.

### 5.7 Push Pipeline (renumbered v1.2) (engine-dispatch)

Existing `engine-dispatch` Edge Function runs 1-minute tick. Add a new handler for day_line item push:

**Prerequisite:** `session_task` does not have a `scheduled_at` column today (verified 2026-05-18 against `supabase/migrations/20260412100300_session_infrastructure.sql:67-82`). Phase A migration must `ALTER TABLE session_task ADD COLUMN scheduled_at TIMESTAMPTZ` (nullable). NULL = "no specific time, do whenever". Push pipeline only fires on NOT NULL items.

```sql
ALTER TABLE session_task ADD COLUMN scheduled_at TIMESTAMPTZ;
CREATE INDEX idx_session_task_scheduled_pending
  ON session_task (scheduled_at)
  WHERE scheduled_at IS NOT NULL AND status = 'pending';
```

```ts
// supabase/functions/engine-dispatch/handlers/day-line-push.ts
async function dispatchDayLinePush(ctx: DispatchCtx) {
  // session_task.id is the PK (not session_task_id) per migration 20260412100300:68.
  // session_task.assigned_to references profile (used as final notification recipient
  // when an item is personally assigned; otherwise all clocked-in receivers).
  // shift_session.employee_id holds the assignee profile (mirrors schedule_shift naming).
  const items = await ctx.sb.from("session_task").select(`
    id, title, description, day_line_id, scheduled_at, workspace_id,
    day_line:day_line_id(location_id),
    receivers:shift_session_day_line(
      shift_session:shift_session_id(
        shift_session_id, workspace_id, employee_id, status,
        profile:employee_id(expo_push_token)
      )
    )
  `)
  .gte("scheduled_at", new Date(Date.now() - 60_000).toISOString())
  .lt("scheduled_at", new Date(Date.now() + 60_000).toISOString())
  .not("day_line_id", "is", null)
  .eq("status", "pending");

  for (const item of items.data ?? []) {
    for (const r of item.receivers) {
      const ss = r.shift_session;
      if (ss.status !== "clocked_in") continue;
      const token = ss.profile?.expo_push_token;
      if (!token) continue;

      const idempotencyKey = `${item.id}:${ss.shift_session_id}`;
      const alreadySent = await ctx.sb.from("engine_event")
        .select("event_id")
        .eq("event_type", "day_line_item.notified")
        .eq("entity_id", idempotencyKey)
        .maybeSingle();
      if (alreadySent.data) continue;

      await sendExpoPush(token, { title: item.title, body: item.description });

      await emit("day_line_item.notified", {
        workspace_id: ss.workspace_id,
        entity_id: idempotencyKey,
        actor_id: "system:engine-dispatch",
        item_id: item.id,
        shift_session_id: ss.shift_session_id,
        employee_id: ss.employee_id,
      });
    }
  }
}
```

## 6. Phase Sequence

Six sub-sortier, each independently mergeable on `campaign/ui-shell` or a new campaign if scope warrants.

### Phase A — Schema + RLS + Backfill (B1-B8 + B5 + S7 partial)

**Deliverables (migrations in causal order — verify timestamps against current repo tip per L-0042):**

1. `<TS+0>_is_admin_or_manager_helper.sql` — new SQL helper `is_admin_or_manager_in_workspace(uid, wid)` (signature mirrors existing `is_admin_in_workspace`)
2. `<TS+1>_day_line_status_enum.sql` — `day_line_status` + `shift_session_status` enums
3. `<TS+2>_day_line_table.sql` — `day_line` + RLS (JWT + API key paths per ADR-0039)
4. `<TS+3>_shift_session_table.sql` — `shift_session` + RLS (JWT + API key)
5. `<TS+4>_shift_session_day_line.sql` — junction
6. `<TS+5>_department_location.sql` — junction + RLS
7. `<TS+6>_day_line_child_fks.sql` — ALTER TABLE for `session_task.day_line_id`, `session_task.scheduled_at`, `schedule_day_booking.day_line_id`, `deviation.day_line_id` (note: NOT `session_hook` — per ADR-0367 Rule 2 amendment)
8. `<TS+7>_day_line_backfill.sql` — backfill `day_line` rows from existing `department_session` rows, leave `schedule_day_booking.day_line_id` NULL (free-text `.location` cannot auto-resolve)
9. `<TS+8>_capability_seed.sql` — INSERT into `capability_default_registry` + `engine_authority_config` for 5 new capabilities

**Falsifiable acceptance:**
- [ ] `npx supabase db reset` applies clean.
- [ ] Backfill dry-run: `count(day_line) == count(department_session)` after run; manual override window exists (7-day flag column dropped after window).
- [ ] `schedule_day_booking.day_line_id` is NULL for all existing rows post-backfill (verified by count query); new INSERTs require non-NULL via capability layer.
- [ ] RLS deny-test (4 cases): anonymous role cannot SELECT; manager from other workspace returns 0 rows; employee viewer reads own `shift_session` but NOT others'; manager+ reads all in own workspace.
- [ ] API key path: `get_api_workspace_id()` SELECT returns expected rows.
- [ ] L-0042 dependency check: every referenced table/enum/function created in an earlier migration. New helper used by RLS policies is created BEFORE policies that call it.
- [ ] Trigger sanity-check on `schedule_shift`: INSERT with NULL `location_id` → no `shift_session` row (skipped). INSERT with NULL `employee_id` → no row. INSERT with all required → exactly one `shift_session` + junction populated.

**Estimate:** 0.75–1 wall day (revised up from 0.5–1 due to 9 migrations + 4 RLS deny-tests).

### Phase B — Capabilities + Server Actions + Triggers (B9-B14 + S1 + S2)

**Deliverables:**
- `packages/ai/src/capabilities/day-line/` (3 tools — folder name avoids collision with existing `timeline-template/`)
- `packages/ai/src/capabilities/routine/` (1 tool — `attach_to_line`)
- `packages/ai/src/capabilities/org/` (1 tool — `update_dept_areas`)
- Extension of `task.create_session`, `task.complete`, `hms.report_deviation` to accept `day_line_id`
- 3 Server Actions
- Trigger function + trigger on `schedule_shift` (see §5.4 — handles all nullable cases)
- Counterpart trigger on `day_line` INSERT to back-populate `shift_session_day_line` for already-active `shift_session` rows at that `(department_session_id, location_id)`
- 9 telemetry events registered in both `SmartoutEvent` + `EVENT_ROUTING` (ADR-0358)
- Unit tests: deny path + allow path per capability

**Falsifiable acceptance:**
- [ ] `pnpm --filter @smartout/ai test capabilities/day-line` green.
- [ ] `scripts/check-telemetry-emit-coverage.ts` green (ADR-0358).
- [ ] No direct `supabase.from("day_line").insert()` outside capability tool bodies.
- [ ] Server Actions return ADR-0151 shape — `workspace_id` + `profile_id` derived from `getServerContext`, never body.

**Estimate:** 0.75–1 wall day.

### Phase C — UI Rewire Web (W1-W11)

**Deliverables:**
- `TimelineTab` refactor — multi-strip stack
- `DayLineStripHeader` + `OpenCloseEditPopover` + `DayLineCreateSheet` + `AttachRoutineDialog`
- `ScopeFilterPopover` multi-select per dimension
- `useDayLines` hook
- Aggregated overview (no scope selected)
- Nordic Split audit pass (ADR-0366 compliance)

**Falsifiable acceptance:**
- [ ] TimelineTab renders N strips for N day_line rows.
- [ ] SlotPicker on strip-1 only opens dialogs scoped to strip-1's `day_line_id`.
- [ ] Manager outside own dept sees other strips read-only.
- [ ] `pnpm --filter web lint` green incl. `nordic-split/no-oklch-literal`.
- [ ] `pnpm --filter web typecheck` green.
- [ ] Manual visual pass: aggregated view collapses cleanly on small viewport.

**Estimate:** 1–1.5 wall days.

### Phase D — Mobile (M1-M7)

**Deliverables:**
- `useShiftSession` hook
- Mobile day view rewires to read shift_session → day_lines → items
- Shift card on home shows day_line preview
- Push subscribe/unsubscribe on clock-in/out
- Mobile telemetry via `getProfileContext()` (ADR-0134 fail-fast)
- Defensive client-side filter + leak telemetry

**Falsifiable acceptance:**
- [ ] Employee with one shift at Bar-area on a given day: mobile shows 1 day_line.
- [ ] Employee with shifts at Bar-area + Event-area same day: mobile shows 2 day_lines stacked.
- [ ] Clock-in flips `shift_session.status` to `clocked_in` and subscribes push topic.
- [ ] Synthetic foreign-line insert: mobile defensive filter drops it AND emits `shift_session.item_leak_detected`.
- [ ] No `gate_action` calls originate from mobile (ADR-0133).

**Estimate:** 0.5–0.75 wall days.

### Phase E — Push Pipeline (B14 detail)

**Deliverables:**
- `engine-dispatch` handler for day_line item push
- Idempotency via `engine_event` partial-unique
- Expo push API integration (key in `op://smartout_ai_prod/expo/access-token`)
- Test: synthetic insert with scheduled_at=now+1min → push delivered exactly once

**Falsifiable acceptance:**
- [ ] Push delivered within 1 minute of `scheduled_at`.
- [ ] Restart engine-dispatch mid-tick: no duplicate push.
- [ ] No active `shift_session` for receiver: push skipped.
- [ ] Manual `notify=false` flag on item (future extension): push skipped.

**Estimate:** 0.5 wall day.

### Phase F — Journeys + E2E + Docs (S3-S8)

**Deliverables:**
- 5 journey docs
- Web E2E specs (3)
- Mobile E2E spec (1)
- `docs/modules/daytimeline/*` updates
- CLAUDE.md ADR table updated
- `/audit smoke` green

**Falsifiable acceptance:**
- [ ] Every journey has at least one E2E test referencing a `data-testid`.
- [ ] `pnpm --filter @smartout/e2e test` green for day_line specs.
- [ ] Manual review against all 5 journeys passes (per `dual-perspective-verification` skill).
- [ ] `adr-contract-audit` finds zero drift on day_line / shift_session surfaces.

**Estimate:** 0.5–0.75 wall day.

## 7. Cross-Phase Concerns

### 7.1 Backfill heuristic

Existing `department_session` rows (post-Bubble-migration, 13k+ rows): pick department's first `department_location` alphabetically. Migration writes a flag column `day_line.is_backfilled` so admin can review and reseat before flip. After 7 days without complaint, drop the flag. Reversal: DELETE WHERE `is_backfilled=true` AND `created_at < now() - interval '7 days'`.

### 7.2 Council gate

ADR-0367 is currently `proposed`. Before Phase A merge, run council via `run-council` skill with reviewers: `system-steward` (chair), `supervisor`, `system-agent-coordinator`, `botsson-harness-builder`, `frontend-designer`. Verdict goes into ADR. If verdict ≠ accept, halt and revise.

### 7.3 Performance budget

- `TimelineTab` initial render ≤200ms with 6 day_lines × 50 items.
- `useDayLines` query <100ms p95.
- Mobile day route TTI <800ms on iPhone SE 2nd gen.
- Engine-dispatch tick <2s for 1000 active shift_sessions.

### 7.4 PII + Security

- `day_line` is non-PII (location + dept + hours).
- `day_line_item` may contain owner names — gated like today.
- `shift_session` is per-employee; RLS prevents cross-viewer reads.
- Push payload contains `title` + `body` only — no profile data.
- Voice tools follow ADR-0078 chat-only on day_line / shift_session mutations.

### 7.5 Mobile parity (ADR-0133 invariant)

Web composes, mobile executes. Mobile gains:
- Read-side hooks (shift_session, day_line_item)
- Execute-side capability calls (existing `task.complete`, `hms.report_deviation`, `shift-lifecycle.clock_in/out`)

Mobile does NOT gain:
- Day-line creation
- Day-line item authoring (note/booking/reminder writes)
- Department area pairings
- Open/close edits

## 8. Open Items

| # | Item | Resolution path |
|---|---|---|
| O1 | Owner of trigger function `ensure_shift_session` — service role or workspace-scoped? | Use SECURITY DEFINER with locked search_path per L-0172. |
| O2 | Should `notify=false` opt-out exist on day_line_item from V1? | Add column with DEFAULT TRUE; admin UI hides until V2 needs it. |
| O3 | Should empty `department_location` fail department-session creation? | NO — fallback to "all locations in workspace" for dept until pairing added. Phase A pre-flight check warns admin. |
| O4 | Cross-workspace shift — can an employee have shifts at multiple workspaces same day? | Out of scope V1. Each workspace owns its own shift_session row. |
| O5 | Voice tool authoring on day_line — chat-only per ADR-0078 confirmed? | YES. Phase B confirms `allowed_channels = ARRAY['chat']` in capability_default_registry seed. |
| O6 | Property layer — at what trigger? | When workspace adds 2nd physical site OR when admin requests via support. Until then, all `location.parent_location_id` references forbidden. |

## 9. Estimated Wall Time

| Phase | Estimate | Cumulative |
|---|---|---|
| A — Schema + RLS + Backfill | 0.5–1d | 0.5–1d |
| B — Capabilities + Actions + Triggers | 0.75–1d | 1.25–2d |
| C — UI Rewire Web | 1–1.5d | 2.25–3.5d |
| D — Mobile | 0.5–0.75d | 2.75–4.25d |
| E — Push Pipeline | 0.5d | 3.25–4.75d |
| F — Journeys + E2E + Docs | 0.5–0.75d | 3.75–5.5d |
| Buffer | 0.5d | 4.25–6d |

**Solo: ~4–6 wall days.** Parallel (3 sub-sortier per phase): **~2–3 wall days.**

## 10. Cross-References

### ADRs
- **[ADR-0367](../../decisions/0367-day-line-area-anchored-runtime.md)** — authoritative
- ADR-0078, ADR-0099, ADR-0114, ADR-0133, ADR-0151, ADR-0156, ADR-0173, ADR-0204, ADR-0240, ADR-0287, ADR-0297, ADR-0298, ADR-0334, ADR-0335, ADR-0358, ADR-0366

### Modules
- `docs/modules/core-structure/` — D1 axes (HVOR + HVEM)
- `docs/modules/daytimeline/` — direct consumer
- `docs/modules/payroll/` — read-only consumer of `department_session`

### Code paths
- Backend: `supabase/migrations/`, `supabase/functions/engine-dispatch/`, `packages/ai/src/capabilities/`
- Web: `apps/web/src/components/day/`, `apps/web/src/app/dashboard/_hooks/`, `apps/web/src/app/dashboard/_actions/`
- Mobile: `apps/mobile/app/(app)/(calendar)/`, `apps/mobile/src/hooks/`, `apps/mobile/src/lib/push.ts`

### Skills triggered during implementation
- `smartout-database-guide` — every migration
- `smartout-cascade-developer` — every D6 touch
- `smartout-agent-dev` — every capability tool
- `smartout-edge-function-guide` — `engine-dispatch` extension
- `smartout-nordic-split` — every UI surface in Phase C
- `smartout-page-polish` — Phase C closure
- `dual-perspective-verification` — Phase F closure
