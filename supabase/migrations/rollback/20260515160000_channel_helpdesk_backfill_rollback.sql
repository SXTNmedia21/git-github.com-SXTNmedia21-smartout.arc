-- ============================================
-- Rollback for 20260515160000_channel_helpdesk_backfill.sql
-- Progressive Channel Phase 1A.2 — reverse backfill + restore old CHECK
-- ============================================
-- Emergency rollback if Phase 1A.2 ships broken. After running this,
-- the database matches the post-1A.1 / pre-1A.2 state:
--   - Legacy 'desk' rows: helpdesk_enabled=false, privacy_mode=NULL.
--   - Old CHECK channel_desk_requires_responsible: restored (VALID).
--   - New CHECKs channel_helpdesk_requires_responsible / _private
--     _requires_helpdesk: reverted to NOT VALID posture (so future
--     re-run of 1A.2 can VALIDATE them cleanly).
--
-- This rollback does NOT undo Phase 1A.1 — its schema (columns, enum,
-- RLS narrowing) remains in place. Pair this with the 1A.1 rollback
-- to fully revert to pre-progressive state.
--
-- Order matters: reverse data first (so the old CHECK can VALIDATE),
-- restore old CHECK second, then mark new CHECKs NOT VALID last.
-- ============================================

SET search_path TO public, extensions;

-- ── 1. Revert backfill on legacy desk rows ──────────────────────
-- The pre-1A.2 contract was: channel_type='desk' → helpdesk_enabled
-- default false + privacy_mode NULL. Reverting matches that shape
-- even if downstream code has been re-pointed at the flag.
UPDATE public.channel
SET helpdesk_enabled = false,
    privacy_mode     = NULL
WHERE channel_type = 'desk';

-- ── 2. Restore the old Phase 1 CHECK ────────────────────────────
-- channel_desk_requires_responsible keyed off channel_type='desk'.
-- Re-add it as NOT VALID first (safe even on a dirty table), then
-- VALIDATE — every legacy desk row is guaranteed to have
-- responsible_profile_id set (Phase 1 contract unchanged), so the
-- VALIDATE will succeed.
ALTER TABLE public.channel
  ADD CONSTRAINT channel_desk_requires_responsible
  CHECK (channel_type <> 'desk' OR responsible_profile_id IS NOT NULL)
  NOT VALID;

ALTER TABLE public.channel
  VALIDATE CONSTRAINT channel_desk_requires_responsible;

-- ── 3. Revert new CHECKs to NOT VALID posture ───────────────────
-- Postgres does not expose "un-validate" as a first-class operation,
-- so we drop the VALID versions and re-add them NOT VALID. The
-- constraint logic is unchanged; only the validity state differs.
-- After this, Phase 1A.2 can be re-applied cleanly in the future.
ALTER TABLE public.channel
  DROP CONSTRAINT IF EXISTS channel_helpdesk_requires_responsible;

ALTER TABLE public.channel
  ADD CONSTRAINT channel_helpdesk_requires_responsible
  CHECK (NOT helpdesk_enabled OR responsible_profile_id IS NOT NULL)
  NOT VALID;

ALTER TABLE public.channel
  DROP CONSTRAINT IF EXISTS channel_private_requires_helpdesk;

ALTER TABLE public.channel
  ADD CONSTRAINT channel_private_requires_helpdesk
  CHECK (privacy_mode IS NULL OR helpdesk_enabled = true)
  NOT VALID;
