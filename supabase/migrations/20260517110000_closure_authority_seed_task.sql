-- ADR-0099 — Unified authority gate (default-allow without config row)
-- ADR-0189 — Authority seed parity (CI gate prevents silent authority escape)
-- Learning L-0107 — Authority appearance ≠ authority presence
--
-- ============================================
-- 20260517110000_closure_authority_seed_task.sql
-- Campaign/daily-operation closure — Item 2 (TasksTab "Legg til oppgave").
--
-- Seeds the `task.add_task_manual` capability for every existing workspace
-- so that `gate_action('task.add_task_manual')` called from
-- apps/web/src/app/dashboard/_actions/add-task-action.ts:66 has an explicit
-- floor (level='suggest', min_role='manager') instead of the default-allow
-- fallback that would otherwise grant ungated access to every admin-session
-- caller since the feature shipped (L-0107 parity trap).
--
-- Capability details:
--   capability  = 'task.add_task_manual'
--   level       = 'suggest'  (per plan §Authority: mirrors authority for
--                 admin-initiated session_task creation from the web
--                 Oppgaver tab — no four-eyes, no observer escalation)
--   min_role    = 'manager'  (shop-floor employees do not add ad-hoc
--                 tasks on behalf of others; managers + admins only)
--   requires_four_eyes = false
--   observer_escalation_hours = 24  (default; no direct observer workflow)
--
-- Separated from Item 1 (roster.add_shift_manual) + Item 4
-- (signoff.admin_override) per the plan "Combined migration" caveat to
-- keep each sub-sortie's commit independent and avoid merge conflicts on
-- a single shared migration file. The `authority-seed-parity` CI gate
-- accepts either layout — one seed-per-capability migration OR one
-- combined — as long as every engine_authority_config capability that
-- the code path calls has ≥1 row in a seed migration.
--
-- Pattern mirrors 20260517090000_seed_observer_request_authority.sql.
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
    RAISE NOTICE 'No godmode user found — skipping task.add_task_manual authority seed. Re-run after first admin is created.';
    RETURN;
  END IF;

  -- CROSS JOIN VALUES (…) shape matches 20260517090000_seed_observer_request_authority.sql
  -- and is also required by the authority-seed-parity CI scanner
  -- (scripts/authority-seed-parity.ts:403-413) which only matches capability
  -- literals inside VALUES tuples — SELECT-list literals are invisible to it.
  INSERT INTO public.engine_authority_config (
    workspace_id, capability, level, min_role,
    requires_four_eyes, observer_escalation_hours, updated_by
  )
  SELECT w.workspace_id, cap.capability, cap.level, cap.min_role,
         false, 24, v_updated_by
  FROM public.workspace w
  CROSS JOIN (
    VALUES
      ('task.add_task_manual', 'suggest', 'manager')
  ) AS cap(capability, level, min_role)
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; added session.open/session.transition/shift.manual_time_entry 2026-04-20; added reconciliation.override/submit/wizard_submit_with_blocker/wizard_save 2026-04-22 (ADR-0189); added observer_request.create/claim/approve 2026-04-22 (ADR-0189 Phase 0e gap closure); added task.add_task_manual 2026-04-23 (campaign/daily-operation closure Item 2).';
