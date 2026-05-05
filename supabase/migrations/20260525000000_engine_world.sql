-- ============================================================================
-- 20260525000000_engine_world.sql
-- engine_world: shared world model for agent fleet.
--
-- Purpose: Every agent reads from engine_world before acting. Heartbeat jobs
-- and counter-reports from agents keep it fresh. Surfaces tracked: services
-- (vercel.web), PRs (pr.323), worktrees (wt.mobile-wt-2), migrations
-- (migration.20260524000000), costs (cost.openrouter.daily), CI (ci.workflow.X).
--
-- L-0042 timestamp verified: tip 20260524000000 (anon REVOKE hardening).
-- This migration is strictly greater. No forward dependencies on later files.
--
-- Dependencies:
--   - workspace (00001_identity_tables.sql) — earlier
--   - profile (00001_identity_tables.sql) — earlier (observed_by_profile_id FK)
--   - get_workspace_ids_for_user, is_admin_in_workspace (RLS helpers — earlier)
--
-- Pattern: read-by-many, write-by-many. Every agent capability that observes
-- truth (heartbeat, ci-incident-conductor, deploy-conductor, etc.) writes
-- here via report_observation tool. RLS enforces workspace isolation;
-- platform-level rows have workspace_id = NULL.
--
-- Per ADR-0151: writes derive workspace_id server-side, never from request body.
-- Per ADR-0099: writes go through gate_action with capability='engine.world_observe'.
-- Per L-0182: NO emit() in this migration — phantom-emit prevention. Producer
-- + consumer go in follow-up sortie.
-- ============================================================================

SET search_path TO public, extensions;

-- ─── Surface type enum ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engine_world_surface_type') THEN
    CREATE TYPE public.engine_world_surface_type AS ENUM (
      'service',      -- vercel.web, supabase.prod, droplet.n8n
      'pr',           -- pr.323
      'worktree',     -- wt.mobile-wt-2
      'migration',    -- migration.20260524000000
      'cost',         -- cost.openrouter.daily, cost.vercel.month
      'ci_workflow',  -- ci.workflow.harness-invariants
      'campaign',     -- campaign.botsson-arena
      'custom'        -- escape hatch — flag for promotion to first-class type
    );
  END IF;
END$$;

-- ─── Surface state enum ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engine_world_status') THEN
    CREATE TYPE public.engine_world_status AS ENUM (
      'green',        -- healthy
      'yellow',       -- degraded but functional
      'red',          -- broken
      'unknown',      -- not observed in last ttl window
      'paused'        -- intentionally not running
    );
  END IF;
END$$;

-- ─── Table ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.engine_world (
  surface_id              TEXT PRIMARY KEY,
  surface_type            engine_world_surface_type NOT NULL,
  status                  engine_world_status NOT NULL DEFAULT 'unknown',
  details                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Tenant isolation. NULL = platform-level (CI, infra, prod-DB observations).
  workspace_id            UUID REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  observed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  observed_by             TEXT NOT NULL,
  observed_by_profile_id  UUID REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  ttl_seconds             INTEGER NOT NULL DEFAULT 1800 CHECK (ttl_seconds > 0),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.engine_world IS
  'Shared world model for agent fleet. Each surface_id is a uniquely-identified observable thing (service, PR, worktree, migration, cost, CI workflow, campaign). Status reflects last observation. Stale rows (now - observed_at > ttl_seconds) should be treated as unknown by readers.';

COMMENT ON COLUMN public.engine_world.surface_id IS
  'Stable string ID. Convention: <type>.<name>. Examples: vercel.web, pr.323, wt.mobile-wt-2, migration.20260524000000, cost.openrouter.daily.';

COMMENT ON COLUMN public.engine_world.observed_by IS
  'Source identifier. Examples: heartbeat:drift-check, agent:ci-incident-conductor, mcp:supabase, manual:pontus.';

COMMENT ON COLUMN public.engine_world.ttl_seconds IS
  'Staleness gate. Default 30 min. Heartbeat jobs typically set 300-600s; one-shot manual observations set 86400s.';

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_engine_world_surface_type
  ON public.engine_world (surface_type);

CREATE INDEX IF NOT EXISTS idx_engine_world_status
  ON public.engine_world (status)
  WHERE status IN ('red', 'yellow', 'unknown');

CREATE INDEX IF NOT EXISTS idx_engine_world_observed_at
  ON public.engine_world (observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_engine_world_workspace
  ON public.engine_world (workspace_id)
  WHERE workspace_id IS NOT NULL;

-- Stale-rows query helper (now - observed_at > ttl_seconds).
CREATE INDEX IF NOT EXISTS idx_engine_world_staleness
  ON public.engine_world ((observed_at + (ttl_seconds || ' seconds')::interval));

-- ─── updated_at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER set_engine_world_updated_at
  BEFORE UPDATE ON public.engine_world
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.engine_world ENABLE ROW LEVEL SECURITY;

-- Read: workspace-scoped rows visible to workspace members; platform-level
-- rows (workspace_id IS NULL) visible to everyone authenticated. Anon callers
-- see nothing.
DROP POLICY IF EXISTS "engine_world_read_jwt" ON public.engine_world;
CREATE POLICY "engine_world_read_jwt" ON public.engine_world
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      workspace_id IS NULL
      OR workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    )
  );

-- API-key read path (workspace-scoped rows + platform-level rows).
DROP POLICY IF EXISTS "engine_world_read_api_key" ON public.engine_world;
CREATE POLICY "engine_world_read_api_key" ON public.engine_world
  FOR SELECT USING (
    workspace_id IS NULL
    OR workspace_id = public.get_api_workspace_id()
  );

-- Writes go through service_role (gated capability). No JWT or API-key write
-- policy — capability tool re-derives workspace_id server-side and runs
-- gate_action before writing.

-- ─── Capability registry tuple (per L-0179) ──────────────────────────────────
-- Capability 'engine.world_observe' must default to 'manual' authority for new
-- workspaces. Heartbeat + agent counter-reports run with platform service_role
-- (workspace_id IS NULL writes), bypassing gate_action via runtime SECURITY
-- DEFINER on the report function (separate sortie).
INSERT INTO public.capability_default_registry (capability, default_authority_level, description)
VALUES (
  'engine.world_observe',
  'manual',
  'Write/update an observation row in engine_world. Gated capability for workspace-scoped surfaces. Platform-level observations bypass via service_role (heartbeat jobs, ci-incident-conductor).'
)
ON CONFLICT (capability) DO NOTHING;
