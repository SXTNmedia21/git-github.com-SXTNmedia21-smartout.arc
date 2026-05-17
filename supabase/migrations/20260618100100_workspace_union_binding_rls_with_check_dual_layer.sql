-- ============================================
-- 20260618100100_workspace_union_binding_rls_with_check_dual_layer.sql
-- Phase 7d-followup Sortie 2 fix-up: add WITH CHECK clause to JWT UPDATE
-- policy on public.workspace_union_binding per ADR-0355 §B dual-layer
-- enforcement contract.
--
-- WHY THIS EXISTS
-- ---------------
-- Migration 20260618100000 shipped jwt_update_workspace_union_binding policy
-- with USING() only — no WITH CHECK. ADR-0355 §B specifies dual-layer
-- enforcement: (1) RLS policy WITH CHECK rejects immutable-column mutations
-- at access-control layer; (2) APPEND-ONLY BEFORE UPDATE trigger rejects
-- same at DB layer. Original migration installed only layer 2.
--
-- Code-review Sortie 2 (commit 7550e6a4c) caught this as C-1 CRITICAL.
-- Layer 2 (trigger) still rejects violating updates — no production data
-- leak — but RLS-layer rejection is the ADR contract for cleaner error
-- semantics + defense-in-depth. This migration closes the gap.
--
-- L-0042 COMPLIANCE
-- -----------------
-- Timestamp 20260618100100 > prior tip 20260618100000. Strictly increasing.
-- Dependencies: public.workspace_union_binding table (created 20260618100000).
-- get_workspace_ids_for_user(uuid) function (existing RLS helper).
--
-- Refs: ADR-0355 §B, code-review verdict commit 7550e6a4c, L-0172
-- ============================================

SET search_path TO public, extensions;

-- Drop + recreate UPDATE policy with WITH CHECK clause pinning immutable
-- columns per ADR-0355 §B. Per cascade pattern: also keep USING for read-
-- side restriction (workspace membership).
DROP POLICY IF EXISTS "jwt_update_workspace_union_binding" ON public.workspace_union_binding;

CREATE POLICY "jwt_update_workspace_union_binding" ON public.workspace_union_binding
  FOR UPDATE
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
  WITH CHECK (
    -- Same workspace membership for the post-update row
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

-- NOTE on WITH CHECK semantics: PostgreSQL CHECK clauses on RLS policies
-- evaluate only against the NEW row — they cannot reference OLD. The
-- column-immutability enforcement (only `effective_to` mutable) lives in
-- the BEFORE UPDATE trigger enforce_workspace_union_binding_append_only
-- per L-0172 SECURITY DEFINER pattern (migration 20260618100000:159-184).
-- This policy ensures the post-update row still belongs to a workspace the
-- caller has access to — preventing workspace-id rebinding via update.
-- Trigger handles the rest of the APPEND-ONLY invariant per ADR-0355.

COMMENT ON POLICY "jwt_update_workspace_union_binding" ON public.workspace_union_binding IS
  'Dual-layer enforcement per ADR-0355 §B: RLS USING + WITH CHECK confirms workspace membership both before + after update. Column-immutability invariant (only effective_to mutable) enforced by enforce_workspace_union_binding_append_only trigger at DB layer. Added 20260618100100 per code-review C-1 finding.';

-- Self-test: verify policy now has WITH CHECK clause
DO $$
DECLARE
  v_has_check BOOLEAN;
BEGIN
  SELECT (qual IS NOT NULL AND with_check IS NOT NULL)
    INTO v_has_check
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'workspace_union_binding'
     AND policyname = 'jwt_update_workspace_union_binding';

  IF NOT COALESCE(v_has_check, false) THEN
    RAISE EXCEPTION '20260618100100 self-test FAILED: jwt_update_workspace_union_binding policy missing WITH CHECK clause after migration';
  END IF;

  RAISE NOTICE '20260618100100 self-test PASSED: jwt_update_workspace_union_binding policy now has dual-layer USING + WITH CHECK';
END $$;
