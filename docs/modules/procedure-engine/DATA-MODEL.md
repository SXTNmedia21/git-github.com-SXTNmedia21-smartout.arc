---
title: Procedure Engine — Data Model
status: in_progress
updated: 2026-05-22
created: 2026-05-20
module: procedure-engine
tags: [module, procedure-engine, data-model, schema, governance, policy, protocol, procedure, routine, manual, five-sources, day-line, fn-list-my-tasks, adr-0298, adr-0367, adr-0387]
---

# Procedure Engine — Data Model

> Every table the Procedure Engine reads or writes, the governance spine (policy→protocol→procedure/routine), the D6 runtime structure (department_session→day_line→session_task), the read RPC projection, gaps, and the schema divergences that make the read-normalization layer load-bearing.
>
> **Spec:** `docs/superpowers/specs/2026-05-22-procedure-engine-design.md` — authoritative source for gap details and phase decisions.

## 0. Governance spine — Policy → Protocol → Procedure → Routine (EXISTS)

The canonical model (spec §1). All tables verified in code.

### 0.1 `policy`
Migration: `00003_governance_tables.sql:13`.

| Column | Type | Notes |
|--------|------|-------|
| `policy_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL → workspace | |
| `policy_type` | TEXT | e.g. hms, ik-mat, brann |
| `policy_scope` | TEXT | workspace/department/team/location |
| `statement` | TEXT | the normative requirement |
| `enforcement_status` | TEXT | active/draft/archived |

### 0.2 `protocol`
Migration: `00003:39`.

| Column | Type | Notes |
|--------|------|-------|
| `protocol_id` | UUID PK | |
| `policy_id` | UUID UNIQUE NOT NULL → policy | **1:1** (UNIQUE constraint) |
| `workspace_id` | UUID NOT NULL | |
| `version` | INTEGER | current published version |
| `status` | TEXT | draft/active/archived |
| `evidence_tier` | TEXT | `quiz` / `quiz_plus_observer` / `quiz_plus_observer_plus_confirmation` / `four_eyes` |

`evidence_tier` drives how much proof is required before protocol_assignment status → `completed`. Auto-flip triggers update assignment status at step-completion / test-pass / signering.

### 0.3 `procedure`
Migration: `00003:61`.

| Column | Type | Notes |
|--------|------|-------|
| `procedure_id` | UUID PK | |
| `protocol_id` | UUID NOT NULL → protocol | currently 1:1; M:N reserved via `protocol_procedure` junction (decision 6) |
| `procedure_type` | enum | |
| `skill_requirements` | JSONB | |
| `sort_order` | INTEGER | |

### 0.4 `procedure_step`
Migration: `00003:80`.

| Column | Type | Notes |
|--------|------|-------|
| `step_id` | UUID PK | |
| `procedure_id` | UUID NOT NULL → procedure | |
| `title` | TEXT NOT NULL | |
| `step_order` | INTEGER NOT NULL | |
| `is_required` | BOOLEAN | |
| `estimated_minutes` | INTEGER | |
| `training_content` | TEXT (markdown) | **inline step learning content** ("how to do this step") — NOT a manual |
| `media_urls` | JSONB | `{type, url, caption}` array |

**Two distinct content layers:** `training_content`/`media_urls` = inline step content (execution-coupled). `manual` (new table, §0.8) = standalone document (intro/overview/Q&A). Different purpose, no duplication.

### 0.5 `routine`
Migration: `00003:107`.

| Column | Type | Notes |
|--------|------|-------|
| `routine_id` | UUID PK | |
| `protocol_id` | UUID → protocol | |
| `procedure_id` | UUID NOT NULL → procedure | steps live here |
| `trigger_type` | TEXT | `scheduled` / `event` |
| `trigger_config` | JSONB | times/days/event spec |
| `assigned_to_type` | TEXT | `role` / `team` / `profile` / `location` |
| `assigned_to_ref` | UUID | single FK (team gap → routine_team junction) |
| `control_list_id` | UUID → control_list | optional |
| `control_frequency` | TEXT | |
| `control_nth` | INTEGER | |
| `is_active` | BOOLEAN | |
| `location_id` | UUID → location | **GAP G-loc — DOES NOT EXIST YET** |
| `workspace_id` | UUID | **GAP G-loc — DOES NOT EXIST YET (denorm)** |
| `executor_type` | enum | `human`/`ai`/`system`/`hybrid` — **Phase 1 schema delta** |

**A routine has no step table of its own — its steps are the linked procedure's steps.**

### 0.6 `knowledge_test` / `confirmation` / `control_list` / `runbook`
Migration: `00003`.

| Table | Role | Key fields |
|-------|------|------------|
| `knowledge_test` | quiz | `protocol_id`, `questions` (jsonb), `pass_threshold`, `max_attempts` |
| `confirmation` | signering | `protocol_id`, `confirmation_text`, `requires_signature` |
| `control_list` | sjekkliste | `protocol_id`, **`items` jsonb** (no child table), `assigned_to_type`; **no workspace_id** (via protocol) |
| `runbook` (+`runbook_step`) | incident response | `protocol_id`, **`control_list_id` NOT NULL**, `trigger_event`, `escalation_chain` jsonb |

### 0.7 `protocol_assignment` + execution proof tables
Migration: `00003` + later migrations.

| Table | Role | Key fields |
|-------|------|------------|
| `protocol_assignment` | assignment + progress | `profile_id`, `protocol_id`, `status`, **`protocol_version` (snapshot)**, denormalized counters, `next_review_at` |
| `knowledge_test_attempt` | quiz execution (immutable) | `score`, `passed`, `attempt_number` |
| `confirmation_signature` | signing proof (immutable) | `signed_at`, `ip_address` |
| `procedure_step_completion` | step proof (immutable) | `evidence` (jsonb) |
| `observer_request` | four-eyes verification | `subject_profile_id`, `observer_profile_id`, `status` |

### 0.8 `manual` — NEW TABLE (GAP G-manual — does not exist yet)

Standalone document with `manual_type` + polymorphic FK. Distinct from `procedure_step.training_content`.

| Column | Type | Notes |
|--------|------|-------|
| `manual_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL | |
| `manual_type` | TEXT | `routine_overview` / `procedure_intro` / `qna` / `general` (extensible) |
| `procedure_id` | UUID → procedure | nullable polymorphic FK |
| `routine_id` | UUID → routine | nullable polymorphic FK |
| `protocol_id` | UUID → protocol | nullable polymorphic FK |
| `sections` | JSONB | blocks: text/video/image/checklist |
| `version` | INTEGER | |

