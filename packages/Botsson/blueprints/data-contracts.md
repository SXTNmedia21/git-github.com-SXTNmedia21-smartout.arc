---
title: "Botsson Data Contracts"
status: draft
updated: 2026-03-10
created: 2026-03-10
module: Botsson
tags: [blueprint, database, types, contracts, schema]
---

# Botsson Data Contracts

Reference document for all database tables, TypeScript types, enums, RLS patterns, relationships, and constraints that Botsson depends on.

> Source of truth: code + migrations. If this doc contradicts code, CODE wins.

---

## 1. Core Enums

### MissionMode

How stages within a mission are navigated.

| Value        | Description                                             |
| ------------ | ------------------------------------------------------- |
| `sequential` | Stages are walked in `stage_order`. No skipping.        |
| `free`       | Agent chooses stages freely based on conversation flow. |
| `hybrid`     | Fixed start and end stages, free-order middle stages.   |

- DB: `engine_missions.mode TEXT CHECK (mode IN ('sequential', 'free', 'hybrid'))`, default `'sequential'`
- TS: `type MissionMode = "sequential" | "free" | "hybrid"` (`services/stage-engine/src/types/session.ts`)

### SessionMode

Distinguishes structured mission workflows from free-form agent conversations.

| Value     | Description                                                                 |
| --------- | --------------------------------------------------------------------------- |
| `mission` | Multi-stage workflow driven by a mission definition. `mission_id` required. |
| `agent`   | Free-form conversation. `mission_id` is NULL.                               |

- DB: `engine_sessions.mode TEXT CHECK (mode IN ('mission', 'agent'))`, default `'mission'`
- TS: `type SessionMode = "mission" | "agent"` (`services/stage-engine/src/types/session.ts`)
- Constraint: `chk_mission_mode_requires_mission` ensures `mode = 'agent' OR mission_id IS NOT NULL`

### SessionChannel

Communication channel for the session.

| Value        | Description                          |
| ------------ | ------------------------------------ |
| `voice`      | Real-time voice via Ultravox/LiveKit |
| `sms`        | SMS messages                         |
| `chat`       | Text chat (web/app)                  |
| `email`      | Email-based interaction              |
| `autonomous` | System-initiated, no human channel   |

- DB: `engine_sessions.channel TEXT CHECK (channel IN ('voice', 'sms', 'chat', 'email', 'autonomous'))`
- TS: `type SessionChannel = "voice" | "sms" | "chat" | "email" | "autonomous"` (`services/stage-engine/src/types/session.ts`)

### SessionStatus

Session lifecycle status.

| Value       | Description                            |
| ----------- | -------------------------------------- |
| `active`    | In progress                            |
| `complete`  | All stages done or agent concluded     |
| `expired`   | Passed `expires_at` without completing |
| `abandoned` | User left, never returned              |

- DB: `engine_sessions.status TEXT CHECK (status IN ('active', 'complete', 'expired', 'abandoned'))`, default `'active'`
- TS: `type SessionStatus = "active" | "complete" | "expired" | "abandoned"` (`services/stage-engine/src/types/session.ts`)

### CapabilityName

Capabilities the AI agent can exercise, gated by authority config.

| Value           | Description                                  |
| --------------- | -------------------------------------------- |
| `knowledge`     | Handbook, policy lookup, document search     |
| `schedule`      | Read/write shift schedules                   |
| `training`      | Protocol assignments, readiness tracking     |
| `operations`    | Department sessions, deviations              |
| `profile`       | Employee profile data                        |
| `communication` | Send notifications, messages                 |
| `memory`        | Persistent memory read/write                 |
| `payroll`       | Payroll data access                          |
| `ui`            | UI manipulation (context pushes, navigation) |

- DB: `engine_authority_config.capability TEXT` (no enum constraint, validated in application)
- TS: `type CapabilityName` (`packages/ai/src/capabilities/types.ts`)
- Note: 9 values defined in TS. `guardian` also appears in seed data but is not in the TS type.

### AuthorityLevel

How much autonomy the agent has for a given capability in a workspace.

| Value        | Description                                  |
| ------------ | -------------------------------------------- |
| `autonomous` | Agent acts without asking. Full autonomy.    |
| `confirm`    | Agent proposes, waits for user confirmation. |
| `suggest`    | Agent suggests, human decides.               |
| `read_only`  | Agent can read data but not modify anything. |
| `disabled`   | Capability fully disabled.                   |

- DB: `engine_authority_config.level TEXT CHECK (level IN ('autonomous', 'confirm', 'suggest', 'read_only', 'disabled'))`, default `'read_only'`
- TS: `type AuthorityLevel = "autonomous" | "confirm" | "suggest" | "read_only" | "disabled"` (`packages/ai/src/capabilities/types.ts`)

### EngineStateStatus

Status for domain process instances (engine_state).

| Value       | Description               |
| ----------- | ------------------------- |
| `pending`   | Created, not yet started  |
| `active`    | Currently executing       |
| `waiting`   | Blocked on external event |
| `complete`  | Finished successfully     |
| `failed`    | Terminated with error     |
| `escalated` | Escalated to human        |

- DB: `engine_state.status TEXT CHECK (status IN ('pending', 'active', 'waiting', 'complete', 'failed', 'escalated'))`, default `'pending'`
- TS: Zod enum `EngineStateStatus` (`packages/types/src/engine.ts`)

### EngineActionType

Step action types in the domain process engine.

| Value                 | Description                   |
| --------------------- | ----------------------------- |
| `assign_task`         | Assign a task to a person     |
| `send_notification`   | Send notification             |
| `wait_for_event`      | Pause until event fires       |
| `schedule_control`    | Schedule-related action       |
| `start_process`       | Spawn a sub-process           |
| `update_entity`       | Modify an entity              |
| `create_deviation`    | Create a deviation record     |
| `validate_settlement` | Validate financial settlement |
| `lock_checkout`       | Lock checkout process         |

