---
title: "Day Session — Data Model"
status: in_progress
mirror: verified
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: day-session
tags: [domain, day-session, data-model, schema, d6, tri-layer, adr-0367, rls, telemetry]
---

# Day Session — Data Model

> Every table the day-session domain owns, with FK map, enums, RLS, and telemetry. **Code wins — actual schema.**

## 1. Enums

### `department_session_status`
**Migration:** `supabase/migrations/20260304200000_department_session.sql:12`

```sql
CREATE TYPE department_session_status AS ENUM (
  'upcoming',          -- before planned_open
  'active',            -- opened_at set, day running
  'pending_signoff',   -- closed_at set, awaiting manager sign-off
  'closed',            -- manager signed off, awaiting admin approval
  'missed'             -- never opened, grace period exceeded
);
```

**DEVIATION from design:** The design spec (day-handoff README §3) lists 6 phases including `locked`. The DB enum has only 5 — `locked` is implemented as `daily_reconciliation.status = 'locked'` (see §1.2), not as a `department_session_status` value. This is intentional per ADR-0156 (stored status drifts). See GAPS §4b.

### `reconciliation_status`
**Migration:** `supabase/migrations/20260304200100_daily_reconciliation.sql:12`

```sql
CREATE TYPE reconciliation_status AS ENUM (
  'open',              -- day started, accumulating
  'submitted',         -- closing employee submitted
  'awaiting_approval', -- OCR done, ready for admin
  'approved',          -- admin approved — day closed
  'locked',            -- immutable after policy period
  'unreconciled'       -- timed out without approval
);
```

### `day_line_status` (derived, NOT stored)
**File:** `apps/web/src/lib/cascade/derive-day-line-status.ts`

Type: `"draft" | "active" | "closed" | "locked" | "cancelled"`. Derived at read time. Precedence: locked > cancelled > draft > closed > active.

### `shift_session_status`
**Migration:** `supabase/migrations/20260620120100_day_line_session_enums.sql`

```sql
CREATE TYPE shift_session_status AS ENUM ('scheduled', 'clocked_in', 'clocked_out', 'cancelled');
```

### `settlement_source_type`
```sql
CREATE TYPE settlement_source_type AS ENUM ('pos', 'terminal', 'z_report', 'cash_count', 'other');
```

### `session_hook_type` (hook type)
**Migration:** `supabase/migrations/20260412100300_session_infrastructure.sql`

Values: `opening`, `closing`, `scheduled`, `timer`. Maps to design hook types: `pre_open`, `open`, `scheduled`, `pre_close`, `close`.

---

## 2. Core Tables

### 2.1 `department_session` — the day aggregate
**Migration:** `supabase/migrations/20260304200000_department_session.sql`

| Column | Type | Notes |
|---|---|---|
| `department_session_id` | UUID PK | gen_random_uuid() |
| `workspace_id` | UUID NOT NULL FK → workspace | RLS root |
| `department_id` | UUID NOT NULL FK → department | one per dept per day |
| `season_id` | UUID FK → season | D4 link |
| `session_date` | DATE NOT NULL | business date |
| `status` | `department_session_status` NOT NULL DEFAULT `'upcoming'` | state machine |
| `opened_at` / `opened_by` | timestamptz / UUID FK profile | lifecycle |
| `closed_at` / `closed_by` | timestamptz / UUID FK profile | lifecycle |
| `duty_leader_profile_id` | UUID FK profile | added migration `20260329100000` |
| `signoff_notes` / `handoff_notes` | TEXT | end-of-day prose |
| `planned_shifts` / `actual_shifts` | int | metrics |
| `tasks_total` / `tasks_completed` | int | metrics |
| `planned_open` / `planned_close` | TIME nullable | Cascade A1 — resolved from `department_operating_hours` |
| `created_at` / `updated_at` | timestamptz NOT NULL | audit |

**Constraint:** `UNIQUE (workspace_id, department_id, session_date)` — one session per dept per day.

**RLS:** jwt_read (workspace member), jwt_manage (admin+), api_key_read, service_role.

### 2.2 `day_line` — area-anchored program layer (ADR-0367)
**Migration:** `supabase/migrations/20260620120200_day_line_table.sql`

