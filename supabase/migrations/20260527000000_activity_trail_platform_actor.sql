-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: activity_trail platform-actor schema
-- ADR-0290 Phase 2A — closes the audit gap for engine_world platform writes.
--
-- Problem (Phase 1 state):
--   activity_trail has workspace_id, actor_id, entity_id all NOT NULL (FK-backed).
--   Platform writes (workspace_id=NULL, actor_id=NULL) fail the NOT NULL constraint,
--   so engine_world_observe_platform's audit INSERT always raises not_null_violation
--   and falls into the EXCEPTION block. No audit row is ever written.
--
-- Solution:
--   1. Add actor_kind TEXT NOT NULL DEFAULT 'user' (CHECK: 'user' | 'platform').
--   2. Drop NOT NULL on workspace_id, actor_id, entity_id.
--      FK constraints remain — FK allows NULL in Postgres (NULL means "unknown
--      reference", not "invalid row"), so existing FK semantics are preserved for
--      user rows and NULL platform rows skip FK evaluation entirely.
--   3. Add a conditional CHECK enforcing the user-actor invariant:
--        actor_kind = 'user'    → workspace_id, actor_id, entity_id must all be non-null
--        actor_kind = 'platform' → no requirement (all three may be NULL)
--      This ensures no existing user-actor write is weakened — the NOT NULL behaviour
--      is now enforced by the CHECK rather than the column definition.
--   4. entity_type TEXT NOT NULL is kept NOT NULL. Platform rows supply
--      'engine_world' as the entity_type (a meaningful string, not a UUID reference).
--   5. New RLS policy: godmode-only read for actor_kind = 'platform' rows.
--      Existing workspace-member SELECT policy is unchanged (workspace_id IN (...)
--      naturally excludes NULL rows, so platform rows are invisible without the new policy).
--   6. engine_world_observe_platform RPC: drop EXCEPTION block, write real audit row.
--
-- Pre-conditions verified (2026-05-27 against local DB):
--   activity_trail columns with NOT NULL: workspace_id, actor_id, event, action_verb,
--     category, entity_type, entity_id, created_at.
--   FKs: actor_id → profile(profile_id), workspace_id → workspace(workspace_id).
--   No actor_kind column exists yet.
--   is_godmode column exists on user_identity (verified via \d+).
--   Existing INSERT policy: "Service role can insert activity" FOR INSERT TO service_role WITH CHECK (true).
-- ─────────────────────────────────────────────────────────────────────────────

SET search_path TO public, pg_temp;

-- ─── 1. Add actor_kind column ─────────────────────────────────────────────────

ALTER TABLE public.activity_trail
  ADD COLUMN actor_kind TEXT NOT NULL DEFAULT 'user'
  CHECK (actor_kind IN ('user', 'platform'));

COMMENT ON COLUMN public.activity_trail.actor_kind IS
  'user = workspace member action (workspace_id/actor_id/entity_id required). '
  'platform = infrastructure/telemetry write (workspace_id/actor_id/entity_id may be NULL). '
  'Added in ADR-0290 Phase 2A to support engine_world_observe_platform audit rows.';

-- ─── 2. Drop NOT NULL on workspace_id, actor_id, entity_id ──────────────────
--
-- FK constraints stay in place. In PostgreSQL, a FK constraint on a nullable
-- column allows NULL (NULL means "no reference", not a bad reference).
-- Existing user rows have non-null values so nothing changes for them.
-- The new CHECK constraint below re-enforces the user-actor invariant.

ALTER TABLE public.activity_trail
  ALTER COLUMN workspace_id DROP NOT NULL;

ALTER TABLE public.activity_trail
  ALTER COLUMN actor_id DROP NOT NULL;

ALTER TABLE public.activity_trail
  ALTER COLUMN entity_id DROP NOT NULL;

-- ─── 3. Conditional CHECK for user-actor invariant ───────────────────────────
--
-- Preserves the original NOT NULL guarantee for user writes:
-- any row with actor_kind = 'user' MUST supply all three identity columns.
-- Platform rows are exempt — they carry no workspace/actor/entity context.

ALTER TABLE public.activity_trail
  ADD CONSTRAINT activity_trail_user_actor_fields_required
  CHECK (
    (actor_kind = 'user' AND workspace_id IS NOT NULL AND actor_id IS NOT NULL AND entity_id IS NOT NULL)
    OR
    (actor_kind = 'platform')
  );

-- ─── 4. Godmode-only RLS policy for platform rows ────────────────────────────
--
-- Existing "Workspace members can view activity" policy uses:
--   workspace_id IN (SELECT p.workspace_id FROM profile p WHERE p.user_id = auth.uid())
-- This naturally returns no rows where workspace_id IS NULL, so platform rows
-- are already invisible to workspace members without this policy.
--
-- The new policy adds godmode visibility for platform observation rows.
-- Option A chosen (godmode-only, not all-members) per ADR-0290 V0 scope:
-- minimal surface area; platform telemetry rows are infrastructure-level
-- and should not be exposed in workspace audit trails.

CREATE POLICY "Godmode read platform activity" ON public.activity_trail
  FOR SELECT
  USING (
    actor_kind = 'platform'
    AND EXISTS (
      SELECT 1 FROM public.user_identity
      WHERE user_id = auth.uid()
        AND is_godmode = true
    )
  );

-- ─── 5. engine_world_observe_platform: real audit row ────────────────────────
--
-- Replaces the EXCEPTION-wrapped INSERT (which always raised not_null_violation)
-- with a real INSERT that uses the new actor_kind='platform' path.
-- The UPSERT body (engine_world INSERT/UPDATE) is unchanged from Phase 1.

CREATE OR REPLACE FUNCTION public.engine_world_observe_platform(
  p_surface_id     TEXT,
  p_surface_type   public.engine_world_surface_type,
  p_status         public.engine_world_status,
  p_details        JSONB DEFAULT '{}'::jsonb,
  p_ttl_seconds    INTEGER DEFAULT 1800,
  p_observed_by    TEXT DEFAULT 'platform'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- ── engine_world UPSERT (unchanged from Phase 1) ──────────────────────────
  INSERT INTO public.engine_world (
    surface_id, surface_type, status, details,
    workspace_id, observed_at, observed_by, ttl_seconds
  ) VALUES (
    p_surface_id, p_surface_type, p_status, p_details,
    NULL, now(), p_observed_by, p_ttl_seconds
  )
  ON CONFLICT (surface_id) DO UPDATE SET
    surface_type = EXCLUDED.surface_type,
    status       = EXCLUDED.status,
    details      = EXCLUDED.details,
    observed_at  = EXCLUDED.observed_at,
    observed_by  = EXCLUDED.observed_by,
    ttl_seconds  = EXCLUDED.ttl_seconds,
    updated_at   = now();

  -- ── activity_trail audit row (ADR-0290 Phase 2A) ──────────────────────────
  -- Now a real row, not an EXCEPTION-wrapped attempt.
  -- actor_kind = 'platform' satisfies the new conditional CHECK.
  -- workspace_id, actor_id, entity_id are NULL — permitted by the CHECK for platform rows.
  -- entity_type = 'engine_world' provides a meaningful type string.
  -- data carries the full observation context for query/replay.
  INSERT INTO public.activity_trail (
    actor_kind,
    workspace_id,
    actor_id,
    event,
    action_verb,
    category,
    entity_type,
    entity_id,
    data,
    source,
    created_at
  ) VALUES (
    'platform',
    NULL,
    NULL,
    'engine_world.platform_write',
    'observed',
    'platform_telemetry',
    'engine_world',
    NULL,
    jsonb_build_object(
      'surface_id',   p_surface_id,
      'surface_type', p_surface_type::text,
      'status',       p_status::text,
      'observed_by',  p_observed_by
    ),
    'platform',
    now()
  );
END;
$$;

COMMENT ON FUNCTION public.engine_world_observe_platform IS
  'Platform-level UPSERT into engine_world. SECURITY DEFINER bypasses gate_action per ADR-0290. '
  'Allowed callers: heartbeat jobs, ci-incident-conductor, stage-engine. '
  'Phase 2A: audit INSERT now writes a real activity_trail row with actor_kind=''platform''. '
  'ADR-0290 status: proposed → accepted.';

-- REVOKE/GRANT contract unchanged from Phase 1
REVOKE ALL ON FUNCTION public.engine_world_observe_platform FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.engine_world_observe_platform TO service_role;
GRANT EXECUTE ON FUNCTION public.engine_world_observe_platform TO authenticated;
