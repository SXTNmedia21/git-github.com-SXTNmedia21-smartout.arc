---
title: Task Manager — Data Model
status: in_progress
updated: 2026-05-20
created: 2026-05-20
module: task-manager
tags: [module, task-manager, data-model, schema, five-sources, day-line, routine, fn-list-my-tasks]
---

# Task Manager — Data Model

> Every table the task system reads or writes, the read RPC projection, telemetry, and the schema divergences that make the read-normalization layer load-bearing.

## 1. The Five Sources (instance axis)

### 1.1 `session_task` — D6 Production
Migration: `20260412100300_session_infrastructure.sql:67–82` + enum `20260412100000_session_enums.sql:23–31` + day_line FKs `20260620120600_day_line_child_fks.sql:7,12`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `workspace_id` | UUID NOT NULL → workspace | RLS root |
| `department_session_id` | UUID NOT NULL → department_session | always-populated anchor |
| `session_hook_id` | UUID → session_hook | nullable; set = cascade/hook origin |
| `day_line_id` | UUID → day_line | **nullable** (ADR-0367); set = area-anchored |
| `scheduled_at` | TIMESTAMPTZ | **nullable**; absolute time for push pipeline |
| `title` | TEXT NOT NULL | |
| `description` | TEXT | |
| `status` | enum `session_task_status` | `pending`/`available`/`in_progress`/`completed`/`skipped`/`overdue`/`escalated` |
| `assigned_to` | UUID → profile | |
| `completed_by` | UUID → profile | |
| `completed_at` | TIMESTAMPTZ | |
| `evidence` | JSONB | HACCP `{measured_value, notes}` |
| `is_compliance_required` | BOOLEAN NOT NULL DEFAULT false | drives priority='high' |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Indexes: `(department_session_id, status)`, `(assigned_to, status)` partial active, `(day_line_id)` partial NOT NULL, `(scheduled_at)` partial pending. **No direct FK to `schedule_shift`** — shift linkage is via `day_line`.

### 1.2 `schedule_day_task` — D6 ad-hoc
Migration: `20260301600003_schedule_persistence_tables.sql:305–349`.

| Column | Type | Notes |
|---|---|---|
| `schedule_day_task_id` | UUID PK | **PK name differs** (not `id`) |
| `workspace_id` | UUID NOT NULL → workspace | |
| `shift_date` | DATE NOT NULL | time-window anchor (date only) |
| `label` | TEXT NOT NULL | **title field is `label`** |
| `task_status` | TEXT NOT NULL DEFAULT 'pending' | **free text, NO CHECK** |
| `category` | TEXT NOT NULL DEFAULT 'all' | |
| `assigned_to` | UUID → profile | |
| `completed_at` | TIMESTAMPTZ | |
| `highlight` | BOOLEAN NOT NULL DEFAULT false | synthesizes priority='high' |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Not session-anchored. No `department_session_id`, no `day_line_id`, no `scheduled_at`.

### 1.3 `personal_task` — C2 Agent-Utility
Migration: `20260520100000_personal_task.sql:15–27`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `profile_id` | UUID NOT NULL → profile | owner = assignee |
| `workspace_id` | UUID NOT NULL → workspace | |
| `title` | TEXT NOT NULL | |
| `due_at` | TIMESTAMPTZ | nullable |
| `priority` | TEXT NOT NULL DEFAULT 'normal' | CHECK low/normal/high/urgent |
| `status` | TEXT NOT NULL DEFAULT 'open' | CHECK open/done/cancelled |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**No `completed_at`, no `description`, no `assigned_to`.** Lightest schema. RPC must NULL-fill `completed_at`.

