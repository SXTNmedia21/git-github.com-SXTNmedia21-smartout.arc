-- Add configurable invoice payment-term column to pricing_terms.
--
-- Replaces the hardcoded net-14 in generate-monthly-invoices/generator.ts
-- with a per-customer value. DEFAULT 14 preserves identical behaviour for
-- every existing row — no data migration required.
--
-- ADR-0385 / council R4 pre-approved. Web-only authoring per ADR-0133.

ALTER TABLE public.pricing_terms
  ADD COLUMN IF NOT EXISTS payment_terms_days integer NOT NULL DEFAULT 14;

COMMENT ON COLUMN public.pricing_terms.payment_terms_days IS
  'Invoice net payment term in days (due_at = issue + N days). Default 14 preserves prior hardcoded behavior. ADR-0385/council R4.';

-- Guard: only add constraint when it does not already exist (idempotent re-run).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'pricing_terms_payment_terms_days_positive'
      AND  conrelid = 'public.pricing_terms'::regclass
  ) THEN
    ALTER TABLE public.pricing_terms
      ADD CONSTRAINT pricing_terms_payment_terms_days_positive
      CHECK (payment_terms_days > 0);
  END IF;
END$$;
