-- ADR-0114 — Server Actions as canonical mutation primitive
-- ADR-0099 — Unified authority gate (default-allow without config row)
-- ADR-0189 — Authority seed parity (CI gate prevents silent authority escape)
-- Learning L-0066 / L-0107 — default-allow without seed is CVE-class.
--
-- ============================================
-- 20260525100100_seed_day_info_authority.sql
-- Schedule day-info creation capability seed — sortie
-- feat/mobile-addsheet-server-action-migration.
--
-- Context: `useCreateDayInfo` called
--   supabase.from("schedule_day_info").insert() directly from the browser
--   without any authority gate. Moving to createDayInfoAction (Server
--   Action) closes the gap, but the action calls gate_action() with
--   `schedule.add_day_info_manual` — without a seed row, default-allow
--   would fire silently (L-0107).
--
-- Policy:
--   level = 'confirm'     — day-info creation is a deliberate scheduling
--                           action. Matches the level floor for
--                           schedule-domain mutations.
--   min_role = 'manager'  — day-level notes and events are manager+
--                           authoring (schedule web surface is manager-
--                           owned per ADR-0133). Employees read; managers
--                           and admins write.
--   requires_four_eyes = false — single manager action; auditable via
--                                activity_trail + engine_event emit().
--   observer_escalation_hours = 24 — default.
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
    RAISE NOTICE 'No godmode user found — skipping schedule.add_day_info_manual authority seed. Re-run after first admin is created.';
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
      ('schedule.add_day_info_manual', 'confirm', 'manager')
  ) AS cap(capability, level, min_role)
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union or domain-scoped literal like roster.add_shift_manual). Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; added session.open/session.transition/shift.manual_time_entry 2026-04-20; added reconciliation.override/submit/wizard_submit_with_blocker/wizard_save 2026-04-22 (ADR-0189); added roster.add_shift_manual 2026-04-23 (campaign/daily-operation Invariant #13, Item 1); added hms.report_deviation_manual 2026-05-25 (mobile-addsheet-server-action-migration); added schedule.add_day_info_manual 2026-05-25 (mobile-addsheet-server-action-migration).';
