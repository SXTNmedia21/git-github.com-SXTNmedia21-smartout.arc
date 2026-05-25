-- ============================================================================
-- 20260626000000_capability_default_registry_communication.sql
--
-- BUG-1 FIX: Add `communication` to capability_default_registry.
--
-- ROOT CAUSE (chair Phase 5 synthesis 2026-05-24):
--   Migration 20260518000000_contract_authority_seed_upsert_and_bootstrap.sql
--   lines 235-244 explicitly excluded `communication` from the registry under
--   a comment "not in scope here". Migration 20260601100000_seed_communication_
--   authority.sql backfilled engine_authority_config for EXISTING workspaces
--   but never updated capability_default_registry. As a result, the bootstrap
--   trigger (workspace_seed_authority_defaults_trg) that fires AFTER INSERT on
--   workspace iterates capability_default_registry and finds no `communication`
--   row — new workspaces created post-2026-06-01 get no engine_authority_config
--   row for `communication` → gate_action default-allows any caller.
--   L-0066 CVE-class. Silent. No error. No log.
--
-- TWO-PART FIX:
--   Part A: INSERT `communication` into capability_default_registry so all
--           future workspaces auto-seed it via the bootstrap trigger.
--   Part B: UPSERT `communication` into engine_authority_config for every
--           existing workspace that lacks it (idempotent, mirrors the pattern
--           from 20260601100000 but ensures the registry is the single source).
--
-- AUTHORITY VALUES (match 20260601100000_seed_communication_authority.sql):
--   level             = 'suggest'   — Botsson proposes, manager/employee confirms
--   min_role          = 'employee'  — any authenticated workspace member may trigger
--   requires_four_eyes = false      — no dual-approval required at this tier
--
-- ADR reference: ADR-0413 (capability_default_registry single source of truth)
-- L-0066 (CVE-class default-allow), L-0292 (capability without registry entry)
-- Chair Phase 5 synthesis 2026-05-24.
-- ============================================================================

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part A — Insert `communication` into capability_default_registry
--          Idempotent (ON CONFLICT DO NOTHING).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'communication',
    'suggest',
    'employee',
    false,
    72,
    'BUG-1 fix: was omitted from registry in 20260518000000:235-244 under "separate sortie". '
    'Backfill 20260601100000 seeded existing workspaces but left bootstrap trigger blind. '
    'L-0066 CVE-class. ADR-0413. Chair Phase 5 synthesis 2026-05-24.'
  )
ON CONFLICT (capability) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part B — Backfill engine_authority_config for any workspace that still lacks
--          a `communication` row. This is a safety net for:
--   (a) Workspaces created between 20260601100000 and this migration that
--       somehow did not get the backfill.
--   (b) Future db reset + replay scenarios where ordering matters.
--   The updated_by COALESCE chain mirrors 20260518000000 Part A.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'communication',
  'suggest',
  'employee',
  false,
  COALESCE(
    (
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
        AND cm.role IN ('owner', 'admin')
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT ui.user_id
      FROM public.user_identity ui
      ORDER BY ui.created_at
      LIMIT 1
    )
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1
  FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id
    AND eac.capability   = 'communication'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- Verification query (manual, not executed):
--   SELECT
--     (SELECT count(*) FROM capability_default_registry WHERE capability = 'communication') AS registry_rows,
--     (SELECT count(*) FROM workspace) AS workspace_count,
--     (SELECT count(*) FROM engine_authority_config WHERE capability = 'communication') AS seeded_workspaces;
-- Expected: registry_rows=1, seeded_workspaces=workspace_count.
