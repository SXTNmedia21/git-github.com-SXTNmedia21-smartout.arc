SET search_path TO public, extensions;

-- ============================================
-- 20260515110000_seed_day_control_authority.sql
-- WebDayControl capability seeds (ADR-0156 T3 follow-up)
--
-- Seeds engine_authority_config rows for the 3 capabilities introduced
-- by WebDayControl Server Actions:
--
--   - session.signoff  (manager+) — leder sends day to pending_signoff
--   - session.close    (admin)    — admin approves and closes the day
--   - broadcast.send   (manager+) — leder posts to the komm news channel
--
-- Pattern follows 20260417170000_billing_query_authority_seed.sql. Every
-- existing workspace gets one row per capability. New workspaces are
-- seeded by the workspace provisioning code (separate concern).
--
-- level = 'confirm' — these are user-initiated, human-confirmed mutations
-- via Server Actions. Not autonomous-agent territory.
-- min_role — enforces the role floor consumed by gate_action() via
-- _role_rank() comparator. Callers receiving downgrade_to='suggest'
-- treat it as denied in the Server Action context.
-- requires_four_eyes = false — single approver suffices today; four-eyes
-- extension is a follow-up for admin-scoped close if policy tightens.
-- observer_escalation_hours = 24 — column default; no observer workflow
-- bound to these capabilities yet.
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
    RAISE NOTICE 'No godmode user found — skipping WebDayControl authority seeds. Re-run after first admin is created.';
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
      ('session.signoff', 'confirm', 'manager'),
      ('session.close',   'confirm', 'admin'),
      ('broadcast.send',  'confirm', 'manager')
  ) AS cap(capability, level, min_role)
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15.';