- DB: `engine_step.action_type TEXT NOT NULL` (no constraint, validated in application)
- TS: Zod enum `EngineActionType` (`packages/types/src/engine.ts`)

### EngineStateStepStatus

Per-step execution status within a running process instance.

| Value       | Description           |
| ----------- | --------------------- |
| `pending`   | Not yet started       |
| `active`    | Currently executing   |
| `completed` | Successfully finished |
| `skipped`   | Skipped by condition  |
| `failed`    | Failed execution      |

- DB: `engine_state_step.status TEXT CHECK (status IN ('pending', 'active', 'completed', 'skipped', 'failed'))`, default `'pending'`

### AgentStatus (Client-side)

Provider-agnostic voice/chat agent connection status.

| Value           | Description                       |
| --------------- | --------------------------------- |
| `idle`          | Not connected                     |
| `connecting`    | Establishing connection           |
| `listening`     | Connected, waiting for user input |
| `thinking`      | Processing user input             |
| `speaking`      | Agent is responding               |
| `disconnecting` | Tearing down connection           |
| `disconnected`  | Connection closed                 |

- TS: `type AgentStatus` (`packages/agent-sdk/src/types.ts`)
- Not persisted in DB. Client-side only.

---

## 2. Database Tables

### engine_missions

Reusable agent workflow definitions. Missions are templates; sessions are instances.

| Column           | Type        | Nullable | Default        | Description                                         |
| ---------------- | ----------- | -------- | -------------- | --------------------------------------------------- |
| `id`             | TEXT        | NO       | -              | PK. Human-readable slug (e.g. `"onboarding"`)       |
| `name`           | TEXT        | NO       | -              | Display name                                        |
| `description`    | TEXT        | YES      | NULL           | Optional description                                |
| `mode`           | TEXT        | NO       | `'sequential'` | `sequential \| free \| hybrid`                      |
| `context_source` | TEXT        | YES      | NULL           | Where to load context from                          |
| `workspace_id`   | UUID        | YES      | NULL           | FK `workspace`. NULL = global mission               |
| `journey_id`     | UUID        | YES      | NULL           | FK `journey`. The user journey this mission follows |
| `is_active`      | BOOLEAN     | NO       | `true`         | Soft-delete flag                                    |
| `system_prompt`  | TEXT        | YES      | NULL           | Base personality prompt wrapping all stage prompts  |
| `created_at`     | TIMESTAMPTZ | NO       | `now()`        |                                                     |
| `updated_at`     | TIMESTAMPTZ | NO       | `now()`        |                                                     |

**Indexes:**

- `idx_engine_missions_context` on `(context_source)` WHERE `is_active = true`
- `idx_engine_missions_workspace` on `(workspace_id)` WHERE `is_active = true`
- `idx_engine_missions_journey` on `(journey_id)` WHERE `journey_id IS NOT NULL`

**Migration sources:** `20260301200000_engine_tables.sql`, `20260318100000_mission_journey_link.sql`, `20260318120000_engine_tuning_notes_and_mission_prompt.sql`

---

### engine_stages

Ordered steps within a mission. Contains agent instructions and personality overlay.

| Column                    | Type        | Nullable | Default             | Description                                            |
| ------------------------- | ----------- | -------- | ------------------- | ------------------------------------------------------ |
| `id`                      | UUID        | NO       | `gen_random_uuid()` | PK                                                     |
| `mission_id`              | TEXT        | NO       | -                   | FK `engine_missions(id)` ON DELETE CASCADE             |
| `stage_id`                | TEXT        | NO       | -                   | Human-readable stage identifier                        |
| `stage_order`             | INTEGER     | NO       | -                   | Execution order within mission                         |
| `goal`                    | TEXT        | NO       | -                   | What this stage aims to achieve                        |
| `instructions`            | TEXT        | NO       | -                   | Detailed instructions for the agent                    |
| `success_criteria`        | TEXT        | NO       | -                   | How to determine stage completion                      |
| `escalation_instructions` | TEXT        | YES      | NULL                | What to do when stuck                                  |
| `personality_override`    | TEXT        | YES      | NULL                | Override base personality for this stage               |
| `emotion_hint`            | TEXT        | YES      | NULL                | Emotional tone hint                                    |
| `creative_freedom`        | REAL        | NO       | `0.7`               | 0.0-1.0 scale for agent creativity                     |
| `next_stage`              | TEXT        | YES      | NULL                | Override for next stage (used in `free`/`hybrid` mode) |
| `is_required`             | BOOLEAN     | NO       | `true`              | Whether this stage can be skipped                      |
| `journey_step_id`         | UUID        | YES      | NULL                | FK `journey_step`. Screen/component/action context     |
| `tuning_notes`            | TEXT        | YES      | NULL                | Coaching hints injected into the prompt                |
| `deferred_templates`      | JSONB       | NO       | `'[]'`              | Templates loaded lazily                                |
| `inline_instructions`     | JSONB       | NO       | `'[]'`              | Instructions embedded directly                         |
| `created_at`              | TIMESTAMPTZ | NO       | `now()`             |                                                        |

**Constraints:**

- `uq_mission_stage` UNIQUE `(mission_id, stage_id)` -- no duplicate stage IDs per mission
- `uq_mission_order` UNIQUE `(mission_id, stage_order)` -- no duplicate ordering per mission
- CHECK `creative_freedom >= 0 AND creative_freedom <= 1`

**Indexes:**

- `idx_engine_stages_mission` on `(mission_id, stage_order)`
- `idx_engine_stages_journey_step` on `(journey_step_id)` WHERE `journey_step_id IS NOT NULL`

**Migration sources:** `20260301200000_engine_tables.sql`, `20260318100000_mission_journey_link.sql`, `20260318120000_engine_tuning_notes_and_mission_prompt.sql`

---

### engine_sessions

Active conversation instances. One row per running session.

