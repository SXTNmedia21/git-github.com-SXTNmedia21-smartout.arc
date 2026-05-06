-- ============================================================================
-- 20260526000000_engine_world_phase_1.sql
-- engine_world Phase 1 — platform RPC + capability level upgrade
--
-- Spec: docs/superpowers/specs/2026-05-06-engine-world-phase-1.md
-- ADRs: 0281 (engine_world), 0290 (platform RPC bypass justification)
--        NOTE: ADR-0282 slot taken by voice-plane-consolidation; escalated to 0290.
--
-- Phase 0 (20260525000000_engine_world.sql) shipped the table, enums, RLS,
-- and the capability_default_registry seed row at level='read_only'.
-- This migration:
--   1. Creates SECURITY DEFINER RPC engine_world_observe_platform for
--      platform-level writes (heartbeat, ci-conductor, stage-engine).
--      Bypasses gate_action per ADR-0290. Audit substitute: attempts an
--      activity_trail insert — expected to hit EXCEPTION on platform context
--      where workspace_id IS NULL (NOT NULL constraint on activity_trail).
--      See schema note below.
--   2. Upgrades engine.world_observe registry level read_only → confirm so
--      the user-facing report_observation tool can perform gated writes.
--
-- ─── Schema findings (verified 2026-05-26 against local DB) ─────────────────
-- capability_default_registry.level is TEXT with CHECK constraint:
--   ('autonomous', 'confirm', 'suggest', 'read_only', 'disabled') — 'confirm' valid.
-- activity_trail columns: workspace_id UUID NOT NULL, actor_id UUID NOT NULL,
--   event TEXT NOT NULL, action_verb TEXT NOT NULL, category TEXT NOT NULL,
--   entity_type TEXT NOT NULL, entity_id UUID NOT NULL.
-- activity_trail has NO nullable ID columns — platform writes (workspace_id=NULL,
-- actor_id=NULL) will always fail the NOT NULL constraint and be caught by the
-- EXCEPTION block. This is intentional: the RPC still succeeds; the audit gap
-- is logged to PG log per ADR-0290. Phase E ADR-0290 author must reconcile if
-- activity_trail gains a nullable platform-actor path.
-- ─────────────────────────────────────────────────────────────────────────────

SET search_path TO public, pg_temp;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SECURITY DEFINER RPC for platform-level writes
--    Allowed callers: heartbeat jobs, ci-incident-conductor,
--    stage-engine post-dispatch async writer.
--    Bypasses gate_action by design (per ADR-0290).
--    Audit substitute: attempts activity_trail INSERT; catches NOT NULL failure
--    since platform context has no workspace_id / actor_id.
-- ─────────────────────────────────────────────────────────────────────────────

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
  -- Platform-level surfaces have workspace_id NULL
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

  -- ── Audit substitute (ADR-0290) ──────────────────────────────────────────
  -- activity_trail requires workspace_id NOT NULL + actor_id NOT NULL + several
  -- other NOT NULL fields. Platform writes have no workspace or actor context,
  -- so this INSERT will always raise a NOT NULL violation and fall into the
  -- EXCEPTION block. The RPC write itself has already succeeded above.
  --
  -- This block is kept intentionally so that when/if activity_trail gains a
  -- nullable platform-actor path (Phase E reconciliation per ADR-0290), the
  -- audit will activate automatically without a new migration.
  --
  -- Current behaviour: platform write succeeds; audit gap logged to PG log.
  BEGIN
    INSERT INTO public.activity_trail (
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
      NULL,                                        -- NOT NULL: will raise exception
      NULL,                                        -- NOT NULL: will raise exception
      'engine_world.platform_write',
      'observe',
      'engine_world',
      'surface',
      NULL,                                        -- NOT NULL: will raise exception
      jsonb_build_object(
        'surface_id',    p_surface_id,
        'surface_type',  p_surface_type::text,
        'status',        p_status::text,
        'observed_by',   p_observed_by,
        'actor_kind',    'platform',
        'denied_by_gate', NULL
      ),
      'platform',
      now()
    );
  EXCEPTION WHEN not_null_violation OR undefined_column OR undefined_table THEN
    -- Expected: activity_trail NOT NULL constraints reject platform-actor rows.
    -- ADR-0290: platform write itself succeeded; audit gap logged here.
    RAISE WARNING 'engine_world_observe_platform: activity_trail audit skipped — % (surface_id=%, status=%)',
      SQLERRM, p_surface_id, p_status::text;
  END;
END;
$$;

COMMENT ON FUNCTION public.engine_world_observe_platform IS
  'Platform-level UPSERT into engine_world. SECURITY DEFINER bypasses gate_action per ADR-0290. '
  'Allowed callers: heartbeat jobs, ci-incident-conductor, stage-engine. '
  'Audit substitute via activity_trail is currently non-functional (NOT NULL constraint mismatch); '
  'tracked for Phase E reconciliation in ADR-0290.';

-- Restrict execute privilege — only service_role + authenticated should call
REVOKE ALL ON FUNCTION public.engine_world_observe_platform FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.engine_world_observe_platform TO service_role;
GRANT EXECUTE ON FUNCTION public.engine_world_observe_platform TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Upgrade engine.world_observe default registry level read_only → confirm
--    Phase 0 seeded read_only which would deny all gated writes to the
--    user-facing report_observation tool (gate evaluates capability level and
--    returns denied when level < confirm for mutating actions).
-- ─────────────────────────────────────────────────────────────────────────────

-- Note: capability_default_registry has no updated_at column (verified against schema).
UPDATE public.capability_default_registry
SET    level = 'confirm'
WHERE  capability = 'engine.world_observe';

-- Sanity check — fail loudly if Phase 0 row missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.capability_default_registry
    WHERE capability = 'engine.world_observe'
  ) THEN
    RAISE EXCEPTION 'engine.world_observe missing from capability_default_registry — Phase 0 migration (20260525000000_engine_world.sql) not applied?';
  END IF;
END $$;
