SET search_path TO public, extensions;

-- ============================================
-- 20260512000000_payment_enums.sql
-- Billing Engine Fase 3A — B1 Migration A
--
-- Enums for Stripe payments + downstream payment processing. Created before
-- the payment + payment_attempt tables (Migrations C + D) that reference
-- them. Verified against packages/supabase/src/database.types.ts — neither
-- name collides with an existing enum.
--
-- Ref: Fase 3A spec §3.2 + §6, ADR-0131 (Stripe Connect platform model),
--      ADR-0141 (payment_attempt PII redaction).
-- ============================================

-- ── payment_method_type ──────────────────────────────────────
-- How the payment was initiated. stripe_card + stripe_bank are the two
-- Stripe-native Checkout flows for Fase 3A; bank_transfer covers manual
-- wire/giro marking; manual_adjustment is the platform-admin override
-- (correction, write-off settlement).
CREATE TYPE public.payment_method_type AS ENUM (
  'stripe_card',
  'stripe_bank',
  'bank_transfer',
  'manual_adjustment'
);

COMMENT ON TYPE public.payment_method_type IS
  'Origin of a payment row. stripe_* values are webhook-driven; bank_transfer + manual_adjustment are platform-admin actions.';

-- ── payment_status ───────────────────────────────────────────
-- Lifecycle of a single payment. pending → processing → succeeded (or
-- failed). refunded / partially_refunded are terminal states reached via
-- charge.refunded webhook per ADR-0142. Order-of-events between
-- "processing" and "succeeded" is webhook-timestamp-driven (latest wins)
-- per spec §3.4.
CREATE TYPE public.payment_status AS ENUM (
  'pending',
  'processing',
  'succeeded',
  'failed',
  'refunded',
  'partially_refunded'
);

COMMENT ON TYPE public.payment_status IS
  'Per-payment lifecycle. ADR-0142 refund flow reaches refunded/partially_refunded via charge.refunded webhook; invoice.status stays paid (credit-note balances).';