| Column                   | Type        | Nullable | Default              | Description                                            |
| ------------------------ | ----------- | -------- | -------------------- | ------------------------------------------------------ |
| `id`                     | UUID        | NO       | `gen_random_uuid()`  | PK                                                     |
| `mode`                   | TEXT        | NO       | `'mission'`          | `mission \| agent`                                     |
| `mission_id`             | TEXT        | YES      | -                    | FK `engine_missions(id)`. NULL when `mode = 'agent'`   |
| `journey_id`             | UUID        | YES      | NULL                 | FK `journey`. Copied from mission at creation          |
| `workspace_id`           | UUID        | YES      | -                    | FK `workspace`. NULL during onboarding (pre-workspace) |
| `user_id`                | UUID        | YES      | NULL                 | Supabase auth user                                     |
| `profile_id`             | UUID        | YES      | NULL                 | Workspace profile                                      |
| `channel`                | TEXT        | NO       | -                    | `voice \| sms \| chat \| email \| autonomous`          |
| `current_stage_id`       | TEXT        | YES      | NULL                 | Current stage being executed                           |
| `stage_index`            | INTEGER     | NO       | `0`                  | Ordinal position in stage sequence                     |
| `stage_started_at`       | TIMESTAMPTZ | YES      | NULL                 | When current stage began (for Guardian timing)         |
| `status`                 | TEXT        | NO       | `'active'`           | `active \| complete \| expired \| abandoned`           |
| `context`                | JSONB       | NO       | `'{}'`               | Session-level context data                             |
| `collected_data`         | JSONB       | NO       | `'{}'`               | All data collected during session                      |
| `summary`                | TEXT        | YES      | NULL                 | Session summary (set on completion)                    |
| `callback_url`           | TEXT        | YES      | NULL                 | URL to call on session completion                      |
| `guardian_whisper_count` | INTEGER     | NO       | `0`                  | Number of Guardian whispers this session               |
| `expires_at`             | TIMESTAMPTZ | YES      | `now() + '24 hours'` | NULL = never auto-expires                              |
| `completed_at`           | TIMESTAMPTZ | YES      | NULL                 | When session completed                                 |
| `created_at`             | TIMESTAMPTZ | NO       | `now()`              |                                                        |
| `updated_at`             | TIMESTAMPTZ | NO       | `now()`              |                                                        |

**Constraints:**

- `chk_mission_mode_requires_mission`: `mode = 'agent' OR mission_id IS NOT NULL`

**Indexes:**

- `idx_engine_sessions_workspace_status` on `(workspace_id, status)` WHERE `status = 'active'`
- `idx_engine_sessions_expiry` on `(expires_at)` WHERE `status = 'active'`
- `idx_engine_sessions_mission` on `(mission_id, workspace_id, status)`
- `idx_engine_sessions_agent_profile` on `(workspace_id, profile_id, created_at DESC)` WHERE `mode = 'agent'`
- `idx_engine_sessions_journey` on `(journey_id)` WHERE `journey_id IS NOT NULL`

**Migration sources:** `20260301200000_engine_tables.sql`, `20260302000200_engine_sessions_mode.sql`, `20260323100000_journey_timing_and_guardian_fields.sql`, `20260324100000_engine_sessions_nullable_expiry.sql`, `20260330200000_engine_sessions_nullable_workspace.sql`

---

### engine_inbox

Generic data inbox where agents store collected information during sessions.

| Column         | Type        | Nullable | Default             | Description                                         |
| -------------- | ----------- | -------- | ------------------- | --------------------------------------------------- |
| `id`           | UUID        | NO       | `gen_random_uuid()` | PK                                                  |
| `session_id`   | UUID        | NO       | -                   | FK `engine_sessions(id)` ON DELETE CASCADE          |
| `stage_id`     | TEXT        | NO       | -                   | Which stage produced this entry                     |
| `workspace_id` | UUID        | NO       | -                   | FK `workspace`                                      |
| `entity_type`  | TEXT        | NO       | -                   | Category (e.g. `"company_info"`, `"employee_data"`) |
| `data`         | JSONB       | NO       | -                   | Freeform collected data                             |
| `validated`    | BOOLEAN     | NO       | `false`             | Whether data has been validated                     |
| `processed`    | BOOLEAN     | NO       | `false`             | Whether data has been consumed downstream           |
| `created_at`   | TIMESTAMPTZ | NO       | `now()`             |                                                     |

**Indexes:**

- `idx_engine_inbox_session` on `(session_id, stage_id)`
- `idx_engine_inbox_processing` on `(workspace_id, processed)` WHERE `processed = false`

**Migration source:** `20260301200000_engine_tables.sql`

---

### engine_memory

Persistent memory for the AI agent across sessions. Stores preferences, facts, and conversation summaries per employee.

| Column              | Type         | Nullable | Default             | Description                                 |
| ------------------- | ------------ | -------- | ------------------- | ------------------------------------------- |
| `id`                | UUID         | NO       | `gen_random_uuid()` | PK                                          |
| `profile_id`        | UUID         | NO       | -                   | FK `profile(profile_id)`                    |
| `workspace_id`      | UUID         | NO       | -                   | FK `workspace`                              |
| `memory_type`       | TEXT         | NO       | -                   | `preference \| fact \| summary`             |
| `content`           | TEXT         | NO       | -                   | The memory text                             |
| `embedding`         | vector(1536) | YES      | NULL                | pgvector embedding for semantic search      |
| `source_session_id` | UUID         | YES      | NULL                | FK `engine_sessions(id)` ON DELETE SET NULL |
| `expires_at`        | TIMESTAMPTZ  | YES      | NULL                | Optional expiry for temporary memories      |
| `created_at`        | TIMESTAMPTZ  | NO       | `now()`             |                                             |
| `updated_at`        | TIMESTAMPTZ  | NO       | `now()`             |                                             |

**Indexes:**

- `idx_engine_memory_embedding` HNSW `(embedding vector_cosine_ops)` WITH `(m = 16, ef_construction = 64)` -- vector similarity search
- `idx_engine_memory_profile` on `(workspace_id, profile_id, created_at DESC)` -- profile memory lookup
- `idx_engine_memory_expiry` on `(expires_at)` WHERE `expires_at IS NOT NULL` -- cleanup sweep

