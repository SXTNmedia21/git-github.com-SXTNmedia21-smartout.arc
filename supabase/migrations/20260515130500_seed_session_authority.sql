SET search_path TO public, extensions;

-- ============================================
-- 20260420221500_seed_session_authority.sql
-- Session lifecycle capability seeds (sub-sortie: session-lifecycle).
--
-- Seeds engine_authority_config rows for the 3 capabilities introduced
-- by Task 2 / Task 3 / Task 10 of the session-lifecycle plan:
--
--   - session.open              (manager+) — manual session creation
--                                            (openSessionAction)
--   - session.transition        (manager+) — non-closure lifecycle hops
--                                            (transitionSessionAction)
--   - shift.manual_time_entry   (admin)    — retroactive clock-in/out
--                                            (manualTimeEntryAction)
--
-- Pattern follows 20260515110000_seed_day_control_authority.sql and
-- 20260417170000_billing_query_authority_seed.sql:
--   - workspace_id NOT NULL on engine_authority_config → one row per
--     existing workspace via cross join.
--   - ON CONFLICT (workspace_id, capability) DO NOTHING — idempotent.
--   - updated_by must be non-null; fall back to first godmode user.
--   - If no godmode user exists (fresh seed), emit RAISE NOTICE and
--     exit gracefully — re-run this migration after first admin exists.
--
-- Policy:
--   level = 'confirm'           — mutations require human confirmation.
--                                 Server Actions treat downgrade_to='suggest'
--                                 as denied (no suggest mode server-side).
--   min_role                    — enforces the role floor consumed by
--                                 gate_action() via _role_rank().
--   requires_four_eyes = false  — single approver suffices.
--   observer_escalation_hours = 24 — default; no observer workflow bound.
--
-- Note re plan text: the plan's sketched SQL used columns that do not
-- exist on engine_authority_config (allowed_channels, capability_key,
-- workspace_id=NULL). The canonical column is `capability`; unique is
-- (workspace_id, capability); workspace_id is NOT NULL. This file
-- matches the current schema.
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
    RAISE NOTICE 'No godmode user found — skipping session-lifecycle authority seeds. Re-run after first admin is created.';
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
      ('session.open',             'confirm', 'manager'),
      ('session.transition',       'confirm', 'manager'),
      ('shift.manual_time_entry',  'confirm', 'admin')
  ) AS cap(capability, level, min_role)
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; added session.open/session.transition/shift.manual_time_entry 2026-04-20.';
