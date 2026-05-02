-- ============================================================================
-- 20260521000000_billing_schema_create.sql
--
-- Creates the dedicated `billing` schema.
-- New objects (accountant_company_grant table, helpers, view) live here.
-- Existing invoice/payment/company tables stay in `public` per ADR-0118.
-- Mirrors pattern used by payroll (20260422110700), timesheet (20260324090000),
-- websites (20260322100000) schemas.
--
-- ADR-A (2026-05-02): billing schema for accountant cross-company access.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS billing;

-- Grant usage so authenticated clients can reference billing objects.
-- Row-level access is still controlled by RLS on individual tables/functions.
GRANT USAGE ON SCHEMA billing TO authenticated;
GRANT USAGE ON SCHEMA billing TO anon;
GRANT USAGE ON SCHEMA billing TO service_role;

COMMENT ON SCHEMA billing IS
  'Accountant access + grunnfaktura tooling (admin.smartout.ai). ADR-A 2026-05-02. '
  'Invoice/payment tables stay in public per ADR-0118.';
