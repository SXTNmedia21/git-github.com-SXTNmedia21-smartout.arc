-- M5.4 / ADR-0200 — prevents concurrent activate_season RPCs from leaving
-- a workspace with 2 active seasons. Second concurrent RPC fails with 23505,
-- Server Action surfaces as rpc_error. Atomicity promise holds across
-- concurrent transactions.
--
-- Source: 2026-04-23 post-implementation council (harness C4 blocker).

CREATE UNIQUE INDEX IF NOT EXISTS season_one_active_per_workspace
  ON public.season (workspace_id)
  WHERE status = 'active';

COMMENT ON INDEX public.season_one_active_per_workspace IS
  'ADR-0200 / M5.4 — prevents concurrent activations leaving a workspace with 2 active seasons. Second concurrent RPC fails with 23505 (unique violation).';
