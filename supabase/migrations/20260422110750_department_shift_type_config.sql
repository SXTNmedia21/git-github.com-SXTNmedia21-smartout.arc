-- Migration: department_shift_type_config
-- D1 Operational Envelope: junction table binding payroll.shift_type to departments
-- with default scheduling parameters (start time, end time, break, slot count).
-- Replaces schedule_template_shift as the source of truth for grid columns.

CREATE TABLE department_shift_type_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id         UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  shift_type_id         UUID NOT NULL REFERENCES payroll.shift_type(id) ON DELETE CASCADE,
  label                 TEXT NOT NULL,
  default_start_time    TIME NOT NULL DEFAULT '08:00',
  default_end_time      TIME NOT NULL DEFAULT '16:00',
  default_break_minutes INTEGER NOT NULL DEFAULT 30,
  slot_count            INTEGER NOT NULL DEFAULT 1,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  applicable_day_types  TEXT[] NOT NULL DEFAULT '{weekday,weekend}'
                        CHECK (applicable_day_types <@ ARRAY['weekday','weekend','holiday']::text[]),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_dept_shift_config UNIQUE (department_id, shift_type_id, default_start_time, default_end_time)
);

ALTER TABLE department_shift_type_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_dept_shift_config" ON department_shift_type_config
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_dept_shift_config" ON department_shift_type_config
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_dept_shift_config" ON department_shift_type_config
  FOR SELECT USING (workspace_id = get_api_workspace_id());

CREATE INDEX idx_dept_shift_config_dept ON department_shift_type_config (department_id);
CREATE INDEX idx_dept_shift_config_workspace ON department_shift_type_config (workspace_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON department_shift_type_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE department_shift_type_config IS
  'D1 Operational Envelope: binds workspace-level shift types to departments with default scheduling parameters.';

-- Backfill Step 1: Create payroll.shift_type entries from existing template roles
-- Uses fuzzy name matching (case-insensitive) to avoid duplicates.
INSERT INTO payroll.shift_type (workspace_id, name, color, sort_order)
SELECT DISTINCT
  t.workspace_id,
  ts.role,
  '#6B7280',
  0
FROM schedule_template_shift ts
JOIN schedule_template t ON t.schedule_template_id = ts.template_id
WHERE ts.role IS NOT NULL
  AND t.workspace_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payroll.shift_type st
    WHERE st.workspace_id = t.workspace_id AND LOWER(st.name) = LOWER(ts.role)
  );

-- Backfill Step 2: Create department_shift_type_config rows from template shifts
-- DISTINCT ON prevents duplicate rows for the same dept+type+start+end combination.
INSERT INTO department_shift_type_config
  (workspace_id, department_id, shift_type_id, label, default_start_time, default_end_time, slot_count, sort_order)
SELECT DISTINCT ON (t.department_id, st.id, ts.start_time, ts.end_time)
  t.workspace_id,
  t.department_id,
  st.id,
  ts.role || ' ' || ts.start_time || '-' || ts.end_time,
  ts.start_time::TIME,
  ts.end_time::TIME,
  COALESCE(ts.slot_count, 1),
  COALESCE(ts.slot_order, 0)
FROM schedule_template_shift ts
JOIN schedule_template t ON t.schedule_template_id = ts.template_id
JOIN payroll.shift_type st ON st.workspace_id = t.workspace_id AND LOWER(st.name) = LOWER(ts.role)
WHERE t.department_id IS NOT NULL
ON CONFLICT (department_id, shift_type_id, default_start_time, default_end_time) DO NOTHING;

-- Backfill Step 3: Set shift_type_id on existing schedule_shift rows where possible
-- Links schedule_shift to the correct payroll.shift_type via the template shift role name.
UPDATE schedule_shift ss
SET shift_type_id = st.id
FROM schedule_template_shift ts
JOIN schedule_template t ON t.schedule_template_id = ts.template_id
JOIN payroll.shift_type st ON st.workspace_id = t.workspace_id AND LOWER(st.name) = LOWER(ts.role)
WHERE ss.template_shift_id = ts.schedule_template_shift_id
  AND ss.shift_type_id IS NULL;
