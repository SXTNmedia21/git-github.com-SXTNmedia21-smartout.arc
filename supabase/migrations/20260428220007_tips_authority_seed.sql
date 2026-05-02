-- ============================================
-- 20260428220007_tips_authority_seed.sql
-- Seed engine_authority_config rows for 4 tips capabilities.
-- CROSS JOIN VALUES form required by scripts/authority-seed-parity.ts.
--
-- Campaign: tips-handling · Sub-sortie: tips-data-model
-- Binding ADRs: 0176 (authority seed), 0173 (capability model)
-- Binding learnings: L-0066 / L-0097 (authority default-allow CVE class)
--
-- COLUMN SCHEMA (per 20260302000100 base + ALTERs):
--   capability                text    NOT NULL  (CHECK: autonomous|confirm|suggest|read_only|disabled)
--   level                     text    NOT NULL
--   min_role                  text    NOT NULL  (DEFAULT 'employee')
--   requires_four_eyes        boolean NOT NULL  (DEFAULT false)
--   observer_escalation_hours integer NOT NULL  (DEFAULT 72)
--   updated_by                uuid    NULL      (platform seed rows = NULL per 20260414225000)
--
-- Deviation from plan: plan listed `capability_key` and `default_authority` columns.
-- Actual table uses `capability` and `level` (verified via 20260302000100 and
-- journey seed 20260516000400). Casts `::authority_level` also removed — column
-- is TEXT with CHECK constraint, not an enum (per journey seed handoff).
--
-- ROLLBACK (manual):
--   DELETE FROM public.engine_authority_config
--    WHERE capability IN (
--      'tips.set_pot', 'tips.adjust_share',
--      'tips.approve_distribution', 'tips.query_own_share'
--    );
-- ============================================

SET search_path TO public, extensions;

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
  v.capability,
  v.level,
  v.min_role,
  v.requires_four_eyes,
  v.observer_escalation_hours,
  NULL::uuid  -- platform seed, no human actor (per 20260414225000)
FROM public.workspace w
CROSS JOIN (
  VALUES
    ('tips.set_pot',              'suggest',   'manager', false, 72),
    ('tips.adjust_share',         'confirm',   'manager', false, 72),
    ('tips.approve_distribution', 'confirm',   'manager', false, 72),
    ('tips.query_own_share',      'read_only', 'employee', false, 72)
) AS v(capability, level, min_role, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). '
  'Added tips.set_pot/tips.adjust_share/tips.approve_distribution/tips.query_own_share '
  '2026-04-28 (tips-data-model Sortie 1).';
