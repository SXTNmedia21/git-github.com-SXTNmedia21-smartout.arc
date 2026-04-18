SET search_path TO public, extensions;

-- ============================================
-- 20260512000003_payment_attempt_table.sql
-- Billing Engine Fase 3A — B1 Migration D
--
-- payment_attempt logs each Stripe webhook event touching a payment.
-- One-to-many: a payment may accumulate many attempts (succeeded, failed,
-- refunded, partial refunds). Attempts are permanent audit records.
--
-- Idempotency is enforced via UNIQUE(stripe_event_id) so the webhook
-- handler's INSERT ... ON CONFLICT DO NOTHING is both correct and cheap.
--
-- ADR-0141 mandates redacted_payload contains ONLY the PCI-safe subset:
--   - event.id
--   - amount, currency
--   - status, last_payment_error.code
--   - outcome.network_status
--
-- Forbidden keys (enforced in code + Fase 3A pgTAP assertion):
--   - billing_details
--   - customer
--   - source
--   - receipt_url
--   - Any raw card/bank/account numbers
--
-- This table is platform-admin-only (no workspace-admin RLS policy). The
-- spec §7 matrix is explicit: "Ingen tilgang (PII i redacted_payload —
-- platform-only)".
--
-- Ref: Fase 3A spec §3.2, ADR-0141.
-- ============================================

CREATE TABLE public.payment_attempt (
  payment_attempt_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id          uuid NOT NULL REFERENCES public.payment(payment_id) ON DELETE CASCADE,

  -- Monotonic per-payment counter. Webhook handler computes this on insert:
  -- MAX(attempt_number) + 1 WHERE payment_id = NEW.payment_id.
  attempt_number      int NOT NULL CHECK (attempt_number > 0),

  -- The Stripe event.id (evt_*). UNIQUE — idempotency key. If Stripe
  -- replays the same event, ON CONFLICT DO NOTHING preserves the original.
  stripe_event_id     text NOT NULL UNIQUE,

  -- The Stripe event type (e.g. payment_intent.succeeded,
  -- payment_intent.payment_failed, charge.refunded).
  status              text NOT NULL,

  -- Redacted event snapshot per ADR-0141. jsonb default '{}' prevents
  -- NULL from forcing handlers into jsonb_coerce gymnastics.
  redacted_payload    jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Stripe last_payment_error (code + message). Copied from the event
  -- payload when present, else NULL.
  error_code          text,
  error_message       text,

  created_at          timestamptz NOT NULL DEFAULT now()
);

-- No updated_at trigger: payment_attempt rows are immutable audit records.

-- ── Indexes ──────────────────────────────────────────────────
-- Hot path: list attempts for a payment in chronological order (platform-
-- admin detail view).
CREATE INDEX idx_payment_attempt_payment_order
  ON public.payment_attempt(payment_id, attempt_number);

-- Webhook idempotency path is already served by UNIQUE(stripe_event_id)
-- (implicit unique index). No additional index needed.

-- ── Comments ─────────────────────────────────────────────────
COMMENT ON TABLE public.payment_attempt IS
  'Immutable audit log of Stripe webhook events per payment. Platform-admin-only per spec §7 (ADR-0141 PII redaction). redacted_payload contains only PCI-safe subset; receipt_url / customer / billing_details / source are FORBIDDEN keys.';

COMMENT ON COLUMN public.payment_attempt.stripe_event_id IS
  'ADR-0141 idempotency key. Stripe guarantees event.id uniqueness across a webhook endpoint; our UNIQUE constraint makes ON CONFLICT DO NOTHING a correct no-op on replay.';

COMMENT ON COLUMN public.payment_attempt.redacted_payload IS
  'ADR-0141 PCI-safe subset ONLY: event.id, amount, currency, status, last_payment_error.code, outcome.network_status. Forbidden keys: billing_details, customer, source, receipt_url. Enforced in webhook handler + Fase 3A pgTAP assertion.';

COMMENT ON COLUMN public.payment_attempt.attempt_number IS
  'Monotonic 1-indexed counter per payment_id. Webhook handler computes MAX+1 at insert time.';
