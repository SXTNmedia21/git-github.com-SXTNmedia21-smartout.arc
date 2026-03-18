-- HACCP log table for compliance temperature logging.
-- Legal requirement for food service: all temperature checks must have an audit trail.
-- Inserted via mobile app task modal when task_type = 'haccp'.

CREATE TABLE IF NOT EXISTS public.haccp_log (
  haccp_log_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.workspace(workspace_id),
  session_id        UUID REFERENCES public.department_session(department_session_id),
  profile_id        UUID NOT NULL REFERENCES public.profile(profile_id),
  ccp_reference     TEXT NOT NULL,       -- Human label: "Kjøleskap A", "Fryser 2"
  equipment_id      UUID REFERENCES public.asset(asset_id),
  temperature       NUMERIC(5,2) NOT NULL,
  unit              TEXT NOT NULL DEFAULT '°C',
  is_within_range   BOOLEAN NOT NULL,
  corrective_action TEXT,                -- Required when is_within_range = false
  logged_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.haccp_log IS 'HACCP compliance temperature logs. Legal requirement — immutable audit trail. Module: operations/compliance.';
COMMENT ON COLUMN public.haccp_log.ccp_reference IS 'Human-readable label for the critical control point, e.g. "Kjøleskap A"';
COMMENT ON COLUMN public.haccp_log.corrective_action IS 'Required corrective action when temperature is out of range';

-- ── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_haccp_log_workspace_logged
  ON public.haccp_log (workspace_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_haccp_log_session
  ON public.haccp_log (session_id) WHERE session_id IS NOT NULL;

-- ── updated_at trigger ──────────────────────────────────────────
CREATE TRIGGER trg_haccp_log_updated_at
  BEFORE UPDATE ON public.haccp_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.haccp_log ENABLE ROW LEVEL SECURITY;

-- JWT: users can read logs in their workspaces
CREATE POLICY "jwt_read_haccp_log" ON public.haccp_log
  FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid())));

-- JWT: employees can insert logs in their workspaces
CREATE POLICY "jwt_insert_haccp_log" ON public.haccp_log
  FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM public.profile
      WHERE user_id = auth.uid()
    )
    AND workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  );

-- API key: workspace-scoped read
CREATE POLICY "api_key_read_haccp_log" ON public.haccp_log
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());
