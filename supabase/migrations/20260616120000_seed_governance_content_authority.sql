-- ADR-NEXT — Governance content authority backlog closure
-- (ADR number to be filled at sortie close — see docs/plans/scope-fix-authority-seed-parity.md)
--
-- ============================================
-- 20260616120000_seed_governance_content_authority.sql
-- Governance content capability seeds (feat/fix-authority-seed-parity).
--
-- Closes the auth-seed-parity gate failure identified by the 2026-05-16
-- authority-seed-parity.ts script run. Three capabilities were flagged
-- as missing engine_authority_config rows:
--
--   handbook_chapter, policy, protocol
--
-- T0 scope verification (docs/plans/scope-fix-authority-seed-parity.md)
-- confirmed these three are truly missing (not parser false-positives).
-- The six other flagged capabilities (contract, memory, payroll,
-- helpdesk_query, organization.update_department, task) ARE seeded;
-- they were false-positives caused by a DOTTED_RE parser filter bug
-- in the parity script itself (fixed in this same sortie via
-- SINGLE_WORD_ALLOWLIST extension).
--
-- Capabilities seeded:
--
--   - handbook_chapter  (confirm, manager) — Server-Action update of
--     organizational handbook chapters. Manager floor because
--     /dashboard/governance is manager+ gated at layout level.
--     Governance content authoring must require explicit confirmation
--     to prevent accidental overwrite of authoritative policy text.
--
--   - policy            (confirm, manager) — Server-Action update of
--     policy records (HR, HACCP, safety, etc). Same role floor as
--     handbook_chapter; policies carry compliance weight and are
--     consumed by training + audit surfaces.
--
--   - protocol          (confirm, manager) — Server-Action update of
--     protocol records (training procedures, compliance runbooks).
--     Manager floor mirrors policy; protocols are operational
--     instructions consumed daily by employees.
--
-- Pattern mirrors 20260516100000_seed_reconciliation_authority.sql:
--   - workspace_id NOT NULL on engine_authority_config → one row per
--     existing workspace via cross join.
--   - ON CONFLICT (workspace_id, capability) DO NOTHING — idempotent.
--   - updated_by must be non-null; fall back to first godmode user.
--   - If no godmode user exists (fresh seed), emit RAISE NOTICE and
--     exit gracefully — re-run after first admin is created.
--
-- Policy:
--   level = 'confirm'           — mutations require human confirmation.
--   min_role = 'manager'        — governance content is manager-gated.
--   requires_four_eyes = false  — single approver suffices.
--   observer_escalation_hours = 24 — default; no observer workflow bound.
-- ============================================

SET search_path TO public, extensions;

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
    RAISE NOTICE 'No godmode user found — skipping governance content authority seeds. Re-run after first admin is created.';
    RETURN;
  END IF;

  INSERT INTO public.engine_authority_config (
    workspace_id, capability, level, min_role,
    requires_four_eyes, observer_escalation_hours, updated_by
  )
  SELECT w.workspace_id, cap.capability, cap.level, cap.min_role,
         false, 24, v_updated_by
  FROM public.workspace w
  CROSS JOIN (
    VALUES
      ('handbook_chapter', 'confirm', 'manager'),
      ('policy',           'confirm', 'manager'),
      ('protocol',         'confirm', 'manager')
  ) AS cap(capability, level, min_role)
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;
