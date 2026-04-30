-- personal_task: per-profile personal todo items created via Mr. Botsson voice/chat.
--
-- Schema decision rationale (feat/botsson-personal-tools):
--   - NOT session_task: that is D6 production (department_session owned, ops-facing).
--   - NOT engine_state_step: those track process-engine steps, not personal todos.
--   - NOT engine_memory with memory_type='task': engine_memory has no due_at, priority,
--     or status lifecycle. Using it for tasks would corrupt the memory retrieval pipeline.
--   - NEW TABLE personal_task: lightest correct model. Owner-only RLS, workspace_id for
--     scoping and RLS helper reuse, profile_id for identity. Statuses mirror a minimal
--     todo lifecycle: open → done | cancelled.
--
-- Authority: no engine_authority_config row needed for this table — the personal
-- capability tools write via service_role (stage-engine path), checked by gate_action.

CREATE TABLE IF NOT EXISTS public.personal_task (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  due_at          TIMESTAMPTZ,
  priority        TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'done', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER set_personal_task_updated_at
  BEFORE UPDATE ON public.personal_task
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_personal_task_profile_status
  ON public.personal_task (profile_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_personal_task_workspace
  ON public.personal_task (workspace_id, profile_id);

-- RLS
ALTER TABLE public.personal_task ENABLE ROW LEVEL SECURITY;

-- JWT: owner can manage their own tasks
DROP POLICY IF EXISTS "jwt_own_personal_task" ON public.personal_task;
CREATE POLICY "jwt_own_personal_task" ON public.personal_task
  FOR ALL USING (
    profile_id IN (
      SELECT profile_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Service role: stage-engine writes via direct_admin pattern
DROP POLICY IF EXISTS "service_role_personal_task" ON public.personal_task;
CREATE POLICY "service_role_personal_task" ON public.personal_task
  FOR ALL USING (auth.role() = 'service_role');

-- API key read: workspace-scoped (manager oversight of tasks is a future concern —
-- kept conservative as read-only for now)
DROP POLICY IF EXISTS "api_key_read_personal_task" ON public.personal_task;
CREATE POLICY "api_key_read_personal_task" ON public.personal_task
  FOR SELECT USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
  );

COMMENT ON TABLE public.personal_task IS
  'Personal todo items created by Mr. Botsson (personal capability).
   Owner-only via JWT; service_role for stage-engine writes.
   Not to be confused with session_task (D6 production ops) or engine_state_step.';

-- Seed engine_authority_config for personal capability.
-- Default: suggest (mutations require user confirmation; reads are always allowed).
-- Works for all channels except voice for write mutations (capability-level guard).
INSERT INTO public.engine_authority_config (workspace_id, capability, level, updated_by)
SELECT
  w.workspace_id,
  'personal',
  'suggest',
  (SELECT user_id FROM public.profile
   WHERE workspace_id = w.workspace_id AND role = 'owner' AND is_active = true
   LIMIT 1)
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'personal'
)
AND EXISTS (
  SELECT 1 FROM public.profile p
  WHERE p.workspace_id = w.workspace_id AND p.role = 'owner' AND p.is_active = true
)
ON CONFLICT (workspace_id, capability) DO NOTHING;
