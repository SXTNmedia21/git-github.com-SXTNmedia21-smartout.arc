SET search_path TO public, extensions;

-- ============================================
-- Waste tracking: daily waste logs with reason codes.
-- Enables food waste analytics, cost attribution,
-- and waste reduction tracking over time.
-- ============================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waste_category') THEN
    CREATE TYPE waste_category AS ENUM (
      'food_prep',
      'food_spoilage',
      'food_overproduction',
      'food_returned',
      'beverage',
      'packaging',
      'other'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.waste_log (
  waste_log_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id     UUID REFERENCES department(department_id),
  session_id        UUID REFERENCES department_session(department_session_id),
  category          waste_category NOT NULL,
  item_description  TEXT NOT NULL,
  quantity          NUMERIC(10,3),
  unit              TEXT DEFAULT 'kg',
  estimated_cost    NUMERIC(10,2),
  reason            TEXT,
  recorded_by       UUID REFERENCES profile(profile_id),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE waste_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_waste_log" ON waste_log;
CREATE POLICY "jwt_read_waste_log" ON waste_log
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_manage_waste_log" ON waste_log;
CREATE POLICY "jwt_manage_waste_log" ON waste_log
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_waste_log" ON waste_log;
CREATE POLICY "api_key_read_waste_log" ON waste_log
  FOR SELECT USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

DROP POLICY IF EXISTS "service_role_waste_log" ON waste_log;
CREATE POLICY "service_role_waste_log" ON waste_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_waste_log_workspace ON waste_log (workspace_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_waste_log_session ON waste_log (session_id) WHERE session_id IS NOT NULL;
CREATE TRIGGER set_waste_log_updated_at BEFORE UPDATE ON waste_log FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE waste_log IS 'Per-item waste tracking with category, cost, and reason codes.';
