-- Migration: 20260413100000_fix_company_org_number_nullable.sql
-- Description: Make org_number nullable on company table.
-- During onboarding, provision_onboarding_workspace creates the company before
-- the org number is known (discovered via Brreg in the intelligence pipeline).
-- The org number is set later in finalize_onboarding_workspace.

ALTER TABLE public.company ALTER COLUMN org_number DROP NOT NULL;
