SET search_path TO public, extensions;

-- ============================================
-- 20260412100300_session_infrastructure.sql
-- Operational session management tables:
--   session_hook — time-triggered actions per department
--   session_task — tasks within a department_session
--   session_note — handoff/closing/general notes
-- Depends on: 20260412100000_session_enums.sql
-- Source: Module Zero to Production — Week 2
-- ============================================

-- ── session_hook ─────────────────────────────────────────────
-- Configurable hooks that fire procedures/routines at session lifecycle points.
CREATE TABLE IF NOT EXISTS public.session_hook (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id         UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  hook_type             session_hook_type NOT NULL,
  trigger_offset_min    INTEGER NOT NULL DEFAULT 0,
  repeat_interval_min   INTEGER,
  linked_procedure_id   UUID REFERENCES procedure(procedure_id),
  linked_routine_id     UUID REFERENCES routine(routine_id),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE session_hook ENABLE ROW LEVEL SECURITY;

-- JWT: workspace members can read
DROP POLICY IF EXISTS "jwt_read_session_hook" ON session_hook;
CREATE POLICY "jwt_read_session_hook" ON session_hook
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- JWT: admins can manage
DROP POLICY IF EXISTS "jwt_manage_session_hook" ON session_hook;
CREATE POLICY "jwt_manage_session_hook" ON session_hook
FOR ALL USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.profile
    WHERE user_id = auth.uid() AND workspace_id = session_hook.workspace_id
    AND role IN ('admin', 'owner')
  )
);

-- Service role: full access
DROP POLICY IF EXISTS "service_role_session_hook" ON session_hook;
CREATE POLICY "service_role_session_hook" ON session_hook
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_session_hook_dept_type
  ON session_hook (department_id, hook_type)
  WHERE is_active = true;

CREATE TRIGGER set_session_hook_updated_at
  BEFORE UPDATE ON public.session_hook
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE session_hook IS 'Time-triggered actions per department at session lifecycle points (pre_open, open, etc.).';

-- ── session_task ─────────────────────────────────────────────
-- Tasks spawned within a department_session, optionally from a hook.
CREATE TABLE IF NOT EXISTS public.session_task (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_session_id UUID NOT NULL REFERENCES department_session(department_session_id) ON DELETE CASCADE,
  session_hook_id       UUID REFERENCES session_hook(id),
  title                 TEXT NOT NULL,
  description           TEXT,
  status                session_task_status NOT NULL DEFAULT 'pending',
  assigned_to           UUID REFERENCES profile(profile_id),
  completed_by          UUID REFERENCES profile(profile_id),
  completed_at          TIMESTAMPTZ,
  evidence              JSONB,
  is_compliance_required BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE session_task ENABLE ROW LEVEL SECURITY;

-- JWT: workspace members can read
DROP POLICY IF EXISTS "jwt_read_session_task" ON session_task;
CREATE POLICY "jwt_read_session_task" ON session_task
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- JWT: workspace members can update (employees completing tasks)
DROP POLICY IF EXISTS "jwt_update_session_task" ON session_task;
CREATE POLICY "jwt_update_session_task" ON session_task
FOR UPDATE USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- Service role: full access
DROP POLICY IF EXISTS "service_role_session_task" ON session_task;
CREATE POLICY "service_role_session_task" ON session_task
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_session_task_session_status
  ON session_task (department_session_id, status);

CREATE INDEX IF NOT EXISTS idx_session_task_assigned_active
  ON session_task (assigned_to, status)
  WHERE status IN ('pending', 'available', 'in_progress');

CREATE TRIGGER set_session_task_updated_at
  BEFORE UPDATE ON public.session_task
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE session_task IS 'Tasks within a department session. Can be hook-triggered or manually created.';

-- ── session_note ─────────────────────────────────────────────
-- Notes attached to department sessions (handoff, closing, general).
CREATE TABLE IF NOT EXISTS public.session_note (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_session_id UUID NOT NULL REFERENCES department_session(department_session_id) ON DELETE CASCADE,
  note_type             session_note_type NOT NULL DEFAULT 'general',
  content               TEXT NOT NULL,
  created_by            UUID NOT NULL REFERENCES profile(profile_id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE session_note ENABLE ROW LEVEL SECURITY;

-- JWT: workspace members can read
DROP POLICY IF EXISTS "jwt_read_session_note" ON session_note;
CREATE POLICY "jwt_read_session_note" ON session_note
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- JWT: workspace members can insert
DROP POLICY IF EXISTS "jwt_insert_session_note" ON session_note;
CREATE POLICY "jwt_insert_session_note" ON session_note
FOR INSERT WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- Service role: full access
DROP POLICY IF EXISTS "service_role_session_note" ON session_note;
CREATE POLICY "service_role_session_note" ON session_note
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_session_note_session
  ON session_note (department_session_id);

COMMENT ON TABLE session_note IS 'Notes on department sessions. Types: handoff (shift change), closing (end of day), general.';
