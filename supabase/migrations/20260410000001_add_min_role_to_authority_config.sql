-- Add min_role to engine_authority_config
-- Controls the minimum profile role required to use a capability at the configured level.
-- Default 'employee' preserves existing behavior (all roles have access).

ALTER TABLE public.engine_authority_config
  ADD COLUMN min_role text NOT NULL DEFAULT 'employee'
  CHECK (min_role IN ('employee', 'manager', 'admin', 'owner'));

COMMENT ON COLUMN public.engine_authority_config.min_role IS
  'Minimum profile role required to use this capability at the configured authority level. '
  'Profiles with lower roles get downgraded to suggest level regardless of workspace config.';
