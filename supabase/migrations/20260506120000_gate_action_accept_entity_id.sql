-- 20260506120000_gate_action_accept_entity_id.sql
-- Fix ultrareview rp6ofqyfv merged_bug_006
--
-- Retimestamped 2026-04-17 from 20260417130000 → 20260506120000 because
-- gate_evaluation is created by 20260505110000_unified_authority_gate.sql
-- and gate_action RPC is defined by 20260506110000_gate_action_four_eyes.sql.
-- The fix must run AFTER both — running at 20260417130000 failed with
-- "relation public.gate_evaluation does not exist" on Supabase preview.
--
-- gate.ts has been passing p_entity_id to the gate_action RPC for 4 shift-
-- lifecycle tool call sites (packages/ai/src/capabilities/shift-lifecycle/
-- tools.ts:156, 281, 421, 479), but the SQL signature at 20260506110000
-- never declared the parameter. PostgREST returns PGRST202 "function not
-- found" and callGateAction's fail-closed path at gate.ts:59 denies every
-- call -> 100% denial of shift writes in production since ADR-0101 was
-- proposed.
--
-- Extending the signature with p_entity_id UUID DEFAULT NULL is backward
-- compatible (existing 8-arg callers remain valid because the new param
-- has a default). The new arg threads into gate_evaluation.entity_id for
-- ADR-0101 per-entity four-eyes scoping (so a single approval doesn't
-- cover every shift of the same capability).
--
-- Body is copied verbatim from 20260506110000_gate_action_four_eyes.sql
-- with exactly three additions:
--   1. p_entity_id UUID DEFAULT NULL added as the final signature arg
--   2. gate_evaluation gets a nullable entity_id column
--   3. gate_evaluation INSERT includes the new column
--
-- No behavior change when entity_id is NULL. Refs: ADR-0099, ADR-0101.
SET search_path TO public, extensions;

-- 1. Add entity_id column to gate_evaluation (idempotent).
ALTER TABLE public.gate_evaluation
  ADD COLUMN IF NOT EXISTS entity_id UUID;

COMMENT ON COLUMN public.gate_evaluation.entity_id IS
  'Optional entity scope for four-eyes approvals (ADR-0101). When set, '
  'the approval applies only to this specific entity (e.g. shift_id), '
  'not the whole capability. See ADR-0101.';

-- 2. Drop the 8-arg signature and recreate with 9-arg.
DROP FUNCTION IF EXISTS public.gate_action(UUID, TEXT, TEXT, UUID, TEXT, TEXT, UUID, UUID[]);

CREATE OR REPLACE FUNCTION public.gate_action(
  p_workspace_id       UUID,
  p_capability         TEXT,
  p_channel            TEXT,
  p_actor_profile_id   UUID,
  p_action_type        TEXT,
  p_engine_process_id  TEXT DEFAULT NULL,
  p_engine_state_id    UUID DEFAULT NULL,
  p_approvers_present  UUID[] DEFAULT ARRAY[]::UUID[],
  p_entity_id          UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_level                 TEXT;
  v_min_role              TEXT;
  v_requires_four_eyes    BOOLEAN := false;
  v_caller_role           TEXT;
  v_allow                 BOOLEAN := true;
  v_downgrade_to          TEXT    := NULL;
  v_channel_allowed       BOOLEAN := true;
  v_reason                TEXT    := NULL;
  v_allowed_channels      TEXT[];
  v_gate_evaluation_id    UUID;
  v_channel               TEXT    := COALESCE(NULLIF(p_channel, ''), 'system');
  v_four_eyes_required    BOOLEAN := false;
  v_approvers_needed      INTEGER := 0;
BEGIN
  -- Look up authority config for (workspace, capability).
  SELECT level, min_role, requires_four_eyes
    INTO v_level, v_min_role, v_requires_four_eyes
    FROM public.engine_authority_config
   WHERE workspace_id = p_workspace_id
     AND capability   = p_capability;

  -- Look up caller role (NULL-safe: system callers may omit actor).
  IF p_actor_profile_id IS NOT NULL THEN
    SELECT role::TEXT
      INTO v_caller_role
      FROM public.profile
     WHERE profile_id = p_actor_profile_id;
  END IF;

  -- Channel check against engine_process.allowed_channels (only when engine step).
  IF p_engine_process_id IS NOT NULL THEN
    SELECT allowed_channels
      INTO v_allowed_channels
      FROM public.engine_process
     WHERE id = p_engine_process_id;

    IF v_allowed_channels IS NOT NULL
       AND NOT (v_channel = ANY(v_allowed_channels)) THEN
      v_allow           := false;
      v_channel_allowed := false;
      v_reason          := 'channel_not_permitted';
    END IF;
  END IF;

  -- Authority level check (only if not already denied on channel).
  IF v_allow THEN
    IF v_level IS NULL THEN
      v_allow := true;
    ELSIF v_level = 'disabled' THEN
      v_allow  := false;
      v_reason := 'capability_disabled';
    ELSIF v_min_role IS NOT NULL
          AND v_caller_role IS NOT NULL
          AND public._role_rank(v_caller_role) < public._role_rank(v_min_role) THEN
      v_downgrade_to := 'suggest';
      IF v_reason IS NULL THEN
        v_reason := 'role_below_min';
      END IF;
    END IF;
  END IF;

  -- Four-eyes check (only when allowed up to here).
  IF v_allow AND COALESCE(v_requires_four_eyes, false) THEN
    v_approvers_needed := 2;
    IF p_approvers_present IS NULL
       OR array_length(p_approvers_present, 1) IS NULL
       OR array_length(p_approvers_present, 1) < 2 THEN
      v_allow              := false;
      v_four_eyes_required := true;
      v_reason             := 'four_eyes_required';
    END IF;
  END IF;

  -- Audit row (one per call). entity_id threads through for ADR-0101 scoping.
  INSERT INTO public.gate_evaluation (
    workspace_id, capability, action_type, channel, actor_profile_id,
    engine_process_id, engine_state_id, entity_id,
    allow, downgrade_to, min_role_required,
    channel_allowed, reason
  ) VALUES (
    p_workspace_id, p_capability, p_action_type, v_channel, p_actor_profile_id,
    p_engine_process_id, p_engine_state_id, p_entity_id,
    v_allow, v_downgrade_to, v_min_role,
    v_channel_allowed, v_reason
  )
  RETURNING id INTO v_gate_evaluation_id;

  RETURN jsonb_build_object(
    'allow',                v_allow,
    'downgrade_to',         v_downgrade_to,
    'min_role_required',    v_min_role,
    'channel_allowed',      v_channel_allowed,
    'reason',               v_reason,
    'gate_evaluation_id',   v_gate_evaluation_id,
    'four_eyes_required',   v_four_eyes_required,
    'approvers_needed',     v_approvers_needed,
    'approvers_present',    COALESCE(p_approvers_present, ARRAY[]::UUID[])
  );
END;
$$;

COMMENT ON FUNCTION public.gate_action IS
  'Single authority gate across agent-router and engine-dispatch (ADR-0099 + ADR-0101). '
  'Includes four-eyes check via requires_four_eyes config. '
  'p_entity_id added 2026-04-17 to enable ADR-0101 per-entity approval scoping (ultrareview merged_bug_006).';

GRANT EXECUTE ON FUNCTION public.gate_action(UUID, TEXT, TEXT, UUID, TEXT, TEXT, UUID, UUID[], UUID) TO authenticated, service_role;
