-- ============================================
-- 20260421100000_cascade_a1_extensions.sql
-- Enable btree_gist for EXCLUDE USING gist constraints
-- Required by: planning_cycle, tariff_rate_table, employee_payroll_profile
-- ============================================

CREATE EXTENSION IF NOT EXISTS btree_gist SCHEMA extensions;

COMMENT ON EXTENSION btree_gist IS 'Cascade: enables EXCLUDE USING gist for overlap prevention on planning_cycle, tariff_rate_table, employee_payroll_profile';
