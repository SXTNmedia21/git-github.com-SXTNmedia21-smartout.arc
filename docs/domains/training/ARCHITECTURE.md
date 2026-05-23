---
title: Training Domain — Architecture
status: done
updated: 2026-05-23
created: 2026-05-23
domain: training
tags: [training, architecture, code-map, packages, hooks, capability]
mirror: verified
last_verified: 2026-05-23
---

# Training Domain — Architecture

Code wins. Every verified claim below has a grep-able anchor + migration/file:line hint.

## L1 — Web UI (3 routes)

### `/dashboard/my-training` — employee self-view
`apps/web/src/app/dashboard/my-training/`

| File | Role |
|---|---|
| `page.tsx` | Client component shell; reads `DashboardContext` for `profileId` + `isDark`. Renders `ProtocolList`, registers `MyTrainingToolsBridge`. Anchor: `MyTrainingPage` (line ±14). |
| `_components/ProtocolList.tsx` | Protocol card list per assignment; expand/collapse per card. |
| `_components/ProcedureStepper.tsx` | Step-by-step procedure viewer with `training_content` + `media_urls`. |
| `_components/KnowledgeTestView.tsx` | Quiz renderer — multiple choice, true/false. Uses `useSubmitTest`. |
| `_components/ConfirmationSign.tsx` | Sign-off UI with digital acknowledgement. Uses `useSignConfirmation`. |
| `_hooks/use-assigned-protocols.ts` | Thin re-export wrapper over `@smartout/training`; injects Supabase client + workspace context. Anchor: `useAssignedProtocols` (line ±28). |
| `_hooks/use-step-completion.ts` | Local copy/re-export; calls into `@smartout/training` mutations. |
| `_tools/my-training-tools-bridge.tsx` | Registers training view-tools in the Botsson harness (AI tool registration). |
| `_tools/use-my-training-tools.ts` | Defines tool payloads that Botsson can invoke on this page. |

### `/dashboard/people/training` — admin readiness matrix
`apps/web/src/app/dashboard/people/training/`

| File | Role |
|---|---|
| `page.tsx` | RSC shell; calls `resolveDashboardContext()` server-side, passes `workspaceId` + `profileId` to client island. Anchor: `TrainingPage` (line ±14). |
| `_components/WorkforceReadinessClient.tsx` | Full admin view: 4-KPI strip, department filter pills, `ReadinessProfileRow` list. Emits `people.training.viewed` on load (L-0177 compliant). Anchor: `WorkforceReadinessClient` (line ±30). |
| `_components/ReadinessProfileRow.tsx` | Per-employee row; expandable protocol list with status badges. |

Shared hook powering this view: `apps/web/src/app/dashboard/_hooks/use-workforce-readiness.ts` — extracted from HMS `CompetenceMatrix` per SM-2-followup-training plan.

### `/dashboard/hms/training` — HMS-flavored subset (edge)
`apps/web/src/app/dashboard/hms/training/page.tsx`

This route renders training-engine components (admin: `<CompetenceMatrix>`, employee: `<ProtocolList>`). The training-domain OWNS the engine components; HMS-domain (future) will author what-must-be-trained for HMS compliance. This route is a thin orchestrator — it does not have its own data layer. Anchor: `TrainingPage` (line ±5).

## L2 — Mobile

`apps/mobile/src/hooks/queries/use-training-data.ts`

Thin compatibility wrapper over `@smartout/training` shared hooks. Maps `AssignedProtocol[]` → legacy `TrainingData` shape (`courses`, `procedures`, `certificates`). Resolves `workspace_id` from `useMyProfile()` (L-0177 / ADR-0134 compliant). Anchor: `useTrainingData` (line ±120).

No dedicated mobile training screen components exist beyond the hook. The training screen in `apps/mobile/app/(app)/(home)/training.tsx` uses this hook's output. Procedure stepper + knowledge test UI on mobile = aspirational (see ROADMAP).

## L3 — AI Capability

`packages/ai/src/capabilities/training/` — 3 tools:

| Tool name | What it does |
|---|---|
| `get_my_training_status` | Returns assignment counts (total/completed/in_progress/expired) + readiness % for current employee. Reads `protocol_assignment`. Anchor: `getMyTrainingStatus` at `tools.ts:6`. |
| `get_next_protocol` | Returns the oldest incomplete assignment (not_started or in_progress). Reads `protocol_assignment` ordered by `assigned_at ASC`. Anchor: `getNextProtocol` at `tools.ts:42`. |
| `get_team_readiness` | Calls `get_workspace_readiness` RPC; fetches profile names; returns per-employee % with optional department filter. Requires manager/admin role. Anchor: `getTeamReadiness` at `tools.ts:75`. |

