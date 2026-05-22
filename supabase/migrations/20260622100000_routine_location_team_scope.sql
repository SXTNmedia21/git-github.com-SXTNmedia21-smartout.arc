-- 20260622100000_routine_location_team_scope.sql
-- Procedure Engine Phase 1: routine scoping by location + team(0..N) + executor.
-- Spec: docs/superpowers/specs/2026-05-22-procedure-engine-design.md §2.3, §3
--
-- PRE-FLIGHT VERIFIED (2026-05-22):
--   public.routine PK = routine_id, protocol FK = protocol_id (CONSTRAINT fk_routine_protocol)
--   public.location PK = location_id
--   public.team PK = team_id
--   public.workspace PK = workspace_id
--   helpers: get_workspace_ids_for_user(uid), is_admin_in_workspace(uid, wid), get_api_workspace_id()
--   is_admin_in_workspace takes TWO args (uid uuid, wid uuid) — policy uses auth.uid() + workspace_id

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'routine_executor_type') THEN
    CREATE TYPE routine_executor_type AS ENUM ('human', 'ai', 'system', 'hybrid');
  END IF;
END $$;

ALTER TABLE public.routine
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.location(location_id),
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspace(workspace_id),
  ADD COLUMN IF NOT EXISTS executor_type routine_executor_type NOT NULL DEFAULT 'human';

CREATE OR REPLACE FUNCTION public.set_routine_workspace_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.protocol WHERE protocol_id = NEW.protocol_id;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_set_routine_workspace_id ON public.routine;
CREATE TRIGGER trg_set_routine_workspace_id
  BEFORE INSERT OR UPDATE ON public.routine
  FOR EACH ROW EXECUTE FUNCTION public.set_routine_workspace_id();

UPDATE public.routine r SET workspace_id = p.workspace_id
  FROM public.protocol p WHERE r.protocol_id = p.protocol_id AND r.workspace_id IS NULL;

CREATE TABLE IF NOT EXISTS public.routine_team (
  routine_id uuid NOT NULL REFERENCES public.routine(routine_id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.team(team_id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (routine_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_routine_team_routine ON public.routine_team(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_team_workspace ON public.routine_team(workspace_id);

ALTER TABLE public.routine_team ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "jwt_read_routine_team" ON public.routine_team;
CREATE POLICY "jwt_read_routine_team" ON public.routine_team FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
DROP POLICY IF EXISTS "jwt_manage_routine_team" ON public.routine_team;
-- ADAPTED: is_admin_in_workspace(uid, wid) -- two-arg signature (verified in 00004_rls_policies.sql)
CREATE POLICY "jwt_manage_routine_team" ON public.routine_team FOR ALL
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "api_key_read_routine_team" ON public.routine_team;
CREATE POLICY "api_key_read_routine_team" ON public.routine_team FOR SELECT
  USING (workspace_id = get_api_workspace_id());
DROP POLICY IF EXISTS "service_role_routine_team" ON public.routine_team;
CREATE POLICY "service_role_routine_team" ON public.routine_team FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_routine_location ON public.routine(location_id) WHERE location_id IS NOT NULL;
