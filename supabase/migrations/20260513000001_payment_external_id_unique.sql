SET search_path TO public, extensions;

-- ============================================
-- 20260513000001_payment_external_id_unique.sql
-- Billing Engine Fase 3B — B1 Migration B
--
-- Adds a composite (external_id, company_id) UNIQUE partial index to
-- guard the inbound payment-poll from ADR-0138. `poll_integration_payments`
-- inserts `payment` rows keyed by the vendor's payment id (Fiken /
-- Tripletex). Without a company-scoped dedup key the same vendor
-- payment could land twice if the hourly cron overlaps with a manual
-- re-poll.
--
-- Why composite vs. the existing `idx_payment_external_id_unique`:
--   - The Fase 3A index enforces GLOBAL uniqueness on external_id
--     (scoped to `external_id IS NOT NULL`). That was correct for
--     Stripe PaymentIntent ids (pi_*) which are globally unique across
--     Stripe's namespace.
--   - Fiken/Tripletex payment ids are only unique within each vendor's
--     tenant namespace. Two workspaces could (in theory) receive a
--     vendor payment with the same numeric id.
--   - Composite `(external_id, company_id)` gives us "same payment for
--     same company = dedup" without forbidding legitimate same-id rows
--     across companies.
--
-- We keep the original index for Stripe — its stricter guarantee still
-- holds for pi_* ids, and leaving it avoids a silent regression of the
-- Fase 3A webhook idempotency contract.
--
-- Ref: Fase 3B spec §4.3, ADR-0138 (poll as separate engine_process).
-- ============================================

CREATE UNIQUE INDEX payment_external_id_company_unique
  ON public.payment(external_id, company_id)
  WHERE external_id IS NOT NULL;

-- ── Comments ────────────────────────────────────────────────
COMMENT ON INDEX public.payment_external_id_company_unique IS
  'ADR-0138 inbound-poll idempotency. Composite dedup key for poll_integration_payments handler: same vendor payment for same company collapses to one row. Coexists with idx_payment_external_id_unique which enforces global uniqueness for Stripe PaymentIntent ids.';
