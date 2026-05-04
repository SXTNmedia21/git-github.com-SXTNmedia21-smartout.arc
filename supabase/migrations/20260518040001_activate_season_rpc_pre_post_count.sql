-- ============================================
-- 20260518040001_activate_season_rpc_pre_post_count.sql
--
-- M5.2 phantom-emit fix: activate_season() now reports
-- `rows_newly_inserted` so the Server Action can distinguish
-- "trigger inserted N fresh rows" from "NOT EXISTS guard
-- short-circuited, zero artefacts produced".
--
-- Background
-- ----------
-- The D1 activation trigger (trg_season_activated, see
-- 20260518010001_season_activation_trigger_d1.sql) uses
-- INSERT … SELECT … WHERE NOT EXISTS to be idempotent on
-- re-activation of a previously-archived season. When the
-- guard short-circuits (rows already exist for this
-- season_id), zero new rows are inserted — but the post-
-- trigger COUNT(*) still returns the full existing-row count,
-- causing the Server Action to misfire
-- `season operating_hours_generated` with
-- `source='auto_copy_on_activate_trigger'`. That is an
-- ADR-0196 Invariant 11 class violation (phantom artefact
-- claim with misleading source attribution).
--
-- Fix
-- ---
-- Capture pre-trigger COUNT(*) before the status flip, then
-- compute the delta. `rows_newly_inserted` is the authoritative
-- signal for whether the D1 artefact was actually produced
-- in this call. `rows_generated` is preserved (total post-
-- trigger rows) for backwards compatibility with existing
-- callers / dashboards, but is no longer load-bearing for
-- the phantom-emit guard.
--
-- Invariants (unchanged from 20260518010002):
--   - Invariant 8: auth.uid() is resolved BEFORE any data access.
--   - Invariant 12: NO automated backfill block.
--
-- Returns JSONB:
--   { ok: true, season_id, departments_affected,
--     rows_generated, rows_newly_inserted }                   — success
--   { ok: true, skipped: true, reason: 'already_active' }     — noop
--   { ok: false, error: 'unauthenticated' }                   — no auth.uid()
--   RAISE EXCEPTION 'season_not_found'                        — bad IDs
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
  v_pre_trigger_count    INTEGER;
  v_post_trigger_count   INTEGER;
  v_rows_newly_inserted  INTEGER;
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

  -- Pre-trigger count — baseline BEFORE the status flip fires
  -- trg_season_activated. If the season was previously active
  -- and archived, `department_operating_hours` rows for this
  -- `season_id` still exist; the trigger's NOT EXISTS guard
  -- will short-circuit and v_rows_newly_inserted will be zero.
  SELECT COUNT(*)
    INTO v_pre_trigger_count
    FROM public.department_operating_hours
   WHERE workspace_id = p_workspace_id
     AND season_id = p_season_id;

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
    INTO v_post_trigger_count
    FROM public.department_operating_hours
   WHERE workspace_id = p_workspace_id
     AND season_id = p_season_id;

  SELECT COUNT(DISTINCT department_id)
    INTO v_departments_affected
    FROM public.department_operating_hours
   WHERE workspace_id = p_workspace_id
     AND season_id = p_season_id;

  -- Delta: the authoritative signal for "trigger actually
  -- inserted new rows in this call". Zero when the NOT EXISTS
  -- guard short-circuited (re-activation of archived season
  -- that already has hours).
  v_rows_newly_inserted := v_post_trigger_count - v_pre_trigger_count;

  RETURN jsonb_build_object(
    'ok', true,
    'season_id', p_season_id,
    'departments_affected', v_departments_affected,
    'rows_generated', v_post_trigger_count,           -- kept for backwards compat
    'rows_newly_inserted', v_rows_newly_inserted      -- NEW: 0 on idempotent skip
  );
END;
$$;

GRANT EXECUTE ON FUNCTION activate_season(UUID, UUID) TO authenticated;
