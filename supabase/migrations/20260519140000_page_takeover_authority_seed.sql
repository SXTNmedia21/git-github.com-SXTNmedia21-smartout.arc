-- M3.2 — page_takeover.help.panic_bar_human_button capability authority seed
-- Per ADR-0228: granular per-target capability, default-deny.
-- Admin must explicitly UPDATE level='disabled' -> 'read_write' to enable.
-- v1 only target: panic-bar "Jeg trenger et menneske" button on /dashboard/help.
-- Future targets: each adds its own seed migration.
--
-- Spec: docs/superpowers/specs/2026-04-29-page-takeover-harness.md
-- ADR: docs/decisions/0228-page-takeover-capability-default-deny.md

DO $$
DECLARE
  v_updated_by uuid;
BEGIN
  -- Pick the earliest godmode user as updated_by; fall back to skipping the seed
  -- when no admin exists yet (fresh repo bootstrapping). The seed is idempotent —
  -- re-running after first admin is created will populate the rows.
  SELECT user_id INTO v_updated_by
  FROM public.user_identity
  WHERE is_godmode = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_updated_by IS NULL THEN
    RAISE NOTICE 'No godmode user found — skipping page_takeover authority seed. Re-run after first admin is created.';
    RETURN;
  END IF;

  -- Default-deny per ADR-0228. Admin opts in by UPDATEing level to 'read_write'.
  -- requires_four_eyes=false for v1 single-target scope; future targets may need
  -- four-eyes for sensitive flows (PII forms etc).
  INSERT INTO public.engine_authority_config (
    workspace_id, capability, level, min_role,
    requires_four_eyes, observer_escalation_hours, updated_by
  )
  SELECT w.workspace_id, 'page_takeover.help.panic_bar_human_button', 'disabled', 'admin',
         false, 24, v_updated_by
  FROM public.workspace w
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union or domain-scoped literal). Added page_takeover.help.panic_bar_human_button 2026-04-29 (ADR-0228 default-deny per-target authority, /dashboard/help M3.2 — admin opt-in only, voice forbidden).';
