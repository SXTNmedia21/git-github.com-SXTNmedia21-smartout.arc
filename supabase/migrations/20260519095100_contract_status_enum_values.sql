-- =============================================================================
-- Migration: contract_status enum value additions (lifecycle states for D2)
-- ADR-0241 — Contract Schema Migration Foundation
--
-- Postgres requires ALTER TYPE ... ADD VALUE to commit BEFORE values can be
-- referenced in DDL (partial indexes, WHERE clauses). Splitting from
-- 20260519100100_contracts_module_foundation.sql which uses 'active' in two
-- partial indexes — keeping them in the same migration triggers SQLSTATE 55P04
-- "unsafe use of new value" under `supabase db reset`.
--
-- Existing values: draft, pending_review, active_legacy (see contracts module),
--                  pending_data, declined, ready_to_send, migration_incomplete
-- =============================================================================

ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'pending_signature';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'superseded';
