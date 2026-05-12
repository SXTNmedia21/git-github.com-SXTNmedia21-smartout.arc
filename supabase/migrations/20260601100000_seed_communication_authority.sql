-- ============================================================================
-- 20260601000000_seed_communication_authority.sql
--
-- Seeds engine_authority_config for the `communication` capability on every
-- existing workspace.
--
-- WHY: Council 2026-05-11 found `communication` was explicitly listed in
-- migration 20260518000000_contract_authority_seed_upsert_and_bootstrap.sql
-- header as NOT seeded. Without this row, gate_action default-allows any
-- caller — L-0066 CVE class. This migration closes that gap and retroactively
-- hardens send_message + publish_announcement (all action_types under
-- `communication`).
--
-- CAPABILITY-LEVEL GRANULARITY: gate_action RPC keys on (workspace_id,
-- capability) only. action_type is recorded in activity_trail but does not
-- drive authority. One row covers send_message, publish_announcement, and
-- any future action_types under this capability namespace.
--
-- PATTERN: Mirrors 2b728a9c6 / 20260530000000_seed_memory_authority_all_workspaces.sql
-- (Wave A fix) — INSERT-SELECT FROM workspace WHERE NOT EXISTS so the
-- migration is a no-op when workspaces are absent (production + fresh
-- reset pre-seed). ON CONFLICT DO NOTHING for idempotent replay.
--
-- AUTHORITY VALUES (per spec §Sequencing prerequisites #3):
--   level             = 'suggest'   — Botsson proposes, manager/employee confirms
--   min_role          = 'employee'  — any authenticated workspace member may trigger
--   requires_four_eyes = false      — no dual-approval required at this tier
--
-- PRODUCTION PROMOTION: Review via admin UI before enabling in prod.
-- This seed is safe for dev: all local workspaces covered.
-- New workspaces are covered by the workspace_seed_authority_defaults_trg
-- AFTER INSERT trigger (20260518000000) once communication is added to
-- capability_default_registry (separate sortie — not in scope here).
--
-- Refs: Council 2026-05-11, ADR-0099 (gate_action first), L-0066 (CVE class)
-- ============================================================================

INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes)
SELECT
  w.workspace_id,
  'communication',
  'suggest',
  'employee',
  false
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1
    FROM public.engine_authority_config eac
   WHERE eac.workspace_id = w.workspace_id
     AND eac.capability   = 'communication'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- Verification (manual):
--   SELECT w.name, eac.level, eac.min_role
--     FROM workspace w
--     JOIN engine_authority_config eac
--       ON eac.workspace_id = w.workspace_id
--    WHERE eac.capability = 'communication'
--    ORDER BY w.name;
-- Expected: one row per workspace with level='suggest', min_role='employee'.
