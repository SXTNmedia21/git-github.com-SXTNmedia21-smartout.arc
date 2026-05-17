-- ============================================
-- 20260618200000_cascade_capability_authority_seed.sql
-- Seed `cascade` capability authority (ADR-0356)
--
-- The cascade capability ships two delegation tools that MUST be callable
-- by payroll Phase 7f tools (setup_workspace_tariff, change_workspace_tariff,
-- add_supplement_override). Without authority seed rows, the gate_action RPC
-- hits the default-allow path (CVE-class per L-0066 / L-0097).
--
-- ADR-0356: cascade-namespace delegation pattern — independent gate per tool.
-- ADR-0173: frozen-4 capability boundaries (cross-namespace write defense).
-- ADR-0204: gatedMutation per-tool authority — each tool needs its own seed.
--
-- Authority level: `autonomous` — delegation tools assume the calling capability
-- (payroll) has ALREADY fired its own gate_action. The cascade gate is an
-- INDEPENDENT authority check, not a double-confirm. Autonomous here means:
-- when the cascade gate approves, execution proceeds without a UI confirm loop.
-- "Autonomous" != "unguarded" — both caller gate AND cascade gate fire.
--
-- Channel restriction: ["chat"] — payroll-adjacent PII + admin config (ADR-0078).
-- min_required_role: 'admin' — both tables have NOT NULL constraint on min_role.
-- These delegation tools are called from payroll Phase 7f admin flows only.
-- 'admin' min_role mirrors the payroll capability seed convention.
--
-- This migration:
--   A. Registers `cascade` in capability_default_registry (auto-seeds new
--      workspaces via workspace_seed_authority_defaults_trg trigger).
--   B. Backfills engine_authority_config for ALL existing workspaces
--      (mirrors the pattern from 20260519160000_payroll_capability_authority_seed.sql).
--   C. Self-test DO-block verifying 3 rows seeded for the seed workspace.
-- ============================================

SET search_path TO public, extensions;

-- ─── Part A: Register in capability_default_registry ─────────────────────────
-- Capability-level row: defaultAuthority=autonomous, allowedChannels=chat, ADR-0356.
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  ('cascade', 'autonomous', 'admin', false, 72,
   'Cascade delegation capability — cross-namespace writes per ADR-0356 + ADR-0173. '
   'Two tools: bind_workspace_union + add_supplement_rule. '
   'Called by payroll Phase 7f tools; never invoked directly by users. '
   'allowedChannels=chat (ADR-0078). Independent gate per ADR-0356 §''Gate convention''. '
   'min_role=admin: only admin-gated payroll flows invoke these tools.')
ON CONFLICT (capability) DO NOTHING;

-- ─── Part B: Backfill existing workspaces — 3 capability strings ─────────────
-- One row per capability string per workspace (capability + per-tool dotted keys).
-- Same COALESCE chain as payroll seed migration for audit-trail consistency.
-- ON CONFLICT DO NOTHING: safe re-play on fresh DBs or after db reset.

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
  v.cap,
  'autonomous',
  'admin',
  false,
  72,
  COALESCE(
    (
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
        AND cm.role IN ('owner', 'admin')
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1
    )
  )
FROM public.workspace w
CROSS JOIN (
  VALUES
    ('cascade'),
    ('cascade.bind_workspace_union'),
    ('cascade.add_supplement_rule')
) AS v(cap)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- ─── Part C: Self-test ───────────────────────────────────────────────────────
-- Verify that at least the seed workspace has all 3 capability rows inserted.
-- Fails migration if any row is missing.
DO $$
DECLARE
  v_count integer;
  v_seed_workspace_id uuid;
BEGIN
  -- Use first workspace as representative seed workspace.
  SELECT workspace_id INTO v_seed_workspace_id
  FROM public.workspace
  ORDER BY created_at
  LIMIT 1;

  IF v_seed_workspace_id IS NULL THEN
    RAISE NOTICE '20260618200000: no workspaces found — skipping self-test (empty DB).';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.engine_authority_config
  WHERE workspace_id = v_seed_workspace_id
    AND capability IN ('cascade', 'cascade.bind_workspace_union', 'cascade.add_supplement_rule');

  IF v_count < 3 THEN
    RAISE EXCEPTION
      '20260618200000 self-test FAILED: expected 3 cascade authority rows for workspace %, found %',
      v_seed_workspace_id, v_count;
  END IF;

  RAISE NOTICE '20260618200000 self-test PASSED: % cascade authority rows for workspace %',
    v_count, v_seed_workspace_id;
END $$;
