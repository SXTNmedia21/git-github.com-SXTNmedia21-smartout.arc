---
title: "WalkAi Blueprint — Database Spread"
status: draft
updated: 2026-03-10
created: 2026-03-10
module: walkAi
tags: [blueprint, database, tables, walkAi]
---

# WalkAi Blueprint — Database Spread

Every database table that WalkAi reads from, writes to, or subscribes to — organized by system, with FK relationships, RLS patterns, and access modes.

---

## System 1: Conversational AI

Tables powering the voice/chat agent runtime — missions, stages, sessions, collected data, memory, and authority.

### engine_missions

| Property | Value |
|----------|-------|
| PK | `id TEXT` (human-readable, e.g. `"onboarding_welcome"`) |
| Key columns | `name`, `description`, `mode` (sequential/free/hybrid), `context_source`, `system_prompt`, `is_active`, `workspace_id` (NULL = global), `journey_id` |
| RLS | Global (NULL workspace_id) readable by all. Workspace-scoped: JWT via profile subquery OR API key. Mutations: service_role only. |
| WalkAi access | **Read** — loaded at session start to resolve mission definition |
| FK out | `workspace_id` -> workspace, `journey_id` -> journey |
| FK in | engine_stages.mission_id, engine_sessions.mission_id |

### engine_stages

| Property | Value |
|----------|-------|
| PK | `id UUID` |
| Key columns | `mission_id TEXT`, `stage_id TEXT`, `stage_order INT`, `goal`, `instructions`, `success_criteria`, `escalation_instructions`, `personality_override`, `emotion_hint`, `creative_freedom` (0.0-1.0), `next_stage`, `is_required`, `deferred_templates JSONB`, `inline_instructions JSONB`, `tuning_notes` |
| RLS | Cascading: `mission_id IN (SELECT id FROM engine_missions)`. Mutations: service_role. |
| WalkAi access | **Read** — loaded per stage advance |
| FK out | `mission_id` -> engine_missions (CASCADE), `journey_step_id` -> journey_step |
| Unique | `(mission_id, stage_id)`, `(mission_id, stage_order)` |

### engine_sessions

| Property | Value |
|----------|-------|
| PK | `id UUID` |
| Key columns | `mission_id` (nullable — NULL for agent mode), `workspace_id`, `user_id`, `profile_id`, `channel` (voice/sms/chat/email/autonomous), `mode` (mission/agent), `current_stage_id`, `stage_index`, `status` (active/complete/expired/abandoned), `context JSONB`, `collected_data JSONB`, `summary`, `callback_url`, `expires_at`, `stage_started_at`, `guardian_whisper_count`, `journey_id` |
| RLS | Workspace isolation: JWT via profile subquery OR API key. Full CRUD within workspace. |
| WalkAi access | **Read/Write** — create on conversation start, update context/stage during, complete on end |
| FK out | `mission_id` -> engine_missions, `workspace_id` -> workspace, `journey_id` -> journey |
| FK in | engine_inbox.session_id, engine_memory.source_session_id |
| Constraint | `chk_mission_mode_requires_mission` — mission mode requires non-NULL mission_id |

### engine_inbox

| Property | Value |
|----------|-------|
| PK | `id UUID` |
| Key columns | `session_id`, `stage_id TEXT`, `workspace_id`, `entity_type TEXT`, `data JSONB`, `validated BOOLEAN`, `processed BOOLEAN` |
| RLS | Workspace isolation: JWT via profile subquery OR API key. |
| WalkAi access | **Write** — stores collected data during conversation for async processing |
| FK out | `session_id` -> engine_sessions (CASCADE), `workspace_id` -> workspace |

### engine_memory

| Property | Value |
|----------|-------|
| PK | `id UUID` |
| Key columns | `profile_id`, `workspace_id`, `memory_type` (preference/fact/summary), `content TEXT`, `embedding vector(1536)`, `source_session_id`, `expires_at` |
| RLS | JWT read: workspace subquery on profile. API key read: `current_setting('app.workspace_id')`. Mutations: service_role only. |
| WalkAi access | **Read/Write** — vector search for relevant memories at session start; store new memories during and after conversation |
| FK out | `profile_id` -> profile, `workspace_id` -> workspace, `source_session_id` -> engine_sessions (SET NULL) |
| Indexes | **HNSW** on embedding (vector_cosine_ops, m=16, ef=64), composite on (workspace_id, profile_id, created_at DESC) |

