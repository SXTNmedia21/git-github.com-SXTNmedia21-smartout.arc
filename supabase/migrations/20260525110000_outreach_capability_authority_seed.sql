-- ADR-0099 — Unified authority gate (default-allow without config row)
-- ADR-0282 — Outreach capability (outbound voice + SMS)
-- ADR-0078 — Channel restriction (PII redirect on voice for personnummer/bank)
-- ADR-0151 — Server-derived recipient (phone never caller-supplied)
-- ADR-0192 — capability_default_registry + bootstrap trigger pattern
-- Learning L-0066 — gate_action default-allow CVE class
-- Learning L-0107 — Authority appearance ≠ authority presence
--
-- ============================================
-- 20260525110000_outreach_capability_authority_seed.sql
-- `outreach` capability authority seed — ADR-0282
--
-- Context: outreach capability ships SMS (Twilio REST) and voice
-- (LiveKit SIP → Twilio trunk). Without this seed, every workspace has
-- no row for capability='outreach' in engine_authority_config →
-- gate_action() default-allows all outreach invocations. Wrong-employee
-- SMS at 02:00 = unacceptable. Mirror shape of
-- 20260524000100_seed_booking_authority.sql.
--
-- TWO-PART SEED (mirrors ADR-0192 pattern)
-- ----------------------------------------
-- Part A: INSERT into capability_default_registry — one platform-wide
--         row consumed by workspace_seed_authority_defaults_trg on every
--         new workspace INSERT (covers fresh workspaces created AFTER
--         this migration runs).
-- Part B: Backfill INSERT into engine_authority_config for every
--         existing workspace via DO $$ + godmode-user lookup. If no
--         godmode user exists (fresh dev env), RAISE NOTICE and exit
--         gracefully so re-run after first admin is created.
--
-- AUTHORITY POLICY
-- ----------------
--   level = 'suggest'      Phase 1: admin/manager triggers outreach via
--                          Botsson; tools visible in suggestTools tier.
--   min_role = 'manager'   Outbound contact to employees is manager+ only.
--                          Phase 1 admin-only triggering enforced socially;
--                          Phase 2 may tighten to 'admin' if abuse surfaces.
--   requires_four_eyes = false
--                          Phase 1: single-person trigger. Phase 2 may add
--                          four-eyes for bulk outreach (>10 recipients).
--   observer_escalation_hours = 24
--                          Operational, not high-sensitivity. Same window
--                          as schedule mutations.
--
-- IDEMPOTENT
-- ----------
-- ON CONFLICT (capability) DO NOTHING            → capability_default_registry
-- ON CONFLICT (workspace_id, capability) DO NOTHING → engine_authority_config
-- Safe under `db reset` + replay.
-- ============================================

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────
-- Part A — capability_default_registry: platform-wide default for outreach
-- (consumed by trigger on new workspace INSERT going forward)
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'outreach',
    'suggest',
    'manager',
    false,
    24,
    'Outbound voice + SMS to employees (ADR-0282). send_sms (Twilio REST), '
    'call_employee (LiveKit SIP -> Twilio trunk). Manager+ only Phase 1; '
    'four-eyes may activate Phase 2 for bulk outreach. Channels: chat, voice. '
    'Phone resolved server-side from user_identity (forgery-class same as ADR-0151).'
  )
ON CONFLICT (capability) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- Part B — engine_authority_config backfill for existing workspaces
-- (booking-seed safety pattern: godmode user + RAISE NOTICE + RETURN)
-- ─────────────────────────────────────────────────────────────────────

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
    RAISE NOTICE 'No godmode user found — skipping outreach authority seed. Re-run after first admin is created.';
    RETURN;
  END IF;

  INSERT INTO public.engine_authority_config (
    workspace_id, capability, level, min_role,
    requires_four_eyes, observer_escalation_hours, updated_by
  )
  SELECT w.workspace_id, 'outreach', 'suggest', 'manager',
         false, 24, v_updated_by
  FROM public.workspace w
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union or domain-scoped literal). Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; added session.open/session.transition/shift.manual_time_entry 2026-04-20; added reconciliation.override/submit/wizard_submit_with_blocker/wizard_save 2026-04-22 (ADR-0189); added observer_request.create/claim/approve 2026-04-22 (ADR-0189 Phase 0e gap closure); added roster.add_shift_manual 2026-04-23 (campaign/daily-operation Invariant #13, Item 1); added schedule.add_booking_manual 2026-05-24 (feat/mobile-addsheet-booking-stack, ADR-0267 PII gate); added outreach 2026-05-25 (ADR-0282, send_sms + call_employee).';
