-- supabase/migrations/20260620120500_department_location_junction.sql
-- ADR-0367 §4.4. M:N — workspace says which departments operate at which areas.
-- workspace_id denormalized for RLS perf; populated by INSERT trigger.

CREATE TABLE public.department_location (
  department_id  UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  location_id    UUID NOT NULL REFERENCES location(location_id) ON DELETE CASCADE,
  workspace_id   UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  created_by     UUID REFERENCES profile(profile_id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (department_id, location_id)
);

CREATE INDEX idx_department_location_department ON department_location (department_id);
CREATE INDEX idx_department_location_location ON department_location (location_id);
CREATE INDEX idx_department_location_workspace ON department_location (workspace_id);

-- Denorm workspace_id from department on INSERT.
CREATE OR REPLACE FUNCTION public.set_department_location_workspace_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id
    FROM public.department WHERE department_id = NEW.department_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_department_location_workspace_id
  BEFORE INSERT ON department_location
  FOR EACH ROW EXECUTE FUNCTION set_department_location_workspace_id();

ALTER TABLE department_location ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_department_location" ON department_location FOR SELECT
USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_department_location" ON department_location FOR SELECT
USING (workspace_id = get_api_workspace_id());

CREATE POLICY "jwt_insert_department_location" ON department_location FOR INSERT
WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND is_admin_in_workspace(auth.uid(), workspace_id)
);

CREATE POLICY "jwt_delete_department_location" ON department_location FOR DELETE
USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND is_admin_in_workspace(auth.uid(), workspace_id)
);

CREATE POLICY "service_role_department_location" ON department_location FOR ALL
USING (auth.role() = 'service_role');