### engine_authority_config

| Property | Value |
|----------|-------|
| PK | `id UUID` |
| Key columns | `workspace_id`, `capability TEXT` (e.g. profile, schedule, training), `level` (autonomous/confirm/suggest/read_only/disabled), `updated_by` |
| RLS | Admin/owner: JWT with role check. API key read: `current_setting`. Service role: full. |
| WalkAi access | **Read** — checked before every agent action to determine permission level |
| FK out | `workspace_id` -> workspace, `updated_by` -> user_identity |
| Unique | `(workspace_id, capability)` |

---

## System 2: Domain Process

Workflow engine tables — process definitions, event routing, running instances, and step-level tracking.

### engine_process

| Property | Value |
|----------|-------|
| PK | `id TEXT` (human-readable, e.g. `"daily_close"`, `"onboarding_14d"`) |
| Key columns | `name`, `description`, `workspace_id` (NULL = global), `is_active`, `max_steps` (default 50) |
| RLS | Global readable by all. Workspace-scoped: `get_workspace_ids_for_user()` OR API key. Mutations: service_role. |
| WalkAi access | **Read** — resolved when triggers fire to determine which process to spawn |
| FK out | `workspace_id` -> workspace |
| FK in | engine_step.process_id, engine_trigger.process_id, engine_state.process_id, journey.engine_process_id |

### engine_step

| Property | Value |
|----------|-------|
| PK | `id UUID` |
| Key columns | `process_id TEXT`, `step_order INT`, `step_group INT` (same group = parallel), `action_type TEXT`, `action_payload JSONB`, `condition JSONB`, `assignee_rule TEXT` (self/manager/department_head/role:x) |
| RLS | Cascading: `process_id IN (SELECT id FROM engine_process)`. Mutations: service_role. |
| WalkAi access | **Read** — loaded when a process instance starts (snapshot copied to engine_state.steps_snapshot) |
| FK out | `process_id` -> engine_process (CASCADE) |
| Unique | `(process_id, step_order)` |

### engine_trigger

| Property | Value |
|----------|-------|
| PK | `id UUID` |
| Key columns | `event_type TEXT`, `process_id TEXT`, `condition JSONB`, `delay_seconds INT` (default 0), `is_active`, `workspace_id` (NULL = global) |
| RLS | Global readable. Workspace-scoped: JWT OR API key. Mutations: service_role. |
| WalkAi access | **Read** — matched against incoming events to determine process spawning |
| FK out | `process_id` -> engine_process (CASCADE), `workspace_id` -> workspace |
| FK in | engine_state.trigger_id, engine_delayed_trigger.trigger_id |

### engine_event

| Property | Value |
|----------|-------|
| PK | `id UUID` |
| Key columns | `event_type TEXT`, `payload JSONB`, `workspace_id` (NOT NULL), `idempotency_key TEXT`, `fired_at` |
| RLS | Workspace-scoped: `get_workspace_ids_for_user()` OR API key. Mutations: service_role. |
| WalkAi access | **Write** — emits events on session state changes (stage completed, session completed, etc.) |
| FK out | `workspace_id` -> workspace |
| FK in | engine_delayed_trigger.event_id |
| Unique | `(idempotency_key)` WHERE NOT NULL |

### engine_state

| Property | Value |
|----------|-------|
| PK | `id UUID` |
| Key columns | `process_id TEXT`, `trigger_id`, `workspace_id`, `current_step INT`, `status` (pending/active/waiting/complete/failed/escalated), `entity_type TEXT`, `entity_id UUID`, `assignee_id`, `context JSONB`, `steps_snapshot JSONB`, `result JSONB`, `depth INT`, `parent_state_id` (self-ref), `retry_count`, `last_error` |
| RLS | Workspace-scoped: `get_workspace_ids_for_user()` OR API key. Mutations: service_role. |
| WalkAi access | **Read/Write** — spawned when triggers match; advanced step-by-step |
| FK out | `process_id` -> engine_process, `trigger_id` -> engine_trigger, `workspace_id` -> workspace, `parent_state_id` -> engine_state (self) |
| FK in | engine_state_step.state_id |
| Unique | `(entity_type, entity_id, process_id)` WHERE status IN (pending, active, waiting) — prevents duplicate active processes |

### engine_state_step

