-- ============================================
-- 20260520160000_operations_capability_authority_seed.sql
-- `operations` capability authority seed — ADR-0186 follow-up
--
-- PURPOSE
-- -------
-- Ships the authority config rows that make the `operations` capability
-- a closed gate rather than a default-allow surface (L-0066 CVE class).
--
-- Without this seed: any workspace has no row for capability='operations' in
-- engine_authority_config → gate_action() default-allows all operations tool
-- invocations regardless of role or channel. createDeviation + completeTask
-- are real mutations that must land on a gated surface.
--
-- TWO-PART SEED (mirrors ADR-0192 pattern, 20260518000000)
-- --------------------------------------------------------
-- Part A: INSERT into capability_default_registry — one platform-wide row
--         consumed by workspace_seed_authority_defaults_trg on every new
--         workspace INSERT.
-- Part B: Backfill INSERT into engine_authority_config for every existing
--         workspace — same COALESCE chain (owner → any member → any
--         user_identity) used by helpdesk_query, contract, and legal seeds.
--
-- AUTHORITY POLICY
-- ----------------
--   level = 'read_only'    — operations tools are per-employee daily ops.
--                            createDeviation + completeTask are self-service
--                            actions (employee logs their own deviation,
--                            completes their own task). read_only is the
--                            workspace-visible posture; the JS gate enforces
--                            per-tool action-type gates.
--   min_role = 'employee'  — deviations and task completion are employee-
--                            initiated. Lower bar than helpdesk/contract/legal.
--                            An employee must be able to log their own deviation
--                            without manager approval — that's the operational
--                            safety contract.
--   requires_four_eyes = false
--                          — self-service daily ops. No dual-approval required
--                            for standard deviation reports or task completions.
--   observer_escalation_hours = 24
--                          — daily-ops cadence. 24h matches the department
--                            session cycle — a manager reviews escalations
--                            within one business day.
--
-- IDEMPOTENT
-- ----------
-- ON CONFLICT (capability) DO NOTHING     → capability_default_registry
-- ON CONFLICT (workspace_id, capability) DO NOTHING → engine_authority_config
-- Safe under `db reset` + replay.
--
-- References:
--   ADR-0186 (gate_action mandatory before mutations — CVE close)
--   ADR-0192 (capability_default_registry + bootstrap trigger pattern)
--   ADR-0099 (gate_action authority gate)
--   L-0066   (default-allow CVE class — authority seed is mandatory same PR)
--   packages/ai/src/capabilities/operations/tools.ts (createDeviation, completeTask)
-- ============================================

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────
-- Part A — capability_default_registry: platform-wide default for operations
-- ─────────────────────────────────────────────────────────────────────
-- Consumed by workspace_seed_authority_defaults_trg (ADR-0192) on every
-- new workspace INSERT. Adding this row is sufficient to auto-seed new
-- workspaces — no trigger function rewrite needed.

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'operations',
    'read_only',
    'employee',
    false,
    24,
    'Daily ops — createDeviation: employee self-report; completeTask: employee self-service. '
    '24h escalation matches department session cycle. ADR-0186 gate close. 2026-05-02.'
  )
ON CONFLICT (capability) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- Part B — engine_authority_config: backfill for all existing workspaces
-- ─────────────────────────────────────────────────────────────────────
-- The trigger (Part A) covers only future workspaces. This SELECT × JOIN
-- fills the gap for all workspaces created before this migration lands.
-- COALESCE chain mirrors contract + helpdesk_query + legal backfill pattern.

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
  'operations',
  'read_only',
  'employee',
  false,
  24,
  COALESCE(
    (
      -- Prefer workspace owner/admin via company_member (ADR-0099 audit trail).
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
        AND cm.role IN ('owner', 'admin')
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      -- Fallback to any member of the company (seed-time data may not
      -- have owner/admin distinction).
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      -- Last resort: any user_identity row (Supabase local seed data).
      SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1
    )
  )
FROM public.workspace w
ON CONFLICT (workspace_id, capability) DO NOTHING;

COMMENT ON TABLE public.capability_default_registry IS
  'Canonical list of capabilities that auto-seed engine_authority_config rows '
  'when a new workspace is created. See trigger workspace_seed_authority_defaults. '
  'Adding a capability here is sufficient — no function rewrite needed. '
  'Existing-workspace backfill is the responsibility of each capability''s own '
  'seed migration. `operations` added 2026-05-02 (ADR-0186).';
