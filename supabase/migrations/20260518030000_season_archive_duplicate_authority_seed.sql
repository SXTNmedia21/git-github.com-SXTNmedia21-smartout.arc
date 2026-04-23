SET search_path TO public, extensions;

-- ============================================
-- 20260518030000_season_archive_duplicate_authority_seed.sql
-- Year Wheel M4 — C4 authority seed for season.archive + season.duplicate
--
-- Campaign: year-wheel · Milestone: M4 · Sub-sortie: M4.1
-- Binding ADRs: 0099 (gate_action), 0176 (seed pattern), 0189 (parity CI),
--               0200 (authority-seed-before-capability invariant)
-- Binding learnings: L-0066 / L-0097 (default-allow CVE class)
-- ============================================
--
-- PURPOSE
-- -------
-- Seed public.engine_authority_config rows for two new season capabilities
-- landed in M4:
--
--   season.archive   — manager-level; reversible soft-state change.
--   season.duplicate — admin-level;   creates fresh draft + copies budget
--                      + copies day/hour factors. Low blast radius in
--                      source data but spawns new rows, so gated at admin.
--
-- Both capabilities default to 'suggest' — Server Actions treat this as
-- allow-for-role per ADR-0099 gate semantics.
--
-- Column schema + seed pattern mirror 20260518010000_season_activate_authority_seed.sql
-- verbatim. Idempotent via (workspace_id, capability) unique conflict.
--
-- ROLLBACK (manual, for reference)
-- --------------------------------
--   DELETE FROM public.engine_authority_config
--    WHERE capability IN ('season.archive', 'season.duplicate');
-- ============================================

INSERT INTO public.engine_authority_config
  (workspace_id, capability, min_role, level, requires_four_eyes, observer_escalation_hours)
SELECT
  w.workspace_id,
  v.capability,
  v.min_role,
  v.level,
  v.requires_four_eyes,
  v.observer_escalation_hours
FROM public.workspace w
CROSS JOIN (
  VALUES
    ('season.archive',   'manager', 'suggest', false, 72),
    ('season.duplicate', 'admin',   'suggest', false, 72)
) AS v(capability, min_role, level, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). '
  'Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; '
  'added helpdesk_query 2026-05-15; added journey.run_dev/journey.publish_mission/'
  'journey.publish_guide/journey.run_guided 2026-04-22 (S1.3, ADR-0173 / ADR-0176); '
  'added season.activate 2026-05-18 (M1.3, ADR-0200); '
  'added season.archive + season.duplicate 2026-05-18 (M4.1).';