ManualBuilder (port `manual-builder.jsx`) authors; ManualViewer/Guide renders.

### 0.9 `protocol_procedure` — Reserved M:N junction (decision 6)

Not yet migrated. Reserve when a procedure (e.g. clean-grill) needs to appear in multiple protocols (HACCP + HMS + Brann + Opening). Populate 1:1 until then.

---

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

## 3. Governance templates (summary — full detail in §0 above)

See §0 for full column-level detail of each governance table.

| Table | PK | Key columns | Migration |
|---|---|---|---|
| `policy` | `policy_id` | workspace, `policy_type`, `policy_scope`, `statement`, `enforcement_status` | `00003:13` |
| `protocol` | `protocol_id` | `policy_id` (UNIQUE — 1:1), workspace, `version`, `status`, **`evidence_tier`** | `00003:39` |
| `procedure` | `procedure_id` | `protocol_id`, `procedure_type` enum, `skill_requirements` jsonb, `sort_order` | `00003:61` |
| `procedure_step` | `step_id` | `procedure_id`, `title`, `step_order`, `is_required`, `estimated_minutes`, **`training_content`** (markdown), **`media_urls`** (jsonb) | `00003:80` |
| `routine` | `routine_id` | `protocol_id`, **`procedure_id` NOT NULL** (steps live here), `trigger_type`(scheduled/event), `trigger_config` jsonb, `assigned_to_type/ref`, `control_list_id`, `control_frequency`, `control_nth`, `is_active`; **GAP G-loc: no `location_id`/`workspace_id`**; **Phase 1: +`executor_type`** | `00003:107` |
| `control_list` | `control_list_id` | `protocol_id`, **`items` jsonb** (no child table), `assigned_to_type`; **no workspace_id** (via protocol) | `00003:92` |
| `runbook` (+`runbook_step`) | `runbook_id` | `protocol_id`, **`control_list_id` NOT NULL**, `trigger_event`, `escalation_chain` jsonb | `00003:129` |
| `protocol_assignment` | `id` | `profile_id`, `protocol_id`, `status`, **`protocol_version` (snapshot)**, denorm counters, `next_review_at` | `00003` + later |
| `manual` | `manual_id` | **GAP G-manual — NEW TABLE** (manual_type + sections jsonb + polymorphic FK) | not yet migrated |
| `routine_team` | (routine, team) | **GAP G-team — NEW TABLE** junction 0..N | not yet migrated |
| `protocol_procedure` | (protocol, procedure) | **Reserved M:N** — populate 1:1 until needed | not yet migrated |

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
