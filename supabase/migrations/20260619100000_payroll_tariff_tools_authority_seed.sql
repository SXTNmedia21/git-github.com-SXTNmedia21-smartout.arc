-- ============================================
-- 20260619100000_payroll_tariff_tools_authority_seed.sql
-- Seed per-tool authority config for Phase 7f payroll tariff delegation tools.
--
-- Three new gate_action strings for the payroll capability (ADR-0356 + ADR-0204):
--   payroll.setup_workspace_tariff    — first-time tariff binding (admin only)
--   payroll.change_workspace_tariff   — tariff switch flow (admin only)
--   payroll.add_supplement_override   — workspace supplement above tariff floor (admin or manager)
--
-- These tools delegate to cascade tools (bind_workspace_union + add_supplement_rule)
-- per ADR-0356. The payroll gate fires FIRST (here), then the cascade gate fires
-- inside the cascade delegation tool. Both must approve (ADR-0356 §"Gate convention").
--
-- The cascade capability authority rows are seeded separately in
-- 20260618200000_cascade_capability_authority_seed.sql.
--
-- Convention mirrors 20260519160000_payroll_capability_authority_seed.sql:
--   capability_default_registry: one row per gate_action string.
--   engine_authority_config: backfill all existing workspaces.
--   Self-test DO-block: verify 3 rows seeded for the seed workspace.
--
-- Authority level rationale:
--   setup_workspace_tariff:     'confirm' / 'admin' — structural workspace config.
--   change_workspace_tariff:    'confirm' / 'admin' — structural workspace config.
--   add_supplement_override:    'confirm' / 'manager' — per ADR-0250 dynamic supplement
--     framework: managers may add supplements above tariff floor for their department.
--     Tariff-floor enforcement is DB-level (trigger), not role-level.
--
-- observer_escalation_hours:
--   72h for structural bindings (setup + change) — matches cascade capability seed.
--   24h for supplement overrides — matches payroll capability base seed.
--
-- ADR-0204 — gatedMutation per-tool authority.
-- ADR-0250 — dynamic supplement framework (manager can add supplement_rule).
-- ADR-0356 — cascade-namespace delegation pattern.
-- L-0097   — fail CLOSED on RPC error; never default-allow.
-- ============================================

SET search_path TO public, extensions;

-- ─── Part A: Register in capability_default_registry ─────────────────────────
-- Three per-tool rows. The payroll capability-level row already exists from
-- 20260519160000_payroll_capability_authority_seed.sql. These are the fine-grained
-- per-tool authority rows consulted by gate_action when p_action_type is set.

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  -- Structural tariff binding — admin only, 72h escalation window.
  ('payroll.setup_workspace_tariff',  'confirm', 'admin',   false, 72,
   'Phase 7f tariff setup — first-time workspace_union_binding insert. '
   'Admin only. Delegates to cascade.bind_workspace_union (ADR-0356). '
   'ADR-0204 gatedMutation. Both payroll + cascade gates fire independently.'),

  -- Structural tariff switch — admin only, 72h escalation window.
  ('payroll.change_workspace_tariff', 'confirm', 'admin',   false, 72,
   'Phase 7f tariff switch — atomic close-old + insert-new via bind_workspace_union_atomic. '
   'Admin only. Delegates to cascade.bind_workspace_union UP classifier (ADR-0356 + ADR-0252 §F). '
   'MATERIAL + ENDRINGSOPPSIGELSE classifiers blocked at cascade layer (require employee signering). '
   'ADR-0204 gatedMutation. Both payroll + cascade gates fire independently.'),

  -- Supplement override — manager or admin, 24h escalation window.
  ('payroll.add_supplement_override', 'confirm', 'manager', false, 24,
   'Phase 7f supplement override — workspace-specific supplement above tariff floor. '
   'Manager or admin (ADR-0250). Delegates to cascade.add_supplement_rule (ADR-0356). '
   'PostgreSQL BEFORE INSERT trigger enforces tariff floor (ADR-0351). '
   'ADR-0204 gatedMutation. Both payroll + cascade gates fire independently.')
ON CONFLICT (capability) DO NOTHING;

-- ─── Part B: Backfill existing workspaces ────────────────────────────────────
-- Three capability strings × all existing workspaces.
-- Same COALESCE chain as payroll + cascade seed migrations for audit-trail consistency.
-- ON CONFLICT DO NOTHING: safe re-play on fresh DBs or after db reset.

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
  v.cap,
  v.lvl,
  v.min_r,
  false,
  v.esc_h,
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
      SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1
    )
  )
FROM public.workspace w
CROSS JOIN (
  VALUES
    ('payroll.setup_workspace_tariff',  'confirm', 'admin',   72),
    ('payroll.change_workspace_tariff', 'confirm', 'admin',   72),
    ('payroll.add_supplement_override', 'confirm', 'manager', 24)
) AS v(cap, lvl, min_r, esc_h)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- ─── Part C: Self-test ───────────────────────────────────────────────────────
-- Verify that at least the seed workspace has all 3 payroll tariff authority rows.
-- Fails migration with EXCEPTION if any row is missing.
-- Gracefully skips if no workspaces exist (empty / test DB).
DO $$
DECLARE
  v_count         integer;
  v_seed_ws_id    uuid;
BEGIN
  -- Use oldest workspace as representative seed workspace (mirrors cascade + payroll seeds).
  SELECT workspace_id INTO v_seed_ws_id
  FROM public.workspace
  ORDER BY created_at
  LIMIT 1;

  IF v_seed_ws_id IS NULL THEN
    RAISE NOTICE '20260619100000: no workspaces found — skipping self-test (empty DB).';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.engine_authority_config
  WHERE workspace_id = v_seed_ws_id
    AND capability IN (
      'payroll.setup_workspace_tariff',
      'payroll.change_workspace_tariff',
      'payroll.add_supplement_override'
    );

  IF v_count < 3 THEN
    RAISE EXCEPTION
      '20260619100000 self-test FAILED: expected 3 payroll tariff authority rows for workspace %, found %',
      v_seed_ws_id, v_count;
  END IF;

  RAISE NOTICE '20260619100000 self-test PASSED: % payroll tariff authority rows for workspace %',
    v_count, v_seed_ws_id;
END $$;
