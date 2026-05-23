---
title: "Procedure Engine — Data Model"
status: in_progress
mirror: mixed
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: procedure-engine
tags: [domain, procedure-engine, data-model, schema, governance, policy, protocol, procedure, routine, five-sources, day-line, fn-list-my-tasks, adr-0298, adr-0367, adr-0391]
---

# Procedure Engine — Data Model

> Every table the Procedure Engine reads or writes, the governance spine (policy→protocol→procedure/routine), the five task-source instances, the D6 anchor structure, the read RPC projection, Phase 1 schema additions (ADR-0391), and gap tables not yet migrated.
> **Code wins.** `mirror: mixed` — governance spine + instance tables + Phase 1 migrations verified vs code. Gap tables (`manual`, `protocol_procedure`) are aspirational.

## 0. Governance spine — VERIFIED

All tables in `supabase/migrations/00003_governance_tables.sql`.

### `policy` (line 13)
| Column | Type | Notes |
|--------|------|-------|
| `policy_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL → workspace | |
| `policy_type` | TEXT | hms, ik-mat, brann, etc. |
| `policy_scope` | TEXT | workspace/department/team/location |
| `statement` | TEXT | the normative requirement |
| `enforcement_status` | TEXT | active/draft/archived |

### `protocol` (line 39)
| Column | Type | Notes |
|--------|------|-------|
| `protocol_id` | UUID PK | |
| `policy_id` | UUID UNIQUE NOT NULL → policy | **1:1** (UNIQUE constraint) |
| `workspace_id` | UUID NOT NULL | |
| `version` | INTEGER | current published version |
| `status` | TEXT | draft/active/archived |
| `evidence_tier` | TEXT | `quiz` / `quiz_plus_observer` / `quiz_plus_observer_plus_confirmation` / `four_eyes` |

`evidence_tier` drives how much proof is required before `protocol_assignment.status → completed`. Auto-flip triggers update assignment status at step-completion / test-pass / signering.

### `procedure` (line 61)
| Column | Type | Notes |
|--------|------|-------|
| `procedure_id` | UUID PK | |
| `protocol_id` | UUID NOT NULL → protocol | currently 1:1; M:N reserved via `protocol_procedure` junction (gap G-m2n) |
| `procedure_type` | enum | |
| `skill_requirements` | JSONB | |
| `sort_order` | INTEGER | |

### `procedure_step` (line 80)
| Column | Type | Notes |
|--------|------|-------|
| `step_id` | UUID PK | |
| `procedure_id` | UUID NOT NULL → procedure | |
| `title` | TEXT NOT NULL | |
| `step_order` | INTEGER NOT NULL | |
| `is_required` | BOOLEAN | |
| `estimated_minutes` | INTEGER | |
| `training_content` | TEXT (markdown) | **inline step learning content** — NOT a manual |
| `media_urls` | JSONB | `{type, url, caption}` array |

> Two distinct content layers: `training_content`/`media_urls` = inline step content (execution-coupled). `manual` (gap G-manual) = standalone document (intro/overview/Q&A). Different purpose, no duplication.

### `routine` (line 107) — Phase 1 additions verified (`20260622100000`)
| Column | Type | Notes |
|--------|------|-------|
| `routine_id` | UUID PK | |
| `protocol_id` | UUID → protocol | |
| `procedure_id` | UUID NOT NULL → procedure | steps live in procedure_step |
| `trigger_type` | TEXT | `scheduled` / `event` |
| `trigger_config` | JSONB | times/days/event spec |
| `assigned_to_type` | TEXT | `role` / `team` / `profile` / `location` |
| `assigned_to_ref` | UUID | single FK (team gap → routine_team junction) |
| `control_list_id` | UUID → control_list | optional |
| `control_frequency` | TEXT | |
| `control_nth` | INTEGER | |
| `is_active` | BOOLEAN | |
| `location_id` | UUID → location | **Phase 1 ADR-0391 — ADDED** (`20260622100000:20`) |
| `workspace_id` | UUID → workspace | **Phase 1 ADR-0391 — ADDED** (trigger-backfilled from protocol, `20260622100000:24–36`) |
| `executor_type` | `routine_executor_type` enum | **Phase 1 ADR-0391 — ADDED** (`20260622100000:14–18`); `human`\|`ai`\|`system`\|`hybrid`, default `human` |

A routine has no step table of its own — its steps are the linked procedure's steps.

### `routine_team` — Phase 1 addition VERIFIED (`20260622100000:41–67`)
| Column | Type | Notes |
|--------|------|-------|
| `routine_id` | UUID NOT NULL → routine (CASCADE) | |
| `team_id` | UUID NOT NULL → team (CASCADE) | |
| `workspace_id` | UUID NOT NULL → workspace | |
| `created_at` | TIMESTAMPTZ | |
| PK | `(routine_id, team_id)` | |

RLS: jwt read (`get_workspace_ids_for_user`), jwt manage (`is_admin_in_workspace(auth.uid(), workspace_id)` — two-arg verified), api_key read, service_role full. Zero rows = location-wide / pickup.

### `knowledge_test` / `confirmation` / `control_list` / `runbook` (line 92+)
| Table | Role | Key fields |
|-------|------|------------|
| `knowledge_test` | quiz | `protocol_id`, `questions` (jsonb), `pass_threshold`, `max_attempts` |
| `confirmation` | signering | `protocol_id`, `confirmation_text`, `requires_signature` |
| `control_list` | sjekkliste | `protocol_id`, **`items` jsonb** (no child table, no per-item runtime state), `assigned_to_type`; **no workspace_id** (via protocol) |
| `runbook` (+`runbook_step`) | incident response | `protocol_id`, `control_list_id` NOT NULL, `trigger_event`, `escalation_chain` jsonb |

### `protocol_assignment` + execution proof tables
| Table | Role | Key fields |
|-------|------|------------|
| `protocol_assignment` | assignment + progress | `profile_id`, `protocol_id`, `status`, `protocol_version` (snapshot), denorm counters, `next_review_at` |
| `knowledge_test_attempt` | quiz proof (immutable) | `score`, `passed`, `attempt_number` |
| `confirmation_signature` | signing proof (immutable) | `signed_at`, `ip_address` |
| `procedure_step_completion` | step proof (immutable) | `evidence` (jsonb) |
| `observer_request` | four-eyes | `subject_profile_id`, `observer_profile_id`, `status` |

---

## 1. Five task-source tables (instance axis) — VERIFIED

### `session_task` — D6 Production (shared DDL with day-session)
Migrations: `20260412100300_session_infrastructure.sql:67–82` + `20260412100000_session_enums.sql:23–31` + day_line FKs `20260620120600:7,12` + **provenance triple `20260622100500`**.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `workspace_id` | UUID NOT NULL → workspace | RLS root |
| `department_session_id` | UUID NOT NULL → department_session | always-populated anchor |
| `session_hook_id` | UUID → session_hook | nullable |
| `day_line_id` | UUID → day_line | nullable (ADR-0367); set = area-anchored |
| `scheduled_at` | TIMESTAMPTZ | nullable; push pipeline trigger |
| `title` | TEXT NOT NULL | |
| `description` | TEXT | |
| `status` | `session_task_status` enum | pending/available/in_progress/completed/skipped/overdue/escalated |
| `assigned_to` | UUID → profile | |
| `completed_by` | UUID → profile | |
| `completed_at` | TIMESTAMPTZ | |
| `evidence` | JSONB | HACCP `{measured_value, notes}` |
| `is_compliance_required` | BOOLEAN NOT NULL DEFAULT false | drives priority='high' |
| `origin` | `task_origin` enum | **Phase 1 ADR-0391** — session/adhoc/routine/procedure/projection/manual |
| `generated_by` | `task_generated_by` enum | **Phase 1 ADR-0391** — cron/manager/agent/system |
| `source_reference` | UUID | **Phase 1 ADR-0391** — FK-less ref (session_hook.id/routine_id/template_id), interpreted via `origin` |

> **DDL seam:** `session_task` table structure is owned by day-session (it is the D6 runtime surface that `session-hook-executor` writes into). Procedure-engine generates the rows (via cron + `task` capability). See GAPS §5 for the full seam decision.

### `schedule_day_task` — D6 ad-hoc
Migration: `20260301600003_schedule_persistence_tables.sql:305–349`. PK = `schedule_day_task_id` (differs from `id`). Title field = `label`. Status = free TEXT (no CHECK — gap G14). Date anchor = `shift_date` (no `department_session_id`, no `day_line_id`).

### `personal_task` — C2 Agent-Utility
Migration: `20260520100000_personal_task.sql:15–27`. Owner = `profile_id`. No `completed_at` (gap G13), no `description`, no `assigned_to`. Status = TEXT+CHECK (open/done/cancelled).

### `emma_task` — C2 Agent-Utility (agent-curated)
Migration: `20260311042814_emma_task.sql:4–17` + `20260311060000_emma_task_cron_and_limit.sql`. Max-3 active per profile via `check_emma_task_limit()` trigger. Cron `emma-task-trigger` flips `pending`→`triggered` at `due_at`. `triggered_at` maps to `completed_at` in RPC.

### Schema divergence map (why the read layer is load-bearing)

| Concept | session_task | schedule_day_task | personal_task | emma_task |
|---|---|---|---|---|
| PK | `id` | `schedule_day_task_id` | `id` | `id` |
| Title | `title` | `label` | `title` | `title` |
| Status | enum | free TEXT | TEXT+CHECK | TEXT+CHECK |
| `completed_at` | ✅ | ✅ | ❌ | via `triggered_at` |
| `assigned_to` | ✅ | ✅ | ❌ (owner) | ❌ (owner) |
| `description` | ✅ | ❌ | ❌ | ✅ |
| `priority` | synth | synth | column | constant |
| Provenance | origin/generated_by/source_reference | ❌ | ❌ | ❌ |

---

## 2. D6 anchor structure — VERIFIED (procedure-engine reads, day-session owns DDL)

| Table | Key columns | Migration |
|---|---|---|
| `department_session` | workspace, department, season, `session_date`, status enum, `planned_open/close`; UNIQUE(workspace, dept, date) | `20260304200000` + `20260421100350` |
| `day_line` | dept_session (CASCADE), `location_id` NOT NULL (RESTRICT), `business_date`, `planned_open`/`planned_close`, `source_template_id`, UNIQUE(dept_session, location); **no status column** | `20260620120200` |
| `shift_session` | dept_session, `schedule_shift_id` UNIQUE, `employee_id`, `location_id`, status(scheduled/clocked_in/clocked_out/cancelled), `push_topic` | `20260620120300` |
| `shift_session_day_line` | M:N join shift→day_line | `20260620120400` |
| `session_hook` | workspace, department, `hook_type` enum, `trigger_offset_min`, `linked_procedure_id`, `linked_routine_id`; UNIQUE(workspace, dept, hook_type); **template — no day_line_id** | `20260412100300` + `20260620120600` |

The **shift→tasks chain:** `schedule_shift → shift_session (1:1) → shift_session_day_line (M:N) → day_line → session_task WHERE day_line_id = day_line.day_line_id`. Mobile renders this (`use-shift-session.ts:65` + `useDayLineItems`). Cron-spawned tasks lack `day_line_id` = **gap G3**.

---

## 3. `fn_list_my_tasks` projection — VERIFIED

Migrations: `20260606120100` (v1) + `20260607100100` (v2). `SECURITY DEFINER`, `STABLE`, granted to `authenticated` only.

Returned columns: `id`, `source`(session|day_ad_hoc|personal|emma), `raw_status`, `status`(normalized), `title`, `description`, `due_at`, `priority`, `assigned_to`, `workspace_id`, `session_id`, `hook_id`, `compliance`, `created_at`, `completed_at`, `origin_actor`, `hook_linked_procedure_id`, `hook_linked_routine_id`.

**NOT projected (Phase R1 gap):** `day_line_id`, `scheduled_at`, `location_id`, `origin`, `generated_by`, `source_reference`. These columns exist on `session_task` since `20260620120600` + `20260622100500` but were never added to the RPC return type.

---

## 4. Phase 1 schema additions summary (ADR-0391) — VERIFIED

| Migration | What | Verified |
|---|---|---|
| `20260622100000_routine_location_team_scope.sql` | `routine_executor_type` enum; `routine.location_id`, `.workspace_id`, `.executor_type`; `set_routine_workspace_id()` trigger; `routine_team` table + RLS + indexes | ✅ file read |
| `20260622100500_session_task_provenance.sql` | `task_origin` enum; `task_generated_by` enum; `session_task.origin`, `.generated_by`, `.source_reference` columns | ✅ file read |

---

## 5. Gap tables — ASPIRATIONAL (not yet migrated)

| Table | Purpose | Gap |
|---|---|---|
| `manual` | Standalone document (`manual_type` + `sections jsonb` + polymorphic FK to procedure/routine/protocol) — distinct from `procedure_step.training_content` | G-manual |
| `protocol_procedure` | Reserved M:N junction; populate 1:1 until a procedure appears in multiple protocols | G-m2n |

---

## 6. RLS summary — VERIFIED

- `session_task`: JWT read/update (workspace members; WITH CHECK `20260608120000`), service_role full.
- `schedule_day_task`: JWT read (member), insert/update/delete (`is_admin_in_workspace`), api_key full. (Gap G15: RLS requires admin; `task.create_day_ad_hoc` gates at manager+. Hidden by service_role bypass.)
- `personal_task`: JWT owner-only, service_role full, api_key read-only.
- `emma_task`: JWT read/write (workspace member — broader than personal_task), service_role.
- `routine_team`: JWT read (`get_workspace_ids_for_user`), manage (`is_admin_in_workspace` two-arg), api_key read, service_role.
- `control_list`: no `workspace_id` — resolves via `protocol_id`.

---

## 7. Telemetry registry (key events) — VERIFIED

`packages/telemetry/src/registry.ts`. See ARCHITECTURE §L5 for full routing table.

| Event | Status |
|---|---|
| `task created` / `task completed` / `task cancelled` | ✅ live |
| `task.list_mine` (read) | ✅ live |
| `routine.created` | ✅ Phase 1 (verify routing in registry) |
| Legacy aliases `session_task.created` / `task.added_manual` | deprecated 30-day |
