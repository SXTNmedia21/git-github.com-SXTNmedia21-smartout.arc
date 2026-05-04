-- ============================================
-- 20260516000200_journey_version_status_0b_enum.sql
--
-- Purpose:
--   Step 0b of the L-0075 enum lifecycle. Validates that every existing
--   `journey_version.status` value is in the new enum domain, then flips the
--   column type from `text` to `journey_version_status`. The literal text
--   default ('draft') is dropped here; it is re-added as an enum-typed default
--   in 0c (separating the type flip from the default change keeps each step
--   minimal and trivially rollback-safe).
--
-- ADR Reference:
--   ADR-0172 — journey_version_status enum lifecycle.
--
-- Backfill strategy:
--   This migration assumes the table is empty or contains only rows whose
--   status is already in the new enum domain. The validation block below
--   raises a clear error if any row would fail the USING cast, so the flip
--   never silently corrupts data.
--
-- Dependencies:
--   - 20260516000000_journey_version_table.sql (journey_version table)
--   - 20260516000100_journey_version_status_0a_widen.sql (enum type)
--
-- Risk level: MEDIUM
--   Alters a column type in place. Safe today because the table is newly
--   created (no production data yet). The PRE-CHECK block makes it safe
--   against future backfills too.
--
-- ROLLBACK (for reference, not auto-executed):
--   ALTER TABLE public.journey_version ALTER COLUMN status DROP DEFAULT;
--   ALTER TABLE public.journey_version ALTER COLUMN status TYPE text USING status::text;
--   ALTER TABLE public.journey_version ALTER COLUMN status SET DEFAULT 'draft';
-- ============================================

SET search_path TO public, extensions;

-- ── Backfill validation (raises on mismatch) ─────────────
DO $$
DECLARE
  bad_count INT;
  bad_sample TEXT;
BEGIN
  SELECT COUNT(*), COALESCE(MIN(status), '')
    INTO bad_count, bad_sample
  FROM public.journey_version
  WHERE status NOT IN ('draft', 'ready_test', 'testing', 'ready_publish', 'published', 'archived');

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'journey_version_status 0b flip aborted: % row(s) have status outside enum domain (sample: %). Backfill before re-running.',
      bad_count, bad_sample;
  END IF;
END $$;

-- ── Drop the text default so the column type flip is unambiguous ─────────
ALTER TABLE public.journey_version
  ALTER COLUMN status DROP DEFAULT;

-- ── Flip the column type ────────────────────────────────
ALTER TABLE public.journey_version
  ALTER COLUMN status TYPE public.journey_version_status
  USING status::public.journey_version_status;
