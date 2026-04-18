SET search_path TO public, extensions;

-- ============================================
-- 20260513000002_payment_method_accountant_manual.sql
-- Billing Engine Fase 3B — B2 Migration
--
-- Ny payment_method_type-verdi 'accountant_manual' for sporing av
-- betalinger der regnskapsfører har behandlet EHF-fakturaen eksternt og
-- rapportert tilbake til platform-admin for manuell mark-paid i Smartout.
--
-- Semantikken skiller seg fra eksisterende 'manual_adjustment':
--   manual_adjustment   = platform-admin korreksjon / write-off
--   accountant_manual   = regnskapsfører rapporterte betalingen er mottatt
-- Dette gjør platform-admin-queries + billing_activity_log-audit mer
-- presise (vi kan skille "ret-ting" fra "rapportert inn").
--
-- Ref: ADR-0148 §Accountant mark-paid, Fase 3B-v2 spec §8.
-- ============================================

-- ADD VALUE må kjøres UTENFOR transaction-block i Postgres 14+, men
-- Supabase-migrasjonene kjører hver i sin egen transaction. IF NOT
-- EXISTS beskytter mot re-run når samme migrasjon kjører mot database
-- som allerede har verdien.
ALTER TYPE public.payment_method_type ADD VALUE IF NOT EXISTS 'accountant_manual';

COMMENT ON TYPE public.payment_method_type IS
  'Origin of a payment row. stripe_* values are webhook-driven; bank_transfer + manual_adjustment are platform-admin actions; accountant_manual (Fase 3B) spores betalinger rapportert inn av ekstern regnskapsfører etter EHF-leveranse.';
