-- supabase/migrations/20260620120200_day_line_table.sql
--
-- ADR-0367 §4.1. PROGRAM layer — per (department_session, location) anchor.
-- Status DERIVED at read time, not stored. cancelled_at + is_backfilled
-- carry the only mutable lifecycle bits.

CREATE TABLE public.day_line (
  day_line_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_session_id  UUID NOT NULL REFERENCES department_session(department_session_id) ON DELETE CASCADE,
  department_id          UUID NOT NULL REFERENCES department(department_id),
  location_id            UUID NOT NULL REFERENCES location(location_id) ON DELETE RESTRICT,
  business_date          DATE NOT NULL,
  planned_open           TIME NOT NULL,
  planned_close          TIME NOT NULL,
  source_template_id     UUID REFERENCES timeline_template(id),
  notes                  TEXT,
  cancelled_at           TIMESTAMPTZ,
  is_backfilled          BOOLEAN NOT NULL DEFAULT false,
  created_by             UUID REFERENCES profile(profile_id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_day_line UNIQUE (department_session_id, location_id)
);

CREATE INDEX idx_day_line_workspace_date ON day_line (workspace_id, business_date);
CREATE INDEX idx_day_line_session ON day_line (department_session_id);
CREATE INDEX idx_day_line_location ON day_line (location_id);

CREATE TRIGGER set_day_line_updated_at
  BEFORE UPDATE ON day_line FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE day_line ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_day_line" ON day_line FOR SELECT
USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_select_day_line" ON day_line FOR SELECT
USING (workspace_id = get_api_workspace_id());

CREATE POLICY "jwt_insert_day_line" ON day_line FOR INSERT
WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND is_admin_or_manager_in_workspace(auth.uid(), workspace_id)
);

CREATE POLICY "jwt_update_day_line" ON day_line FOR UPDATE
USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND is_admin_or_manager_in_workspace(auth.uid(), workspace_id)
);

CREATE POLICY "service_role_day_line" ON day_line FOR ALL
USING (auth.role() = 'service_role');

COMMENT ON TABLE day_line IS 'ADR-0367. PROGRAM layer — per area daily plan. Status derived at read time.';
