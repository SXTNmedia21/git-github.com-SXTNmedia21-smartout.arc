-- supabase/migrations/20260624120100_bulk_import_authority_seed.sql
-- bulk_import Sortie A authority seed: 4 engine_authority_config rows per L-0083 default-deny
-- ADR-0401 (capability) + ADR-0288 (voice forbidden for irreversible writes)
-- Rows for all 4 tools land NOW; bodies for preview_batch/resolve_ambiguity/commit_batch
-- ship Sortie B+C. Without these rows, default-deny would block integration tests when
-- those bodies land.
-- Filename timestamp 20260624120100 strictly > foundation migration 20260624120000 (L-0042).
-- Re-timestamped 2026-05-23 from 20260624000100 after close-feature.sh v8 Gate 0.7 caught
-- collision with dev's 20260624000100_create_employee_onboarding_state.sql.
--
-- SCHEMA DEVIATION NOTE (vs task plan template):
--   The plan specified workspace_id=NULL for "platform-level defaults". The actual
--   engine_authority_config schema has workspace_id NOT NULL (uq_workspace_capability on
--   (workspace_id, capability)). There is no tool_name column — each capability+tool combo
--   is its own capability TEXT value following the dot-notation convention used by
--   session.open, day-line.update_hours, etc.
--
--   RESOLUTION (per ADR-0192 two-part pattern):
--     Part A → capability_default_registry (platform-wide defaults; triggers on new workspace INSERT).
--     Part B → engine_authority_config CROSS JOIN workspace (backfill for all existing workspaces).
--   Capability names: bulk_import.parse_spreadsheet, bulk_import.preview_batch,
--                     bulk_import.resolve_ambiguity, bulk_import.commit_batch
--
-- AUTHORITY POLICY:
--   bulk_import.parse_spreadsheet  → suggest / manager  (read-only; PII-adjacent file contents)
--   bulk_import.preview_batch      → suggest / manager  (writes to import_run only; reversible)
--   bulk_import.resolve_ambiguity  → suggest / manager  (mutates resolver_decisions[] only)
--   bulk_import.commit_batch       → confirm / admin    (irreversible cascade-delegated commit;
--                                                         ADR-0288: voice forbidden)
--
-- References: ADR-0099 (gate_action), ADR-0192 (two-part seed pattern), ADR-0288 (voice),
--             ADR-0401 (bulk_import capability), L-0066 (default-deny CVE), L-0129 (parity scanner),
--             L-0083 (engine_authority_config default-deny).

SET search_path TO public, extensions;

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part A — capability_default_registry: platform-wide defaults (ADR-0192)
-- ─────────────────────────────────────────────────────────────────────────────
-- Consumed by workspace_seed_authority_defaults_trg on every new workspace INSERT.
-- Adding these 4 rows is sufficient for all future workspaces — no trigger rewrite.
-- Per L-0129: capability literals must appear explicitly in VALUES tuples for the
-- parity scanner (scripts/authority-seed-parity.ts) to detect seeds correctly.

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'bulk_import.parse_spreadsheet',
    'suggest',
    'manager',
    false,
    72,
    'ADR-0401 Sortie A. Parse uploaded spreadsheet and return structured ImportRun draft. '
    'Read-only path; no DB writes beyond import_run row creation. PII-adjacent (file '
    'contents in payload). suggest level: AI proposes parse result, manager confirms. '
    'Chat-only (file binary cannot traverse voice channel). 2026-06-24.'
  ),
  (
    'bulk_import.preview_batch',
    'suggest',
    'manager',
    false,
    72,
    'ADR-0401 Sortie B. Preview resolved import batch before commit. Writes to import_run '
    'staging columns only — fully reversible. suggest level: manager reviews preview and '
    'triggers commit_batch separately. Tool body lands Sortie B. 2026-06-24.'
  ),
  (
    'bulk_import.resolve_ambiguity',
    'suggest',
    'manager',
    false,
    72,
    'ADR-0401 Sortie B. Resolve ambiguous rows in an ImportRun (employee/shift matching). '
    'Mutates resolver_decisions[] column on import_run only — no cascade writes. '
    'suggest level: manager reviews and accepts each resolution. Tool body lands Sortie B. 2026-06-24.'
  ),
  (
    'bulk_import.commit_batch',
    'confirm',
    'admin',
    false,
    24,
    'ADR-0401 Sortie C. Atomic cascade-delegated bulk commit: creates schedule_shift rows '
    'and sets import_run.applied_at. Irreversible — requires admin min_role and confirm '
    'level (human gate before any write). ADR-0288: voice channel forbidden for irreversible '
    'C4 acts; chat-only enforcement enforced by capability tool. fn_commit_bulk_import RPC '
    'and tool body land Sortie C. 24h observer escalation: bulk schedule changes are high-impact. '
    '2026-06-24.'
  )
