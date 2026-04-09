-- ADR-0076: Contract Composition Engine
-- Adds 'declined' status for when an employee declines data intake or contract signing.
-- Must be a separate migration from 'pending_data' because PostgreSQL requires
-- each ADD VALUE to be in its own transaction.

ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'declined';