| Property | Value |
|----------|-------|
| PK | `id UUID` |
| Key columns | `state_id`, `step_order INT`, `status` (pending/active/completed/skipped/failed), `action_type TEXT`, `action_payload JSONB`, `condition JSONB`, `assignee_rule`, `completed_by`, `completed_at`, `result JSONB` |
| RLS | **Cascading**: `state_id IN (SELECT id FROM engine_state)` — inherits workspace isolation. Mutations: service_role. |
| WalkAi access | **Read/Write** — tracks per-step execution within running processes |
| FK out | `state_id` -> engine_state (CASCADE), `completed_by` -> profile |
| Unique | `(state_id, step_order)` |
| Trigger | `set_engine_state_step_updated_at` |

### engine_delayed_trigger

| Property | Value |
|----------|-------|
| PK | `id UUID` |
| Key columns | `trigger_id`, `event_id`, `workspace_id`, `fire_at TIMESTAMPTZ`, `fired BOOLEAN` |
| RLS | Workspace-scoped: JWT OR API key. Mutations: service_role. |
| WalkAi access | **Write** — queued when a trigger has delay_seconds > 0. **Read** by pg_cron polling. |
| FK out | `trigger_id` -> engine_trigger, `event_id` -> engine_event, `workspace_id` -> workspace |

### Governance Tables (Read-Only for WalkAi)

WalkAi reads these to understand what protocols/procedures an employee needs to complete, but does not create or modify governance definitions.

#### protocol

| Property | Value |
|----------|-------|
| PK | `protocol_id UUID` |
| Key columns | `workspace_id`, `policy_id`, `status` (draft/active/deprecated), `title`, `description` |
| WalkAi access | **Read** — loads protocol definitions for training/readiness context |
| FK out | `policy_id` -> policy, `workspace_id` -> workspace |

#### protocol_assignment

| Property | Value |
|----------|-------|
| PK | `protocol_assignment_id UUID` |
| Key columns | `protocol_id`, `profile_id`, `status` (pending/completed/expired), `assigned_at`, `completed_at` |
| WalkAi access | **Read** — checks employee readiness (% of assignments completed) |
| FK out | `protocol_id` -> protocol, `profile_id` -> profile |
| Note | No `workspace_id` — must join through `profile!inner(workspace_id)` for workspace scoping |

#### knowledge_test

| Property | Value |
|----------|-------|
| PK | `knowledge_test_id UUID` |
| Key columns | `protocol_id`, `workspace_id`, `title`, `questions JSONB`, `passing_score` |
| WalkAi access | **Read** — loads test definitions when guiding employee through training |
| FK out | `protocol_id` -> protocol, `workspace_id` -> workspace |

#### knowledge_test_attempt

| Property | Value |
|----------|-------|
| PK | `knowledge_test_attempt_id UUID` |
| Key columns | `knowledge_test_id`, `profile_id`, `protocol_assignment_id`, `workspace_id`, `score`, `answers JSONB`, `passed BOOLEAN` |
| WalkAi access | **Read/Write** — reads past attempts for context; writes new attempts when employee completes a test via conversation |
| FK out | `knowledge_test_id` -> knowledge_test, `profile_id` -> profile, `protocol_assignment_id` -> protocol_assignment |

#### procedure_step_completion

| Property | Value |
|----------|-------|
| PK | `procedure_step_completion_id UUID` |
| Key columns | `procedure_step_id`, `profile_id`, `protocol_assignment_id`, `workspace_id`, `completed_at` |
| WalkAi access | **Read/Write** — reads progress; writes completion when employee confirms step via conversation |
| FK out | `procedure_step_id` -> procedure_step, `profile_id` -> profile, `protocol_assignment_id` -> protocol_assignment |

#### confirmation_signature

| Property | Value |
|----------|-------|
| PK | `confirmation_signature_id UUID` |
| Key columns | `confirmation_id`, `profile_id`, `protocol_assignment_id`, `workspace_id`, `signature_data JSONB`, `signed_at` |
| WalkAi access | **Read/Write** — reads existing signatures; writes when employee acknowledges via conversation |
| FK out | `confirmation_id` -> confirmation, `profile_id` -> profile, `protocol_assignment_id` -> protocol_assignment |

---

## System 3: Guardian

Proactive monitoring — signals for health concerns, event logs for audit trail.

### guardian_signal

