-- ============================================
-- 20260515160000_channel_helpdesk_backfill.sql
-- Progressive Channel Phase 1A.2 — backfill + CHECK swap (ADR-0165)
-- ============================================
-- Phase 1A.1 (20260515140000) shipped the additive schema: helpdesk_enabled
-- boolean column, privacy_mode enum + column, two NOT VALID CHECKs, and
-- narrowed channel_jwt_insert / channel_jwt_update RLS policies. Legacy
-- Phase 1 helpdesk channels (channel_type='desk') remained untouched and
-- were ignored by the new flag-based read paths.
--
-- Phase 1A.2 flips the read-time truth source. After this migration:
--   - Every legacy desk row carries helpdesk_enabled=true + privacy_mode
--     set to 'private_per_requester' (the Phase 1 posture).
--   - The new CHECK constraints (channel_helpdesk_requires_responsible,
--     channel_private_requires_helpdesk) are VALIDATEd against the live
--     table. This is safe because the backfill ran first and every
--     eligible row satisfies both.
--   - The old CHECK (channel_desk_requires_responsible, from
--     20260515130100:31) is DROPped. The flag-based CHECK supersedes it.
--     Dual-truth window closes here.
--
-- Leave channel_type='desk' unchanged on legacy rows per ADR-0165 Rule 7
-- (read paths consult the flag only). 'standard' is not a valid enum
-- value so we must not attempt to UPDATE channel_type.
--
-- Idempotency: the UPDATE is a no-op on a freshly-backfilled table.
-- The VALIDATEs are no-ops if already valid. The DROP CONSTRAINT uses
-- IF EXISTS. Safe to re-run.
-- ============================================

SET search_path TO public, extensions;

-- ── 1. Backfill legacy desk rows ────────────────────────────────
-- Every channel_type='desk' row inherits the Phase 1 posture:
--   - helpdesk_enabled = true (flag is now the truth source)
--   - privacy_mode = 'private_per_requester' (Phase 1 spawned a
--     sub-channel per query; that matches the private posture)
-- Non-desk rows are untouched. responsible_profile_id is already NOT
-- NULL on every 'desk' row (enforced by the old CHECK at
-- 20260515130100:31), so channel_helpdesk_requires_responsible
-- cannot fail its VALIDATE in step 3.

UPDATE public.channel
SET helpdesk_enabled = true,
    privacy_mode     = 'private_per_requester'
WHERE channel_type = 'desk'
  AND (helpdesk_enabled IS DISTINCT FROM true
       OR privacy_mode IS DISTINCT FROM 'private_per_requester');

-- ── 2. Backfill sanity check (fail fast on unexpected state) ────
-- Any 'desk' row still missing helpdesk_enabled after the UPDATE is a
-- migration bug (trigger, partial update, race). Abort the migration
-- rather than silently ship with inconsistent state.
DO $$
DECLARE
  bad_row_count integer;
BEGIN
  SELECT count(*) INTO bad_row_count
  FROM public.channel
  WHERE channel_type = 'desk'
    AND (helpdesk_enabled IS DISTINCT FROM true OR privacy_mode IS NULL);

  IF bad_row_count > 0 THEN
    RAISE EXCEPTION
      'Backfill sanity check failed: % legacy desk row(s) still missing helpdesk_enabled/privacy_mode. Aborting migration.',
      bad_row_count;
  END IF;
END $$;

-- ── 3. VALIDATE the NOT VALID CHECKs from 1A.1 ───────────────────
-- The 1A.1 migration shipped these as NOT VALID so it could ship
-- without scanning the live table. Now that the backfill has
-- aligned every row, the full-table scan will succeed.
ALTER TABLE public.channel
  VALIDATE CONSTRAINT channel_helpdesk_requires_responsible;

ALTER TABLE public.channel
  VALIDATE CONSTRAINT channel_private_requires_helpdesk;

-- ── 4. Drop the superseded Phase 1 CHECK ────────────────────────
-- channel_desk_requires_responsible (added at 20260515130100:31) keyed
-- off channel_type='desk'. Its flag-based successor (channel_helpdesk
-- _requires_responsible, added at 20260515140000:61) is now validated
-- against the full table and covers every helpdesk-enabled row by
-- construction (ADR-0165 Rule 3). Keeping both would double-gate
-- legacy rows and block future admin-UX downgrades that flip the
-- flag off without touching channel_type.
ALTER TABLE public.channel
  DROP CONSTRAINT IF EXISTS channel_desk_requires_responsible;
