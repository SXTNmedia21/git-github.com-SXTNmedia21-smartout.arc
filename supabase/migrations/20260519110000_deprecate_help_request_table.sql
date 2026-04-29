-- Migration: deprecate help_request table (ADR-0165)
-- Ticket submission surface now uses engine_state(process_id='helpdesk_query_lifecycle').
-- The help_request table is preserved for historical data but must not receive new rows.
-- All dashboard write paths have been removed as of 2026-04-28.
-- Drop candidate: after all legacy rows are reviewed and archived (separate exercise).

COMMENT ON TABLE help_request IS 'DEPRECATED 2026-04-28 per ADR-0165. New tickets use engine_state(process_id=helpdesk_query_lifecycle). DO NOT WRITE.';