**Migration source:** `20260302000000_engine_memory.sql`

---

### engine_authority_config

Per-workspace, per-capability authority levels. Controls what the agent can do autonomously.

| Column         | Type        | Nullable | Default             | Description                                        |
| -------------- | ----------- | -------- | ------------------- | -------------------------------------------------- |
| `id`           | UUID        | NO       | `gen_random_uuid()` | PK                                                 |
| `workspace_id` | UUID        | NO       | -                   | FK `workspace`                                     |
| `capability`   | TEXT        | NO       | -                   | Capability name (see CapabilityName enum)          |
| `level`        | TEXT        | NO       | `'read_only'`       | Authority level (see AuthorityLevel enum)          |
| `updated_by`   | UUID        | NO       | -                   | FK `user_identity(user_id)`. Who last changed this |
| `created_at`   | TIMESTAMPTZ | NO       | `now()`             |                                                    |
| `updated_at`   | TIMESTAMPTZ | NO       | `now()`             |                                                    |

**Constraints:**

- `uq_workspace_capability` UNIQUE `(workspace_id, capability)` -- one config per capability per workspace

**Indexes:**

- `idx_authority_workspace` on `(workspace_id)`

**Migration source:** `20260302000100_engine_authority_config.sql`

---

### engine_process

Domain process definitions (NOT the same as engine_missions). Used for operational workflows: daily close, onboarding sequences, HACCP checks, etc.

| Column         | Type        | Nullable | Default | Description                                    |
| -------------- | ----------- | -------- | ------- | ---------------------------------------------- |
| `id`           | TEXT        | NO       | -       | PK. Human-readable slug (e.g. `"daily_close"`) |
| `name`         | TEXT        | NO       | -       | Display name                                   |
| `description`  | TEXT        | YES      | NULL    |                                                |
| `workspace_id` | UUID        | YES      | NULL    | FK `workspace`. NULL = global process          |
| `is_active`    | BOOLEAN     | NO       | `true`  |                                                |
| `max_steps`    | INTEGER     | NO       | `50`    | Maximum step depth                             |
| `created_at`   | TIMESTAMPTZ | NO       | `now()` |                                                |
| `updated_at`   | TIMESTAMPTZ | NO       | `now()` |                                                |

**Migration source:** `20260304100000_engine_process_tables.sql`

---

### engine_step

Steps within a domain process. Parallel execution via `step_group`.

| Column           | Type        | Nullable | Default             | Description                                      |
| ---------------- | ----------- | -------- | ------------------- | ------------------------------------------------ |
| `id`             | UUID        | NO       | `gen_random_uuid()` | PK                                               |
| `process_id`     | TEXT        | NO       | -                   | FK `engine_process(id)` ON DELETE CASCADE        |
| `step_order`     | INTEGER     | NO       | -                   | Execution order                                  |
| `step_group`     | INTEGER     | YES      | NULL                | Same group = parallel execution                  |
| `action_type`    | TEXT        | NO       | -                   | Action to perform (see EngineActionType)         |
| `action_payload` | JSONB       | NO       | `'{}'`              | Action-specific parameters                       |
| `condition`      | JSONB       | YES      | NULL                | Condition to evaluate before executing           |
| `assignee_rule`  | TEXT        | YES      | NULL                | `self`, `manager`, `department_head`, `role:<x>` |
| `created_at`     | TIMESTAMPTZ | NO       | `now()`             |                                                  |

**Constraints:**

- `uq_process_step_order` UNIQUE `(process_id, step_order)`

**Indexes:**

- `idx_engine_step_process` on `(process_id, step_order)`

**Migration source:** `20260304100000_engine_process_tables.sql`

---

### engine_trigger

Maps event types to process starts. When an event fires, matching triggers spawn process instances.

| Column          | Type        | Nullable | Default             | Description                                      |
| --------------- | ----------- | -------- | ------------------- | ------------------------------------------------ |
| `id`            | UUID        | NO       | `gen_random_uuid()` | PK                                               |
| `event_type`    | TEXT        | NO       | -                   | Event pattern (e.g. `"session.closing_started"`) |
| `process_id`    | TEXT        | NO       | -                   | FK `engine_process(id)` ON DELETE CASCADE        |
| `condition`     | JSONB       | YES      | NULL                | Filter: `{"match": {"department": "kitchen"}}`   |
| `delay_seconds` | INTEGER     | YES      | `0`                 | Delay before process starts                      |
| `is_active`     | BOOLEAN     | NO       | `true`              |                                                  |
| `workspace_id`  | UUID        | YES      | NULL                | FK `workspace`. NULL = global trigger            |
| `created_at`    | TIMESTAMPTZ | NO       | `now()`             |                                                  |

**Indexes:**

- `idx_engine_trigger_event` on `(event_type)` WHERE `is_active = true`

**Migration source:** `20260304100000_engine_process_tables.sql`

---

### engine_event

Immutable event log. All events entering the system are recorded here.

| Column            | Type        | Nullable | Default             | Description                                        |
| ----------------- | ----------- | -------- | ------------------- | -------------------------------------------------- |
| `id`              | UUID        | NO       | `gen_random_uuid()` | PK                                                 |
| `event_type`      | TEXT        | NO       | -                   | Dot-notation event type (e.g. `"shift.completed"`) |
| `payload`         | JSONB       | NO       | `'{}'`              | Event data                                         |
| `workspace_id`    | UUID        | YES      | -                   | FK `workspace`. NULL for pre-workspace events      |
| `idempotency_key` | TEXT        | YES      | NULL                | Prevents duplicate processing                      |
| `fired_at`        | TIMESTAMPTZ | NO       | `now()`             | When the event occurred                            |

**Indexes:**

- `idx_engine_event_idempotency` UNIQUE on `(idempotency_key)` WHERE `idempotency_key IS NOT NULL`
- `idx_engine_event_type` on `(event_type, fired_at DESC)`
- `idx_engine_event_workspace` on `(workspace_id, fired_at DESC)`

