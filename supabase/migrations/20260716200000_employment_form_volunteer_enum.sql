-- ============================================================================
-- 20260716200000_employment_form_volunteer_enum.sql
--
-- ADR-0428 Part 1 of 2 — Add 'volunteer' value to employment_form_enum.
-- Part 2 (20260716200100) performs the bubble-migration recovery + comment
-- update; recovery must run in a SEPARATE transaction because PG 12+
-- forbids reading the new enum value in the transaction that added it.
--
-- ROOT CAUSE (BUG-SIM-01, L-0354):
--   Migration 20260519150000_contract_text_to_enum_cast.sql Step C
--   (lines 140-160) backfilled every NULL employment_form → 'permanent'
--   then set the column NOT NULL. ADR-0109 §Clause B (NULL = volunteer,
--   no-Tripletex-sync) became physically unexpressible. Data already lost
--   on every workspace that applied 20260519150000.
--
-- POSTGRES 12+ NOTE:
--   ALTER TYPE ... ADD VALUE is allowed inside a transaction block, but
--   the restriction "the new value may not be READ in the same transaction"
--   applies — including reads triggered by enum-cast writes such as
--   `UPDATE ... SET col = 'newval'::enum_type`. We therefore split:
--     - 20260716200000 (this): ADD VALUE only.
--     - 20260716200100 (next): recovery UPDATE + comment.
--
-- IDEMPOTENCY: ADD VALUE IF NOT EXISTS no-ops on replay.
--
-- ADR references: ADR-0428 (this), ADR-0109 §Clause B (superseded form),
-- ADR-0427 (forward-only doctrine), ADR-0421 (declared fulfillment).
-- ============================================================================

SET search_path TO public, extensions;

ALTER TYPE public.employment_form_enum
  ADD VALUE IF NOT EXISTS 'volunteer';
