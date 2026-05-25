-- ============================================================================
-- 20260716100000_capability_registry_seed_sweep_followup.sql
--
-- L-0354 + ADR-0413 follow-up sweep — 5 capabilities still missing from
-- capability_default_registry per scripts/authority-seed-parity.ts as of
-- 2026-05-26. Mirrors the pattern from 20260701000000.
--
-- ROOT CAUSE (identical to BUG-A4-02):
--   Each of these 5 capabilities calls gate_action(p_capability='X') from
--   real call-sites but no engine_authority_config row exists for X on new
--   workspaces. The workspace_seed_authority_defaults_trg trigger iterates
--   capability_default_registry — without a row, no per-workspace seed →
--   gate_action default-allows every caller → CVE-class.
--
-- MISSING CAPABILITIES (per CI):
--   1. bootstrap                       (ADR-0407 K1a bootstrap gates)
--   2. day-line                        (ADR-0367 D6 dag-linje lifecycle)
--   3. org                             (ADR-0367 BT2 area-management)
--   4. routine                         (ADR-0367 BT2 routine attachment)
--   5. schedule.view_preference.write  (user-pref scheduler density)
--
-- AUTHORITY CHOICES — sourced from each capability's authoritative ADR.
-- Same conservative-default rule as 20260701000000: write tools demand
-- minimum 'suggest'; manager+ writes demand 'confirm'.
--
-- IDEMPOTENCY: ON CONFLICT (capability) DO NOTHING for registry;
--              ON CONFLICT (workspace_id, capability) DO NOTHING for backfill.
--
-- ADR references: ADR-0413, ADR-0407, ADR-0367, L-0354, L-0066.
-- ============================================================================

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part A — INSERT 5 capabilities into capability_default_registry
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. bootstrap ────────────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/bootstrap/index.ts (ADR-0407 Phase 1)
-- Tools: list_bootstrap_gates (read_only/admin), close_bootstrap_gate
--        (suggest/admin), skip_bootstrap_gate (suggest/admin V1).
-- K1a industry-package gates (hospitality=11, default=6). Admin-only
-- because gate skip/close decisions are compliance-class.
-- suggest/admin reflects the dominant write actions; read tool layered atop.
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'bootstrap',
    'suggest',
    'admin',
    false,
    72,
    'L-0354 sweep follow-up. K1a bootstrap-gate registry capability per '
    'ADR-0407 Phase 1. Tools: list_bootstrap_gates (read), close + skip '
    '(write/compliance). suggest/admin: writes are compliance-class. '
    'chat+voice for read; chat-only V1 for skip. 20260716100000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- 2. day-line ────────────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/day-line/index.ts (ADR-0367 D6)
-- Tools: create (manager+, chat-only), add_item (manager+ delegating),
--        instantiate_template (manager+), update_hours (manager+).
-- All four tools are D6 Production writes. Cross-namespace delegation
-- via ADR-0240 to task.create_session + timeline_template.apply_template.
-- confirm/manager mirrors timeline_template.apply_template authority.
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'day-line',
    'confirm',
    'manager',
    false,
    72,
    'L-0354 sweep follow-up. D6 dag-linje lifecycle per ADR-0367. Four '
    'manager-level write tools (create, add_item, instantiate_template, '
    'update_hours). confirm/manager: mirrors timeline_template authority. '
    'chat-only V1 (irreversible D6 writes per ADR-0078). 20260716100000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- 3. org ──────────────────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/org/index.ts (ADR-0367 BT2)
-- Tools: update_dept_areas (admin+, confirm, chat-only V1).
-- Org-structure writes link/unlink department_location records — admin-
-- gated because area assignment cascades into D1 envelope coefficients.
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'org',
    'confirm',
    'admin',
    false,
    72,
    'L-0354 sweep follow-up. Org-structure area-management per ADR-0367 BT2. '
    'Single tool: update_dept_areas. Admin-only because area assignment '
    'cascades into D1 envelope coefficients. confirm/admin per ADR. '
    'chat-only V1 per ADR-0078. 20260716100000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- 4. routine ──────────────────────────────────────────────────────────────────
-- Code: packages/ai/src/capabilities/routine/index.ts (ADR-0367 BT2)
-- Tools: attach_to_line (manager+, confirm, chat-only V1).
-- Materialises routine template into day_line via task.create_session
-- delegation (ADR-0240 — no direct session_task.insert).
-- confirm/manager matches day-line + timeline_template authority.
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'routine',
    'confirm',
    'manager',
    false,
    72,
    'L-0354 sweep follow-up. Routine attachment per ADR-0367 BT2. Single '
    'tool: attach_to_line delegates to task.create_session via ADR-0240. '
    'confirm/manager: mirrors day-line + timeline_template authority. '
    'chat-only V1 (D6 write irreversible per ADR-0078). 20260716100000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- 5. schedule.view_preference.write ──────────────────────────────────────────
-- Code: apps/web/src/app/dashboard/schedule/_actions/set-schedule-density.ts
-- Single Server Action — toggles user-level scheduler view density setting.
-- No PII, no audit-class risk, no cross-user effect. Pure user-pref write.
-- autonomous/employee: every member may set their own view preference.
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'schedule.view_preference.write',
    'autonomous',
    'employee',
    false,
    72,
    'L-0354 sweep follow-up. User-level scheduler view-density preference. '
    'No PII, no cross-user effect, pure UI preference. autonomous/employee: '
    'all members. chat-only (UI Server Action). 20260716100000.'
  )
ON CONFLICT (capability) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part B — Backfill engine_authority_config for existing workspaces
-- ─────────────────────────────────────────────────────────────────────────────
-- Same COALESCE(owner/admin → any member → first user) chain as 20260701000000.

-- B.1 bootstrap
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'bootstrap',
  'suggest',
  'admin',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'bootstrap'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.2 day-line
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'day-line',
  'confirm',
  'manager',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'day-line'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.3 org
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'org',
  'confirm',
  'admin',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'org'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.4 routine
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'routine',
  'confirm',
  'manager',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'routine'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.5 schedule.view_preference.write
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'schedule.view_preference.write',
  'autonomous',
  'employee',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id
    AND eac.capability = 'schedule.view_preference.write'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- B.6 shift_marketplace
-- ADR-0306. capability_default_registry row already exists from
-- 20260611120100_wfm_capability_authority_seed.sql; this backfills
-- engine_authority_config for existing workspaces that the registry
-- trigger hasn't already covered. Matches level + min_role from the
-- registry row (autonomous/manager/12h).
INSERT INTO public.engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes, updated_by)
SELECT
  w.workspace_id,
  'shift_marketplace',
  'autonomous',
  'manager',
  false,
  COALESCE(
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id AND cm.role IN ('owner', 'admin')
     ORDER BY cm.created_at LIMIT 1),
    (SELECT cm.user_id FROM public.company_member cm
     WHERE cm.company_id = w.company_id
     ORDER BY cm.created_at LIMIT 1),
    (SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1)
  )
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id
    AND eac.capability = 'shift_marketplace'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- ============================================================================
-- DONE. After this migration, scripts/authority-seed-parity.ts should report
-- 0 missing seeds (was 5 as of 2026-05-26 pre-migration).
-- ============================================================================