**Migration sources:** `20260304100000_engine_process_tables.sql`, `20260308194429_engine_event_nullable_workspace.sql`

---

### engine_state

Running domain process instances. One row per active process run.

| Column            | Type        | Nullable | Default             | Description                                            |
| ----------------- | ----------- | -------- | ------------------- | ------------------------------------------------------ |
| `id`              | UUID        | NO       | `gen_random_uuid()` | PK                                                     |
| `trigger_id`      | UUID        | YES      | NULL                | FK `engine_trigger(id)`                                |
| `process_id`      | TEXT        | NO       | -                   | FK `engine_process(id)`                                |
| `workspace_id`    | UUID        | YES      | -                   | FK `workspace`. NULL for pre-workspace processes       |
| `current_step`    | INTEGER     | NO       | `0`                 | Current step position                                  |
| `status`          | TEXT        | NO       | `'pending'`         | See EngineStateStatus enum                             |
| `entity_type`     | TEXT        | YES      | NULL                | `'department_session'`, `'shift'`, `'employee'`, etc.  |
| `entity_id`       | UUID        | YES      | NULL                | Reference to the tracked entity                        |
| `assignee_id`     | UUID        | YES      | NULL                | Currently assigned user                                |
| `context`         | JSONB       | NO       | `'{}'`              | Runtime context data                                   |
| `steps_snapshot`  | JSONB       | YES      | NULL                | Frozen copy of process steps at start                  |
| `result`          | JSONB       | YES      | NULL                | Accumulated step results                               |
| `depth`           | INTEGER     | NO       | `0`                 | Nesting depth (sub-processes)                          |
| `parent_state_id` | UUID        | YES      | NULL                | FK `engine_state(id)` self-reference for sub-processes |
| `retry_count`     | INTEGER     | NO       | `0`                 | How many retries have occurred                         |
| `last_error`      | TEXT        | YES      | NULL                | Last error message                                     |
| `started_at`      | TIMESTAMPTZ | NO       | `now()`             |                                                        |
| `updated_at`      | TIMESTAMPTZ | NO       | `now()`             |                                                        |
| `completed_at`    | TIMESTAMPTZ | YES      | NULL                |                                                        |

**Constraints:**

- `idx_engine_state_unique_active` UNIQUE `(entity_type, entity_id, process_id)` WHERE `status IN ('pending', 'active', 'waiting')` -- prevents duplicate active processes per entity

**Indexes:**

- `idx_engine_state_entity` on `(entity_type, entity_id)`
- `idx_engine_state_workspace_status` on `(workspace_id, status)` WHERE `status IN ('pending', 'active', 'waiting')`
- `idx_engine_state_process` on `(process_id, status)`

**Migration sources:** `20260304100000_engine_process_tables.sql`, `20260308194432_engine_state_nullable_workspace.sql`

---

### engine_state_step

Per-step runtime tracking within an engine_state instance.

| Column           | Type        | Nullable | Default             | Description                                           |
| ---------------- | ----------- | -------- | ------------------- | ----------------------------------------------------- |
| `id`             | UUID        | NO       | `gen_random_uuid()` | PK                                                    |
| `state_id`       | UUID        | NO       | -                   | FK `engine_state(id)` ON DELETE CASCADE               |
| `step_order`     | INTEGER     | NO       | -                   | Step position                                         |
| `status`         | TEXT        | NO       | `'pending'`         | `pending \| active \| completed \| skipped \| failed` |
| `action_type`    | TEXT        | NO       | -                   | Action type from the step definition                  |
| `action_payload` | JSONB       | NO       | `'{}'`              | Action parameters                                     |
| `condition`      | JSONB       | YES      | NULL                | Condition from the step definition                    |
| `assignee_rule`  | TEXT        | YES      | NULL                | Assignment rule                                       |
| `completed_by`   | UUID        | YES      | NULL                | FK `profile(profile_id)`. Who completed this step     |
| `completed_at`   | TIMESTAMPTZ | YES      | NULL                |                                                       |
| `result`         | JSONB       | YES      | NULL                | Step execution result                                 |
| `created_at`     | TIMESTAMPTZ | NO       | `now()`             |                                                       |
| `updated_at`     | TIMESTAMPTZ | NO       | `now()`             | Auto-updated via `set_updated_at()` trigger           |

**Constraints:**

- `uq_state_step_order` UNIQUE `(state_id, step_order)`

**Indexes:**

- `idx_engine_state_step_state` on `(state_id, step_order)` -- primary lookup
- `idx_engine_state_step_active` on `(state_id, status)` WHERE `status IN ('pending', 'active')` -- find actionable steps

**Migration source:** `20260412100100_engine_state_step.sql`

---

### engine_delayed_trigger

Timer queue for delayed trigger firing. Polled by pg_cron every minute.

| Column         | Type        | Nullable | Default             | Description                   |
| -------------- | ----------- | -------- | ------------------- | ----------------------------- |
| `id`           | UUID        | NO       | `gen_random_uuid()` | PK                            |
| `trigger_id`   | UUID        | NO       | -                   | FK `engine_trigger(id)`       |
| `event_id`     | UUID        | NO       | -                   | FK `engine_event(id)`         |
| `workspace_id` | UUID        | NO       | -                   | FK `workspace`                |
| `fire_at`      | TIMESTAMPTZ | NO       | -                   | When to fire                  |
| `fired`        | BOOLEAN     | NO       | `false`             | Whether it has been processed |
| `created_at`   | TIMESTAMPTZ | NO       | `now()`             |                               |

**Indexes:**

- `idx_engine_delayed_trigger_fire` on `(fire_at)` WHERE `fired = false`

**Migration source:** `20260304100000_engine_process_tables.sql`

---

### guardian_signal

Workspace health monitoring signals. Generated by guardian-sweep Edge Function.

