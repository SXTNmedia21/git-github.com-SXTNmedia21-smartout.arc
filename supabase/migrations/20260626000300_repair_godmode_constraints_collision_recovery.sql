-- Migration: repair godmode constraints — collision recovery
-- Created: 2026-05-25
-- ADR: ADR-0427 (forward-only repair for timestamp-collision class)
--      extends ADR-0361 §Design 2 (forward-only repair, not auto-fix)
--      sibling of L-0302 (ledger-without-DDL ghost migrations)
--
-- WHY THIS MIGRATION EXISTS
-- ─────────────────────────
-- ADR-0410 godmode RPC `fn_godmode_join_workspace` inserts profile rows with
-- source='godmode' and activity_trail rows with actor_kind='godmode'. The
-- pre-existing check constraints rejected both values, and a composite
-- constraint required actor_id NOT NULL.
--
-- A sibling sortie (feat/godmode-button-web 2026-05-25) added three fix
-- migrations (20260626000100/0200/0300) but their TIMESTAMPS collided with
-- THREE different unrelated migrations already on main:
--   - 20260626000100 on main = `invitation_pending_unique_per_phone`
--   - 20260626000200 on main = `channel_is_active_column`
--   - 20260626000300 was free on main
--
-- `supabase db push --include-all` matches by timestamp, not content. So on
-- next HOP B (development → preview → main), the dev-branch fix migrations
-- 0100/0200 would be silently skipped — prod ledger already records those
-- timestamps as applied (with different SQL). 0300 alone would not unblock
-- the godmode button because the first INSERT step fails on profile_source_check.
--
-- THIS MIGRATION (timestamp 20260626000300, unique on dev + free on main at
-- the moment of writing) applies all three constraint extensions idempotently.
-- The 5 colliding/redundant predecessor migrations on dev have been DELETED
-- in this same merge commit. After deploy:
--   - profile.source CHECK accepts 'godmode'
--   - activity_trail.actor_kind CHECK accepts 'godmode'
--   - activity_trail composite CHECK accepts {actor_kind='godmode', actor_id NULL,
--     workspace_id NOT NULL, entity_id NOT NULL}
--
-- DEPLOYMENT TARGETS
-- ──────────────────
-- Local dev (Supabase Local):    `supabase db reset` after this merge re-applies
--                                from clean state. Old constraints from deleted
--                                0100/0200/0300 also re-deleted in same reset.
-- Preview Branch DB:             applied via dev→preview merge.
-- Prod (yljaglomadbhyqpcigff):   first real shape change here — fixes the bug
--                                /verify caught on local but never reached prod
--                                due to timestamp collision with main's hotfixes.
--
-- VERIFIED BY
-- ───────────
-- 2026-05-25 /verify pass (sortie 6): end-to-end Playwright click + DB assertion
-- on local with constraints in this exact final shape. Profile row INSERT +
-- activity_trail audit row both succeed.

-- ─── profile.source CHECK ────────────────────────────────────────────────────
ALTER TABLE public.profile DROP CONSTRAINT IF EXISTS profile_source_check;

ALTER TABLE public.profile
  ADD CONSTRAINT profile_source_check
  CHECK (source IN ('operational', 'bubble_migration', 'v3_engine', 'godmode'));

COMMENT ON CONSTRAINT profile_source_check ON public.profile IS
  'Allowed profile.source values. godmode added 2026-05-25 for ADR-0410 '
  'fn_godmode_join_workspace via collision-recovery migration ADR-0427.';

-- ─── activity_trail.actor_kind CHECK ─────────────────────────────────────────
ALTER TABLE public.activity_trail DROP CONSTRAINT IF EXISTS activity_trail_actor_kind_check;

ALTER TABLE public.activity_trail
  ADD CONSTRAINT activity_trail_actor_kind_check
  CHECK (actor_kind IN ('user', 'platform', 'godmode'));

COMMENT ON CONSTRAINT activity_trail_actor_kind_check ON public.activity_trail IS
  'Allowed activity_trail.actor_kind values. godmode added 2026-05-25 for '
  'ADR-0410 audit row via collision-recovery migration ADR-0427.';

-- ─── activity_trail composite CHECK (per-kind field requirements) ────────────
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
  'for ADR-0410: actor_id NULL allowed (godmode has no profile in target '
  'workspace at audit time), workspace_id + entity_id required. '
  'Bundled with the two sibling constraint relaxations in one atomic '
  'forward-only collision-recovery migration (ADR-0427).';
