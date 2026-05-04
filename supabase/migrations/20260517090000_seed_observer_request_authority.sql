-- ADR-0099 — Unified authority gate (default-allow without config row)
-- ADR-0189 — Authority seed parity (CI gate prevents silent authority escape)
-- Learning L-0107 — Authority appearance ≠ authority presence
--
-- ============================================
-- 20260517090000_seed_observer_request_authority.sql
-- Observer-request capability seeds (Phase 0e gap closure, campaign/daily-operation).
--
-- Closes the last three CVE-class authority gaps flagged by the
-- scripts/authority-seed-parity.ts gate on 2026-04-22:
--
--   - observer_request.create
--     apps/web/src/app/api/observer-requests/route.ts:93
--   - observer_request.claim
--     apps/web/src/app/api/observer-requests/[id]/route.ts:107
--   - observer_request.approve
--     apps/web/src/app/api/observer-requests/[id]/route.ts:107
--
-- All three call sites invoke `supabase.rpc("gate_action", ...)` (the
-- ADR-0099 unified authority gate) without a matching
-- engine_authority_config row. gate_action() default-allows when no
-- config exists (migration 20260505110000_unified_authority_gate.sql §4),
-- so every observer-request create/claim/approve since the feature
-- shipped has passed an ungated gate — indistinguishable in the
-- activity trail from an explicit allow (L-0107).
--
-- The seven colon-delimited capabilities also flagged in the Phase 0b
-- scan (profile:update:role/department/status/bulk, profile:delete,
-- season:create, season:update) are NOT gate-routed via ADR-0099.
-- They invoke `gatedInsert`/`gatedUpdate` from
-- packages/supabase/src/gate-client.ts which uses `cascade_gate_write`
-- (ADR-0091 cascade governance gate) — a separate pathway that does
-- not read engine_authority_config. No seed required for those.
--
-- Pattern mirrors 20260516100000_seed_reconciliation_authority.sql:
--   - workspace_id NOT NULL on engine_authority_config → one row per
--     existing workspace via cross join.
--   - ON CONFLICT (workspace_id, capability) DO NOTHING — idempotent.
--   - updated_by must be non-null; fall back to first godmode user.
--   - If no godmode user exists (fresh seed), emit RAISE NOTICE and
--     exit gracefully — re-run this migration after first admin exists.
--
-- Policy:
--   level = 'confirm'           — observer-request mutations always
--                                 require human confirmation server-side.
--   min_role                    — enforces the role floor consumed by
--                                 gate_action() via _role_rank().
--                                 'manager' for all three: the create
--                                 endpoint does not self-guard on
--                                 subject_profile_id = caller, so an
--                                 employee could request observation
--                                 on any colleague; manager-floor
--                                 scopes this to training-oversight
--                                 staff. Can be relaxed per-workspace
--                                 later via engine_authority_config
--                                 UPDATE.
--   requires_four_eyes = false  — per-protocol four-eyes is enforced
--                                 in code by matching
--                                 `evidence_tier = 'four_eyes'` on the
--                                 protocol row (see observer-requests/
--                                 [id]/route.ts:124-129). Setting it
--                                 true on the authority config would
--                                 gate ALL approves through
--                                 change_proposal regardless of
--                                 evidence tier, which is not the
--                                 intended product behaviour.
--   observer_escalation_hours = 24 — default; no observer workflow
--                                    bound directly to this capability
--                                    (observer_request IS the workflow
--                                    entity itself).
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
    RAISE NOTICE 'No godmode user found — skipping observer_request authority seeds. Re-run after first admin is created.';
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
      ('observer_request.create',   'confirm', 'manager'),
      ('observer_request.claim',    'confirm', 'manager'),
      ('observer_request.approve',  'confirm', 'manager')
  ) AS cap(capability, level, min_role)
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; added session.open/session.transition/shift.manual_time_entry 2026-04-20; added reconciliation.override/submit/wizard_submit_with_blocker/wizard_save 2026-04-22 (ADR-0189); added observer_request.create/claim/approve 2026-04-22 (ADR-0189 Phase 0e gap closure).';