| Column            | Type        | Nullable | Default             | Description                                               |
| ----------------- | ----------- | -------- | ------------------- | --------------------------------------------------------- |
| `id`              | UUID        | NO       | `gen_random_uuid()` | PK                                                        |
| `workspace_id`    | UUID        | NO       | -                   | FK `workspace`                                            |
| `signal_type`     | TEXT        | NO       | -                   | Signal category                                           |
| `domain`          | TEXT        | NO       | -                   | `'readiness' \| 'workspace_maturity' \| 'agent_behavior'` |
| `severity`        | TEXT        | NO       | -                   | `'info' \| 'warning' \| 'critical'`                       |
| `entity_type`     | TEXT        | YES      | NULL                | Optional entity reference type                            |
| `entity_id`       | UUID        | YES      | NULL                | Optional entity reference                                 |
| `entity_label`    | TEXT        | YES      | NULL                | Human-readable entity label                               |
| `title`           | TEXT        | NO       | -                   | Signal title                                              |
| `description`     | TEXT        | YES      | NULL                | Detailed description                                      |
| `data`            | JSONB       | YES      | `'{}'`              | Signal-specific data                                      |
| `status`          | TEXT        | NO       | `'active'`          | `'active' \| 'acknowledged' \| 'resolved' \| 'dismissed'` |
| `acknowledged_by` | UUID        | YES      | NULL                | FK `profile(profile_id)`                                  |
| `acknowledged_at` | TIMESTAMPTZ | YES      | NULL                |                                                           |
| `resolved_at`     | TIMESTAMPTZ | YES      | NULL                |                                                           |
| `source_check_id` | TEXT        | YES      | NULL                | ID of the guardian check that produced this               |
| `created_at`      | TIMESTAMPTZ | NO       | `now()`             |                                                           |
| `updated_at`      | TIMESTAMPTZ | NO       | `now()`             |                                                           |
| `expires_at`      | TIMESTAMPTZ | YES      | NULL                | Optional auto-expiry                                      |

**Indexes:**

- `idx_guardian_signal_active` on `(workspace_id, status, severity, created_at DESC)` WHERE `status = 'active'`
- `idx_guardian_signal_entity` on `(workspace_id, entity_type, entity_id)`

**Migration sources:** `20260314000000_guardian_signal.sql`, `20260314200000_guardian_signal_rls_policies.sql`

---

### guardian_log

Persisted Guardian event bus events. History/replay and WebSocket fallback.

| Column         | Type        | Nullable | Default             | Description                                              |
| -------------- | ----------- | -------- | ------------------- | -------------------------------------------------------- |
| `id`           | UUID        | NO       | `gen_random_uuid()` | PK                                                       |
| `workspace_id` | UUID        | NO       | -                   | FK `workspace`                                           |
| `session_id`   | UUID        | NO       | -                   | Session that generated the event                         |
| `event_type`   | TEXT        | NO       | -                   | Event type                                               |
| `actor`        | TEXT        | NO       | -                   | `'system' \| 'agent' \| 'user' \| 'guardian' \| 'admin'` |
| `summary`      | TEXT        | NO       | -                   | Human-readable summary                                   |
| `data`         | JSONB       | YES      | `'{}'`              | Event data                                               |
| `created_at`   | TIMESTAMPTZ | NO       | `now()`             |                                                          |
| `updated_at`   | TIMESTAMPTZ | NO       | `now()`             |                                                          |

**Indexes:**

- `idx_guardian_log_session` on `(session_id, created_at)` -- session event feed
- `idx_guardian_log_workspace` on `(workspace_id, created_at DESC)` -- dashboard list

**Migration source:** `20260314100000_guardian_log.sql`

---

## 3. TypeScript Types

### packages/types/src/engine.ts

Zod schemas with inferred types for the domain process engine.

```typescript
// Enums
EngineStateStatus; // "pending" | "active" | "waiting" | "complete" | "failed" | "escalated"
EngineActionType; // "assign_task" | "send_notification" | "wait_for_event" | ...
TimeoutAction; // "fail" | "escalate" | "skip" | "retry"

// Condition Language (composable)
EngineCondition; // { match: Record } | { step_status: { step, is } } | { all: [] } | { any: [] }

// Core Schemas (Zod objects)
EngineProcess; // id, name, description?, workspace_id?, is_active, max_steps
EngineStep; // id, process_id, step_order, step_group?, action_type, action_payload, condition?, assignee_rule?
EngineEvent; // id, event_type, payload, workspace_id, idempotency_key?, fired_at
EngineState; // id, trigger_id?, process_id, workspace_id, current_step, status, entity_type?, entity_id?,
//   assignee_id?, context, steps_snapshot?, result?, depth, retry_count, last_error?
```

### services/stage-engine/src/types/session.ts

Mirror of database schema for the conversational AI engine.

```typescript
MissionMode; // "sequential" | "free" | "hybrid"
SessionMode; // "mission" | "agent"
SessionChannel; // "voice" | "sms" | "chat" | "email" | "autonomous"
SessionStatus; // "active" | "complete" | "expired" | "abandoned"

Mission; // Full mission row type
Stage; // Full stage row type (includes tuning_notes, deferred_templates, inline_instructions)
JourneyStep; // Journey step with timing + confirmation fields
Session; // Full session row type
InboxEntry; // Inbox row type
```

### services/stage-engine/src/types/api.ts

Request/response types for all stage-engine API endpoints.

```typescript
CreateSessionRequest; // mission_id, workspace_id?, user_id?, profile_id?, channel, callback_url?, context?
CreateSessionResponse; // session_id, mission, current_stage, stages?, context, progress, system_prompt
StageInfo; // stage_id, goal, instructions, success_criteria, emotion_hint? (subset of Stage)
StoreRequest; // entity_type, data, stage_id?
FetchRequest; // query_type: "context" | "inbox" | "stage" | "history", filters?
AdvanceRequest; // result?, next_stage_id?, force?
AdvanceResponse; // new_stage?, progress, complete, system_prompt?, summary?
```

### services/stage-engine/src/types/agent.ts

Types for agent-mode (free-form) conversations.

```typescript
AgentChatRequest; // message, session_id?, profile_id, channel?
AgentChatResponse; // session_id, response, intent?: { capability, confidence }
ConversationTurn; // role: "user" | "assistant", content, timestamp
```

