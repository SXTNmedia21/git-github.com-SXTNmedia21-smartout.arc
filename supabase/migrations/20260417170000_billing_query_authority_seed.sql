SET search_path TO public, extensions;

-- ============================================
-- 20260417170000_billing_query_authority_seed.sql
-- Billing Engine Fase 1 — Phase 11.4
--
-- Seeds engine_authority_config rows for the new billing_query
-- capability (ADR-0118). Every existing workspace gets a row with
-- level = 'read_only' — the capability can read but not mutate,
-- which aligns with the capability's tool surface (5 read-only
-- tools, no mutating tool).
--
-- ON CONFLICT DO NOTHING — idempotent against replays. If a workspace
-- was seeded earlier (manual patch, forward migration), this runs
-- harmlessly. The (workspace_id, capability) unique constraint on
-- engine_authority_config enforces one row per (workspace, capability).
--
-- requires_four_eyes: false — read-only capability, no second-admin
--   confirmation needed.
-- observer_escalation_hours: 24 — default from the table definition;
--   has no effect on a read_only capability but the column is NOT NULL.
-- min_role: 'admin' — workspace-admin / owner can invoke billing tools.
--   Workers do not see billing data; same posture as
--   /dashboard/billing (Phase 10.1).
-- updated_by: the platform-admin author of this migration. We use the
--   first is_godmode user_identity as a non-null fallback; if none
--   exists, the migration exits early (fresh seed).
-- ============================================

DO $$
DECLARE
  v_updated_by uuid;
BEGIN
  SELECT user_id INTO v_updated_by
  FROM public.user_identity
  WHERE is_godmode = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_updated_by IS NULL THEN
    RAISE NOTICE 'No godmode user found — skipping billing_query authority seed. Re-run after first admin is created.';
    RETURN;
  END IF;

  INSERT INTO public.engine_authority_config (
    workspace_id,
    capability,
    level,
    min_role,
    requires_four_eyes,
    observer_escalation_hours,
    updated_by
  )
  SELECT
    w.workspace_id,
    'billing_query',
    'read_only',
    'admin',
    false,
    24,
    v_updated_by
  FROM public.workspace w
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). Added billing_query 2026-04-17.';
