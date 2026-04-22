-- ============================================
-- 20260515170100_fix_is_admin_in_workspace_signature.sql
--
-- Unifies `is_admin_in_workspace` call sites to the single canonical
-- signature (uid uuid, wid uuid) defined in 00004_rls_policies.sql.
--
-- Bug (council 2026-04-22, Gate G1):
--   Two RLS policies in 20260228140000_contract_system_foundation.sql
--   called the function with inverted arguments:
--
--     is_admin_in_workspace(workspace_id, auth.uid())  -- WRONG
--
--   instead of the canonical:
--
--     is_admin_in_workspace(auth.uid(), workspace_id)  -- CORRECT
--
--   Because both parameters are `uuid`, Postgres resolved the call to the
--   same function, but the inverted order made the predicate evaluate
--   against the wrong columns. The function body checks:
--     SELECT 1 FROM public.profile
--     WHERE user_id = uid AND workspace_id = wid ...
--   so with inverted args it searches for a profile where
--   `user_id = <workspace-uuid>` — which never matches. Result: workspace
--   admins were silently blocked from managing contract_template / contract
--   rows under RLS, and callers with service-role keys masked the bug.
--
-- Scope:
--   - Drops and recreates the two affected policies with correct argument
--     order. No schema changes, no function changes, no data changes.
--   - The canonical function (public.is_admin_in_workspace(uid uuid,
--     wid uuid)) is the single existing signature — no overload cleanup
--     is needed. A pgTAP test locks in the "exactly one signature"
--     invariant.
--
-- Refs:
--   - 00004_rls_policies.sql:33 (canonical function definition)
--   - 20260228140000_contract_system_foundation.sql:204,217 (buggy calls)
--   - supabase/tests/pgtap/is_admin_in_workspace_unique.sql (invariant)
-- ============================================

BEGIN;

-- ── contract_template: admin-manage policy ──────────────────────
-- Re-created with canonical (auth.uid(), workspace_id) ordering.
DROP POLICY IF EXISTS "Admins can manage workspace templates"
  ON public.contract_template;

CREATE POLICY "Admins can manage workspace templates"
  ON public.contract_template
  FOR ALL
  USING (public.is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (public.is_admin_in_workspace(auth.uid(), workspace_id));

-- ── contract: admin-manage policy ──────────────────────
-- Re-created with canonical (auth.uid(), workspace_id) ordering.
DROP POLICY IF EXISTS "Admins can manage workspace contracts"
  ON public.contract;

CREATE POLICY "Admins can manage workspace contracts"
  ON public.contract
  FOR ALL
  USING (public.is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (public.is_admin_in_workspace(auth.uid(), workspace_id));

-- ── Invariant check ──────────────────────
-- Exactly one function named `is_admin_in_workspace` must exist, with
-- signature (uid uuid, wid uuid). Fail the migration loudly if violated.
DO $$
DECLARE
  v_count int;
  v_args  text;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'is_admin_in_workspace'
    AND n.nspname = 'public';

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly 1 public.is_admin_in_workspace function, found %',
      v_count;
  END IF;

  SELECT pg_get_function_identity_arguments(p.oid) INTO v_args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'is_admin_in_workspace'
    AND n.nspname = 'public';

  IF v_args <> 'uid uuid, wid uuid' THEN
    RAISE EXCEPTION
      'Canonical signature is_admin_in_workspace(uid uuid, wid uuid) violated; got (%)',
      v_args;
  END IF;
END$$;

COMMIT;
