-- Migration: extend activity_trail_actor_kind_check to allow 'godmode'
-- Created: 2026-05-25
-- ADR: ADR-0410 — Godmode Workspace Auto-Join
--
-- fn_godmode_join_workspace (migration 20260626000000) inserts an audit row
-- with actor_kind='godmode'. Pre-existing constraint
-- activity_trail_actor_kind_check locked actor_kind to ('user','platform') —
-- the audit insert always failed. Same root cause class as the
-- profile_source_check fix in 20260626000100. Found by /verify smoke after
-- the profile_source_check fix unblocked the first INSERT.
--
-- Idempotent: drop-then-add covers both fresh installs and prod where the
-- constraint may already exist in either shape.

ALTER TABLE public.activity_trail DROP CONSTRAINT IF EXISTS activity_trail_actor_kind_check;

ALTER TABLE public.activity_trail
  ADD CONSTRAINT activity_trail_actor_kind_check
  CHECK (actor_kind IN ('user', 'platform', 'godmode'));

COMMENT ON CONSTRAINT activity_trail_actor_kind_check ON public.activity_trail IS
  'Allowed activity_trail.actor_kind values. godmode added 2026-05-25 for '
  'ADR-0410 fn_godmode_join_workspace audit row (was user/platform only).';
