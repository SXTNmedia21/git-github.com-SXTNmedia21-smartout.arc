-- supabase/migrations/20260620120800_day_line_capability_authority_seed.sql
-- ADR-0367 §B7. 5 new capabilities into engine_authority_config.
-- All start as 'suggest' (require user confirmation per default).
-- Voice / chat allowance: chat-only on mutations (ADR-0078).
-- min_role: 'manager' for day-line/routine (operational), 'admin' for org.
--
-- Pattern: Part A registers in capability_default_registry (seeds new workspaces
-- via trigger). Part B backfills existing workspaces.

SET search_path TO public, extensions;

-- ─── Part A: Register in capability_default_registry ─────────────────────────
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  ('day-line',                   'suggest', 'manager', false, 72,
   'ADR-0367. Create/edit day_line for area+session. Chat-only (ADR-0078).'),
  ('day-line.create',            'suggest', 'manager', false, 72,
   'ADR-0367. Create day_line for area+session.'),
  ('day-line.add_item',          'suggest', 'manager', false, 72,
   'ADR-0367. Delegating dispatcher — V1: task+routine only.'),
  ('day-line.instantiate_template', 'suggest', 'manager', false, 72,
   'ADR-0367. Apply timeline_template (scope=location) to day_line.'),
  ('routine.attach_to_line',     'suggest', 'manager', false, 72,
   'ADR-0367. Attach routine items as session_task rows.'),
  ('org.update_dept_areas',      'suggest', 'admin',   false, 72,
   'ADR-0367. Admin updates department_location pairings.')
ON CONFLICT (capability) DO NOTHING;

-- ─── Part B: Backfill existing workspaces ─────────────────────────────────────
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
  v.role,
  false,
  72,
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
    ('day-line',                      'suggest', 'manager'),
    ('day-line.create',               'suggest', 'manager'),
    ('day-line.add_item',             'suggest', 'manager'),
    ('day-line.instantiate_template', 'suggest', 'manager'),
    ('routine.attach_to_line',        'suggest', 'manager'),
    ('org.update_dept_areas',         'suggest', 'admin')
) AS v(cap, lvl, role)
ON CONFLICT (workspace_id, capability) DO NOTHING;
