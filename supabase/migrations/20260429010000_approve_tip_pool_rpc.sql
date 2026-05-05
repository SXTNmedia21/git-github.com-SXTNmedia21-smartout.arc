-- ============================================
-- 20260429010000_approve_tip_pool_rpc.sql
-- SECURITY DEFINER RPC: approve_tip_pool(pool_id, actor_profile_id)
-- Campaign: tips-handling · Sub-sortie: tips-leader-flows · Phase 2A
--
-- Rationale (council verdict 2026-04-29, ADR-0229):
--   RLS UPDATE on tip_distribution blocks rows once their parent pool is
--   approved. A plain two-statement transaction would flip pool first, then
--   fail to update distributions. This SECURITY DEFINER function bypasses
--   the RLS update policy and executes both UPDATEs atomically.
--
-- Security invariants:
--   1. Caller MUST have passed gate_action('tips.approve_distribution')
--      at the BFF layer before invoking this RPC. The BFF is the authority
--      gate. This function adds workspace-scope + state validation as
--      defence-in-depth — it is NOT a replacement for gate_action.
--   2. Workspace-scope check: actor's workspace must match pool's workspace.
--   3. State check: pool must be status='recorded'. Any other state raises.
--   4. SET search_path so schema names are unambiguous inside the function.
-- ============================================

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.approve_tip_pool(
  p_pool_id         uuid,
  p_actor_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_workspace_id  uuid;
  v_pool_status        tip_pool_status;
  v_policy_id          uuid;
  v_algorithm          text;
  v_actor_workspace_id uuid;
  v_total_distributed  numeric(10,2);
  v_distribution_count bigint;
  v_adjustment_count   bigint;
  v_rows_updated       integer;
BEGIN
  -- ── Step 1: Load pool — assert workspace + state ──────────────────────
  SELECT workspace_id, status, policy_id
    INTO v_pool_workspace_id, v_pool_status, v_policy_id
    FROM public.tip_pool
   WHERE id = p_pool_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pool_not_found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_pool_status != 'recorded' THEN
    IF v_pool_status = 'approved' THEN
      RAISE EXCEPTION 'already_approved'
        USING ERRCODE = 'P0001';
    ELSE
      RAISE EXCEPTION 'invalid_state'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── Step 2: Workspace-scope check — actor must belong to same workspace ─
  SELECT workspace_id
    INTO v_actor_workspace_id
    FROM public.profile
   WHERE profile_id = p_actor_profile_id
     AND is_active = true;

  IF NOT FOUND OR v_actor_workspace_id != v_pool_workspace_id THEN
    RAISE EXCEPTION 'workspace_mismatch'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Step 3: Snapshot algorithm from policy ─────────────────────────────
  SELECT method::text
    INTO v_algorithm
    FROM public.tip_policy
   WHERE id = v_policy_id;

  IF NOT FOUND THEN
    -- Policy deleted after pool created — use 'unknown' as safe fallback
    v_algorithm := 'unknown';
  END IF;

  -- ── Step 4: Update distributions FIRST (while pool is still 'recorded') ─
  -- SECURITY DEFINER bypasses the RLS UPDATE check that blocks once pool
  -- is approved. Distributions must flip before the pool does.
  UPDATE public.tip_distribution
     SET status = 'approved'
   WHERE pool_id = p_pool_id;

  -- ── Step 5: Update pool — atomic with distributions above ─────────────
  UPDATE public.tip_pool
     SET status                       = 'approved',
         approved_by                  = p_actor_profile_id,
         approved_at                  = now(),
         algorithm_version_at_approval = v_algorithm
   WHERE id = p_pool_id
     AND status = 'recorded';   -- guard: if concurrent approval raced, 0 rows

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN
    -- Another transaction won the race and already approved.
    RAISE EXCEPTION 'already_approved'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Step 6: Aggregate summary for BFF telemetry payload ───────────────
  SELECT
    SUM(COALESCE(adjusted_amount, calculated_amount)),
    COUNT(*)
    INTO v_total_distributed, v_distribution_count
    FROM public.tip_distribution
   WHERE pool_id = p_pool_id;

  SELECT COUNT(*)
    INTO v_adjustment_count
    FROM public.tip_adjustment_log
   WHERE distribution_id IN (
     SELECT id FROM public.tip_distribution WHERE pool_id = p_pool_id
   );

  -- ── Step 7: Return payload ─────────────────────────────────────────────
  RETURN jsonb_build_object(
    'pool_id',            p_pool_id,
    'department_session_id', (SELECT department_session_id FROM public.tip_pool WHERE id = p_pool_id),
    'total_distributed',  COALESCE(v_total_distributed, 0),
    'distribution_count', COALESCE(v_distribution_count, 0),
    'adjustment_count',   COALESCE(v_adjustment_count, 0),
    'algorithm',          v_algorithm
  );
END;
$$;

-- Grant to authenticated — BFF calls via admin client (service role), but
-- future JWT-path callers (e.g. Server Actions) also need access.
GRANT EXECUTE ON FUNCTION public.approve_tip_pool(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_tip_pool(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.approve_tip_pool IS
  'Atomic pool+distribution approval. SECURITY DEFINER to bypass tip_distribution '
  'RLS UPDATE block that activates once parent pool is approved. '
  'Caller MUST pass gate_action at BFF before invoking. '
  'ADR-0229 (council 2026-04-29), ADR-0099.';