| Property | Value |
|----------|-------|
| PK | `id UUID` |
| Key columns | `workspace_id`, `signal_type TEXT`, `domain` (readiness/workspace_maturity/agent_behavior), `severity` (info/warning/critical), `entity_type`, `entity_id`, `entity_label`, `title`, `description`, `data JSONB`, `status` (active/acknowledged/resolved/dismissed), `source_check_id`, `acknowledged_by`, `acknowledged_at`, `resolved_at`, `expires_at` |
| RLS | JWT read: `get_workspace_ids_for_user()`. Service role: full CRUD. |
| WalkAi access | **Read/Write** — reads active signals for context; creates signals when detecting health concerns during conversation |
| FK out | `workspace_id` -> workspace, `acknowledged_by` -> profile |

### guardian_log

| Property | Value |
|----------|-------|
| PK | `id UUID` |
| Key columns | `workspace_id`, `session_id UUID`, `event_type TEXT`, `actor TEXT`, `summary TEXT`, `data JSONB` |
| RLS | JWT read: `get_workspace_ids_for_user()`. API key read: `get_api_workspace_id()`. Service role: full CRUD. |
| WalkAi access | **Write** — logs guardian events during conversation (whispers, escalations, signal creation) |
| FK out | `workspace_id` -> workspace |

---

## System 4: Journey / Mission

Journey definitions that link to engine_missions and engine_processes. These are the design-time blueprints that define what a user flow looks like.

### journey

| Property | Value |
|----------|-------|
| PK | `journey_id UUID` |
| Key columns | `workspace_id`, `code TEXT`, `title`, `slug`, `module` (journey_module enum), `actor` (employee/trainee/manager/admin/owner/all), `platform` (mobile/desktop/both), `priority` (P0-P3), `status` (journey_status enum — 13-value lifecycle), `engine_process_id`, `trigger_event`, `trigger_description`, `preconditions TEXT[]`, `related_journeys UUID[]`, `blocked_by UUID[]`, `tags TEXT[]`, `version INT` |
| RLS | Godmode: full CRUD. Workspace read: `get_workspace_ids_for_user()`. |
| WalkAi access | **Read** — loads journey definition for context when linked to a mission or process |
| FK out | `workspace_id` -> workspace, `engine_process_id` -> engine_process, `assignee_id` -> user_identity, `created_by` -> user_identity |
| FK in | journey_step.journey_id, journey_event.journey_id, engine_missions.journey_id, engine_sessions.journey_id |
| Unique | `(workspace_id, slug)`, `(workspace_id, code)` |

### journey_step

| Property | Value |
|----------|-------|
| PK | `journey_step_id UUID` |
| Key columns | `journey_id`, `workspace_id`, `step_order INT`, `title`, `action TEXT`, `expects TEXT`, `screen TEXT`, `component TEXT`, `slug`, `data_reads TEXT[]`, `data_writes TEXT[]`, `required_confirmation BOOLEAN`, `min_duration_seconds`, `max_duration_seconds`, `action_type_override`, `action_payload_override JSONB`, `notes` |
| RLS | Godmode: full CRUD. Workspace read: `get_workspace_ids_for_user()`. |
| WalkAi access | **Read** — loads step definitions for stage mapping |
| FK out | `journey_id` -> journey (CASCADE), `workspace_id` -> workspace |
| FK in | engine_stages.journey_step_id |
| Unique | `(journey_id, step_order)` |

### journey_event

| Property | Value |
|----------|-------|
| PK | `journey_event_id UUID` |
| Key columns | `journey_id`, `workspace_id`, `event_type` (status_change/test_run/output_generated/edit/comment), `from_status`, `to_status`, `metadata JSONB`, `actor_id` |
| RLS | Godmode: full CRUD. Workspace read: `get_workspace_ids_for_user()`. |
| WalkAi access | **Write** — logs journey-related status changes |
| FK out | `journey_id` -> journey (CASCADE), `workspace_id` -> workspace, `actor_id` -> user_identity |

### journey_test_run

| Property | Value |
|----------|-------|
| PK | `journey_test_run_id UUID` |
| Key columns | `journey_id`, `workspace_id`, `result` (pass/fail/skip/running), `duration_ms INT`, `error_message TEXT`, `test_output JSONB`, `triggered_by` |
| RLS | Godmode: full CRUD. Workspace read: `get_workspace_ids_for_user()`. |
| WalkAi access | **Read** — checks last test result for journey health |
| FK out | `journey_id` -> journey (CASCADE), `workspace_id` -> workspace, `triggered_by` -> user_identity |

---

## System 5: Identity & Context

