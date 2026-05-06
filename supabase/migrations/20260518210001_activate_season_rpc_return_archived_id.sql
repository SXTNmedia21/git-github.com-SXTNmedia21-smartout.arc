-- ============================================
-- 20260518210001_activate_season_rpc_return_archived_id.sql
--
-- M5.5 phantom-consumer fix: activate_season() now returns the
-- `archived_season_id` — the UUID of the previously-active
-- season that Step 1 archived inside the same transaction (or
-- NULL if no season was active at the time of the call).
--
-- Background
-- ----------
-- `activate_season` (see 20260518040001_activate_season_rpc_pre_post_count.sql)
-- performs two UPDATE statements inside one transaction:
--   Step 1 — archive any currently-active season in the workspace.
--   Step 2 — activate the target season.
--
-- Before this migration, the Step 1 archive was invisible to
-- the Server Action: no return value exposed the archived row,
-- so `activate-season-action.ts` could not emit
-- `season archived` for it. The telemetry event was registered
-- in `packages/telemetry/src/registry.ts` as a phantom-consumer
-- (registered but no emitter), and the archive-on-activate step
-- produced no audit trail row.
--
-- Fix
-- ---
-- Capture the currently-active season_id into `v_archived_season_id`
-- BEFORE the archive UPDATE runs. Return it in the JSONB response
-- as `archived_season_id` (NULL when no season was active). The
-- Server Action consumes this and emits `season archived` for the
-- previously-active row BEFORE emitting `season activated` for
-- the target. Per-row telemetry on both state transitions.
--
-- The pre-trigger-count mechanism from 20260518040001 is preserved
-- unchanged — rows_newly_inserted remains the authoritative signal
-- for whether the D1 copy block actually produced fresh artefacts.
--
-- Invariants (unchanged from 20260518040001):
--   - Invariant 8: auth.uid() is resolved BEFORE any data access.
--   - Invariant 12: NO automated backfill block.
--
-- Returns JSONB:
--   { ok: true, season_id, departments_affected,
--     rows_generated, rows_newly_inserted,
--     archived_season_id }                                    — success
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
  v_archived_season_id   UUID;
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

  -- Capture the currently-active season (if any) BEFORE the
  -- archive UPDATE flips its status. NULL when no season is
  -- active in the workspace (e.g. first-ever activation, or
  -- all seasons are drafts). The Server Action uses this to
  -- emit `season archived` for the displaced row per M5.5
  -- (phantom-consumer fix for the registry-only event).
  SELECT season_id
    INTO v_archived_season_id
    FROM season
   WHERE workspace_id = p_workspace_id
     AND status = 'active'
   LIMIT 1;

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
    'rows_newly_inserted', v_rows_newly_inserted,     -- from 20260518040001
    'archived_season_id', v_archived_season_id        -- NEW: M5.5 phantom-consumer
  );
END;
$$;

GRANT EXECUTE ON FUNCTION activate_season(UUID, UUID) TO authenticated;
