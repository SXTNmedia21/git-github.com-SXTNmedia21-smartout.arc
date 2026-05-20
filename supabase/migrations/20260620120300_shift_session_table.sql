-- supabase/migrations/20260620120300_shift_session_table.sql
--
-- ADR-0367 §4.2. RUNTIME layer — per (employee, schedule_shift).
-- schedule_shift PK is schedule_shift_id; assignee column is employee_id.
-- Verified 2026-05-18 against 20260301300000_schedule_shift_table.sql:45.

CREATE TABLE public.shift_session (
  shift_session_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_session_id  UUID NOT NULL REFERENCES department_session(department_session_id),
  schedule_shift_id      UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  employee_id            UUID NOT NULL REFERENCES profile(profile_id),
  business_date          DATE NOT NULL,
  location_id            UUID NOT NULL REFERENCES location(location_id),
  department_id          UUID NOT NULL REFERENCES department(department_id),
  status                 shift_session_status NOT NULL DEFAULT 'scheduled',
  clocked_in_at          TIMESTAMPTZ,
  clocked_out_at         TIMESTAMPTZ,
  push_topic             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_shift_session UNIQUE (schedule_shift_id)
);

CREATE INDEX idx_shift_session_employee_active
  ON shift_session (employee_id, status)
  WHERE status IN ('scheduled', 'clocked_in');

CREATE INDEX idx_shift_session_date
  ON shift_session (workspace_id, business_date);

CREATE TRIGGER set_shift_session_updated_at
  BEFORE UPDATE ON shift_session FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE shift_session ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_shift_session_self_or_manager" ON shift_session FOR SELECT
USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND (
    employee_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    OR is_admin_or_manager_in_workspace(auth.uid(), workspace_id)
  )
);

CREATE POLICY "api_key_select_shift_session" ON shift_session FOR SELECT
USING (workspace_id = get_api_workspace_id());

CREATE POLICY "service_role_shift_session" ON shift_session FOR ALL
USING (auth.role() = 'service_role');

COMMENT ON TABLE shift_session IS 'ADR-0367. RUNTIME layer — per-employee shift lifecycle row.';