Read-only context tables. WalkAi never modifies these — they provide workspace scope, user identity, and organizational structure.

### user_identity

| Property | Value |
|----------|-------|
| PK | `user_id UUID` |
| Key columns | `email`, `full_name`, `is_godmode BOOLEAN`, `preferred_language`, `created_at` |
| WalkAi access | **Read** — auth identity resolution, godmode check |
| FK in | engine_authority_config.updated_by, journey.assignee_id/created_by, journey_event.actor_id |

### profile

| Property | Value |
|----------|-------|
| PK | `profile_id UUID` |
| Key columns | `user_id`, `workspace_id`, `role` (employee/manager/admin/owner), `status` (trainee/active/inactive/offboarding), `display_name`, `department_id`, `is_active` |
| WalkAi access | **Read** — workspace member context, role/status for authority decisions, RLS subqueries |
| FK out | `user_id` -> user_identity, `workspace_id` -> workspace, `department_id` -> department |
| FK in | engine_memory.profile_id, engine_sessions.profile_id, engine_state_step.completed_by, guardian_signal.acknowledged_by, protocol_assignment.profile_id, all completion tables |

### company

| Property | Value |
|----------|-------|
| PK | `company_id UUID` |
| Key columns | `name`, `org_number`, `subscription_plan`, `subscription_status`, `trial_ends_at`, `industry` |
| WalkAi access | **Read** — subscription context, industry for engine behavior |
| FK in | workspace.company_id |

### workspace

| Property | Value |
|----------|-------|
| PK | `workspace_id UUID` |
| Key columns | `company_id`, `name`, `slug`, `contract_status`, `trial_started_at`, `trial_ends_at` |
| WalkAi access | **Read** — tenant container, referenced by nearly every other table |
| FK out | `company_id` -> company |
| FK in | Almost every workspace-scoped table |

### department

| Property | Value |
|----------|-------|
| PK | `department_id UUID` |
| Key columns | `workspace_id`, `name`, `description` |
| WalkAi access | **Read** — organizational structure context |
| FK out | `workspace_id` -> workspace |
| FK in | profile.department_id, department_session.department_id |

### team

| Property | Value |
|----------|-------|
| PK | `team_id UUID` |
| Key columns | `workspace_id`, `name`, `team_type` (operational/access/cross_department/seasonal/custom), `leader_profile_id`, `is_active` |
| WalkAi access | **Read** — team membership context for access grouping |
| FK out | `workspace_id` -> workspace, `leader_profile_id` -> profile |
| FK in | team_member.team_id, schedule_shift.team_id |

### Additional Context Tables (Read-Only)

| Table | PK | Key Columns | WalkAi Use |
|-------|----|----|------------|
| `handbook_chapter` | `handbook_chapter_id` | `workspace_id`, `chapter_key`, `title`, `content JSONB` | Read — handbook content for knowledge retrieval |
| `workspace_doc_chunk` | `chunk_id` | `workspace_id`, `source_type`, `content`, `embedding vector(1536)`, `token_count`, `metadata JSONB` | Read — semantic search via `match_workspace_docs()` RPC |
| `department_session` | `department_session_id` | `workspace_id`, `department_id`, `session_date`, `status` (upcoming/active/pending_signoff/closed/missed) | Read — daily operational context |
| `schedule_shift` | `schedule_shift_id` | `workspace_id`, `employee_id`, `shift_date`, `start_time`, `end_time`, `status`, `position_id` | Read — employee schedule context |
| `policy` | `policy_id` | `workspace_id`, `policy_type`, `title`, `scope` | Read — governance rule context |
| `procedure` | `procedure_id` | `protocol_id`, `workspace_id`, `title`, `procedure_type` | Read — training content |
| `procedure_step` | `procedure_step_id` | `procedure_id`, `step_order`, `title`, `content` | Read — individual training steps |
| `agent_profile` | `id` | `workspace_id`, `display_name`, `greeting`, `language`, personality sliders, voice settings | Read — AI agent personality/identity at session start |
| `agent_relationship` | `id` | `workspace_id`, `agent_profile_id`, `profile_id`, scores (familiarity, trust, sentiment, readiness) | Read/Write — relationship tracking per employee |

---

## FK Dependency Tree

