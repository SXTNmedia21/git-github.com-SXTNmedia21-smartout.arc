---
title: Training Domain — Data Model
status: done
updated: 2026-05-23
created: 2026-05-23
domain: training
tags: [training, data-model, protocol_assignment, knowledge_test_attempt, confirmation_signature, schema]
mirror: verified
last_verified: 2026-05-23
---

# Training Domain — Data Model

Code wins. All table structures verified against actual migrations.

## 1. Training-domain owned tables

### `protocol_assignment` — training instance (core table)

Migration: `20260414014856_training_schema_foundation.sql` (extends prior `00002_structure_tables.sql` base).

| Column | Type | Notes |
|---|---|---|
| `assignment_id` | UUID PK | `gen_random_uuid()` |
| `workspace_id` | UUID NOT NULL → workspace | Added by foundation migration; NOT NULL; indexed |
| `profile_id` | UUID NOT NULL → profile | Employee being trained |
| `protocol_id` | UUID NOT NULL → protocol | Protocol spec (procedure-engine owns this table) |
| `status` | `protocol_assignment_status` enum | `not_started / in_progress / completed / expired / waived` (default: `not_started`; `pending` = legacy value, migrated to `not_started`) |
| `assigned_at` | TIMESTAMPTZ NOT NULL | When the assignment was created |
| `assigned_via` | `assignment_source` enum | `workspace / department / team / location / position / manual / season` |
| `assigned_ref_id` | UUID | FK-less reference to the team/dept/location that triggered |
| `assigned_by` | UUID → profile | NULL = system-assigned via trigger |
| `started_at` | TIMESTAMPTZ | NULL if not started |
| `completed_at` | TIMESTAMPTZ | NULL if not complete |
| `procedures_total` | INTEGER NOT NULL DEFAULT 0 | Denormalized; maintained by trigger or app |
| `procedures_completed` | INTEGER NOT NULL DEFAULT 0 | |
| `tests_total` | INTEGER NOT NULL DEFAULT 0 | |
| `tests_passed` | INTEGER NOT NULL DEFAULT 0 | |
| `confirmations_total` | INTEGER NOT NULL DEFAULT 0 | |
| `confirmations_signed` | INTEGER NOT NULL DEFAULT 0 | |
| `waived_by` | UUID → profile | NULL if not waived |
| `waived_reason` | TEXT | |
| `protocol_version` | TEXT | Snapshot of `protocol.version` at assignment time |
| `next_review_at` | TIMESTAMPTZ | Spaced repetition: when to re-review. NULL = no schedule |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Enum: `assignment_source`** (created in foundation migration):
`workspace | department | team | location | position | manual | season`

Note: `assigned_via = 'position'` is a dead letter — the trigger has no position branch (G25 in procedure-engine GAPS). The enum value exists but is never populated by the trigger.

**Indexes:**
- `idx_protocol_assignment_workspace (workspace_id)`
- `idx_protocol_assignment_workspace_status (workspace_id, status)`
- `idx_protocol_assignment_profile_status (profile_id, status)`
- `idx_protocol_assignment_next_review (next_review_at) WHERE next_review_at IS NOT NULL`

**RLS:** 4 policies — `jwt_read_own_assignments`, `jwt_admin_read_assignments`, `jwt_admin_write_assignments`, `service_role_protocol_assignment`.

---

### `knowledge_test_attempt` — quiz proof (immutable)

Migration: `20260412100200_completion_tracking.sql`. Column `ai_confidence` + `graded_by` added by `20260414014856_training_schema_foundation.sql` §8.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `workspace_id` | UUID NOT NULL → workspace | RLS root |
| `profile_id` | UUID NOT NULL → profile | |
| `knowledge_test_id` | UUID NOT NULL → knowledge_test | knowledge_test is procedure-engine's table |
| `protocol_assignment_id` | UUID → protocol_assignment | Nullable FK |
| `score` | NUMERIC(5,2) | Percentage 0-100 |
| `passed` | BOOLEAN NOT NULL DEFAULT false | |
| `answers` | JSONB NOT NULL DEFAULT '{}' | `[{question_id, answer, is_correct, points_earned}]` |
| `attempted_at` | TIMESTAMPTZ NOT NULL | |
| `ai_confidence` | NUMERIC(3,2) | AI grading confidence 0.00-1.00. NULL = human/automated grading |
| `graded_by` | TEXT | `"system"` / `"ai"` / profile_id (human) |
| `created_at` | TIMESTAMPTZ NOT NULL | |

**Indexes:** `idx_knowledge_test_attempt_profile (profile_id, knowledge_test_id)`, `idx_knowledge_test_attempt_assignment (protocol_assignment_id) WHERE NOT NULL`.

**RLS:** `jwt_read_knowledge_test_attempt` (workspace members read), `jwt_insert_knowledge_test_attempt` (workspace members insert — employees take tests), `service_role_knowledge_test_attempt`.

---

### `confirmation_signature` — signing proof (immutable)

