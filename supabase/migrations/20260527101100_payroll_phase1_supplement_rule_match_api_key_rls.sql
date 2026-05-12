-- 20260527101100_payroll_phase1_supplement_rule_match_api_key_rls.sql
-- FIX-1 (CRITICAL): Add api_key_read policy to public.supplement_rule_match.
--
-- Problem: supplement_rule has both jwt_read + api_key_read policies (seeded in
-- 20260527100600). supplement_rule_match has ONLY jwt_read.
-- CLAUDE.md mandates dual-auth for all workspace-scoped tables.
-- Calc engine routes through workspace-api gateway (API key auth) and will get
-- zero rows on supplement_rule_match reads, silently breaking the audit trail.
--
-- Source authority: CLAUDE.md dual-auth mandate, DYNAMIC-SUPPLEMENTS.md §5, ADR-0250.

SET search_path TO public, extensions;

DROP POLICY IF EXISTS "api_key_read_supplement_rule_match" ON public.supplement_rule_match;

CREATE POLICY "api_key_read_supplement_rule_match" ON public.supplement_rule_match
  FOR SELECT USING (workspace_id = get_api_workspace_id());

COMMENT ON POLICY "api_key_read_supplement_rule_match" ON public.supplement_rule_match IS
  'Dual-auth: API key path mirrors jwt_read for the workspace-api gateway. '
  'CLAUDE.md mandate: every workspace-scoped table needs both auth paths. '
  'Calc engine uses API key auth when reading supplement_rule_match during evaluation.';
