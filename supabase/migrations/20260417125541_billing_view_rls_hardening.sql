SET search_path TO public, extensions;

-- ============================================
-- 20260417125541_billing_view_rls_hardening.sql
-- Billing Engine Fase 1 — B1 council fix (Code-reviewer critical #2)
--
-- Problem:
--   v_current_plan_preview (Task 1.8) was created with default GRANTs —
--   anon + authenticated roles had full access. The view queries
--   company + workspace + pricing_terms + schedule_shift and emits
--   rows for EVERY company × workspace. Underlying-table RLS may not
--   line up with the view's caller, so an authenticated user from
--   company A could receive rows describing company B's plan data
--   by querying the view directly.
--
-- Fix (Option B, per verdict doc):
--   Revoke SELECT from anon + authenticated + PUBLIC. Keep service_role
--   + postgres GRANTs. Billing UI consumers (platform-admin today;
--   workspace-admin in Phase 9) must read through Server Actions that
--   use createAdminClient() and apply their own company-scoped filters.
--
-- Similar hardening applied to v_invoice_dunning_notes as belt-and-suspenders
-- — it already inherits RLS transparency from billing_activity_log, but
-- revoking authenticated eliminates any query surface that could bypass
-- the policy via a view-path bug.
--
-- get_invoice_basis() keeps its EXECUTE grant to authenticated — Phase 7
-- Server Actions will wrap it and apply RLS/authorization before returning
-- data to the browser.
-- ============================================

REVOKE ALL ON public.v_current_plan_preview FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_current_plan_preview TO service_role, postgres;

REVOKE ALL ON public.v_invoice_dunning_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_invoice_dunning_notes TO service_role, postgres;

COMMENT ON VIEW public.v_current_plan_preview IS
  'Company + workspace + currently-effective pricing_terms + current-month active-user count. Active users counted per ADR-0119 predicate (completed shifts with employee_id).
SECURITY: service_role + postgres only (no anon/authenticated SELECT). Callers must go through Server Actions that use createAdminClient() and apply explicit company_id filters. Revoked 2026-04-17 per B1 council code-reviewer critical #2.';

COMMENT ON VIEW public.v_invoice_dunning_notes IS
  'Dunning notes sourced from billing_activity_log (ADR-0125). Direct authenticated access revoked — read via Server Actions that resolve company_id from request context. The underlying table has RLS scoped to is_admin_in_company, but view-level access restriction is belt-and-suspenders.';