Migration: `20260412100200_completion_tracking.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `workspace_id` | UUID NOT NULL → workspace | |
| `profile_id` | UUID NOT NULL → profile | |
| `confirmation_id` | UUID NOT NULL → confirmation | `confirmation` is procedure-engine's table |
| `protocol_assignment_id` | UUID → protocol_assignment | Nullable FK |
| `signed_at` | TIMESTAMPTZ NOT NULL | |
| `signature_data` | JSONB NOT NULL DEFAULT '{}' | Encoded signature + device info |
| `ip_address` | INET | Audit trail |
| `created_at` | TIMESTAMPTZ NOT NULL | |

**RLS:** Same pattern as `knowledge_test_attempt` — jwt_read/insert + service_role.

---

### `procedure_step_completion` — step proof (immutable)

Migration: `20260412100200_completion_tracking.sql`.

| Column | Notes |
|---|---|
| `procedure_step_id` FK | Step being completed (procedure-engine owns `procedure_step`) |
| `profile_id` FK | Employee |
| `protocol_assignment_id` FK | Assignment context |
| `workspace_id` FK | RLS root |
| `evidence` | JSONB (future: photo, GPS, measured values) |
| `completed_at` TIMESTAMPTZ | |

---

## 2. Tables extended by training-domain

### `procedure_step` — training content columns

Migration: `20260422300800_hms_procedure_step_training.sql`. Table owned by procedure-engine; columns added by training-domain migration.

| Column | Type | Notes |
|---|---|---|
| `training_content` | TEXT | Extended learning material in markdown — shown in training mode only |
| `media_urls` | JSONB | `[{type: "image"|"video", url: string, caption: string}]` — training media |

Comment: `"Extended learning material shown in training mode. Markdown supported."` (Anchor: `ADD COLUMN training_content text`).

---

## 3. Tables used (not owned) by training-domain

| Table | Owner | How training uses it |
|---|---|---|
| `protocol` | procedure-engine | The training unit — training reads name, description, version, status |
| `procedure` | procedure-engine | Training material — steps with content and media |
| `knowledge_test` | procedure-engine | Quiz spec — `questions` JSONB, `pass_threshold`, `max_attempts` |
| `confirmation` | procedure-engine | Sign-off spec — `confirmation_text`, `requires_signature` |
| `policy` | procedure-engine | Scope rule driving assignment cascade |
| `profile` | core-structure | Readiness tracked via protocol_assignment aggregation |
| `team_member` | core-structure | Trigger reads to determine team-scope assignments |
| `profession_training` | procedure-engine (ADR-0387a) | K1a role→mandatory-protocol map; seeded at I1 bootstrap |

---

## 4. Enums

| Enum | Values | Created by |
|---|---|---|
| `assignment_source` | `workspace / department / team / location / position / manual / season` | `20260414014856_training_schema_foundation.sql:11` |
| `protocol_assignment_status` | `not_started / in_progress / completed / expired / waived` (legacy: `pending`) | `20260414014855_training_add_enum_values.sql` |

---

## 5. RPC

| Function | Signature | Purpose |
|---|---|---|
| `get_workspace_readiness` | `(p_workspace_id uuid) → TABLE(profile_id uuid, total bigint, completed bigint)` | Per-profile assignment count aggregation. STABLE SECURITY DEFINER. Used by `get_team_readiness` capability + `WorkforceReadinessClient`. Anchor: `CREATE OR REPLACE FUNCTION public.get_workspace_readiness` in foundation migration. |
| `fn_seed_profession_training` | `(p_workspace_id uuid, p_profiles jsonb) → jsonb` | Idempotent seed of `profession` + `profession_training` rows at I1 bootstrap. SECURITY DEFINER. Only callable by `service_role`. ADR-0379a. |
| `auto_assign_protocols_to_new_employee` | trigger function | Fires AFTER INSERT on `profile`. Inserts `protocol_assignment` rows for all active protocols in scope. Anchor: `CREATE OR REPLACE FUNCTION auto_assign_protocols_to_new_employee`. |

---

## 6. Telemetry events (category: "training")

Source: `packages/telemetry/src/registry.ts` (verified by grep `category: "training"`).

| Event | Destinations | Trigger |
|---|---|---|
| `protocol assigned` | posthog + logger + activity_trail + engine_event | Admin manual assignment |
| `protocol step_completed` | posthog + logger + engine_event | `useCompleteStep` mutation |
| `protocol test_submitted` | posthog + logger + engine_event | `useSubmitTest` mutation |
| `protocol confirmation_signed` | posthog + logger + activity_trail + engine_event | `useSignConfirmation` mutation |
| `protocol completed` | posthog + logger + activity_trail + engine_event | Assignment status → completed |
| `handbook chapter_saved` | posthog + logger + engine_event | Handbook content save |
| `handbook chapter_opened` | posthog + logger + activity_trail | Employee reads handbook chapter |
| `hms.training.viewed` | (see registry ~2735) | `/dashboard/hms/training` page load |
| `people.training.viewed` | (see registry ~2750) | `/dashboard/people/training` page load |
| `policy created`, `policy published` | posthog + logger + activity_trail (+ engine_event for created) | Governance/procedure-engine authoring events — category "training" |
| `observer_request created/claimed/resolved` | posthog + activity_trail (+ engine_event) | Four-eyes observer flow |
| `approval requested/resolved` | posthog + activity_trail + engine_event | Approval flow |
| `reminder sent/opened/converted` | posthog / posthog+activity_trail | Training reminder events |
