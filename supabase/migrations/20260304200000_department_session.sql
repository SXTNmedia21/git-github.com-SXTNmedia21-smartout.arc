-- ============================================
-- 20260304200000_department_session.sql
-- Creates department_session: the daily operational container.
-- One row per department per day within the active season.
-- Source: MODULE_4_OPERATIONS.md §3
-- ============================================

CREATE TYPE department_session_status AS ENUM (
  'upcoming',     -- created but not yet started (day hasn't come)
  'active',       -- currently running
  'pending_signoff', -- all shifts done, awaiting sign-off
  'closed',       -- signed off by closing employee
  'missed'        -- no punch-in happened, auto-closed
);

CREATE TABLE public.department_session (
  department_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id         UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  season_id             UUID REFERENCES season(season_id),
  session_date          DATE NOT NULL,

  -- Lifecycle
  status                department_session_status NOT NULL DEFAULT 'upcoming',
  opened_at             TIMESTAMPTZ,
  opened_by             UUID REFERENCES profile(profile_id),
  closed_at             TIMESTAMPTZ,
  closed_by             UUID REFERENCES profile(profile_id),

  -- Sign-off data
  signoff_notes         TEXT,
  handoff_notes         TEXT,

  -- Metrics (populated during/after session)
  planned_shifts        INTEGER DEFAULT 0,
  actual_shifts         INTEGER DEFAULT 0,
  tasks_total           INTEGER DEFAULT 0,
  tasks_completed       INTEGER DEFAULT 0,

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One session per department per day
  CONSTRAINT uq_dept_session_date UNIQUE (workspace_id, department_id, session_date)
);

ALTER TABLE department_session ENABLE ROW LEVEL SECURITY;

-- JWT: workspace members can read
CREATE POLICY "jwt_read_department_session" ON department_session
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- JWT: admins can manage
CREATE POLICY "jwt_manage_department_session" ON department_session
FOR ALL USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM profile
    WHERE user_id = auth.uid() AND workspace_id = department_session.workspace_id
    AND role IN ('admin', 'owner')
  )
);

-- API key: read
CREATE POLICY "api_key_read_department_session" ON department_session
FOR SELECT USING (
  workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);

-- Service role: full access
CREATE POLICY "service_role_department_session" ON department_session
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_dept_session_date ON department_session (workspace_id, session_date DESC);
CREATE INDEX idx_dept_session_status ON department_session (workspace_id, status)
  WHERE status IN ('active', 'pending_signoff');

COMMENT ON TABLE department_session IS 'Daily operational container per department. One per dept per day.';