| Column | Type | Notes |
|---|---|---|
| `day_line_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK → workspace | RLS root |
| `department_session_id` | UUID NOT NULL FK → department_session ON DELETE CASCADE | parent aggregate |
| `department_id` | UUID NOT NULL FK → department | denormalised for filter/RLS |
| `location_id` | UUID NOT NULL FK → location ON DELETE RESTRICT | area anchor |
| `business_date` | DATE NOT NULL | |
| `planned_open` | TIME NOT NULL | per-area open band |
| `planned_close` | TIME NOT NULL | per-area close band |
| `source_template_id` | UUID FK → timeline_template | which template was applied |
| `notes` | TEXT | |
| `cancelled_at` | timestamptz | soft-cancel |
| `is_backfilled` | BOOLEAN NOT NULL DEFAULT false | Phase A backfill flag |
| `created_by` | UUID FK profile | |
| `created_at` / `updated_at` | timestamptz NOT NULL | |

**Constraint:** `UNIQUE (department_session_id, location_id)` — one line per (session × area).

**RLS:** jwt_select (workspace member), api_key_select, service_role write via capability layer.

**Status:** DERIVED — `apps/web/src/lib/cascade/derive-day-line-status.ts`.

### 2.3 `shift_session` — per-employee runtime layer (ADR-0367)
**Migration:** `supabase/migrations/20260620120300_shift_session_table.sql`

| Column | Type | Notes |
|---|---|---|
| `shift_session_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK → workspace | |
| `department_session_id` | UUID NOT NULL FK → department_session | |
| `schedule_shift_id` | UUID NOT NULL FK → schedule_shift ON DELETE CASCADE | UNIQUE — one per shift |
| `employee_id` | UUID NOT NULL FK → profile | mirrors `schedule_shift.employee_id` |
| `business_date` | DATE NOT NULL | |
| `location_id` | UUID NOT NULL FK → location | |
| `department_id` | UUID NOT NULL FK → department | |
| `status` | `shift_session_status` NOT NULL DEFAULT `'scheduled'` | |
| `clocked_in_at` / `clocked_out_at` | timestamptz | lifecycle |
| `push_topic` | TEXT | Expo push routing |
| `created_at` / `updated_at` | timestamptz NOT NULL | |

**Constraint:** `UNIQUE (schedule_shift_id)`.

**Auto-created by trigger** on `schedule_shift` insert/update (`20260620130000_ensure_shift_session_trigger.sql`). Trigger skips when `employee_id`, `location_id`, or `shift_date` is NULL.

**RLS:** jwt_select (self or manager+), service_role.

### 2.4 `shift_session_day_line` — M:N junction (ADR-0367)
**Migration:** `supabase/migrations/20260620120400_shift_session_day_line_junction.sql`

| Column | Type | Notes |
|---|---|---|
| `shift_session_id` | UUID NOT NULL FK → shift_session ON DELETE CASCADE | PK part 1 |
| `day_line_id` | UUID NOT NULL FK → day_line ON DELETE CASCADE | PK part 2 |

Trigger-populated by `20260620130100_day_line_back_populate_trigger.sql` — joins on `(business_date, department_id, location_id)` at shift_session insert. Drives mobile read scope + push fan-out.

### 2.5 `session_hook` — routine template
**Migration:** `supabase/migrations/20260412100300_session_infrastructure.sql:15`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK | RLS root |
| `department_id` | UUID NOT NULL FK | dept anchor — NOT location-aware (design intent: template is dept-level) |
| `hook_type` | `session_hook_type` | opening/closing/scheduled/timer |
| `trigger_offset_min` | int NOT NULL DEFAULT 0 | minutes from anchor (planned_open or planned_close) |
| `repeat_interval_min` | int nullable | repeating hooks |
| `linked_procedure_id` | UUID FK procedure | optional — procedure-engine seam |
| `linked_routine_id` | UUID FK routine | optional |
| `is_active` | bool DEFAULT true | soft toggle |

**Constraint:** `UNIQUE (workspace_id, department_id, hook_type)` added per ADR-0367 Rule 1b (`20260620120100_day_line_session_enums.sql`).

**Key:** `session_hook` is a TEMPLATE, not a per-session row. Does NOT receive `day_line_id`. The `session_task` rows materialised by `session-hook-executor` at fire time DO inherit `day_line_id` via `fn_resolve_single_day_line`.

### 2.6 `session_task` — single task or routine child
**Migration:** `supabase/migrations/20260412100300_session_infrastructure.sql:67` + `20260620120600_day_line_child_fks.sql`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK | RLS root |
| `department_session_id` | UUID NOT NULL FK → department_session | day anchor |
| `session_hook_id` | UUID nullable FK → session_hook | NULL = ad-hoc; non-null = routine child |
| `day_line_id` | UUID nullable FK → day_line | NULL = dept-level; non-null = area-anchored (ADR-0367) |
| `scheduled_at` | timestamptz nullable | time-anchored push pipeline |
| `title` | TEXT NOT NULL | |
| `description` | TEXT | |
| `status` | `session_task_status` | pending/available/in_progress/completed/etc. |
| `assigned_to` | UUID FK profile | owner |
| `completed_by` / `completed_at` | UUID FK profile / timestamptz | audit |
| `evidence` | JSONB | photo/text/checkbox |
| `is_compliance_required` | bool DEFAULT false | blocks day close if incomplete |

