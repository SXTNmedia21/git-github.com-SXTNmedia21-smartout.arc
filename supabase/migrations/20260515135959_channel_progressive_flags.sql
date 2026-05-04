-- ============================================
-- 20260515135959_channel_progressive_flags.sql
-- Progressive Channel Phase 1A.1 — additive schema (ADR-0165)
-- ============================================
-- ADR-0165 decision: helpdesk becomes a progressive layer on the
-- channel primitive via a boolean flag, not a channel_type subtype.
-- Existing 'desk' enum value is deprecated-not-dropped (Supervisor F1);
-- 'standard' is not a valid enum value so we never UPDATE channel_type.
-- helpdesk_enabled becomes the read-time truth source.
--
-- This migration is ADDITIVE ONLY (Phase 1A.1). No backfill, no
-- DROP of existing CHECKs, no data migration. Nullable columns,
-- NOT VALID CHECKs. Existing Phase 1 helpdesk channels continue
-- to work unchanged until Phase 1A.2 flips them to the flag model.
--
-- Phase 1A.2 (separate migration) will:
--   - UPDATE channel SET helpdesk_enabled=true, privacy_mode='private_per_requester'
--     WHERE channel_type='desk'
--   - VALIDATE the NOT VALID CHECKs
--   - DROP old CHECK channel_desk_requires_responsible
--
-- Security (Supervisor F4): channel_jwt_insert policy narrowed so JWT
-- users cannot INSERT rows with helpdesk_enabled=true unless they are
-- an admin in the workspace. Service role (Server Actions) retains
-- full access. Closes the rogue-helpdesk-creation attack vector that
-- would have existed if we relied on the flag alone.
-- ============================================

SET search_path TO public, extensions;

-- ── 1. Privacy mode enum ────────────────────────────────────────

CREATE TYPE public.channel_privacy_mode AS ENUM (
  'public',                  -- messages visible to all channel members (Fag-skranke)
  'private_per_requester'    -- each ticket spawns a sub-channel (HR-skranke)
);

COMMENT ON TYPE public.channel_privacy_mode IS
  'ADR-0165: helpdesk privacy posture per channel. public = messages visible to all members; private_per_requester = sub-channel per ticket.';

-- ── 2. New columns on channel ───────────────────────────────────

ALTER TABLE public.channel
  ADD COLUMN IF NOT EXISTS helpdesk_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.channel.helpdesk_enabled IS
  'ADR-0165: read-time truth source for helpdesk-ness. Replaces channel_type=''desk'' as discriminator. Legacy ''desk'' enum rows are backfilled to true in Phase 1A.2 and retain the enum value forever.';

ALTER TABLE public.channel
  ADD COLUMN IF NOT EXISTS privacy_mode public.channel_privacy_mode;

COMMENT ON COLUMN public.channel.privacy_mode IS
  'ADR-0165: helpdesk privacy posture. NULL when helpdesk_enabled=false. Set to ''public'' or ''private_per_requester'' when helpdesk_enabled=true (enforced by CHECK channel_private_requires_helpdesk).';

-- ── 3. New CHECK constraints (NOT VALID until Phase 1A.2) ────────

-- Helpdesk channels must have a responsible rep. Parallels the existing
-- channel_desk_requires_responsible CHECK (at 20260515130100:31) which
-- keyed off channel_type='desk'; this version keys off the new flag.
-- Both CHECKs coexist until 1A.2 DROPs the old one.
ALTER TABLE public.channel
  ADD CONSTRAINT channel_helpdesk_requires_responsible
  CHECK (NOT helpdesk_enabled OR responsible_profile_id IS NOT NULL)
  NOT VALID;

-- privacy_mode='private_per_requester' only makes sense when helpdesk_enabled=true.
-- privacy_mode='public' is also only meaningful when helpdesk is on, but we allow
-- it to be NULL when helpdesk is off to avoid forcing non-helpdesk channels to
-- carry an irrelevant value.
ALTER TABLE public.channel
  ADD CONSTRAINT channel_private_requires_helpdesk
  CHECK (privacy_mode IS NULL OR helpdesk_enabled = true)
  NOT VALID;

-- ── 4. Index for Min kø aggregation across channels ─────────────
-- Phase 1A.2's "Min kø" feature aggregates open tickets across all
-- channels where the current user is responsible. This partial index
-- supports that query efficiently; only indexes helpdesk-enabled rows.
CREATE INDEX IF NOT EXISTS idx_channel_helpdesk_responsible
  ON public.channel(responsible_profile_id, workspace_id)
  WHERE helpdesk_enabled = true;

-- ── 5. RLS narrowing — JWT INSERT of helpdesk_enabled=true ───────
-- Security finding (Council 2026-04-20 Supervisor F4): the existing
-- channel_jwt_insert policy allows JWT users to INSERT channel_type
-- IN ('custom', 'direct') rows. If helpdesk_enabled became JWT-settable
-- via that path, users could self-create rogue helpdesks and foist
-- themselves or others as rep. Narrowing the policy to allow the flag
-- only when the JWT user is admin in the workspace closes this hole.
-- Service role (Server Actions) bypasses RLS entirely and remains the
-- canonical upgrade path.

DROP POLICY IF EXISTS "channel_jwt_insert" ON public.channel;

CREATE POLICY "channel_jwt_insert" ON public.channel FOR INSERT WITH CHECK (
  channel_type IN ('custom', 'direct')
  AND workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND (
    helpdesk_enabled = false
    OR public.is_admin_in_workspace(auth.uid(), workspace_id)
  )
);

COMMENT ON POLICY "channel_jwt_insert" ON public.channel IS
  'ADR-0165 Rule 6: JWT users may INSERT custom/direct channels in their workspace. Setting helpdesk_enabled=true requires admin role (workspace owner/admin). Service role (Server Actions) bypasses this and remains the canonical upgrade path.';

-- Analogous narrowing on UPDATE — prevent JWT users from flipping
-- helpdesk_enabled=true on channels they admin but don't own at the
-- workspace level. Existing policy gates on channel_member role='admin';
-- we add the workspace-admin check for the flag.

DROP POLICY IF EXISTS "channel_jwt_update" ON public.channel;

CREATE POLICY "channel_jwt_update" ON public.channel FOR UPDATE USING (
  id IN (
    SELECT channel_id FROM public.channel_member
    WHERE profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid())
    AND role = 'admin'
    AND left_at IS NULL
  )
) WITH CHECK (
  -- Same gate on UPDATE: flipping helpdesk_enabled to true requires workspace admin.
  -- UPDATEs that leave helpdesk_enabled unchanged at false (or down to false) are allowed
  -- for channel admins without the workspace-admin check.
  helpdesk_enabled = false
  OR public.is_admin_in_workspace(auth.uid(), workspace_id)
);

COMMENT ON POLICY "channel_jwt_update" ON public.channel IS
  'ADR-0165 Rule 6: channel admins can UPDATE channel settings, but flipping helpdesk_enabled=true requires workspace admin role. Service role bypasses this.';
