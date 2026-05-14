-- Migration: 20260615120000_wfm_foundation_rls_hotfix.sql
-- ADR-0313 sister-sweep #2 — per-verb service_role policy refactor
--
-- Scope: 2 tables from 20260611120000_wfm_foundation.sql that shipped
--        `FOR ALL USING (auth.role() = 'service_role')` write policies.
--        ADR-0313 (D6 RLS WITH CHECK Invariants) mandates per-verb split:
--        INSERT (WITH CHECK only) / UPDATE (USING + WITH CHECK) / DELETE (USING only).
--
-- Tables refactored:
--   1. public.pos_account         — drops "service_role_write_pos_account"    FOR ALL
--   2. public.schedule_shift_offer — drops "service_role_write_schedule_shift_offer" FOR ALL
--
-- Table skipped (already compliant):
--   - public.pos_sale_event — "service_role_insert_pos_sale_event" is FOR INSERT WITH CHECK only.
--                             No FOR ALL policy exists. No change needed.
--
-- References:
--   ADR-0313 — canonical per-verb policy pattern (this migration)
--   ADR-0303 — sister-table sweep rule (mandate for this migration)
--   20260611120000_wfm_foundation.sql — original foundation migration

-- ============================================================
-- TABLE: public.pos_account
-- ============================================================

-- Drop the FOR ALL policy
DROP POLICY IF EXISTS "service_role_write_pos_account" ON public.pos_account;

-- INSERT: no old-row state; WITH CHECK only
CREATE POLICY "service_role_insert_pos_account" ON public.pos_account
  FOR INSERT TO service_role
  WITH CHECK (auth.role() = 'service_role');

-- UPDATE: symmetric USING = WITH CHECK (cross-workspace forgery defense per ADR-0313 Invariant 2)
CREATE POLICY "service_role_update_pos_account" ON public.pos_account
  FOR UPDATE TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- DELETE: no new-row state; USING only
CREATE POLICY "service_role_delete_pos_account" ON public.pos_account
  FOR DELETE TO service_role
  USING (auth.role() = 'service_role');

-- ============================================================
-- TABLE: public.schedule_shift_offer
-- ============================================================

-- Drop the FOR ALL policy
DROP POLICY IF EXISTS "service_role_write_schedule_shift_offer" ON public.schedule_shift_offer;

-- INSERT: no old-row state; WITH CHECK only
CREATE POLICY "service_role_insert_schedule_shift_offer" ON public.schedule_shift_offer
  FOR INSERT TO service_role
  WITH CHECK (auth.role() = 'service_role');

-- UPDATE: symmetric USING = WITH CHECK (cross-workspace forgery defense per ADR-0313 Invariant 2)
CREATE POLICY "service_role_update_schedule_shift_offer" ON public.schedule_shift_offer
  FOR UPDATE TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- DELETE: no new-row state; USING only
CREATE POLICY "service_role_delete_schedule_shift_offer" ON public.schedule_shift_offer
  FOR DELETE TO service_role
  USING (auth.role() = 'service_role');
