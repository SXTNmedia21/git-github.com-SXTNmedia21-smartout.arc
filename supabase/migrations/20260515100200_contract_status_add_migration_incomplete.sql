-- 20260515100200_contract_status_add_migration_incomplete.sql
-- M2a: add 'migration_incomplete' value to public.contract_status enum.
-- ISOLATED MIGRATION — PG rule: ALTER TYPE ADD VALUE is not usable in the same
-- transaction as any statement that references the new value. Keeping this
-- alone guarantees the value is available for M3+ migrations and runtime code.
-- Per ADR-0109 (migrated profile contract shell).

ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'migration_incomplete';
