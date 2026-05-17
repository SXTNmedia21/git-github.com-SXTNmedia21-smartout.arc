-- ============================================
-- 20260618210000_bind_workspace_union_atomic_rpc.sql
-- Phase 7d-followup Sortie 3 fix: atomic switch-flow RPC for
-- cascade.bind_workspace_union delegation tool per ADR-0356
-- §"Transaction shape".
--
-- WHY THIS EXISTS
-- ---------------
-- Sortie 3 cascade tool's switch flow ran UPDATE (close old binding's
-- effective_to) + INSERT (new active binding) as two sequential Supabase
-- client calls — no atomicity guarantee. Failure between UPDATE + INSERT
-- leaves workspace with zero active bindings. Code-review CRITICAL finding.
--
-- Fix: single SECURITY DEFINER RPC executes both DML in same transaction.
-- ATOMIC: either both succeed or both rollback.
--
-- L-0172 COMPLIANCE
-- -----------------
-- SECURITY DEFINER + SET search_path = public, extensions.
-- ============================================

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.bind_workspace_union_atomic(
  p_workspace_id            UUID,
  p_union_id                TEXT,
  p_law_version             TEXT,
  p_official_effective_date DATE,
  p_effective_from          DATE,
  p_created_by              UUID,
  p_amendment_classifier    TEXT,
  p_derivation_snapshot_id  UUID DEFAULT NULL
)
RETURNS TABLE (
  workspace_union_binding_id UUID,
  effective_from             DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_new_binding_id UUID;
  v_old_binding_id UUID;
BEGIN
  -- Step A: close existing active binding (if any).
  -- APPEND-ONLY invariant (ADR-0355 §B): only allowed UPDATE on
  -- workspace_union_binding is setting effective_to. The BEFORE UPDATE
  -- trigger (trg_workspace_union_binding_append_only) enforces this at DB
  -- level and survives service-role RLS bypass.
  SELECT b.workspace_union_binding_id INTO v_old_binding_id
    FROM public.workspace_union_binding b
   WHERE b.workspace_id = p_workspace_id
     AND b.effective_to IS NULL
   LIMIT 1;

  IF v_old_binding_id IS NOT NULL THEN
    UPDATE public.workspace_union_binding
       SET effective_to = p_effective_from - INTERVAL '1 day'
     WHERE workspace_union_binding_id = v_old_binding_id;
  END IF;

  -- Step B: insert new binding row.
  -- Cache trigger (trg_sync_workspace_settings_union_cache) fires AFTER
  -- INSERT automatically — updates payroll.workspace_settings
  -- (is_tariff_bound + active_union_id). No manual cache sync needed.
  INSERT INTO public.workspace_union_binding (
    workspace_id,
    union_id,
    law_version,
    official_effective_date,
    effective_from,
    effective_to,
    created_by,
    amendment_classifier,
    derivation_snapshot_id
  )
  VALUES (
    p_workspace_id,
    p_union_id,
    p_law_version,
    p_official_effective_date,
    p_effective_from,
    NULL,
    p_created_by,
    p_amendment_classifier,
    p_derivation_snapshot_id
  )
  RETURNING public.workspace_union_binding.workspace_union_binding_id
    INTO v_new_binding_id;

  -- Return new binding metadata (cache trigger fires automatically per Part E
  -- of 20260618100000_workspace_union_binding_and_tariff_floor.sql).
  RETURN QUERY
    SELECT v_new_binding_id, p_effective_from;
END;
$$;

COMMENT ON FUNCTION public.bind_workspace_union_atomic IS
  'Atomic switch-flow for cascade.bind_workspace_union delegation tool. '
  'Closes existing active binding + inserts new in single transaction per '
  'ADR-0356 §"Transaction shape". SECURITY DEFINER + locked search_path '
  'per L-0172. Called by packages/ai/src/capabilities/cascade/tools.ts.';

-- Grant execute to authenticated + service_role.
-- RLS on the underlying tables still applies via SECURITY DEFINER bypass
-- — function is trusted and performs its own workspace-scoping.
GRANT EXECUTE ON FUNCTION public.bind_workspace_union_atomic TO authenticated, service_role;

-- ─── Self-test ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_func_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM pg_proc p
     INNER JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname = 'public'
       AND p.proname = 'bind_workspace_union_atomic'
  ) INTO v_func_exists;

  IF NOT v_func_exists THEN
    RAISE EXCEPTION
      '20260618210000 self-test FAILED: bind_workspace_union_atomic RPC not created';
  END IF;

  RAISE NOTICE
    '20260618210000 self-test PASSED: bind_workspace_union_atomic RPC available';
END $$;
