-- ============================================
-- 20260515130400_helpdesk_rls_and_thread_enum.sql
-- Helpdesk Phase 1 — council blocker fixes (2026-04-20)
-- ============================================
-- Addresses two mid-flight council blockers before Phase 1 UI lands:
--
--   Blocker 1 (supervisor): reps set as channel.responsible_profile_id
--   but not yet in channel_member can't SELECT their desk via JWT RLS
--   → new policy channel_jwt_select_responsible.
--
--   Blocker 2 (supervisor): helpdesk conversation threads reused
--   channel_type='custom' which pollutes the generic "Kanaler" sidebar
--   with desk tickets alongside user-created channels. Introduce a
--   dedicated 'query_thread' enum value for clean filtering.
--
-- Enum addition must commit before dependent DDL references it — this
-- migration only adds the enum and the RLS policy (both idempotent and
-- independent). The capability tools.ts switch from 'custom' →
-- 'query_thread' lands in the same commit as this migration.
-- ============================================

SET search_path TO public, extensions;

-- Blocker 2 — query_thread enum value for helpdesk conversation threads.
-- Separated from the desk/representative enum additions so we never add
-- more than one enum value per migration (PG transaction safety).
ALTER TYPE comm_channel_type ADD VALUE IF NOT EXISTS 'query_thread';

-- Blocker 1 — RLS policy so reps can discover desks they own BEFORE being
-- added as channel_member. The existing channel_jwt_select policy only
-- lets members see channels; a newly-designated rep has no membership
-- yet and gets an empty desk list in the admin UI.
--
-- This policy explicitly grants SELECT to the profile named in
-- responsible_profile_id — the same person who will be assigned
-- incoming query threads. Membership-based access remains the primary
-- read path; this is the narrow fix for rep desk discovery.
DROP POLICY IF EXISTS channel_jwt_select_responsible ON public.channel;
CREATE POLICY channel_jwt_select_responsible ON public.channel
  FOR SELECT
  TO authenticated
  USING (
    responsible_profile_id IS NOT NULL
    AND responsible_profile_id IN (
      SELECT profile_id
      FROM public.profile
      WHERE user_id = auth.uid()
        AND workspace_id = public.channel.workspace_id
    )
  );

COMMENT ON POLICY channel_jwt_select_responsible ON public.channel IS
  'ADR-0161 council fix 2026-04-20: reps can see desks where they are responsible_profile_id even before being added as channel_member.';
