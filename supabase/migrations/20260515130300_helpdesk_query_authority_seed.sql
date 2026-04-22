-- ============================================
-- 20260515130300_helpdesk_query_authority_seed.sql
-- Helpdesk Phase 1 — authority config seed (ADR-0162)
-- ============================================
-- ADR-0162 + L-0066: gate_action default-allows capabilities without
-- a seed row (CVE-class trap). Every new capability MUST land its
-- authority seed in the same migration sequence as its introduction.
--
-- Policy for helpdesk_query:
--   level = 'confirm'           — mutations (resolve, reassign) require
--                                 explicit human confirmation; read-only
--                                 tools (get_ticket, list_queue) unlock
--                                 at this level too.
--   min_role = 'manager'        — rep/admin/owner pass; employee is
--                                 downgraded to 'suggest' (effectively
--                                 read-only in UI).
--   requires_four_eyes = false  — single-approver sufficient for Phase 1.
--                                 Phase 3 may tighten for high-sensitivity
--                                 desks (HR, payroll).
-- ============================================

SET search_path TO public, extensions;

-- Seed one row per existing workspace. New workspaces get the row via
-- packages/ai/src/industry/ bootstrap (future work) OR via this
-- migration re-running at workspace creation (admin pattern).
INSERT INTO engine_authority_config (
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
  'helpdesk_query',
  'confirm',
  'manager',
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
      -- Fallback to any member of the company (seed-time data may not
      -- have owner/admin distinction).
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
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1
  FROM engine_authority_config ac
  WHERE ac.workspace_id = w.workspace_id
    AND ac.capability = 'helpdesk_query'
);

COMMENT ON TABLE engine_authority_config IS
  'Per-workspace capability authority. Default-allow trap — every capability MUST seed here (L-0066). helpdesk_query seeded at Phase 1.';
