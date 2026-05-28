-- Migration M4 — IRREVERSIBLE: drop legacy location_id + zone columns
-- ADR-0430 Rule 2 + ADR-0427 (forward-only repair doctrine).
-- Phase b PLAN-4b §4b.3.
--
-- After this migration:
--   schedule_shift.location_id  — DROPPED (zone membership via shift_zone M:N)
--   schedule_shift.zone         — DROPPED (zone membership via shift_zone M:N)
--   profile.location_id         — DROPPED (location membership via department_location)
--
-- PREREQUISITE CHECKS (enforced in DO block below):
--   1. pg_depend: no remaining column references for location_id / zone on these tables
--   2. Trigger rewrite (20260801000005) must have been applied — trg_ensure_shift_session
--      no longer watches OF location_id
--
-- MF-Prior-5 (council mandate): DROP CONSTRAINT fk_profile_location BEFORE DROP COLUMN.

BEGIN;

-- ── Safety: fail loudly if pg_depend still has column references ──────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_depend d
    JOIN pg_class c ON c.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
    WHERE c.relname IN ('schedule_shift', 'profile')
      AND a.attname IN ('location_id', 'zone')
      AND d.deptype = 'n'
  ) THEN
    RAISE EXCEPTION
      'M4 BLOCKED: pg_depend rows still reference schedule_shift.location_id, '
      'schedule_shift.zone, or profile.location_id — ensure_shift_session trigger '
      'rewrite (20260801000005) or other dependency not yet applied. '
      'Run: SELECT c.relname, a.attname, d.deptype FROM pg_depend d '
      'JOIN pg_class c ON c.oid = d.refobjid '
      'JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid '
      'WHERE c.relname IN (''schedule_shift'', ''profile'') '
      'AND a.attname IN (''location_id'', ''zone'') AND d.deptype = ''n''';
  END IF;
END $$;

-- ── profile: drop FK constraint first (MF-Prior-5) ───────────────────────────
ALTER TABLE public.profile
  DROP CONSTRAINT IF EXISTS fk_profile_location;

-- ── profile: drop location_id column ─────────────────────────────────────────
ALTER TABLE public.profile
  DROP COLUMN IF EXISTS location_id;

-- ── schedule_shift: drop location_id column ──────────────────────────────────
ALTER TABLE public.schedule_shift
  DROP COLUMN IF EXISTS location_id;

-- ── schedule_shift: drop zone column ─────────────────────────────────────────
ALTER TABLE public.schedule_shift
  DROP COLUMN IF EXISTS zone;

COMMIT;
