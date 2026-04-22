-- ============================================
-- 20260516000100_journey_version_status_0a_widen.sql
--
-- Purpose:
--   Step 0a of the L-0075 enum lifecycle. Creates the NEW enum type
--   `journey_version_status` with the full 6-value domain. The
--   `journey_version.status` column is NOT touched in this migration — it
--   remains `text` until 0b. This is the "widen" step: the enum exists and is
--   available to application code, but the column still accepts any text, so
--   rollback is cheap (just `DROP TYPE`).
--
-- ADR Reference:
--   ADR-0172 — journey_version_status enum lifecycle.
--   Collision avoidance: the pre-existing `journey_status` enum on the
--   `journey` table already defines `ready_test` for a different semantic
--   (dev-tracking lifecycle). We therefore create a SEPARATE enum rather than
--   widening the existing `journey_status` enum in place, which is banned by
--   ADR-0172 and the campaign CLAUDE.md hard-rules.
--
-- Value domain (6 states, ADR-0172):
--   draft         — authored, not yet test-ready
--   ready_test    — gated into dev run
--   testing       — Playwright run in progress or failing
--   ready_publish — passed tests, awaiting publish authority
--   published     — live as mission + user-guide
--   archived      — retired, read-only
--
-- Dependencies:
--   - 20260516000000_journey_version_table.sql (table exists with status text)
--
-- Risk level: LOW
--   Type creation only. No column, no data, no RLS changes.
--
-- ROLLBACK (for reference, not auto-executed):
--   DROP TYPE IF EXISTS public.journey_version_status;
--   -- Safe while the status column is still `text`.
-- ============================================

SET search_path TO public, extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journey_version_status') THEN
    CREATE TYPE public.journey_version_status AS ENUM (
      'draft',
      'ready_test',
      'testing',
      'ready_publish',
      'published',
      'archived'
    );
  END IF;
END $$;

COMMENT ON TYPE public.journey_version_status IS
  'Journey version lifecycle (ADR-0172). Distinct from journey_status which tracks the dev-tracking lifecycle of the parent journey.';
