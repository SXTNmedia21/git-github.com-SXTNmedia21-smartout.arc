-- ============================================
-- 20260512100200_cascade_gate_write_assert.sql
-- Add caller identity check to cascade_gate_write (ADR-0091 WP2).
-- ============================================
-- Additive migration that re-emits cascade_gate_write with
-- `PERFORM assert_gate_caller(p_actor_profile_id)` as the first statement
-- inside the BEGIN block. Body is otherwise identical to
-- 20260512100000_cascade_gate_write.sql.
--
-- Why a separate migration: the original has been committed (2278ef52) and
-- may already be applied to shared/preview DBs. Editing it in place would
-- rewrite history; re-emitting via CREATE OR REPLACE is safe and additive.
-- ============================================

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.cascade_gate_write(
  p_entity_type       TEXT,
  p_entity_id         UUID,
  p_action            TEXT,
  p_workspace_id      UUID,
  p_proposed_data     JSONB,
  p_current_data      JSONB,
  p_actor_profile_id  UUID,
  p_capability        TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_framework_id    UUID;
  v_trigger_count   INT;
  v_matched_trigger UUID;
  v_proposal_id     UUID;
  v_gate_eval_id    UUID;
  v_allowed         BOOLEAN;
  v_outcome         TEXT;
  v_reason          TEXT;
BEGIN
  -- 0. Verify caller identity BEFORE any gate writes (ADR-0091 WP2).
  --    Raises SQLSTATE 42501 if:
  --      - JWT caller's auth.uid() does not match p_actor_profile_id's user_id
  --      - service_role caller did not supply p_actor_profile_id
  --      - no authenticated caller and no service_role claim
  PERFORM public.assert_gate_caller(p_actor_profile_id);

  -- 1. Resolve active framework for this workspace (one active row per workspace)
  SELECT framework_id INTO v_framework_id
    FROM workspace_framework_binding
   WHERE workspace_id = p_workspace_id
     AND is_active = true
   LIMIT 1;

  IF v_framework_id IS NULL THEN
    -- No framework active → permit
    v_allowed := TRUE;
    v_outcome := 'applied';
    v_reason  := 'no-active-framework';
  ELSE
    -- 2. Scan framework_trigger for source_entity_type match, honouring
    --    framework_trigger.is_enabled + workspace_trigger_override.is_disabled.
    --    Pick an arbitrary matching trigger_id for the proposal link (the
    --    proposal records which trigger fired; deep evaluation in WP1 will
    --    iterate over all matches).
    SELECT COUNT(*) INTO v_trigger_count
      FROM framework_trigger ft
      LEFT JOIN workspace_trigger_override wto
        ON wto.trigger_id   = ft.trigger_id
       AND wto.workspace_id = p_workspace_id
     WHERE ft.framework_id       = v_framework_id
       AND ft.source_entity_type = p_entity_type
       AND ft.is_enabled         = true
       AND COALESCE(wto.is_disabled, false) = false;

    IF v_trigger_count > 0 THEN
      SELECT ft.trigger_id INTO v_matched_trigger
        FROM framework_trigger ft
        LEFT JOIN workspace_trigger_override wto
          ON wto.trigger_id   = ft.trigger_id
         AND wto.workspace_id = p_workspace_id
       WHERE ft.framework_id       = v_framework_id
         AND ft.source_entity_type = p_entity_type
         AND ft.is_enabled         = true
         AND COALESCE(wto.is_disabled, false) = false
       ORDER BY ft.trigger_id
       LIMIT 1;
    END IF;

    IF v_trigger_count = 0 THEN
      -- No matching trigger → permit
      v_allowed := TRUE;
      v_outcome := 'applied';
      v_reason  := 'no-trigger-match';
    ELSE
      -- 3. Trigger matched — create change_proposal skeleton + deny.
      --    Deep rule evaluation deferred to WP1; MVP treats any matched
      --    trigger as 'needs review'.
      INSERT INTO change_proposal (
        workspace_id,
        initiated_by,
        trigger_type,
        trigger_entity_type,
        trigger_entity_id,
        framework_trigger_id,
        created_by_plane,
        status,
        changes,
        approval_required,
        policy_decision
      ) VALUES (
        p_workspace_id,
        p_actor_profile_id,
        'manual_override'::framework_trigger_type,
        p_entity_type,
        p_entity_id,
        v_matched_trigger,
        'admin_manual'::cascade_initiator,
        'pending'::change_proposal_status,
        jsonb_build_object(
          'action',   p_action,
          'proposed', p_proposed_data,
          'current',  p_current_data
        ),
        true,
        'review_required'::evaluation_outcome
      ) RETURNING change_proposal_id INTO v_proposal_id;

      v_allowed := FALSE;
      v_outcome := 'proposed';
      v_reason  := 'framework-trigger-matched';
    END IF;
  END IF;

  -- 4. Always write a gate_evaluation audit row (action_type and channel
  --    are NOT NULL in gate_evaluation; there is no per-write channel here,
  --    so we record 'system' — matches ADR-0099 audit convention for
  --    non-user-initiated gate checks).
  INSERT INTO gate_evaluation (
    workspace_id,
    capability,
    action_type,
    channel,
    actor_profile_id,
    allow,
    channel_allowed,
    reason
  ) VALUES (
    p_workspace_id,
    p_capability,
    p_action,
    'system',
    p_actor_profile_id,
    v_allowed,
    true,
    v_reason
  ) RETURNING id INTO v_gate_eval_id;

  -- 5. Return structured JSON
  RETURN jsonb_build_object(
    'allowed',             v_allowed,
    'outcome',             v_outcome,
    'proposal_id',         v_proposal_id,
    'reason',              v_reason,
    'gate_evaluation_id',  v_gate_eval_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cascade_gate_write(
  TEXT, UUID, TEXT, UUID, JSONB, JSONB, UUID, TEXT
) TO authenticated, service_role;

COMMENT ON FUNCTION public.cascade_gate_write(
  TEXT, UUID, TEXT, UUID, JSONB, JSONB, UUID, TEXT
) IS
  'ADR-0091 WP2 (Option B): governance write gate. Decides allow/propose/block '
  'for a candidate write. Complements gate_action (ADR-0099, capability/authority). '
  'Matches framework_trigger.source_entity_type; on match, creates a '
  'change_proposal skeleton and returns outcome=proposed. Deep rule evaluation '
  'deferred to WP1 (evaluate_framework_rules). Always writes a gate_evaluation '
  'audit row. As of 20260512100200, invokes assert_gate_caller(p_actor_profile_id) '
  'FIRST to enforce SECURITY DEFINER caller identity (raises SQLSTATE 42501 on '
  'mismatch).';
