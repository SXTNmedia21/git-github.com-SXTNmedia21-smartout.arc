-- ============================================
-- 20260414225000_engine_authority_config_updated_by_nullable.sql
-- ============================================
-- Drop NOT NULL on engine_authority_config.updated_by.
--
-- Context: seed migrations (20260414230000, 20260417170000,
-- 20260515110000, 20260515130300) insert default authority rows
-- per workspace without a human actor. The original schema
-- (20260302000100) required updated_by NOT NULL, which blocked
-- these seeds and caused prod migration failure on 2026-04-20.
--
-- Semantic correctness: system-seeded rows have no human "updater".
-- updated_by is populated when a real user modifies the config via
-- admin UI. NULL unambiguously signals "seeded default".
--
-- FK to user_identity(user_id) is preserved — NULL is allowed by the
-- FK constraint; only the NOT NULL attribute is dropped.
-- ============================================

ALTER TABLE public.engine_authority_config
  ALTER COLUMN updated_by DROP NOT NULL;

COMMENT ON COLUMN public.engine_authority_config.updated_by IS
  'NULL for system-seeded rows. Populated by admin UI when a real user modifies the config.';
