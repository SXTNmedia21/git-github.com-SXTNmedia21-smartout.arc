SET search_path TO public, extensions;

-- ============================================
-- 20260417121600_invoice_enums.sql
-- Billing Engine Fase 1 — Task 1.3
-- Enum types for invoice tables. Created before invoice table (Task 1.4).
-- Ref: ADR-0120 (invoice_type values), ADR-0118.
-- ============================================

CREATE TYPE public.invoice_type AS ENUM (
  'recurring',
  'onboarding',
  'credit_note',
  'one_off'
);

CREATE TYPE public.invoice_status AS ENUM (
  'draft',
  'issued',
  'sent',
  'paid',
  'overdue',
  'void',
  'uncollectible'
);

CREATE TYPE public.dunning_status AS ENUM (
  'none',
  'in_negotiation',
  'reminder_sent',
  'escalated'
);

CREATE TYPE public.invoice_line_type AS ENUM (
  'base_plan',
  'user_overage',
  'addon',
  'onboarding',
  'adjustment'
);

COMMENT ON TYPE public.invoice_type IS
  'Invoice classification. credit_note requires credits_invoice_id FK (ADR-0120).';
COMMENT ON TYPE public.invoice_status IS
  'Invoice lifecycle state. Legal (status, dunning_status) combinations enforced via CHECK on invoice table.';
COMMENT ON TYPE public.dunning_status IS
  'Dunning progression. NULL for terminal invoice states (draft/paid/void/uncollectible).';
COMMENT ON TYPE public.invoice_line_type IS
  'Line item classification for invoice_line_item.';
