-- ============================================
-- Rollback for 20260515135959_channel_progressive_flags.sql
-- Progressive Channel Phase 1A.1 — additive schema reversal
-- ============================================
-- Emergency rollback if Phase 1A.1 ships broken and Phase 1A.2 is
-- delayed. Safe to run because this migration is additive-only:
-- no rows were modified, no old constraints dropped, no data
-- migrated. Restores the pre-1A.1 schema shape exactly.
--
-- ORDER OF OPERATIONS MATTERS. Restore policies first (so writes
-- can continue under the old regime), then drop the new CHECKs,
-- then drop columns, finally drop the enum type.
--
-- Run against a database where Phase 1A.1 migration has been
-- applied. Do not run if 1A.2 has also been applied (would leave
-- data in inconsistent state).
-- ============================================

SET search_path TO public, extensions;

-- 1. Restore original channel_jwt_insert policy.
DROP POLICY IF EXISTS "channel_jwt_insert" ON public.channel;

CREATE POLICY "channel_jwt_insert" ON public.channel FOR INSERT WITH CHECK (
  channel_type IN ('custom', 'direct')
  AND workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- 2. Restore original channel_jwt_update policy.
DROP POLICY IF EXISTS "channel_jwt_update" ON public.channel;

CREATE POLICY "channel_jwt_update" ON public.channel FOR UPDATE USING (
  id IN (
    SELECT channel_id FROM public.channel_member
    WHERE profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid())
    AND role = 'admin'
    AND left_at IS NULL
  )
);

-- 3. Drop the new CHECK constraints (NOT VALID so no data scan needed).
ALTER TABLE public.channel DROP CONSTRAINT IF EXISTS channel_helpdesk_requires_responsible;
ALTER TABLE public.channel DROP CONSTRAINT IF EXISTS channel_private_requires_helpdesk;

-- 4. Drop the partial index.
DROP INDEX IF EXISTS public.idx_channel_helpdesk_responsible;

-- 5. Drop new columns. helpdesk_enabled is NOT NULL DEFAULT false, safe
-- to drop because no other table references it (added by this migration).
ALTER TABLE public.channel DROP COLUMN IF EXISTS privacy_mode;
ALTER TABLE public.channel DROP COLUMN IF EXISTS helpdesk_enabled;

-- 6. Drop the enum type last (must come after the column is dropped).
DROP TYPE IF EXISTS public.channel_privacy_mode;
