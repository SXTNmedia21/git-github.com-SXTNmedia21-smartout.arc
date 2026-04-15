-- 20260509100000_gate_action_four_eyes_history.sql
-- ADR-0101 (Accepted): history-based four-eyes lookup on gate_evaluation.
--
-- Rationale: the earlier p_approvers_present UUID[] approach required callers
-- to assemble actor lists out-of-band. Callers (agent-router, engine-dispatch,
-- shift_lifecycle tools) are stateless per request, so they cannot. Audit
-- rows in gate_evaluation are the natural state-of-record.
--
-- Changes:
--   1. gate_evaluation gains `entity_id UUID` so four-eyes scope is per-entity.
--   2. gate_action gains `p_entity_id UUID DEFAULT NULL` and queries
--      gate_evaluation for a prior distinct actor on
--      (workspace_id, capability, entity_id). If found → allow (2nd eye).
--      If not → deny with reason='four_eyes_required'.
--   3. p_approvers_present is retained in the signature for backwards
--      compatibility but is no longer consulted.
--
-- The engine_authority_config.requires_four_eyes column already exists
-- (migration 20260415120400_authority_config_four_eyes.sql). This migration
-- only changes how the gate consults it.

SET search_path TO public, extensions;

-- ──────────────────────────────────────────────
-- 1. gate_evaluation.entity_id
-- ──────────────────────────────────────────────
ALTER TABLE public.gate_evaluation
  ADD COLUMN IF NOT EXISTS entity_id UUID;

COMMENT ON COLUMN public.gate_evaluation.entity_id IS
  'ADR-0101: the domain entity this evaluation applies to (e.g. schedule_shift_id). '
  'Used by gate_action history lookup for four-eyes.';

CREATE INDEX IF NOT EXISTS idx_gate_evaluation_four_eyes_lookup
  ON public.gate_evaluation (workspace_id, capability, entity_id, actor_profile_id)
  WHERE entity_id IS NOT NULL;

-- ──────────────────────────────────────────────
-- 2. gate_action (drop 8-arg from 20260506110000 and replace with 9-arg)
-- ──────────────────────────────────────────────
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
  v_prior_distinct_actor  BOOLEAN := false;
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

  -- Four-eyes check (history-based, per ADR-0101). Only evaluated when the
  -- gate would otherwise allow. Requires p_entity_id to be scoped; without
  -- it the request is denied (fail-closed) to prevent accidental bypass.
  IF v_allow AND COALESCE(v_requires_four_eyes, false) THEN
    v_approvers_needed := 2;

    IF p_entity_id IS NULL THEN
      v_allow              := false;
      v_four_eyes_required := true;
      v_reason             := 'four_eyes_required';
    ELSE
      -- Does a prior evaluation by a DIFFERENT actor exist for this entity?
      SELECT EXISTS (
        SELECT 1
          FROM public.gate_evaluation
         WHERE workspace_id   = p_workspace_id
           AND capability     = p_capability
           AND entity_id      = p_entity_id
           AND actor_profile_id IS NOT NULL
           AND actor_profile_id <> p_actor_profile_id
      )
      INTO v_prior_distinct_actor;

      IF NOT v_prior_distinct_actor THEN
        v_allow              := false;
        v_four_eyes_required := true;
        v_reason             := 'four_eyes_required';
      END IF;
      -- else: allow stays true — this is the second eye.
    END IF;
  END IF;

  -- Audit row (one per call). entity_id recorded so future calls can see it.
  INSERT INTO public.gate_evaluation (
    workspace_id, capability, action_type, channel, actor_profile_id,
    engine_process_id, engine_state_id, allow, downgrade_to, min_role_required,
    channel_allowed, reason, entity_id
  ) VALUES (
    p_workspace_id, p_capability, p_action_type, v_channel, p_actor_profile_id,
    p_engine_process_id, p_engine_state_id, v_allow, v_downgrade_to, v_min_role,
    v_channel_allowed, v_reason, p_entity_id
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
    'approvers_present',    COALESCE(p_approvers_present, ARRAY[]::UUID[]),
    'entity_id',            p_entity_id
  );
END;
$$;

COMMENT ON FUNCTION public.gate_action IS
  'Unified authority gate across agent-router and engine-dispatch (ADR-0099 + ADR-0101). '
  'Four-eyes is history-based: queries gate_evaluation for a prior distinct actor on '
  '(workspace_id, capability, entity_id).';

GRANT EXECUTE ON FUNCTION public.gate_action(
  UUID, TEXT, TEXT, UUID, TEXT, TEXT, UUID, UUID[], UUID
) TO authenticated, service_role;
