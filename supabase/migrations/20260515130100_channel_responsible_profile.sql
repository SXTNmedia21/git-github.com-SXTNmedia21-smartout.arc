-- ============================================
-- 20260515130100_channel_responsible_profile.sql
-- Helpdesk Phase 1 — desk ownership column (ADR-0161)
-- ============================================
-- ADR-0161 decision: desks are channels with type='desk' + an explicit
-- ownership column, NOT a sibling table (rejected per L-0070). The
-- responsible_profile_id column marks which employee owns incoming
-- queries on this desk (assignment target for helpdesk_query tickets).
--
-- CHECK constraint enforces that every desk channel has an owner —
-- a desk without an owner is nonsense (tickets would have nowhere to go).
-- Non-desk channels keep responsible_profile_id nullable.
--
-- FK uses ON DELETE RESTRICT: reassigning ownership is an explicit
-- admin action, never a cascade side-effect.
-- ============================================

SET search_path TO public, extensions;

ALTER TABLE public.channel
  ADD COLUMN IF NOT EXISTS responsible_profile_id uuid
    REFERENCES public.profile(profile_id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.channel.responsible_profile_id IS
  'ADR-0161: desk owner for channel_type=desk. Incoming helpdesk_query tickets assign here by default. NULL for non-desk channels.';

-- CHECK: desks MUST have an owner. Non-desks MAY have null.
-- NOT VALID lets us ship the constraint without scanning existing rows
-- (none have channel_type='desk' yet), then VALIDATE in a follow-up if needed.
ALTER TABLE public.channel
  ADD CONSTRAINT channel_desk_requires_responsible
  CHECK (channel_type <> 'desk' OR responsible_profile_id IS NOT NULL)
  NOT VALID;

-- Validate immediately — no existing rows will fail since 'desk' is brand new.
ALTER TABLE public.channel
  VALIDATE CONSTRAINT channel_desk_requires_responsible;

-- Index for desk queue lookups ("which desks am I responsible for?")
CREATE INDEX IF NOT EXISTS idx_channel_responsible_profile
  ON public.channel(responsible_profile_id)
  WHERE responsible_profile_id IS NOT NULL;
