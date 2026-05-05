-- ============================================
-- 20260520110050_heartbeat_pickup_rpc.sql
-- Phase 0 (Crown) — atomic heartbeat pickup.
-- Combines SELECT FOR UPDATE SKIP LOCKED + UPDATE + pg_notify in one
-- transaction to eliminate the SELECT/UPDATE race window.
-- See docs/superpowers/plans/2026-04-29-arena-harness-phase-0-crown.md Task 3.
-- ============================================

CREATE OR REPLACE FUNCTION public.heartbeat_pickup(p_limit int DEFAULT 50)
RETURNS TABLE(id uuid, mission_id text, workspace_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    UPDATE public.engine_state es
    SET status = 'pending',
        dispatch_lock_id = gen_random_uuid(),
        updated_at = now()
    WHERE es.id IN (
      SELECT inner_es.id
      FROM public.engine_state inner_es
      WHERE inner_es.status = 'scheduled'
        AND inner_es.scheduled_for <= now()
      ORDER BY inner_es.scheduled_for ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    )
    RETURNING es.id, es.mission_id, es.workspace_id
  LOOP
    PERFORM pg_notify(
      'mission_dispatch',
      json_build_object(
        'engine_state_id', r.id,
        'mission_id', r.mission_id,
        'workspace_id', r.workspace_id
      )::text
    );
    id := r.id;
    mission_id := r.mission_id;
    workspace_id := r.workspace_id;
    RETURN NEXT;
  END LOOP;
END $$;

-- Supabase auto-grants EXECUTE to anon + authenticated on function creation.
-- Revoke from PUBLIC (covers all roles) then re-grant only to service_role.
-- PUBLIC revoke alone is insufficient on Supabase Local — explicit role revokes required.
REVOKE ALL ON FUNCTION public.heartbeat_pickup(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.heartbeat_pickup(int) FROM anon;
REVOKE ALL ON FUNCTION public.heartbeat_pickup(int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_pickup(int) TO service_role;