```
workspace
├── engine_missions (optional FK, NULL = global)
│   ├── engine_stages (CASCADE)
│   │   └── ── journey_step_id -> journey_step
│   └── engine_sessions
│       ├── engine_inbox (CASCADE)
│       └── engine_memory (SET NULL via source_session_id)
├── engine_process (optional FK, NULL = global)
│   ├── engine_step (CASCADE)
│   ├── engine_trigger (CASCADE)
│   │   └── engine_delayed_trigger
│   └── journey.engine_process_id
├── engine_event
│   └── engine_delayed_trigger
├── engine_state (self-referencing via parent_state_id)
│   └── engine_state_step (CASCADE)
│       └── ── completed_by -> profile
├── engine_authority_config
│   └── ── updated_by -> user_identity
├── engine_memory
│   └── ── profile_id -> profile
├── guardian_signal
│   └── ── acknowledged_by -> profile
├── guardian_log
├── agent_profile (UNIQUE per workspace)
│   └── agent_relationship (CASCADE)
│       └── ── profile_id -> profile
├── workspace_doc_chunk (CASCADE)
├── handbook_chapter
├── journey
│   ├── journey_step (CASCADE)
│   │   └── engine_stages.journey_step_id
│   ├── journey_event (CASCADE)
│   └── journey_test_run (CASCADE)
├── protocol -> policy
│   ├── protocol_assignment -> profile
│   │   ├── knowledge_test_attempt
│   │   ├── procedure_step_completion
│   │   └── confirmation_signature
│   ├── procedure -> procedure_step
│   ├── knowledge_test
│   └── confirmation
├── department
│   ├── department_session
│   └── profile.department_id
├── team -> team_member -> profile
├── schedule_shift -> profile (employee_id)
└── profile -> user_identity
```

---

## Spread Matrix

Table x System membership. Shows which system owns each table and what access WalkAi has.

| # | Table | Conv. AI | Domain Process | Guardian | Journey | Identity | WalkAi Access |
|---|-------|:---:|:---:|:---:|:---:|:---:|---|
| 1 | engine_missions | **OWN** | | | | | R |
| 2 | engine_stages | **OWN** | | | | | R |
| 3 | engine_sessions | **OWN** | | | | | RW |
| 4 | engine_inbox | **OWN** | | | | | W |
| 5 | engine_memory | **OWN** | | | | | RW |
| 6 | engine_authority_config | **OWN** | | | | | R |
| 7 | engine_process | | **OWN** | | | | R |
| 8 | engine_step | | **OWN** | | | | R |
| 9 | engine_trigger | | **OWN** | | | | R |
| 10 | engine_event | | **OWN** | | | | W |
| 11 | engine_state | | **OWN** | | | | RW |
| 12 | engine_state_step | | **OWN** | | | | RW |
| 13 | engine_delayed_trigger | | **OWN** | | | | W |
| 14 | protocol | | ref | | | | R |
| 15 | protocol_assignment | | ref | | | | R |
| 16 | knowledge_test | | ref | | | | R |
| 17 | knowledge_test_attempt | | ref | | | | RW |
| 18 | procedure_step_completion | | ref | | | | RW |
| 19 | confirmation_signature | | ref | | | | RW |
| 20 | guardian_signal | | | **OWN** | | | RW |
| 21 | guardian_log | | | **OWN** | | | W |
| 22 | journey | | | | **OWN** | | R |
| 23 | journey_step | | | | **OWN** | | R |
| 24 | journey_event | | | | **OWN** | | W |
| 25 | journey_test_run | | | | **OWN** | | R |
| 26 | user_identity | | | | | **OWN** | R |
| 27 | profile | | | | | **OWN** | R |
| 28 | company | | | | | **OWN** | R |
| 29 | workspace | | | | | **OWN** | R |
| 30 | department | | | | | **OWN** | R |
| 31 | team | | | | | **OWN** | R |
| 32 | handbook_chapter | | | | | ref | R |
| 33 | workspace_doc_chunk | **ref** | | | | | R |
| 34 | agent_profile | **ref** | | | | | R |
| 35 | agent_relationship | **ref** | | | | | RW |
| 36 | department_session | | ref | | | | R |
| 37 | schedule_shift | | | | | ref | R |
| 38 | policy | | ref | | | | R |
| 39 | procedure | | ref | | | | R |
| 40 | procedure_step | | ref | | | | R |

**Legend:** OWN = system owns the table, ref = reads from another system's table, R = read, W = write, RW = read/write

---

## Service Access Matrix

Which runtime service touches which table.