### 1.4 `emma_task` — C2 Agent-Utility (agent-curated)
Migration: `20260311042814_emma_task.sql:4–17` + cron/limit `20260311060000_emma_task_cron_and_limit.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `workspace_id` | UUID NOT NULL → workspace | |
| `profile_id` | UUID NOT NULL → profile | owner |
| `title` | TEXT NOT NULL | |
| `description` | TEXT DEFAULT '' | |
| `due_at` | TIMESTAMPTZ | nullable |
| `status` | TEXT NOT NULL DEFAULT 'pending' | CHECK pending/triggered/done/dismissed |
| `context` | JSONB DEFAULT '{}' | page/mission data |
| `mission` | TEXT | what Emma does when triggered |
| `triggered_at` | TIMESTAMPTZ | RPC maps → `completed_at` |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Max-3 active per profile via `check_emma_task_limit()` trigger. Cron `emma-task-trigger` (every 10 min) flips `pending`→`triggered` when `due_at <= now()`.

### 1.5 `engine_state_step` — control plane (EXCLUDED)
Migration: `20260412100100_engine_state_step.sql`. Per-step tracking of `engine_state`. Columns: `id`, `state_id → engine_state`, `step_order`, `status`(pending/active/completed/skipped/failed), `action_type`, `action_payload` jsonb, `condition`, `assignee_rule`, `completed_by`, `result`. **Never** in `fn_list_my_tasks` (ADR-0298 R2). The `assign_task` action handler writes to `session_task`, not here (`engine-dispatch/index.ts:787–805`).

### 1.6 Schema divergence map (why the read layer is load-bearing)

| Concept | session_task | schedule_day_task | personal_task | emma_task |
|---|---|---|---|---|
| PK | `id` | `schedule_day_task_id` | `id` | `id` |
| Title | `title` | `label` | `title` | `title` |
| Status | enum | free TEXT | TEXT+CHECK | TEXT+CHECK |
| `completed_at` | ✅ | ✅ | ❌ | via `triggered_at` |
| `assigned_to` | ✅ | ✅ | ❌ (owner) | ❌ (owner) |
| `description` | ✅ | ❌ | ❌ | ✅ |
| `priority` | synth | synth | column | constant |
| time anchor | session_date / scheduled_at | shift_date | due_at | due_at |

## 2. Anchor structure (D6, ADR-0367)

| Table | PK | Key FKs / columns | Migration |
|---|---|---|---|
| `department_session` | `department_session_id` | workspace, department, season, `session_date`, status enum, `planned_open/close` TIME; UNIQUE(workspace, dept, date); **no location** | `20260304200000` + `20260421100350` |
| `day_line` | `day_line_id` | dept_session (CASCADE), department, **`location_id` NOT NULL** (RESTRICT), `business_date`, `planned_open`/`planned_close` TIME, `source_template_id → timeline_template`, `cancelled_at`, `is_backfilled`; UNIQUE(dept_session, location); **no status column (derived)** | `20260620120200` |
| `shift_session` | `shift_session_id` | dept_session, **`schedule_shift_id` UNIQUE** (CASCADE), `employee_id`, `business_date`, `location_id`, `department_id`, status enum(scheduled/clocked_in/clocked_out/cancelled), `clocked_in/out_at`, `push_topic` | `20260620120300` |
| `shift_session_day_line` | (shift_session, day_line) | M:N | `20260620120400` |
| `department_location` | (department, location) | M:N + workspace; admin-gated | `20260620120500` |
| `session_hook` | `id` | workspace, department, `hook_type` enum(pre_open/open/scheduled/pre_close/close), `trigger_offset_min`, `repeat_interval_min`, `linked_procedure_id`, `linked_routine_id`, `is_active`; UNIQUE(workspace, dept, hook_type); **template, no day_line_id, no dept_session_id** | `20260412100300` + `20260620120600` |
| `schedule_shift` | `schedule_shift_id` | workspace, employee, position, team, `department_id`(nullable), `location_id`(nullable), `shift_date`, `start_time`/`end_time`, status enum, `is_published` | `20260301300000` + `20260421100350` |
| `timeline_template` | `id` | workspace, name, `scope_type`(team/department/location/shift), `scope_id`(polymorphic), `items_json` jsonb, `is_archived` | `20260616110000` |

**The shift→tasks chain:** `schedule_shift → shift_session (1:1) → shift_session_day_line (M:N) → day_line → session_task WHERE day_line_id = day_line.day_line_id`. This chain is **not rendered by any query/UI today** (see GAPS).

## 3. Governance templates

| Table | PK | Key columns | Migration |
|---|---|---|---|
| `policy` | `policy_id` | workspace | `00003_governance_tables.sql:13` |
| `protocol` | `protocol_id` | `policy_id` (UNIQUE), workspace | `00003:39` |
| `procedure` | `procedure_id` | `protocol_id`, `procedure_type` enum, `skill_requirements` jsonb, `sort_order` | `00003:61` |
| `procedure_step` | `step_id` | `procedure_id`, `title`, `step_order`, `is_required`, `estimated_minutes` | `00003:80` |
| `routine` | `routine_id` | `protocol_id`, **`procedure_id` NOT NULL** (steps live here), `trigger_type`(scheduled/event), `trigger_config` jsonb, `assigned_to_type/ref`, `control_list_id`, `control_frequency`, `control_nth`, `is_active` | `00003:107` |
| `control_list` | `control_list_id` | `protocol_id`, **`items` jsonb** (no child table), `assigned_to_type`; **no workspace_id** (via protocol) | `00003:92` |
| `runbook` (+`runbook_step`) | `runbook_id` | `protocol_id`, **`control_list_id` NOT NULL**, `trigger_event`, `escalation_chain` jsonb | `00003:129` |

## 4. `fn_list_my_tasks` projection

Migrations: `20260606120100` (v1) + `20260607100100` (v2, adds hook links). `SECURITY DEFINER`, `STABLE`, granted to `authenticated` only (NOT service_role → why `list_mine` TS replicates it).

Returned columns: `id`, `source`(session|day_ad_hoc|personal|emma), `raw_status`, `status`(normalized), `title`, `description`, `due_at`, `priority`, `assigned_to`, `workspace_id`, `session_id`(=dept_session, ARM 1 only), `hook_id`(ARM 1), `compliance`(ARM 1), `created_at`, `completed_at`, `origin_actor`(cascade_cron/human/agent_auto), `hook_linked_procedure_id`, `hook_linked_routine_id`.

**Not projected (the Phase 1 gap):** `day_line_id`, `scheduled_at`, `location_id`. Both `day_line_id` and `scheduled_at` exist on `session_task` since `20260620120600` but were never added to the RPC return type — so the unified read cannot filter by area or shift.

Normalization helpers: `fn_normalize_session_task_status`, `fn_normalize_priority` (`20260606120000`).

## 5. Telemetry

Registry `packages/telemetry/src/registry.ts`.

| Event | Destinations | Notes |
|---|---|---|
| `task created` | posthog, logger, activity_trail, engine_event | source ∈ session/personal/day_ad_hoc |
| `task completed` | posthog, logger, activity_trail, engine_event | completed_via ∈ self/manager/agent |
| `task cancelled` | posthog, logger, activity_trail | personal only |
| `task.list_mine` | posthog, logger | read-path; no audit/engine |
| `session_task.created` (alias) | activity_trail, engine_event, posthog | deprecated 30-day |
| `session_task.assigned` (alias) | activity_trail, engine_event, posthog | deprecated |
| `task.added_manual` (alias) | posthog, logger, activity_trail, engine_event | WebDayControl Oppgaver / mobile AddSheet |

## 6. RLS summary

- `session_task`: JWT read/update (workspace members; WITH CHECK patched `20260608120000`), service_role full.
- `schedule_day_task`: JWT read (member), insert/update/delete (`is_admin_in_workspace`), api_key full. (Note: capability gates at manager+, RLS at admin — service_role bypass hides divergence — see GAPS.)
- `personal_task`: JWT owner-only, service_role full, api_key read-only.
- `emma_task`: JWT read/write (workspace member — broader than personal_task), service_role.
- `control_list`: no `workspace_id` — resolves via `protocol_id`.
