-- 20260604121000_sortie_1_gate_action_seed.sql
-- Sortie 1 — Seed 3 gate-action capabilities for all existing workspaces.
-- Per ADR-0298 §4.4 + Spec §4.7 + canonical seed pattern
-- supabase/migrations/20260428220007_tips_authority_seed.sql.
--
-- COLUMN SCHEMA (verified via 20260302000100 + ALTERs):
--   capability                text    NOT NULL  (dotted slug)
--   level                     text    NOT NULL  (CHECK: autonomous|confirm|suggest|read_only|disabled)
--   min_role                  text    NOT NULL  (DEFAULT 'employee')
--   requires_four_eyes        boolean NOT NULL  (DEFAULT false)
--   observer_escalation_hours integer NOT NULL  (DEFAULT 72)
--   updated_by                uuid    NULL      (platform seed = NULL per 20260414225000)
--
-- UNIQUE CONSTRAINT: uq_workspace_capability (workspace_id, capability) — 2 columns only.
-- Dotted-slug pattern (task.complete_session_task) means each is independent row.

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
  NULL::uuid
FROM public.workspace w
CROSS JOIN (
  VALUES
    ('task.complete_session_task',  'suggest',   'employee', false, 72),
    ('schedule.confirm_shift',      'suggest',   'employee', false, 72),
    ('timesheet.confirm_hours',     'suggest',   'employee', false, 72)
) AS v(capability, level, min_role, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). '
  'Added task.complete_session_task + schedule.confirm_shift + timesheet.confirm_hours '
  '2026-05-13 (Sortie 1 mobile-session-task-defense).';
