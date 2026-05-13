-- migrations/20260607100000_task_capability_authority_seed.sql
-- ADR-0298 Sortie 3. Seeds default authority for task capability.
--
-- Seeds engine_authority_config(capability='task', level='suggest') for every
-- workspace that has an active owner. Default 'suggest' means the AI can propose
-- task mutations but the user must confirm before they are written.
--
-- ON CONFLICT DO NOTHING: idempotent — safe to re-apply if row already exists
-- from a manual seed or future migration.
--
-- Pattern copied from 20260520100000_personal_task.sql lines 75-92,
-- changing capability 'personal' → 'task'.

INSERT INTO public.engine_authority_config (workspace_id, capability, level, updated_by)
SELECT
  w.workspace_id,
  'task',
  'suggest',
  (SELECT user_id FROM public.profile
   WHERE workspace_id = w.workspace_id AND role = 'owner' AND is_active = true
   LIMIT 1)
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_authority_config eac
  WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'task'
)
AND EXISTS (
  SELECT 1 FROM public.profile p
  WHERE p.workspace_id = w.workspace_id AND p.role = 'owner' AND p.is_active = true
)
ON CONFLICT (workspace_id, capability) DO NOTHING;