### services/stage-engine/src/types/auth.ts

Auth context attached to every authenticated request.

```typescript
AuthContext; // method: "api_key" | "jwt", workspaceId, userId?, scopes?
```

### packages/ai/src/capabilities/types.ts

AI capability system types.

```typescript
CapabilityName; // 9 values (knowledge, schedule, training, ...)
AuthorityLevel; // 5 values (autonomous, confirm, suggest, read_only, disabled)
AgentToolContext; // workspaceId, profileId, userId?, sessionId, supabaseAdmin
CapabilityDefinition; // name, description, tools[], readOnlyTools[], suggestTools?
Personality; // formality, assertiveness, warmth, humor, verbosity (all numbers)
Situation; // "onboarding" | "haccp" | "scheduling" | "training" | "operations" | "guardian" | "general"
ProfileRole; // "employee" | "manager" | "admin" | "owner"
```

### packages/agent-sdk/src/types.ts

Client-side agent types for voice/chat integration.

```typescript
AgentStatus; // 7 values (idle, connecting, listening, ...)
AgentChannel; // "voice" | "chat" | "phone"
AgentConfig; // missionId, tools?, provider?, channel?, autoStart?, apiEndpoint?, apiParams?, onDebug?, onStatusChange?, onTranscript?
AgentSession; // status, isConnected, isSpeaking, isMuted, currentText, transcript[], debugLog[], startSession(), endSession(), toggleMic(), sendContext()
TranscriptEntry; // role: "user" | "agent", text
DebugEntry; // timestamp, type, content
DebugEntryType; // "status" | "tool_call" | "tool_result" | "context_push" | "inference" | "event"
ClientTool; // name, description, parameters[], implementation
ClientToolKit; // definitions[], implementations
VoiceSession; // join(), leave(), muteMic(), unmuteMic(), sendText(), registerTool(), on(), off()
VoiceProvider; // name, createSession()
```

### services/stage-engine/src/types/guardian.ts

Guardian WebSocket message types.

```typescript
GuardianEvent; // type: "event", session_id, workspace_id, event_type, actor, summary, data, timestamp
GuardianSessionList; // type: "sessions", sessions[]
GuardianCommand; // subscribe | unsubscribe | change_stage | whisper
```

### services/stage-engine/src/types/ultravox.ts

Ultravox voice provider integration types.

```typescript
CreateUltravoxCallRequest; // mission_id, workspace_id, user_id?, profile_id?, voice?, language?
CreateUltravoxCallResponse; // session_id, call_id, join_url
UltravoxHttpTool; // temporaryTool with http config (server-side tools)
UltravoxClientTool; // temporaryTool with client config (browser-side tools)
UltravoxNewStageResponse; // systemPrompt, toolResultText, selectedTools?, temperature?, voice?, languageHint?
UltravoxCreateCallPayload; // systemPrompt, model?, voice?, languageHint?, temperature?, firstSpeaker?, selectedTools, medium?
```

---

## 4. RLS Patterns

Three auth paths are used across all engine tables.

### JWT Path (User Sessions)

Standard pattern for authenticated users. Resolves workspace membership via profile lookup.

```sql
-- Direct workspace membership
workspace_id IN (
  SELECT workspace_id FROM public.profile
  WHERE user_id = auth.uid() AND is_active = true
)

-- Via helper function (used in process engine tables)
workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
```

### API Key Path (External Consumers)

API key consumers set `app.workspace_id` via `set_config()` in a transaction.

```sql
workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
```

- The helper function `get_api_workspace_id()` wraps this pattern in some tables (guardian_log, guardian_signal).

### Cascading RLS via Subquery

Child tables inherit parent table's RLS without duplicating `workspace_id`.

```sql
-- engine_stages inherits from engine_missions
mission_id IN (SELECT id FROM engine_missions)

-- engine_state_step inherits from engine_state
state_id IN (SELECT id FROM engine_state)
```

PostgreSQL applies the parent table's RLS policies to the subquery, so workspace isolation cascades automatically.

### Global Records (NULL workspace_id)

Tables with nullable `workspace_id` allow global records visible to all:

```sql
workspace_id IS NULL  -- global, visible to everyone
OR workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
```

Used by: `engine_missions`, `engine_process`, `engine_trigger`

### Service Role

All engine tables have a service_role policy for full access:

```sql
CREATE POLICY "manage_*" ON table FOR ALL USING (auth.role() = 'service_role');
```

### Admin-Only Write Access

`engine_authority_config` restricts writes to admin/owner roles:

```sql
workspace_id IN (
  SELECT workspace_id FROM public.profile
  WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner')
)
```

---

## 5. Key Relationships

### Conversational AI Engine

```
engine_missions (template)
  ├──< engine_stages (ordered steps)
  │      └──? journey_step (UI context)
  ├──? journey (user journey definition)
  └──< engine_sessions (instances)
         ├──< engine_inbox (collected data)
         ├──< engine_memory (via source_session_id)
         └──? guardian_log (event history)
```

- **Mission --> Stages**: 1:N, cascading delete. Stages ordered by `stage_order`.
- **Session --> Mission**: N:1. NULL when `mode = 'agent'`.
- **Session --> Inbox**: 1:N, cascading delete. One entry per data collection action.
- **Mission --> Journey**: N:1 optional. Links AI workflow to UI journey.
- **Stage --> JourneyStep**: N:1 optional. Links stage to specific UI step.
- **Memory --> Session**: N:1 optional (via `source_session_id`). SET NULL on session delete.

### Domain Process Engine

```
engine_process (blueprint)
  ├──< engine_step (ordered steps)
  ├──< engine_trigger (event matchers)
  │      └──< engine_delayed_trigger (timer queue)
  └──< engine_state (running instances)
         └──< engine_state_step (per-step tracking)

engine_event (immutable log)
  └──< engine_delayed_trigger
```

