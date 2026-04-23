-- ADR-0024 — Authority policy (C4 primer)
-- ADR-0099 — Unified authority gate (default-allow without config row)
-- ADR-0189 — Authority seed parity (CI gate prevents silent authority escape)
-- ADR-0200 — Employee availability three-table model (campaign/daily-operation sortie 2)
-- ADR-0201 — gate_action mandatory on all availability capability tools
-- ADR-0202 — Voice policy split (set_own voice-OK, query_others chat-only)
-- Learning L-0066 / L-0097 — `read_only` + `gate_action` default-allow combo is CVE-class
-- Learning L-0107 — Authority appearance != authority presence
--
-- ============================================
-- 20260518200002_seed_availability_authority.sql
-- Employee availability capabilities — campaign/daily-operation sortie 2,
-- Task H closure.
--
-- Context: employee_availability and employee_availability_preference
-- tables land in 20260518200000 + 20260518200001 (Task G). This migration
-- seeds the three C4 authority rows the agent-side capability relies on:
--
--   availability.set_own       → autonomous / employee   (voice-OK)
--   availability.clear_own     → autonomous / employee   (voice-OK)
--   availability.query_others  → read_only  / employee   (chat-only)
--
-- Without this seed, gate_action() default-allows (per migration
-- 20260505110000_unified_authority_gate.sql §4), so a downgrade/reissue
-- of the capability could slip through undetected — indistinguishable in
-- activity_trail from an explicit allow (L-0107). "read_only" on
-- query_others is intentional: read at router-time, still gated at
-- execute-time (defence-in-depth).
--
-- Pattern mirrors 20260518000000_contract_authority_seed_upsert_and_bootstrap.sql
-- and 20260517100000_seed_roster_add_shift_authority.sql:
--   - workspace_id NOT NULL on engine_authority_config -> one row per
--     existing workspace via CROSS JOIN VALUES.
--   - ON CONFLICT (workspace_id, capability) DO NOTHING — idempotent.
--   - updated_by non-null; fall back to first godmode user.
--   - No godmode user -> RAISE NOTICE + early return, so re-run after
--     first admin is created seeds correctly.
--
-- Policy rationale:
--   set_own / clear_own = autonomous — own-availability is low-risk
--                                      self-service; the RRULE + reason
--                                      body is owner-authored. Manager
--                                      overrides happen via separate
--                                      capability (future).
--                 employee           — every employee can author their
--                                      own availability.
--   query_others = read_only         — view-only from the agent's
--                                      perspective; no mutation path.
--                                      Chat-only enforcement lives in
--                                      the tool's inline channel guard
--                                      and the CapabilityDefinition's
--                                      allowedChannels UNION.
--                 employee           — every employee can query the
--                                      workspace's roster view (needed
--                                      for self-scheduling & swap
--                                      conversations).
--   requires_four_eyes = false       — single-actor self-service flow;
--                                      no change_proposal dual-review.
--   observer_escalation_hours = 24   — default; no observer workflow.
--
-- Timestamp discipline (L-0042): This migration depends on Task G's
-- 20260518200000 + 20260518200001 and on engine_authority_config which
-- has existed since 20260302000100. Current repo tip is 20260518000000
-- (contract authority bootstrap). We pick 20260518200002 — strictly
-- greater than both Task G migrations and the previous tip.
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
    RAISE NOTICE 'No godmode user found — skipping availability authority seed. Re-run after first admin is created.';
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
      ('availability.set_own',       'autonomous', 'employee'),
      ('availability.clear_own',     'autonomous', 'employee'),
      ('availability.query_others',  'read_only',  'employee')
  ) AS cap(capability, level, min_role)
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union or domain-scoped literal like roster.add_shift_manual). Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; added session.open/session.transition/shift.manual_time_entry 2026-04-20; added reconciliation.override/submit/wizard_submit_with_blocker/wizard_save 2026-04-22 (ADR-0189); added observer_request.create/claim/approve 2026-04-22 (ADR-0189 Phase 0e gap closure); added roster.add_shift_manual 2026-04-23 (campaign/daily-operation Invariant #13, Item 1); added availability.set_own / availability.clear_own / availability.query_others 2026-04-23 (campaign/daily-operation sortie 2 Task H, ADR-0200/0201/0202).';
