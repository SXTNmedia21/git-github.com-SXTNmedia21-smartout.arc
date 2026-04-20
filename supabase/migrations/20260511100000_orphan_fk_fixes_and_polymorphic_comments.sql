-- Migration: narrowed orphan FK fix + polymorphic documentation per ADR-0124 (amended)
-- Council 2026-04-17 (third session) post-audit remediation PR1 — NARROWED SCOPE
--
-- Scope narrowed from the original plan after fact-check caught systematic
-- column→table mapping errors in the audit:
--
--   DROPPED (wrong tables in original plan):
--     - workspace.active_contract_id FK (plan said profile.active_contract_id —
--       column is on public.workspace, not public.profile; FK target is
--       semantically ambiguous between public.contract and public.employment_contract;
--       queued for dedicated audit; ADR-0124 amended to remove this claim).
--     - FK on employee_payroll_profile.seeded_from_framework_binding_id (plan said
--       that column existed on employee_payroll_profile; it is actually on
--       public.tariff_rate_table — see migration 20260422400000:150-152).
--
--   KEPT (verified correct):
--     - tariff_rate_table.seeded_from_framework_binding_id → workspace_framework_binding(id)
--       (unambiguous provenance reference; workspace_framework_binding has UUID PK `id`
--       per migration 20260421200100:135-136).
--     - COMMENT ON protocol_assignment.assigned_ref_id (polymorphic, no existing COMMENT).
--     - COMMENT ON chat_conversation.source_id (polymorphic, upgrades existing COMMENT
--       from migration 20260418100300:41 to cite ADR-0124).
--
-- Timestamp floor: tariff_rate_table.seeded_from_framework_binding_id is added by
-- 20260422400000_cascade_b_schema.sql:150; HEAD at time of writing was
-- 20260510200000_split_shift_lifecycle_view_by_role.sql. 20260511100000 is safely past.
-- See L-0042 for the migration-ordering rule.

BEGIN;

-- =========================================================================
-- 1. FK on tariff_rate_table.seeded_from_framework_binding_id (provenance)
-- =========================================================================
-- No existing FK per pg_constraint check; no expected orphans in dev seed data
-- (column added 20260422400000 with no backfill; only populated when tariffs
-- are seeded from a workspace_framework_binding). Defensive NULL backfill in
-- case production has orphans.

UPDATE public.tariff_rate_table t
SET seeded_from_framework_binding_id = NULL
WHERE t.seeded_from_framework_binding_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.workspace_framework_binding wfb
    WHERE wfb.id = t.seeded_from_framework_binding_id
  );

ALTER TABLE public.tariff_rate_table
  ADD CONSTRAINT tariff_rate_table_seeded_from_framework_binding_id_fkey
  FOREIGN KEY (seeded_from_framework_binding_id)
  REFERENCES public.workspace_framework_binding(id)
  ON DELETE SET NULL;

-- =========================================================================
-- 2. Polymorphic documentation per ADR-0124 (amended)
-- =========================================================================

COMMENT ON COLUMN public.protocol_assignment.assigned_ref_id IS
  'Polymorphic reference. No FK by design. '
  'Dispatch via assigned_via enum (policy/department/team). '
  'See ADR-0124.';

-- Existing COMMENT from 20260418100300:41 already documents polymorphic intent.
-- Upgrade to cite ADR-0124 as the canonical convention.
COMMENT ON COLUMN public.chat_conversation.source_id IS
  'Polymorphic reference. No FK by design. '
  'Dispatch via source_type: department_id, team_id, or department_session_id. '
  'See ADR-0124.';

COMMIT;
