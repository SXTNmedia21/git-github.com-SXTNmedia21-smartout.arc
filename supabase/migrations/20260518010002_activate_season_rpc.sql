-- ============================================
-- 20260518010002_activate_season_rpc.sql
--
-- activate_season(p_workspace_id, p_season_id) — ADR-0200 Layer 2.
--
-- Wraps archive-current-active + activate-target into a single Postgres
-- transaction. Closes the partial-success window documented in
-- ADR-0085 §Consequences known-risk (two separate client-side UPDATEs
-- could leave a workspace with zero active seasons on partial failure).
--
-- The trg_season_activated trigger (extended by 20260518010001) fires
-- inside this RPC's transaction — so D1 row generation and season
-- activation are atomic. If the D1 INSERT fails (e.g., unique constraint
-- violation), the entire RPC call rolls back.
--
-- Invariants (see ADR-0200):
--   - Invariant 8: auth.uid() is resolved BEFORE any SELECT/UPDATE. NULL
--     returns {ok:false, error:'unauthenticated'} without touching data.
--   - Invariant 12: NO automated backfill block. Workspaces with a season
--     already at status='active' when this migration lands retain zero
--     season_id != NULL rows until a manager re-activates via the UI.
--
-- Returns JSONB:
--   { ok: true, season_id, departments_affected, rows_generated }  — success
--   { ok: true, skipped: true, reason: 'already_active' }            — noop
--   { ok: false, error: 'unauthenticated' }                          — no auth.uid()
--   RAISE EXCEPTION 'season_not_found'                               — bad IDs
--
-- GRANT EXECUTE TO authenticated — RLS is enforced by SECURITY DEFINER
-- resolving auth.uid() and validating workspace ownership via the
-- capability gate upstream (gate_action in activate-season-action.ts).
-- ============================================

CREATE OR REPLACE FUNCTION activate_season(
  p_workspace_id UUID,
  p_season_id    UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_id             UUID := auth.uid();
  v_already_active       BOOLEAN;
  v_rows_generated       INTEGER;
  v_departments_affected INTEGER;
  v_updated_count        INTEGER;
BEGIN
  -- Invariant 8 — reject unauthenticated BEFORE any data access.
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  -- Already-active guard (idempotent no-op for re-activation).
  SELECT status = 'active'
    INTO v_already_active
    FROM season
   WHERE season_id = p_season_id
     AND workspace_id = p_workspace_id;

  IF v_already_active IS TRUE THEN
    RETURN jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'already_active'
    );
  END IF;

  -- Step 1 — archive any currently-active season in the workspace.
  UPDATE season
     SET status = 'archived'
   WHERE workspace_id = p_workspace_id
     AND status = 'active';

  -- Step 2 — activate target. trg_season_activated fires AFTER UPDATE,
  -- runs the D1 copy block inside this transaction.
  UPDATE season
     SET status = 'active'
   WHERE season_id = p_season_id
     AND workspace_id = p_workspace_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'season_not_found';
  END IF;

  -- Step 3 — read counts AFTER the trigger has run.
  SELECT COUNT(*)
    INTO v_rows_generated
    FROM department_operating_hours
   WHERE season_id = p_season_id;

  SELECT COUNT(DISTINCT department_id)
    INTO v_departments_affected
    FROM department_operating_hours
   WHERE season_id = p_season_id;

  RETURN jsonb_build_object(
    'ok', true,
    'season_id', p_season_id,
    'departments_affected', v_departments_affected,
    'rows_generated', v_rows_generated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION activate_season(UUID, UUID) TO authenticated;
