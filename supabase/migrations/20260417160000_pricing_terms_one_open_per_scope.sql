SET search_path TO public, extensions;

-- ============================================
-- 20260417160000_pricing_terms_one_open_per_scope.sql
-- Billing Engine Fase 1 B5 — code-reviewer important #2
--
-- Problem:
--   updatePricingTerms (Phase 7.6) does a close-then-insert in two
--   separate round-trips. If two platform-admin submits land at the
--   same time for the same (company, workspace) scope, both can
--   read the currently-active row before either commits its close,
--   then both close it and both insert a new row. The end state:
--   two rows with effective_until IS NULL for the same scope.
--
--   That poisons subsequent invoice generation — the active-row
--   lookup (.is("effective_until", null).order(...).limit(1)) picks
--   one of the two arbitrarily, and invoices generated during the
--   race could reference either row's pricing_terms_id.
--
-- Fix:
--   Unique partial index on (company_id, workspace_id) WHERE
--   effective_until IS NULL. The second concurrent INSERT fails at
--   the DB level with a 23505 (unique_violation), which
--   updatePricingTerms surfaces as an insert-failed error. The
--   admin retries after the race resolves.
--
-- NULL coalescing on workspace_id:
--   pricing_terms.workspace_id is nullable (company-wide terms have
--   workspace_id IS NULL, per-workspace overrides have a UUID).
--   Postgres treats NULLs as distinct by default, so the index below
--   correctly allows one open row for workspace_id=NULL and one open
--   row per non-NULL workspace_id within the same company. NULLS
--   NOT DISTINCT would be wrong here.
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_terms_one_open_per_scope
  ON public.pricing_terms (company_id, workspace_id)
  WHERE effective_until IS NULL;

COMMENT ON INDEX public.idx_pricing_terms_one_open_per_scope IS
  'Ensures at most one open-ended pricing_terms row per (company_id, workspace_id). Prevents the concurrent-submit race in updatePricingTerms Server Action (Phase 7.6). Added 2026-04-17 per B5 code-reviewer important #2.';
