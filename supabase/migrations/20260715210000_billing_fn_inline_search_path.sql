SET search_path TO public, extensions;

-- ============================================
-- 20260715210000_billing_fn_inline_search_path.sql
-- Security hardening — inline SET search_path on SECURITY DEFINER billing
-- functions.
--
-- Source: ADR-contract audit smoke 2026-05-25 (db-rls slice, 2 HIGH).
--
-- Problem: fn_generate_company_invoice + fn_check_billing_run are
-- SECURITY DEFINER but only set `SET search_path TO public, extensions` at
-- migration session level (line 1 of their original migration). In
-- PostgreSQL, session-level SET does NOT lock the search path during
-- SECURITY DEFINER function execution — a caller with the ability to
-- prepend their own search_path can intercept unqualified table/function
-- references inside the body.
--
-- Fix: re-define both functions with the `SET search_path = public,
-- extensions` clause as a function attribute (between `LANGUAGE` and
-- the body). This binds the search path to the function regardless of
-- the caller's session state.
--
-- ALTER FUNCTION ... SET search_path is the in-place equivalent and
-- avoids body re-definition. Pattern matches the
-- 20260301120000_rename_is_super_admin_to_is_godmode migration approach
-- (recreate policies, don't recreate function bodies).
-- ============================================

-- fn_generate_company_invoice — atomic invoice RPC (20260621200000)
ALTER FUNCTION public.fn_generate_company_invoice(
  uuid, date, date, uuid, numeric, numeric, numeric, numeric, text, date, jsonb
) SET search_path = public, extensions;

-- fn_check_billing_run — billing-run state check (20260621200002)
ALTER FUNCTION public.fn_check_billing_run()
SET search_path = public, extensions;

COMMENT ON FUNCTION public.fn_generate_company_invoice(
  uuid, date, date, uuid, numeric, numeric, numeric, numeric, text, date, jsonb
) IS
  'Atomic invoice draft → line items → issued status (ADR-0120). SECURITY DEFINER with inline SET search_path locked to public,extensions (audit 2026-05-25).';

COMMENT ON FUNCTION public.fn_check_billing_run() IS
  'Billing-run gate (ADR-0125, platform-scoped). SECURITY DEFINER with inline SET search_path locked to public,extensions (audit 2026-05-25).';
