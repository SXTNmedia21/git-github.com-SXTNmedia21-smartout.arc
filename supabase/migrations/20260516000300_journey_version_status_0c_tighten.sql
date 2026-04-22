-- ============================================
-- 20260516000300_journey_version_status_0c_tighten.sql
--
-- Purpose:
--   Step 0c of the L-0075 enum lifecycle. Re-asserts NOT NULL (already
--   enforced from migration 1 but idempotent) and adds the enum-typed default
--   'draft'::journey_version_status. After this migration the column is
--   fully locked down: typed, NOT NULL, default-covered for INSERTs.
--
-- ADR Reference:
--   ADR-0172 — journey_version_status enum lifecycle.
--
-- Dependencies:
--   - 20260516000200_journey_version_status_0b_enum.sql (column is enum-typed)
--
-- Risk level: LOW
--   Constraint re-assertion + default. No data movement.
--
-- ROLLBACK (for reference, not auto-executed):
--   ALTER TABLE public.journey_version ALTER COLUMN status DROP DEFAULT;
--   ALTER TABLE public.journey_version ALTER COLUMN status DROP NOT NULL;
-- ============================================

SET search_path TO public, extensions;

ALTER TABLE public.journey_version
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.journey_version
  ALTER COLUMN status SET DEFAULT 'draft'::public.journey_version_status;
