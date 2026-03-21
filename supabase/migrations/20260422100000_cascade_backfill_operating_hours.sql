-- ============================================
-- 20260422100000_cascade_backfill_operating_hours.sql
-- Backfill: operating_hours → department_operating_hours
-- Maps legacy workspace-level hours to first active department per workspace.
-- Existing department_operating_hours rows are preserved (ON CONFLICT DO NOTHING).
-- ============================================

SET search_path TO public, extensions;

-- Backfill: for each workspace that has operating_hours rows,
-- copy them into department_operating_hours mapped to the first active department.
-- Uses a lateral join to pick one department per workspace (sort_order ASC, created_at ASC).
INSERT INTO department_operating_hours (
  workspace_id,
  department_id,
  location_id,
  season_id,
  day_of_week,
  open_time,
  close_time,
  is_closed,
  provenance
)
SELECT
  oh.workspace_id,
  first_dept.department_id,
  oh.location_id,
  NULL,  -- season_id NULL = workspace default
  oh.day_of_week,
  oh.open_time,
  oh.close_time,
  oh.is_closed,
  jsonb_build_object(
    'source', 'backfill_from_operating_hours',
    'original_table', 'operating_hours',
    'original_id', oh.id,
    'backfill_date', now()::text
  )
FROM operating_hours oh
CROSS JOIN LATERAL (
  SELECT d.department_id
  FROM department d
  WHERE d.workspace_id = oh.workspace_id
    AND d.is_active = true
  ORDER BY d.sort_order ASC, d.created_at ASC
  LIMIT 1
) first_dept
ON CONFLICT (department_id, location_id, season_id, day_of_week) DO NOTHING;

-- Mark legacy table
COMMENT ON TABLE operating_hours IS
  'LEGACY: backfilled to department_operating_hours on 2026-04-22. Runtime reads must use department_operating_hours. Kept for rollback safety.';