| Table | Stage Engine (Hono) | Edge Functions | Web App (Next.js) | pg_cron |
|-------|:---:|:---:|:---:|:---:|
| engine_missions | RW | R | R | - |
| engine_stages | RW | R | R | - |
| engine_sessions | RW | R | RW | - |
| engine_inbox | RW | R | R | - |
| engine_memory | RW | R | R | - |
| engine_authority_config | R | R | RW | - |
| engine_process | RW | R | R | - |
| engine_step | RW | R | R | - |
| engine_trigger | RW | R | R | - |
| engine_event | RW | RW | R | - |
| engine_state | RW | RW | R | - |
| engine_state_step | RW | RW | R | - |
| engine_delayed_trigger | RW | R | - | **RW** |
| guardian_signal | RW | RW | R | - |
| guardian_log | RW | RW | R | - |
| journey | R | RW | RW | - |
| journey_step | R | RW | RW | - |
| journey_event | R | RW | R | - |
| journey_test_run | R | RW | R | - |
| agent_profile | RW | R | RW | - |
| agent_relationship | RW | R | R | - |
| workspace_doc_chunk | RW | RW | R | - |

**Legend:** R = read, RW = read/write, - = no access

---

## RLS Pattern Summary

| Pattern | Mechanism | Tables |
|---------|-----------|--------|
| **JWT (profile subquery)** | `workspace_id IN (SELECT workspace_id FROM profile WHERE user_id = auth.uid() AND is_active = true)` | engine_sessions, engine_inbox, engine_memory (read) |
| **JWT (helper function)** | `workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))` | engine_process, engine_event, engine_state, guardian_signal, guardian_log, journey tables, workspace_doc_chunk |
| **JWT (admin-gated)** | JWT + `is_admin_in_workspace(auth.uid(), workspace_id)` | engine_authority_config, agent_profile (write) |
| **API key** | `workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid` | engine_missions, engine_sessions, engine_inbox, engine_memory, engine_authority_config, agent_profile |
| **API key (helper)** | `workspace_id = get_api_workspace_id()` | guardian_log, workspace_doc_chunk |
| **Service role** | `auth.role() = 'service_role'` — full CRUD | All engine_* mutations, guardian mutations, doc_chunk mutations |
| **Cascading RLS** | Child FK IN (SELECT id FROM parent) — parent RLS filters first | engine_stages via engine_missions, engine_step via engine_process, engine_state_step via engine_state |
| **Global records** | `workspace_id IS NULL` visible to all | engine_missions, engine_process, engine_trigger |
| **Godmode** | `EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_godmode = true)` | journey, journey_step, journey_event, journey_test_run |
| **Own-profile read** | `profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())` | agent_relationship |

---

## Key Constraints

| Table | Constraint | Columns |
|-------|-----------|---------|
| engine_missions | CHECK | mode IN (sequential, free, hybrid) |
| engine_stages | UNIQUE | (mission_id, stage_id), (mission_id, stage_order) |
| engine_stages | CHECK | creative_freedom 0.0-1.0 |
| engine_sessions | CHECK | channel IN (voice, sms, chat, email, autonomous) |
| engine_sessions | CHECK | status IN (active, complete, expired, abandoned) |
| engine_sessions | CHECK | mode = 'agent' OR mission_id IS NOT NULL |
| engine_step | UNIQUE | (process_id, step_order) |
| engine_state | CHECK | status IN (pending, active, waiting, complete, failed, escalated) |
| engine_state | UNIQUE (partial) | (entity_type, entity_id, process_id) WHERE status IN (pending, active, waiting) |
| engine_state_step | CHECK | status IN (pending, active, completed, skipped, failed) |
| engine_state_step | UNIQUE | (state_id, step_order) |
| engine_event | UNIQUE (partial) | (idempotency_key) WHERE NOT NULL |
| engine_authority_config | UNIQUE | (workspace_id, capability) |
| engine_authority_config | CHECK | level IN (autonomous, confirm, suggest, read_only, disabled) |
| engine_memory | CHECK | memory_type IN (preference, fact, summary) |
| guardian_signal | CHECK | severity IN (info, warning, critical), status IN (active, acknowledged, resolved, dismissed) |
| agent_profile | UNIQUE | (workspace_id) — one agent per workspace |
| agent_relationship | UNIQUE | (agent_profile_id, profile_id) |
| journey | UNIQUE | (workspace_id, slug), (workspace_id, code) |
| journey_step | UNIQUE | (journey_id, step_order) |