- **Process --> Steps**: 1:N, cascading delete. Steps ordered by `step_order`, grouped by `step_group`.
- **Process --> Triggers**: 1:N, cascading delete. Multiple events can start the same process.
- **Trigger --> DelayedTrigger**: 1:N. Created when `delay_seconds > 0`.
- **State --> StateStep**: 1:N, cascading delete. Runtime mirror of process steps.
- **State --> State**: Self-referencing via `parent_state_id` for sub-processes.
- **Journey --> Process**: 1:1 optional (via `journey.engine_process_id`). Set by compile function.

### Guardian System

```
guardian_signal (workspace health)
  └──? profile (acknowledged_by)

guardian_log (event history)
  └── workspace
```

- `guardian_log.session_id` is a UUID but NOT a FK to `engine_sessions` -- it can reference any session type.

### Cross-System Links

| From                      | To               | Via                 | Cardinality |
| ------------------------- | ---------------- | ------------------- | ----------- |
| `engine_missions`         | `journey`        | `journey_id`        | N:1         |
| `engine_stages`           | `journey_step`   | `journey_step_id`   | N:1         |
| `engine_sessions`         | `journey`        | `journey_id`        | N:1         |
| `journey`                 | `engine_process` | `engine_process_id` | 1:1         |
| `engine_memory`           | `profile`        | `profile_id`        | N:1         |
| `engine_authority_config` | `user_identity`  | `updated_by`        | N:1         |

---

## 6. Constraints and Indexes

### Unique Constraints

| Table                     | Constraint                          | Columns                      | Notes                                      |
| ------------------------- | ----------------------------------- | ---------------------------- | ------------------------------------------ |
| `engine_stages`           | `uq_mission_stage`                  | `(mission_id, stage_id)`     | No duplicate stage IDs per mission         |
| `engine_stages`           | `uq_mission_order`                  | `(mission_id, stage_order)`  | No duplicate ordering per mission          |
| `engine_step`             | `uq_process_step_order`             | `(process_id, step_order)`   | No duplicate ordering per process          |
| `engine_state_step`       | `uq_state_step_order`               | `(state_id, step_order)`     | No duplicate ordering per state            |
| `engine_authority_config` | `uq_workspace_capability`           | `(workspace_id, capability)` | One config per capability per workspace    |
| `engine_sessions`         | `chk_mission_mode_requires_mission` | CHECK constraint             | `mode = 'agent' OR mission_id IS NOT NULL` |

### Partial Unique Indexes

| Table          | Index                            | Columns                                | WHERE                                        | Purpose                                       |
| -------------- | -------------------------------- | -------------------------------------- | -------------------------------------------- | --------------------------------------------- |
| `engine_state` | `idx_engine_state_unique_active` | `(entity_type, entity_id, process_id)` | `status IN ('pending', 'active', 'waiting')` | Prevent duplicate active processes per entity |
| `engine_event` | `idx_engine_event_idempotency`   | `(idempotency_key)`                    | `idempotency_key IS NOT NULL`                | Event deduplication                           |

### Performance Indexes

| Table                    | Index                                  | Columns                                             | WHERE                                        | Purpose                                             |
| ------------------------ | -------------------------------------- | --------------------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| `engine_memory`          | `idx_engine_memory_embedding`          | `(embedding)` HNSW                                  | -                                            | Vector similarity search (m=16, ef_construction=64) |
| `engine_sessions`        | `idx_engine_sessions_workspace_status` | `(workspace_id, status)`                            | `status = 'active'`                          | Active session lookup                               |
| `engine_sessions`        | `idx_engine_sessions_expiry`           | `(expires_at)`                                      | `status = 'active'`                          | Expiry sweep                                        |
| `engine_sessions`        | `idx_engine_sessions_agent_profile`    | `(workspace_id, profile_id, created_at DESC)`       | `mode = 'agent'`                             | Agent conversation history                          |
| `engine_state`           | `idx_engine_state_workspace_status`    | `(workspace_id, status)`                            | `status IN ('pending', 'active', 'waiting')` | Active state lookup                                 |
| `engine_inbox`           | `idx_engine_inbox_processing`          | `(workspace_id, processed)`                         | `processed = false`                          | Unprocessed data queue                              |
| `engine_delayed_trigger` | `idx_engine_delayed_trigger_fire`      | `(fire_at)`                                         | `fired = false`                              | pg_cron polling                                     |
| `guardian_signal`        | `idx_guardian_signal_active`           | `(workspace_id, status, severity, created_at DESC)` | `status = 'active'`                          | Active signal dashboard                             |
| `engine_memory`          | `idx_engine_memory_expiry`             | `(expires_at)`                                      | `expires_at IS NOT NULL`                     | Memory cleanup sweep                                |

### Check Constraints

| Table                     | Column             | Constraint                                                               |
| ------------------------- | ------------------ | ------------------------------------------------------------------------ |
| `engine_missions`         | `mode`             | `IN ('sequential', 'free', 'hybrid')`                                    |
| `engine_sessions`         | `channel`          | `IN ('voice', 'sms', 'chat', 'email', 'autonomous')`                     |
| `engine_sessions`         | `status`           | `IN ('active', 'complete', 'expired', 'abandoned')`                      |
| `engine_sessions`         | `mode`             | `IN ('mission', 'agent')`                                                |
| `engine_stages`           | `creative_freedom` | `>= 0 AND <= 1`                                                          |
| `engine_state`            | `status`           | `IN ('pending', 'active', 'waiting', 'complete', 'failed', 'escalated')` |
| `engine_state_step`       | `status`           | `IN ('pending', 'active', 'completed', 'skipped', 'failed')`             |
| `engine_memory`           | `memory_type`      | `IN ('preference', 'fact', 'summary')`                                   |
| `engine_authority_config` | `level`            | `IN ('autonomous', 'confirm', 'suggest', 'read_only', 'disabled')`       |

### Triggers

| Table               | Trigger                            | Function           |
| ------------------- | ---------------------------------- | ------------------ |
| `engine_state_step` | `set_engine_state_step_updated_at` | `set_updated_at()` |
