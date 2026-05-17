-- ============================================
-- 20260616110100_seed_timeline_template_authority.sql
--
-- What:  Seeds engine_authority_config rows for the `timeline_template`
--        capability across all existing workspaces, and registers the
--        capability in capability_default_registry so new workspaces
--        auto-seed via the workspace_seed_authority_defaults_trg trigger.
--
-- Why:   ADR-0189 authority-seed-parity: every registered capability MUST
--        have an engine_authority_config row per workspace AND a
--        capability_default_registry row for auto-seeding of future workspaces.
--        Without this, gate_action() defaults to read_only and all mutating
--        tools (save_template, apply_template, archive_template) are blocked.
--
-- Authority policy (spec §Authority seed + council 2026-05-16):
--   level         = 'confirm'   — manager confirms before writing D6 rows
--   min_role      = 'admin'     — admin/owner only (manager support deferred)
--   requires_four_eyes = false  — single-approver in v1
--   observer_escalation_hours = 72 — standard escalation window
--
-- Idempotent: ON CONFLICT (workspace_id, capability) DO NOTHING ensures safe
--   replay on fresh DBs or after db reset.
--
-- ADR ref: ADR-0335 (Timeline Templates), ADR-0189 (authority-seed-parity)
-- ============================================

-- ─── Part A: Backfill existing workspaces ─────────────────────────────────────

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
  'timeline_template',
  'confirm',
  'admin',
  false,
  72,
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
      -- Fallback: any member of the company.
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      -- Last resort: any user_identity row (local seed data).
      SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1
    )
  )
FROM public.workspace w
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- ─── Part B: Register in capability_default_registry ─────────────────────────
-- New workspaces created AFTER this migration auto-seed via the
-- workspace_seed_authority_defaults_trg trigger, which reads this table.

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'timeline_template',
    'confirm',
    'admin',
    false,
    72,
    'ADR-0335. Timeline Templates: save/apply/archive scope-filtered D6 authoring canvases. '
    'Chat-only per ADR-0078 (no voice apply — D6 writes are irreversible). '
    'save_template (gate: timeline_template.save): INSERT timeline_template row. '
    'apply_template (gate: timeline_template.apply): transactional D6 row materialization. '
    'archive_template (gate: timeline_template.archive): soft-delete via UPDATE is_archived. '
    'list_templates: read-only, no gate. '
    'level=confirm/min_role=admin: manager auth deferred to Phase 2.'
  )
ON CONFLICT (capability) DO NOTHING;
