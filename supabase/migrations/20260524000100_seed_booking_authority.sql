-- ADR-0099 — Unified authority gate (default-allow without config row)
-- ADR-0114 — Server Actions as canonical mutation primitive
-- ADR-0267 — Booking-PII access control (min_role gate for contact field)
-- Learning L-0107 — Authority appearance ≠ authority presence
--
-- ============================================
-- 20260524000100_seed_booking_authority.sql
-- BookingAdd "Legg til booking" capability seed — feat/mobile-addsheet-booking-stack.
--
-- Context: schedule_day_booking table existed (migration 20260301600003)
-- but had zero authority seed. Without this row, gate_action() default-
-- allows (migration 20260505110000_unified_authority_gate.sql §4), so
-- every booking insert would pass an ungated gate — indistinguishable
-- from an explicit allow in activity_trail (L-0107).
--
-- Mirrors shape of 20260517100000_seed_roster_add_shift_authority.sql:
--   - workspace_id NOT NULL → one row per existing workspace via cross join.
--   - ON CONFLICT (workspace_id, capability) DO NOTHING — idempotent.
--   - updated_by must be non-null; fall back to first godmode user.
--   - If no godmode user exists (fresh seed), RAISE NOTICE and exit
--     gracefully so re-run after first admin is created.
--
-- ADR-0267: contact_person is PII. min_role='manager' means employees
-- cannot trigger the booking-create path even if the mobile BFF were
-- misconfigured. The gate is the second layer after the channel guard
-- (ADR-0078 + ADR-0267) in add-booking-action.ts.
--
-- Policy:
--   level = 'confirm'           — booking creation is a deliberate manager
--                                 action. No autonomous path for this
--                                 capability. Matches the level floor for
--                                 roster.add_shift_manual (ADR-0099 §4).
--   min_role = 'manager'        — managers own day operations; employees
--                                 cannot create bookings via this path.
--                                 A guest-self-service flow would be a
--                                 separate capability with its own seed.
--   requires_four_eyes = false  — booking creation is auditable via
--                                 activity_trail (all four emit() destinations).
--   observer_escalation_hours = 24 — default; no observer workflow bound
--                                    to this capability.
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
    RAISE NOTICE 'No godmode user found — skipping schedule.add_booking_manual authority seed. Re-run after first admin is created.';
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
      ('schedule.add_booking_manual', 'confirm', 'manager')
  ) AS cap(capability, level, min_role)
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union or domain-scoped literal). Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; added session.open/session.transition/shift.manual_time_entry 2026-04-20; added reconciliation.override/submit/wizard_submit_with_blocker/wizard_save 2026-04-22 (ADR-0189); added observer_request.create/claim/approve 2026-04-22 (ADR-0189 Phase 0e gap closure); added roster.add_shift_manual 2026-04-23 (campaign/daily-operation Invariant #13, Item 1); added schedule.add_booking_manual 2026-05-24 (feat/mobile-addsheet-booking-stack, ADR-0267 PII gate).';
