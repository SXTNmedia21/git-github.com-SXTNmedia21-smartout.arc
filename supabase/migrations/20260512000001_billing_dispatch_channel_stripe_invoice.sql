SET search_path TO public, extensions;

-- ============================================
-- 20260512000001_billing_dispatch_channel_stripe_invoice.sql
-- Billing Engine Fase 3A — B1 Migration B
--
-- Extends billing_dispatch_channel enum with 'stripe_invoice' so the
-- StripeDispatchAdapter (B2) can register as a channel alongside
-- email_customer, email_internal, http_api, peppol_ehf.
--
-- ALTER TYPE ... ADD VALUE is non-transactional in Postgres — this
-- migration contains only the ADD VALUE statement so `supabase db reset`
-- runs it cleanly outside an implicit transaction.
--
-- Ref: Fase 3A spec §3.2, §6 (datamodell-oppsummering row 6).
-- ============================================

ALTER TYPE public.billing_dispatch_channel ADD VALUE IF NOT EXISTS 'stripe_invoice';

-- Note: COMMENT ON TYPE already describes the enum (Fase 2 Migration A).
-- Re-applying comment here would drop/re-set; leave as-is so diff stays
-- minimal.
