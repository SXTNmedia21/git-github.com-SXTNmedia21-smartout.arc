SET search_path TO public, extensions;

-- ============================================
-- 20260511200000_billing_fase2_enums.sql
-- Billing Engine Fase 2 — B1 Migration A (Enums)
--
-- Enum types for dispatch + integration framework. Created before the tables
-- that reference them (Migrations B-E).
--
-- Verified against packages/supabase/src/database.types.ts: none of these
-- names collide with existing enums.
--
-- Ref: Fase 2 spec §6 (datamodell-oppsummering), ADR-0127 (dispatch rule),
--      ADR-0129 (integration adapter + is_placeholder).
-- ============================================

-- ── billing_dispatch_channel ─────────────────────────────────
-- Channels an invoice can be dispatched through. peppol_ehf is reserved
-- for Fase 3 (§3.3 — enum kept for forward-compat; adapter class not built
-- in Fase 2).
CREATE TYPE public.billing_dispatch_channel AS ENUM (
  'email_customer',
  'email_internal',
  'http_api',
  'peppol_ehf'
);

COMMENT ON TYPE public.billing_dispatch_channel IS
  'Delivery channel for invoice_dispatch. peppol_ehf reserved for Fase 3 (no adapter class in Fase 2).';

-- ── dispatch_status ──────────────────────────────────────────
-- Per-dispatch-attempt lifecycle. pending -> in_flight -> delivered|failed|bounced.
CREATE TYPE public.dispatch_status AS ENUM (
  'pending',
  'in_flight',
  'delivered',
  'failed',
  'bounced'
);

COMMENT ON TYPE public.dispatch_status IS
  'invoice_dispatch lifecycle. bounced = delivered-but-rejected (email bounce, API 4xx).';

-- ── dispatch_rule_action ─────────────────────────────────────
-- Explicit send|suppress per ADR-0127. Workspace can override a
-- platform-default by creating a rule with action='suppress' and matching
-- dedup-key (channel + trigger_event + target).
CREATE TYPE public.dispatch_rule_action AS ENUM (
  'send',
  'suppress'
);

COMMENT ON TYPE public.dispatch_rule_action IS
  'ADR-0127: workspace can suppress platform-defaults by creating a matching rule with action=suppress.';

-- ── billing_integration_type ─────────────────────────────────
-- Third-party systems behind the integration adapter. placeholder is the
-- audit-safe mock per ADR-0129 (emits `integration sync mocked`, not
-- `succeeded`).
CREATE TYPE public.billing_integration_type AS ENUM (
  'fiken',
  'tripletex',
  'stripe',
  'placeholder'
);

COMMENT ON TYPE public.billing_integration_type IS
  'Integration target. placeholder is the audit-safe mock per ADR-0129 — gates emit semantics via is_placeholder column.';
