-- RPC to compute readiness scores per profile in a workspace.
-- Joins protocol_assignment through profile to scope by workspace
-- (protocol_assignment is not directly workspace-scoped).
CREATE OR REPLACE FUNCTION public.get_workspace_readiness(p_workspace_id uuid)
RETURNS TABLE(profile_id uuid, total bigint, completed bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.profile_id,
    COUNT(pa.assignment_id) AS total,
    COUNT(pa.assignment_id) FILTER (WHERE pa.status = 'completed') AS completed
  FROM public.profile p
  JOIN public.protocol_assignment pa ON pa.profile_id = p.profile_id
  WHERE p.workspace_id = p_workspace_id
  GROUP BY p.profile_id;
$$;

COMMENT ON FUNCTION public.get_workspace_readiness(uuid)
  IS 'Returns readiness stats (total/completed protocol assignments) per profile in a workspace.';
