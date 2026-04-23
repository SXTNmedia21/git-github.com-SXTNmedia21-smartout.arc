-- ADR-0024 — Authority policy (C4 primer)
-- ADR-0099 — Unified authority gate (default-allow without config row)
-- ADR-0189 — Authority seed parity (CI gate prevents silent authority escape)
-- ADR-0201 — gate_action mandatory on all capability tools (2026-04-23 Hospitality Council)
-- Learning L-0066 / L-0097 — `read_only` + `gate_action` default-allow combo is CVE-class
-- Learning L-0107 — Authority appearance ≠ authority presence
-- Learning L-0129 — Capability seeds missing at feature-ship time (recurring)
--
-- ============================================
-- 20260518100000_seed_shift_swap_authority.sql
-- Campaign/schedule-harness — Sortie 1 (shift-swap-harness), Task A.
--
-- Context: 2026-04-23 Hospitality Council Trust Gate FAILED for the
-- shift_swap capability surface. Zero rows existed in
-- engine_authority_config for any shift_swap.* capability despite the
-- feature being live via `initiate_shift_swap` / `respond_to_shift_swap`
-- / `cancel_shift_swap` RPCs and the capability tools in
-- `packages/ai/src/capabilities/shift-swap/tools.ts`. A prior migration
-- (20260518000000_contract_authority_seed_upsert_and_bootstrap.sql:237)
-- mentioned shift_swap only in a comment — no row was ever inserted.
--
-- Without this seed, `gate_action('shift_swap.request' | 'shift_swap.respond'
-- | 'shift_swap.cancel')` default-allows (per migration
-- 20260505110000_unified_authority_gate.sql §4), granting ungated access
-- to every caller since the feature shipped. That is indistinguishable
-- in `activity_trail` from an explicit allow (L-0107).
--
-- Capabilities seeded (three, matching Task B gate_action call sites):
--
--   shift_swap.request  — level='suggest', min_role='employee'
--     Employees initiate swap offers against another employee's shift.
--     `suggest` keeps the author in the loop on gate outcome without
--     four-eyes — swaps are non-destructive (pending until responded).
--
--   shift_swap.respond  — level='suggest', min_role='employee'
--     Target employee accepts or declines a request. Same authority
--     shape as `.request`: author-in-the-loop, no four-eyes; the act of
--     responding is itself the authorization.
--
--   shift_swap.cancel   — level='confirm', min_role='employee'
--     Initiator cancels their pending request. Higher level than
--     request/respond because cancellation is destructive (breaks a
--     committed offer); `confirm` forces explicit UI acknowledgement.
--     The RPC enforces "own only" ownership; min_role stays `employee`
--     because any employee can cancel their own request.
--
-- All three: requires_four_eyes=false (swap workflow is auditable via
-- activity_trail + the swap_status state machine itself);
-- observer_escalation_hours=24 (default; no observer workflow bound).
--
-- Pattern mirrors 20260517110000_closure_authority_seed_task.sql and
-- 20260517090000_seed_observer_request_authority.sql — CROSS JOIN VALUES
-- is the shape required by the authority-seed-parity CI scanner
-- (scripts/authority-seed-parity.ts:363-413), which only matches
-- capability literals inside VALUES tuples. SELECT-list literals are
-- invisible to it.
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
    RAISE NOTICE 'No godmode user found — skipping shift_swap.* authority seed. Re-run after first admin is created.';
    RETURN;
  END IF;

  -- CROSS JOIN VALUES (…) shape matches 20260517110000_closure_authority_seed_task.sql
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
      ('shift_swap.request',  'suggest', 'employee'),
      ('shift_swap.respond',  'suggest', 'employee'),
      ('shift_swap.cancel',   'confirm', 'employee')
  ) AS cap(capability, level, min_role)
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union or domain-scoped literal like shift_swap.request). Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; added session.open/session.transition/shift.manual_time_entry 2026-04-20; added reconciliation.override/submit/wizard_submit_with_blocker/wizard_save 2026-04-22 (ADR-0189); added observer_request.create/claim/approve 2026-04-22 (ADR-0189 Phase 0e gap closure); added roster.add_shift_manual 2026-04-23 (campaign/daily-operation Invariant #13, Item 1); added task.add_task_manual 2026-04-23 (campaign/daily-operation closure Item 2); added shift_swap.request/respond/cancel 2026-04-23 (campaign/schedule-harness Sortie 1, Trust Gate fix per ADR-0201).';
