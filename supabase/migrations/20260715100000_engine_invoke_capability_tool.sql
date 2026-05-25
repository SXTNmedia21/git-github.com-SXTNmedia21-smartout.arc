SET search_path TO public, extensions;

-- ============================================================
-- 20260715100000_engine_invoke_capability_tool.sql
--
-- Implements ADR-0424: `invoke_capability_tool` action-type schema
-- layer for engine_state_step.
--
-- action_type is TEXT (no enum, no CHECK constraint) — no
-- constraint surgery needed; the dispatcher validates the value
-- at runtime. Handler track (T-Handler) wires the actual
-- dispatch logic in engine-dispatch/index.ts.
--
-- Columns added (all nullable — backward-compatible with rows
-- that predate this migration and use other action types):
--
--   capability_name    TEXT   — CapabilityName routed by dispatcher.
--                               Required when action_type = 'invoke_capability_tool'.
--
--   tool_name          TEXT   — snake_case tool name within the capability.
--                               Required when action_type = 'invoke_capability_tool'.
--
--   args_resolved      JSONB  — Resolved args passed to the tool execute().
--                               Stored for audit / replay (ADR-0134).
--                               NOT the raw blueprint args — the dispatcher
--                               resolves template variables before storing.
--
--   tool_result_summary JSONB — Output returned by tool execute() stored as
--                               { summary: string, success: boolean }.
--                               Enables downstream steps to branch on result.
--
--   gate_action_id     UUID   — FK to gate_evaluation.id written by
--                               gate_action() RPC (ADR-0099). Proves the
--                               capability invocation passed the authority gate.
--                               NULL = gate not yet evaluated (step not executed).
--
--   delegated_via      TEXT   — engine_process.id string. REQUIRED by ADR-0356
--                               audit-symmetry: every capability invocation via
--                               engine-dispatch MUST carry the originating
--                               process identity so emit() downstream can set
--                               actor_capability + delegated_via correctly.
--
-- RLS: no changes needed. engine_state_step uses a cascading subquery
-- (state_id IN SELECT id FROM engine_state) — workspace_id scoping is
-- inherited from engine_state's own RLS. New columns are covered
-- automatically by existing SELECT + service_role ALL policies.
--
-- References: ADR-0424, ADR-0173, ADR-0356, ADR-0151, ADR-0099
-- ============================================================

-- capability_name: the CapabilityName to invoke (e.g. 'operations', 'schedule').
-- Nullable on rows using other action types.
ALTER TABLE public.engine_state_step
  ADD COLUMN IF NOT EXISTS capability_name TEXT;

COMMENT ON COLUMN public.engine_state_step.capability_name IS
  'ADR-0424: CapabilityName targeted by invoke_capability_tool action type. NULL for other action types.';

-- tool_name: snake_case tool registered inside the capability.
ALTER TABLE public.engine_state_step
  ADD COLUMN IF NOT EXISTS tool_name TEXT;

COMMENT ON COLUMN public.engine_state_step.tool_name IS
  'ADR-0424: Tool name within the capability invoked by invoke_capability_tool. NULL for other action types.';

-- args_resolved: dispatcher-resolved args (template vars substituted) passed to execute().
-- Stored at invocation time for audit trail (ADR-0134).
ALTER TABLE public.engine_state_step
  ADD COLUMN IF NOT EXISTS args_resolved JSONB;

COMMENT ON COLUMN public.engine_state_step.args_resolved IS
  'ADR-0424: Resolved args passed to capability tool execute(). Template variables substituted by dispatcher before storage. Enables replay and audit (ADR-0134).';

-- tool_result_summary: { summary: string, success: boolean } output from execute().
-- Stored after successful invocation. NULL while step is pending/active.
ALTER TABLE public.engine_state_step
  ADD COLUMN IF NOT EXISTS tool_result_summary JSONB;

COMMENT ON COLUMN public.engine_state_step.tool_result_summary IS
  'ADR-0424: Output captured from capability tool execute(). Shape: { summary: string, success: boolean }. NULL until step completes.';

-- gate_action_id: FK to gate_evaluation.id from gate_action() RPC call.
-- Enforces ADR-0099: capability invocation MUST pass authority gate first.
-- NULL = step not yet executed (gate not yet evaluated).
ALTER TABLE public.engine_state_step
  ADD COLUMN IF NOT EXISTS gate_action_id UUID;

COMMENT ON COLUMN public.engine_state_step.gate_action_id IS
  'ADR-0424 + ADR-0099: ID of the gate_evaluation row written by gate_action() RPC before tool invocation. Proves authority gate passed. NULL until step executes.';

-- delegated_via: engine_process.id string. REQUIRED per ADR-0356 audit-symmetry.
-- The dispatcher MUST propagate this into emit() calls as delegated_via.
-- Stored as TEXT (not UUID FK) to match ADR-0356 pattern in other tables
-- and allow engine_process IDs to be string slugs as well as UUIDs.
ALTER TABLE public.engine_state_step
  ADD COLUMN IF NOT EXISTS delegated_via TEXT;

COMMENT ON COLUMN public.engine_state_step.delegated_via IS
  'ADR-0424 + ADR-0356: engine_process identifier that spawned this capability invocation. REQUIRED for audit-symmetry emit(). Propagated as delegated_via in all downstream emits from the handler.';

-- Index: look up all invoke_capability_tool steps for a given state quickly
-- (T-Handler track needs this for recursion-depth check per ADR-0424 §Handler invariants #3).
CREATE INDEX IF NOT EXISTS idx_engine_state_step_invoke_cap
  ON public.engine_state_step (state_id, action_type)
  WHERE action_type = 'invoke_capability_tool';

-- Index: look up steps by gate_action_id for audit join.
CREATE INDEX IF NOT EXISTS idx_engine_state_step_gate_action
  ON public.engine_state_step (gate_action_id)
  WHERE gate_action_id IS NOT NULL;
