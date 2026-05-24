-- Migration: extend activity_trail_user_actor_fields_required for godmode
-- Created: 2026-05-25
-- ADR: ADR-0410 — Godmode Workspace Auto-Join
--
-- Composite constraint previously enforced:
--   actor_kind='user'     → workspace_id + actor_id + entity_id all NOT NULL
--   actor_kind='platform' → no field requirements
-- 'godmode' rows have actor_id IS NULL by design (godmode user has no profile
-- in the target workspace at audit time — ADR-0410 §Security §4). Same root
-- cause class as profile_source_check (20260626000100) and
-- activity_trail_actor_kind_check (20260626000200) fixes. Found by /verify
-- smoke after those two fixes unblocked the prior INSERT steps.
--
-- Idempotent: drop-then-add covers fresh + drifted states.

ALTER TABLE public.activity_trail
  DROP CONSTRAINT IF EXISTS activity_trail_user_actor_fields_required;

ALTER TABLE public.activity_trail
  ADD CONSTRAINT activity_trail_user_actor_fields_required
  CHECK (
    (actor_kind = 'user'
      AND workspace_id IS NOT NULL
      AND actor_id     IS NOT NULL
      AND entity_id    IS NOT NULL)
    OR (actor_kind = 'platform')
    OR (actor_kind = 'godmode'
      AND workspace_id IS NOT NULL
      AND entity_id    IS NOT NULL)
  );

COMMENT ON CONSTRAINT activity_trail_user_actor_fields_required ON public.activity_trail IS
  'Enforces actor-kind-specific field presence. godmode rows added 2026-05-25 '
  'for ADR-0410 audit: actor_id NULL allowed (no profile yet), '
  'workspace_id + entity_id required.';
