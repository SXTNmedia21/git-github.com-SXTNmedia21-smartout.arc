-- ADR-0024 — Authority policy (C4 primer)
-- ADR-0099 — Unified authority gate (default-allow without config row)
-- ADR-0189 — Authority seed parity (CI gate prevents silent authority escape)
-- Learning L-0066 / L-0097 — `read_only` + `gate_action` default-allow combo is CVE-class
-- Learning L-0107 — Authority appearance ≠ authority presence
--
-- ============================================
-- 20260517100000_seed_roster_add_shift_authority.sql
-- Roster "Legg til vakt" capability seed — campaign/daily-operation,
-- Invariant #13 closure (Item 1).
--
-- Context: RosterTab empty-state was a text cross-link dead-end
-- (apps/web/src/components/day/tabs/RosterTab.tsx line 79-89 pre-fix).
-- Invariant #13 demands empty states are CTAs. Item 1 replaces the
-- dead-end with an in-place "Legg til vakt" dialog backed by
-- `apps/web/src/app/dashboard/_actions/add-shift-action.ts`, which
-- calls `gate_action()` with capability `roster.add_shift_manual`.
--
-- Without this seed, `gate_action()` default-allows (per migration
-- 20260505110000_unified_authority_gate.sql §4), so every admin-created
-- shift would pass an ungated gate — indistinguishable in
-- `activity_trail` from an explicit allow (L-0107).
--
-- Pattern mirrors 20260517090000_seed_observer_request_authority.sql
-- and 20260515130500_seed_session_authority.sql:
--   - workspace_id NOT NULL on engine_authority_config → one row per
--     existing workspace via cross join.
--   - ON CONFLICT (workspace_id, capability) DO NOTHING — idempotent.
--   - updated_by must be non-null; fall back to first godmode user.
--   - If no godmode user exists (fresh seed), RAISE NOTICE and exit
--     gracefully so re-run after first admin is created.
--
-- Policy:
--   level = 'confirm'           — manual shift creation is always a
--                                 deliberate admin action; no
--                                 autonomous path. Matches the level
--                                 floor for `shift.manual_time_entry`.
--   min_role = 'manager'        — managers own rostering day-to-day.
--                                 Admin can override per-workspace via
--                                 engine_authority_config UPDATE.
--                                 Explicitly NOT 'employee' — a
--                                 self-service shift-request flow
--                                 would be a separate capability.
--   requires_four_eyes = false  — shift creation is auditable through
--                                 `activity_trail` with manual=true +
--                                 reason; the RosterTab UI also
--                                 surfaces the newly-added shift
--                                 immediately. No need for
--                                 change_proposal dual-review.
--   observer_escalation_hours = 24 — default; no observer workflow
--                                    bound to this capability.
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
    RAISE NOTICE 'No godmode user found — skipping roster.add_shift_manual authority seed. Re-run after first admin is created.';
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
      ('roster.add_shift_manual', 'confirm', 'manager')
  ) AS cap(capability, level, min_role)
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union or domain-scoped literal like roster.add_shift_manual). Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; added session.open/session.transition/shift.manual_time_entry 2026-04-20; added reconciliation.override/submit/wizard_submit_with_blocker/wizard_save 2026-04-22 (ADR-0189); added observer_request.create/claim/approve 2026-04-22 (ADR-0189 Phase 0e gap closure); added roster.add_shift_manual 2026-04-23 (campaign/daily-operation Invariant #13, Item 1).';