Capability registration: `packages/ai/src/capabilities/training/index.ts:20` — `name: "training"`.

**`ops-learn` EF is NOT training-domain.** `supabase/functions/ops-learn/index.ts` learns from `session_task` + `department_session` patterns (task duration drift, staffing, deviation correlation). It does not read `protocol_assignment` or training tables. Classification: shared ops-intelligence EF (cron-driven, owned by day-session/operations domain).

## L4 — Shared Package

`packages/training/src/` — workspace:

| Export | File | What it provides |
|---|---|---|
| `useAssignedProtocols` | `hooks/use-assigned-protocols.ts` | Query: all protocol assignments for a profile with full procedure/test/confirmation detail |
| `useCompleteStep` | `hooks/use-step-completion.ts` | Mutation: insert `procedure_step_completion` + emit `protocol step_completed` |
| `useSubmitTest` | `hooks/use-step-completion.ts` | Mutation: insert `knowledge_test_attempt` + emit `protocol test_submitted` |
| `useSignConfirmation` | `hooks/use-step-completion.ts` | Mutation: insert `confirmation_signature` + emit `protocol confirmation_signed` |
| `useReadinessScore` | `hooks/use-readiness-score.ts` | Derived score `{percent, completed, total}` from assignment aggregation |
| `trainingKeys` | `hooks/keys.ts` | TanStack Query key factory for cache invalidation |
| Types | `types.ts` | `AssignedProtocol`, `AssignedProcedure`, `ProcedureStepWithStatus`, `AssignedKnowledgeTest`, `AssignedConfirmation`, `ReadinessScore` |

Package exports: `packages/training/package.json` — entry `.`, `./hooks`, `./types`.

## L5 — Data Layer (migrations + RLS + RPC)

Key migrations (training-domain owned):

| Migration | What it adds |
|---|---|
| `20260412100200_completion_tracking.sql` | Creates `knowledge_test_attempt`, `confirmation_signature`, `procedure_step_completion` with RLS (jwt_read/insert + service_role). Anchor: `CREATE TABLE IF NOT EXISTS public.knowledge_test_attempt` (line ±12). |
| `20260414014856_training_schema_foundation.sql` | Extends `protocol_assignment`: adds `workspace_id`, `assigned_via` enum (`assignment_source`), `assigned_by`, denorm counters, waiver fields, `protocol_version`, `next_review_at`. Rewrites RLS policies. Creates `auto_assign_protocols_to_new_employee()` trigger. Creates `get_workspace_readiness()` RPC. Anchor: `CREATE TYPE assignment_source AS ENUM` (line ±11). |
| `20260414014855_training_add_enum_values.sql` | Adds enum values to `protocol_assignment_status` (must run before foundation). |
| `20260412200200_seed_training_protocol.sql` | Seeds initial workspace training protocol for onboarding process. |
| `20260422300800_hms_procedure_step_training.sql` | Adds `training_content` + `media_urls` columns to `procedure_step`. Anchor: `ADD COLUMN training_content text` (line ±1). |
| `20260421100300_add_profession_system.sql` | Creates `profession`, `profession_industry`, `legal_function`, `profile_legal_function`, `profession_training` tables. Note: `profession_training` classified as procedure-engine / K1a (ADR-0387a). Anchor: `CREATE TABLE public.profession` (line ±5). |
| `20260503110000_employment_category_constraint_and_template_column.sql` | Adds `employment_category` CHECK constraint on `employment_contract` + `contract_template`. Contracts-domain migration, not training-domain. Listed here for cross-reference only. |
| `20260621200105_profession_training_read_path_indexes.sql` | Adds read-path indexes on `profession_training`. Anchor: `idx_profession_training_workspace_profession` (line ±20). |
| `20260621200106_fn_seed_profession_training.sql` | Creates `fn_seed_profession_training(p_workspace_id, p_profiles)` SECURITY DEFINER function for I1 bootstrap. Anchor: `CREATE OR REPLACE FUNCTION public.fn_seed_profession_training` (line ±25). |

RPC owned by training-domain:
- `get_workspace_readiness(p_workspace_id uuid)` — returns per-profile `(profile_id, total, completed)`. Used by `get_team_readiness` capability tool + `WorkforceReadinessClient`.

RLS pattern on `protocol_assignment`:
- `jwt_read_own_assignments` — employee reads own rows (`profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())`)
- `jwt_admin_read_assignments` — admin reads workspace rows (`is_admin_in_workspace()`)
- `jwt_admin_write_assignments` — admin writes workspace rows
- `service_role_protocol_assignment` — full access
