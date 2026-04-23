-- ============================================
-- 20260518010001_season_activation_trigger_d1.sql
--
-- EXTENDS emit_season_activated_event() — ADR-0200 Layer 1 (D1 atomicity).
--
-- This migration adds an idempotent D1 copy block to the existing trigger
-- function (originally defined in 20260428100001_season_activation_trigger.sql).
-- The original function emits a 'season.activated' engine_event on status
-- transition to 'active'. This extension PRESERVES that behaviour verbatim
-- and ADDS — inside the same status-transition guard, after the engine_event
-- INSERT — an idempotent copy of DEFAULT (season_id IS NULL) department
-- operating-hour rows into SEASON-scoped rows (season_id = NEW.season_id).
--
-- The existing trigger trg_season_activated (AFTER UPDATE OF status ON season)
-- is NOT re-registered here. CREATE OR REPLACE FUNCTION is sufficient — the
-- trigger binding in pg_trigger points to the function by oid, and REPLACE
-- updates the same oid's body in place.
--
-- Design notes (see ADR-0200 Layer 1 + Invariants 6/7/9):
--   - NO session-actor derivation in the function body (Invariant 6).
--     The trigger fires from migrations, service-role direct writes, cron,
--     etc. — session actor is NULL on many paths. Actor attribution
--     belongs in the application layer.
--   - Guard uses IF NOT EXISTS (SELECT 1 ...) — not COUNT=0 (Invariant 7).
--   - Department filter is d.is_active = TRUE (Invariant 9). `department`
--     has no soft-delete column; active flag is the only lifecycle signal.
--   - COALESCE on open_offset_minutes / close_offset_minutes → 0 (columns
--     are NULL-defaultable; treat NULL as "no offset").
--   - provenance stamps auto_copy_on_activate_trigger + activated_at + trigger name.
--   - is_derived = TRUE — these rows are cascade-derived from workspace
--     base hours, not manually authored.
--
-- Scope: ONLY the function body is replaced. Engine-trigger wiring and
-- trg_season_activated trigger binding are unchanged.
-- ============================================

CREATE OR REPLACE FUNCTION emit_season_activated_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    -- ── Existing engine_event emit (verbatim from 20260428100001) ──
    INSERT INTO engine_event (
      event_type,
      workspace_id,
      payload,
      idempotency_key
    ) VALUES (
      'season.activated',
      NEW.workspace_id,
      jsonb_build_object(
        'season_id', NEW.season_id,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'name', NEW.name
      ),
      'season_activated_' || NEW.season_id
    );

    -- ── D1 copy block — ADR-0200 Layer 1 extension ──
    -- Idempotent: copy DEFAULT rows (season_id IS NULL) → SEASON rows
    -- (season_id = NEW.season_id) only when no season rows exist yet.
    IF NOT EXISTS (
      SELECT 1
      FROM department_operating_hours
      WHERE workspace_id = NEW.workspace_id
        AND season_id = NEW.season_id
    ) THEN
      INSERT INTO department_operating_hours (
        workspace_id,
        department_id,
        location_id,
        season_id,
        day_of_week,
        open_time,
        close_time,
        open_offset_minutes,
        close_offset_minutes,
        is_closed,
        is_derived,
        provenance
      )
      SELECT
        doh.workspace_id,
        doh.department_id,
        doh.location_id,
        NEW.season_id,
        doh.day_of_week,
        doh.open_time,
        doh.close_time,
        COALESCE(doh.open_offset_minutes, 0),
        COALESCE(doh.close_offset_minutes, 0),
        doh.is_closed,
        TRUE,
        jsonb_build_object(
          'source', 'auto_copy_on_activate_trigger',
          'activated_at', NOW(),
          'trigger', 'trg_season_activated'
        )
      FROM department_operating_hours doh
      JOIN department d ON d.department_id = doh.department_id
      WHERE doh.workspace_id = NEW.workspace_id
        AND doh.season_id IS NULL
        AND d.is_active = TRUE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
