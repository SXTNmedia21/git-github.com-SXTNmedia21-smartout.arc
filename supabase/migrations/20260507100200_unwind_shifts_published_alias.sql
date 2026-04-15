SET search_path TO public, extensions;

-- ============================================================
-- 20260507100200_unwind_shifts_published_alias.sql
--
-- Canonical publish event = `shift.published` (singular).
-- `shifts.published` (plural) was an historical batch variant
-- wired in 20260427100000_seed_shifts_published_trigger.sql.
--
-- Decision (Council 2026-04-15, per ADR-0095 + SHIFT_LIFECYCLE_MAP):
-- unwind the plural routing. One canonical event name per domain
-- concept.
--
-- Scope of this migration:
--   1. Deactivate + delete any `shifts.published` engine_trigger rows.
--   2. Keep `shift.published` canonical (no-op here; trigger seeded
--      in 20260507100100).
--
-- Not in scope (handled in application code in the same PR):
--   - packages/schedule/src/use-grid-mutations.ts emits
--     "shifts published" on batch publish; updated to "shift published".
--   - Registry entry "shifts published" left in place for one release
--     as a soft-deprecation (not wired to engine_event).
-- ============================================================

-- Deactivate first (so in-flight dispatches see is_active=false),
-- then delete. Idempotent: NOT EXISTS guard is unnecessary since
-- DELETE on a non-matching event is a no-op.

UPDATE engine_trigger
   SET is_active = false
 WHERE event_type = 'shifts.published';

DELETE FROM engine_trigger
 WHERE event_type = 'shifts.published';

-- Safety: if any workspace-scoped duplicate exists (should not),
-- the DELETE above covers it. Log a NOTICE if one was removed.
DO $$
DECLARE
  v_remaining INT;
BEGIN
  SELECT count(*) INTO v_remaining
    FROM engine_trigger
   WHERE event_type = 'shifts.published';
  IF v_remaining > 0 THEN
    RAISE EXCEPTION
      'unwind_shifts_published_alias: % rows still route shifts.published', v_remaining;
  END IF;
END $$;
