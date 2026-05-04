-- ADR-0189 — Authority seed parity (atomic seed closing reconciliation.override CVE)
-- Council 2 verdict 2026-04-22
-- Related: ADR-NEXT-02 prep — reconciliation.submit/wizard_submit_with_blocker/wizard_save
--
-- ============================================
-- 20260516100000_seed_reconciliation_authority.sql
-- Reconciliation capability seeds (Phase 0b, campaign/daily-operation).
--
-- Closes a CVE-class authority gap: the `reconciliation.override`
-- capability has been called in production via gateAction() at
-- apps/web/src/app/dashboard/reconciliation/_actions/override-reconciliation-action.ts:68
-- without a corresponding engine_authority_config row. Because
-- gate_action() default-allows when no config exists, every admin
-- override since the feature shipped has passed an ungated gate.
--
-- Also seeds the three capabilities that the M2 recon-wizard-mobile
-- sub-sortie will introduce (per ADR-NEXT-02), so the gate rows are
-- in place BEFORE any new gateAction call sites ship (ADR-0189
-- "seed at introduction" principle).
--
-- Capabilities seeded:
--
--   - reconciliation.override                  (admin)   — overrides a
--     submitted recon that would otherwise block close (CVE closure).
--   - reconciliation.submit                    (manager) — daily recon
--     submission; manager floor enforced server-side.
--   - reconciliation.wizard_submit_with_blocker (admin)  — admin-override
--     path through clockout-wizard preflight blockers (Invariant #9).
--   - reconciliation.wizard_save               (employee, autonomous) —
--     per-step draft save inside the wizard; low-risk, no approval.
--
-- Pattern mirrors 20260515130500_seed_session_authority.sql:
--   - workspace_id NOT NULL on engine_authority_config → one row per
--     existing workspace via cross join.
--   - ON CONFLICT (workspace_id, capability) DO NOTHING — idempotent.
--   - updated_by must be non-null; fall back to first godmode user.
--   - If no godmode user exists (fresh seed), emit RAISE NOTICE and
--     exit gracefully — re-run this migration after first admin exists.
--
-- Policy:
--   level = 'confirm'           — mutations require human confirmation.
--   level = 'autonomous'        — for wizard_save only (per-step draft).
--   min_role                    — enforces the role floor consumed by
--                                 gate_action() via _role_rank().
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
    RAISE NOTICE 'No godmode user found — skipping reconciliation authority seeds. Re-run after first admin is created.';
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
      ('reconciliation.override',                    'confirm',    'admin'),
      ('reconciliation.submit',                      'confirm',    'manager'),
      ('reconciliation.wizard_submit_with_blocker',  'confirm',    'admin'),
      ('reconciliation.wizard_save',                 'autonomous', 'employee')
  ) AS cap(capability, level, min_role)
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; added session.open/session.transition/shift.manual_time_entry 2026-04-20; added reconciliation.override/submit/wizard_submit_with_blocker/wizard_save 2026-04-22 (ADR-0189).';