**Indexes:** `idx_session_task_session_status (department_session_id, status)` · `idx_session_task_assigned_active` partial WHERE status IN pending/available/in_progress.

**RLS:** workspace member SELECT; workspace member UPDATE (for completion); manager+ INSERT.

### 2.7 `daily_reconciliation` — C1 lock + omsetning record
**Migration:** `supabase/migrations/20260304200100_daily_reconciliation.sql`

| Column | Type | Notes |
|---|---|---|
| `reconciliation_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK → workspace | |
| `department_id` | UUID NOT NULL FK → department | |
| `session_id` | UUID FK → department_session | optional link |
| `reconciliation_date` | DATE NOT NULL | |
| `status` | `reconciliation_status` NOT NULL DEFAULT `'open'` | state machine (incl. `locked`) |
| `settled_by` / `settled_at` | UUID FK profile / timestamptz | Phase 1: shift leader |
| `approved_by` / `approved_at` | UUID FK profile / timestamptz | Phase 2: admin |
| `approval_notes` | TEXT | |
| `revenue_total` / `revenue_card` / `revenue_cash` / `revenue_vat` | NUMERIC(12,2) | omsetning figures |
| `revenue_transactions` | int | |
| `revenue_source` | `revenue_source` enum (`ocr` / `manual`) | |
| `total_planned_hours` / `total_actual_hours` | NUMERIC(6,2) | |
| `total_labor_cost` | NUMERIC(10,2) | |
| `revenue_per_worked_hour` / `labor_percentage` | computed KPIs | |
| `locked_at` / `locked_by` | timestamptz / UUID FK profile | immutable seal |
| `wizard_state` | JSONB NOT NULL DEFAULT `'{}'` | M2 clockout-wizard resumability (ADR-0134). Shape: `{ last_completed_step, last_touched_at, step_data }` |

**Constraint:** `UNIQUE (workspace_id, department_id, reconciliation_date)`.

**RLS:** jwt_read (workspace member), jwt_manage (admin/owner/manager), jwt_leader_write (duty leader UPDATE wizard_state), service_role.

### 2.8 `settlement_image` — OCR source
**Migration:** same as 2.7

| Key columns | Notes |
|---|---|
| `reconciliation_id` FK NOT NULL | parent |
| `source_type` | `settlement_source_type` |
| `storage_path` | Supabase Storage path |
| `ocr_raw_text` / `ocr_parsed` JSONB / `ocr_confidence` REAL | OCR output |
| `uploaded_by` FK profile | |

**EF:** `process-settlement-image` — Norwegian-language regex parser for POS/terminal output. Confidence computed from how many fields extracted.

### 2.9 `settlement_validation` — POS vs terminal cross-check
**Migration:** same as 2.7

Columns: `pos_total`, `terminal_total`, `difference`, `difference_percent`, `within_threshold`, `deviation_id` (FK to deviation when out-of-tolerance).

**EF:** `validate-settlement`.

### 2.10 `financial_close_config` — customizable close tolerances
**Migration:** `supabase/migrations/20260328120100_financial_close_config.sql`

| Column | Notes |
|---|---|
| `workspace_id` UNIQUE | 1:1 per workspace |
| `tolerance_type` TEXT CHECK (`'fixed'` / `'percentage'`) | |
| `tolerance_value` NUMERIC(10,2) DEFAULT 50 | |
| `require_cash_count` BOOLEAN DEFAULT true | |
| `cash_tolerance_type` / `cash_tolerance_value` | |
| `approval_required` BOOLEAN DEFAULT true | |
| `approval_deadline_hours` INTEGER DEFAULT 24 | |

**RLS:** workspace_member_read (SELECT), workspace_admin_write (INSERT), workspace_admin_update (UPDATE).

**GAP:** Schema exists; no confirmed UI to configure these values from the web dashboard. See GAPS §G10.

### 2.11 `timeline_template` — saved day-line programs (ADR-0335)
**Migration:** `supabase/migrations/` (ADR-0335 migration set)

| Key columns | Notes |
|---|---|
| `scope_type` enum `team \| department \| location \| shift` | polymorphic anchor |
| `scope_id` UUID | validated app-side, no FK |
| `items_json` JSONB | Zod-validated 6-kind discriminated union |
| `is_archived` bool | soft-delete |

**RLS:** SELECT (workspace member), INSERT (admin), UPDATE (creator or admin).

Applied at session creation via `day_line.instantiate_template` capability.

### 2.12 Adjacent tables (read-joins)

| Table | What day-session reads | Migration |
|---|---|---|
| `schedule_day_booking` | booking markers on timeline; gained `day_line_id` FK (ADR-0367) | `20260301600003_schedule_persistence_tables.sql:353` |
| `schedule_day_info` | duty-leader notes, weather, day-level free text | `20260302152749_add_dashboard_evolution_tables.sql:157` |
| `deviation` | D6 deviations; gained `day_line_id` FK (ADR-0367) | `20260620120600_day_line_child_fks.sql` |
| `department_location` | M:N junction — which depts staff which areas | `20260620120500_department_location_table.sql` |
| `department_operating_hours` | `planned_open`/`planned_close` source (D1) | `20260421100350_cascade_a1_alter_existing.sql` |
| `schedule_shift` | shift markers; has `location_id` from Cascade A1 | `20260301300000_schedule_shift_table.sql` |

---

## 3. FK Map (summary)

```
workspace
  └── department_session (workspace_id, department_id, session_date)
        ├── day_line (department_session_id, location_id)
        │     └── session_task.day_line_id (nullable)
        │     └── schedule_day_booking.day_line_id (nullable)
        │     └── deviation.day_line_id (nullable)
        ├── shift_session (department_session_id, schedule_shift_id)
        │     └── shift_session_day_line (shift_session_id, day_line_id)
        ├── session_task (department_session_id, session_hook_id?)
        └── daily_reconciliation (department_id, reconciliation_date, session_id?)
              ├── settlement_image (reconciliation_id)
              └── settlement_validation (reconciliation_id)

