-- ADR-0156 — Day-control widgets must not own Supabase access
-- ADR-0114 — Server Actions as canonical mutation primitive
-- ADR-0099 — Unified authority gate (default-allow without config row)
-- ADR-0189 — Authority seed parity (CI gate prevents silent authority escape)
-- ADR-0204 — Gated mutation backlog
--
-- ============================================
-- 20260610100000_seed_day_control_action_authority.sql
--
-- Sortie: feat/audit-fsc04-day-control-server-actions
-- Closes: F-SC-04-15 + F-SC-04-13 (audit 2026-05-13)
--
-- Context: Two new Server Actions land in this sortie to lift direct DB
-- writes out of day-control widgets:
--   1. updateDeviationAction (resolve + acknowledge paths) — lifts the
--      `deviation.update` calls in EventDetailPanel.tsx:299,319.
--   2. updateDepartmentSessionDutyLeaderAction — lifts the inline
--      `department_session.update({ duty_leader_id })` in OversiktTab.tsx:257.
--
-- Both actions call gate_action() with new capability literals. Per
-- ADR-0189, gate_action() default-allows when no engine_authority_config
-- row exists for (workspace, capability), so any un-seeded literal is a
-- silent authority escape. This migration seeds the three new capabilities
-- for every existing workspace.
--
-- Policy:
--   hms.acknowledge_deviation
--     level = 'confirm'    — same audit-floor as report_deviation_manual.
--     min_role = 'employee' — staff can acknowledge a deviation they own.
--   hms.resolve_deviation
--     level = 'confirm'    — resolution closes the deviation; audit-sensitive.
--     min_role = 'manager' — only managers (and admin/owner via inheritance)
--                            should be allowed to close a deviation.
--   session.update_duty_leader
--     level = 'confirm'    — explicit operational ownership reassignment.
--     min_role = 'manager' — only managers reassign duty leader for a day.
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
    RAISE NOTICE 'No godmode user found — skipping day-control action authority seed. Re-run after first admin is created.';
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
      ('hms.acknowledge_deviation', 'confirm', 'employee'),
      ('hms.resolve_deviation', 'confirm', 'manager'),
      ('session.update_duty_leader', 'confirm', 'manager')
  ) AS cap(capability, level, min_role)
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union or domain-scoped literal like roster.add_shift_manual). Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; added session.open/session.transition/shift.manual_time_entry 2026-04-20; added reconciliation.override/submit/wizard_submit_with_blocker/wizard_save 2026-04-22 (ADR-0189); added roster.add_shift_manual 2026-04-23 (campaign/daily-operation Invariant #13, Item 1); added hms.report_deviation_manual 2026-05-25 (sortie mobile-addsheet-server-action-migration); added schedule.add_day_info_manual 2026-05-25 (mobile-addsheet-server-action-migration); added hms.acknowledge_deviation / hms.resolve_deviation / session.update_duty_leader 2026-06-10 (sortie audit-fsc04-day-control-server-actions, closes F-SC-04-15 + F-SC-04-13).';
