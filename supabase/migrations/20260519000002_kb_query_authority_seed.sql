-- ADR-0221 — KB Capability Registration as Merge Gate
-- Learning L-0066 — default-allow without config row is CVE-class trap
-- Learning L-0107 — authority appearance != authority presence
--
-- ============================================
-- 20260519000002_kb_query_authority_seed.sql
-- Seeds engine_authority_config for the kb_query capability introduced
-- in packages/ai/src/capabilities/kb_query/ (ADR-0221, G1 merge-blocker).
--
-- Policy rationale:
--   level = 'read_only'       — kb_query is a pure retrieval capability;
--                               no mutations. Read pattern: agent calls
--                               searchKb, receives chunks. gate_action
--                               enforces read_only at execute-time.
--   min_role = 'employee'     — every workspace member should be able to
--                               ask Botsson about the handbook. The chat
--                               hero on /dashboard/help serves admin +
--                               manager + employee equally (ADR-0219).
--   requires_four_eyes = false — single-actor read; no dual-review needed.
--   observer_escalation_hours = 24 — default; no observer workflow for
--                               this read-only capability.
--
-- Idempotent: ON CONFLICT (workspace_id, capability) DO NOTHING.
-- Pattern mirrors 20260518200002_seed_availability_authority.sql
-- and 20260515130300_helpdesk_query_authority_seed.sql.
--
-- Timestamp: 20260519000001 — strictly greater than repo tip
-- 20260519000000 (create_page_knowledge).
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
    RAISE NOTICE 'No godmode user found — skipping kb_query authority seed. Re-run after first admin is created.';
    RETURN;
  END IF;

  INSERT INTO public.engine_authority_config (
    workspace_id, capability, level, min_role,
    requires_four_eyes, observer_escalation_hours, updated_by
  )
  SELECT w.workspace_id, 'kb_query', 'read_only', 'employee',
         false, 24, v_updated_by
  FROM public.workspace w
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union or domain-scoped literal). Added kb_query 2026-04-28 (ADR-0221 G1 merge-blocker, /dashboard/help v1 — read-only semantic KB retrieval, employee+ access).';