workspace
  └── session_hook (workspace_id, department_id, hook_type) — template, not per-session
  └── financial_close_config (workspace_id) — 1:1
  └── timeline_template (workspace_id, scope_type, scope_id)
```

---

## 4. Telemetry Events

Source of truth: `packages/telemetry/src/registry.ts`. Fan-out to PostHog + Logger + `activity_trail` + `engine_event` per `EVENT_ROUTING` map.

| Event key | When emitted | Source |
|---|---|---|
| `"task.added_manual"` | session_task created via `task.create_session` | `addTaskAction` |
| `"session_task completed"` | task completed | `toggle-session-task-action` / `complete-session-task-action` |
| `"task.list_mine"` | capability read | `task` capability tool |
| `"session_hook created"` / `"session_hook deleted"` | hook management | manager authoring path |
| `"deviation viewed"` / `"deviation reported"` / `"deviation updated"` / `"deviation resolved"` | HMS flow | M5 sortie |
| `"day_info created"` / `"day_info updated"` / `"day_info deleted"` | DailyNoteSheet | `create-day-info-action` |
| `"booking created"` | schedule_day_booking | `add-booking-action` |
| `"day_line.created"` | new day_line created | `day-line.create` capability |
| `"day_line.opening_changed"` / `"day_line.closing_changed"` | hours edit | `day-line` capability |
| `"day_line_item.added"` / `"day_line_item.notified"` | item add + push | capability + engine-dispatch |
| `"shift_session.bound"` / `"shift_session.clocked_in"` / `"shift_session.clocked_out"` | clock events | `shift-lifecycle` capability |
| `"routine.attached"` | template attached to day_line | `day-line.instantiate_template` |
| `"calendar view_changed"` / `"calendar item_viewed"` | mobile calendar view | `apps/mobile/app/(app)/(calendar)/day/[date].tsx` |

**Recurrence trap:** every new event MUST be added to BOTH `SmartoutEvent` union AND `EVENT_ROUTING` map or it silently drops. Verified pattern from MEMORY.

---

## 5. RLS Summary

| Table | JWT SELECT | JWT WRITE | Notes |
|---|---|---|---|
| `department_session` | workspace member | admin+ (manage) | |
| `day_line` | workspace member | service_role via capability | |
| `shift_session` | self or manager+ | trigger (auto-insert) | |
| `shift_session_day_line` | workspace member | trigger | |
| `session_hook` | workspace member | admin+ | template write admin-only |
| `session_task` | workspace member | workspace member (complete) / manager+ (create) | |
| `daily_reconciliation` | workspace member | admin/owner/manager + leader (wizard_state UPDATE) | |
| `settlement_image` | workspace member | workspace member (upload) | |
| `settlement_validation` | workspace member | service_role | |
| `financial_close_config` | workspace member | admin only | |
| `timeline_template` | workspace member | admin (INSERT) / creator-or-admin (UPDATE) | |

All policies join through `get_workspace_ids_for_user(auth.uid())`. Service-role policies exist for capability-layer writes and EF paths.