ON CONFLICT (capability) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Part B — engine_authority_config: backfill for all EXISTING workspaces
-- ─────────────────────────────────────────────────────────────────────────────
-- The trigger (Part A) only fires on INSERT of new workspaces. This CROSS JOIN
-- fills the gap for all workspaces that existed before this migration lands.
-- COALESCE chain mirrors 20260611120100_wfm_capability_authority_seed.sql.
-- Per L-0129: capability literals must appear explicitly in VALUES tuples for
-- the parity scanner to detect seeds correctly.
-- ON CONFLICT (workspace_id, capability) DO NOTHING — idempotent on re-apply.

INSERT INTO public.engine_authority_config (
  workspace_id,
  capability,
  level,
  min_role,
  requires_four_eyes,
  observer_escalation_hours,
  updated_by
)
SELECT
  w.workspace_id,
  caps.capability,
  caps.level,
  caps.min_role,
  caps.requires_four_eyes,
  caps.observer_escalation_hours,
  COALESCE(
    (
      -- Prefer workspace owner/admin via company_member (ADR-0099 audit trail).
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
        AND cm.role IN ('owner', 'admin')
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      -- Fallback to any member of the company.
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      -- Last resort: any user_identity row (Supabase local seed data).
      SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1
    )
  ) AS updated_by
FROM public.workspace w
-- L-0129: capability literals in VALUES tuples for parity scanner detection
CROSS JOIN (VALUES
  ('bulk_import.parse_spreadsheet',  'suggest', 'manager', false, 72),
  ('bulk_import.preview_batch',      'suggest', 'manager', false, 72),
  ('bulk_import.resolve_ambiguity',  'suggest', 'manager', false, 72),
  ('bulk_import.commit_batch',       'confirm', 'admin',   false, 24)
) AS caps(capability, level, min_role, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Update capability_default_registry COMMENT — add 4 new capabilities to list
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.capability_default_registry IS
  'Canonical list of capabilities that auto-seed engine_authority_config rows '
  'when a new workspace is created. See trigger workspace_seed_authority_defaults. '
  'Adding a capability here is sufficient — no function rewrite needed. '
  'Existing-workspace backfill is the responsibility of each capability''s own '
  'seed migration. '
  'Capabilities registered (in migration order): '
  '  onboarding (ADR-0275 Phase E, 2026-05-04), '
  '  scheduler (ADR-0307/0309, 2026-05-14), '
  '  shift_marketplace (ADR-0306, 2026-05-14), '
  '  pos_account_management (ADR-0305, 2026-05-14), '
  '  bulk_import.parse_spreadsheet (ADR-0401 Sortie A, 2026-06-24), '
  '  bulk_import.preview_batch (ADR-0401 Sortie B, 2026-06-24), '
  '  bulk_import.resolve_ambiguity (ADR-0401 Sortie B, 2026-06-24), '
  '  bulk_import.commit_batch (ADR-0401 Sortie C, 2026-06-24). '
  'For the full list query: SELECT capability FROM capability_default_registry ORDER BY 1.';

COMMIT;
