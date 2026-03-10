-- Make company_id nullable on contract table.
-- During onboarding, contracts are created BEFORE the workspace is finalized,
-- so the company may not exist yet. company_id is linked at finalization.
ALTER TABLE contract ALTER COLUMN company_id DROP NOT NULL;
