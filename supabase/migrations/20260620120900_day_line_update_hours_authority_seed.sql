-- supabase/migrations/20260620120900_day_line_update_hours_authority_seed.sql
-- ADR-0367 self-review addition: seed 'day-line.update_hours' capability authority.
-- This action was not included in 20260620120800_day_line_capability_authority_seed.sql.
--
-- Pattern: Part A registers default for new workspaces; Part B backfills existing workspaces.
-- Schema columns: capability / level / min_role / requires_four_eyes / observer_escalation_hours
--   (engine_authority_config has workspace_id NOT NULL; Part B cross-joins with workspace table).

SET search_path TO public, extensions;

-- ─── Part A: Register in capability_default_registry ─────────────────────────
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  ('day-line.update_hours', 'suggest', 'manager', false, 72,
   'ADR-0367. Update planned_open / planned_close on an existing day_line. Chat-only (ADR-0078).')
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
  'day-line.update_hours',
  'suggest',
  'manager',
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
ON CONFLICT (workspace_id, capability) DO NOTHING;
