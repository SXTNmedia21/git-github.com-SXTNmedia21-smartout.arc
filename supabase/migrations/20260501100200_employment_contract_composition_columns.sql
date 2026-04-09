-- ADR-0076 + ADR-0080 + ADR-0082: Contract Composition Engine columns
-- Extends employment_contract with composition-specific fields:
--   framework_snapshot  — immutable copy of framework rules at send time (ADR-0080)
--   compliance_overrides — admin-acknowledged tariff deviations with provenance
--   parent_contract_id  — version chain linking revised contracts (ADR-0082)
--   decline_reason_code — machine-readable decline reason
--   decline_reason_text — free-text decline explanation from employee

-- Immutable snapshot of framework_rule rows at composition/send time (ADR-0080).
-- Enables compliance drift detection without relying on mutable framework_rule table.
ALTER TABLE public.employment_contract
  ADD COLUMN IF NOT EXISTS framework_snapshot JSONB;

COMMENT ON COLUMN public.employment_contract.framework_snapshot IS
  'Immutable snapshot of framework_rule rows at send time. Used for compliance drift detection (ADR-0080).';

-- Admin-acknowledged tariff deviations with provenance metadata.
-- Each element: { rule_code, acknowledged_by, acknowledged_at, reason }.
ALTER TABLE public.employment_contract
  ADD COLUMN IF NOT EXISTS compliance_overrides JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.employment_contract.compliance_overrides IS
  'Admin-acknowledged tariff deviations with provenance. Array of { rule_code, acknowledged_by, acknowledged_at, reason }.';

-- Version chain: links a revised contract to its predecessor (ADR-0082).
ALTER TABLE public.employment_contract
  ADD COLUMN IF NOT EXISTS parent_contract_id UUID REFERENCES public.employment_contract(contract_id);

COMMENT ON COLUMN public.employment_contract.parent_contract_id IS
  'References the previous version of this contract in the version chain (ADR-0082).';

-- Partial index for version chain lookups — only index rows that have a parent.
CREATE INDEX IF NOT EXISTS idx_employment_contract_parent
  ON public.employment_contract(parent_contract_id)
  WHERE parent_contract_id IS NOT NULL;

-- Machine-readable decline reason code (e.g. 'data_refused', 'terms_rejected').
ALTER TABLE public.employment_contract
  ADD COLUMN IF NOT EXISTS decline_reason_code TEXT;

COMMENT ON COLUMN public.employment_contract.decline_reason_code IS
  'Machine-readable decline reason code (e.g. data_refused, terms_rejected).';

-- Free-text decline explanation provided by the employee.
ALTER TABLE public.employment_contract
  ADD COLUMN IF NOT EXISTS decline_reason_text TEXT;

COMMENT ON COLUMN public.employment_contract.decline_reason_text IS
  'Free-text decline explanation provided by the employee.';
