-- 20260616100400_seed_organization_update_department_authority.sql
--
-- Seeds engine_authority_config for the `organization.update_department`
-- capability introduced in update-department-action.ts (council B2 fix,
-- 2026-05-14).
--
-- EditDepartmentDialog previously wrote directly to `department` via a
-- browser supabase client with no gate, no emit, and no workspace_id
-- verification. The council flagged this as a B2 (P0) blocker because:
--   1. No gate_action call (ADR-0099 violation)
--   2. No emit() call (ADR-0134 violation — audit-trail blind)
--   3. Blast-radius amplified by openDepartmentEdit bridge tool making
--      the ungated path agent-callable
--
-- Authority config:
--   level          = 'confirm'    (manager must confirm, not autonomous)
--   min_role       = 'manager'    (employees cannot update departments)
--   requires_four_eyes = false    (one approver is sufficient)
--   observer_escalation_hours = 24 (standard for org-structure changes)
--
-- Idempotent: ON CONFLICT DO NOTHING so re-applying is safe.
-- Covers all existing workspaces. New workspaces inherit the row via the
-- workspace creation trigger or the next periodic authority-backfill job.

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
  'organization.update_department',
  'confirm',
  'manager',
  false,
  24,
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
    )
  )
FROM public.workspace w
ON CONFLICT (workspace_id, capability) DO NOTHING;
