-- ADR-0076: Contract Composition Engine
-- Adds 'pending_data' status for contracts awaiting employee data intake.
-- The composition engine places contracts in this state when employee PII
-- (identity, banking, address) is still required before the contract can be finalized.

ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'pending_data';
