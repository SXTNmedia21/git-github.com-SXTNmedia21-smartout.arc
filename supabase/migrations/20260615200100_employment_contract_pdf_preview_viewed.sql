-- ============================================
-- 20260615200100_employment_contract_pdf_preview_viewed.sql
-- SMA-310: Server-enforced PDF preview gate (ADR-0310).
-- ============================================
-- Why: The /api/contracts/send route must persist the timestamp of when
--      the admin confirmed reading the PDF preview, before DocuSeal dispatch.
--      NULL until admin confirmed PDF read. Server validates non-null +
--      past timestamp; persists; verifies post-persist. See plan §4.
-- ============================================

SET search_path TO public, extensions;

ALTER TABLE public.employment_contract
  ADD COLUMN IF NOT EXISTS pdf_preview_viewed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.employment_contract.pdf_preview_viewed_at IS
  'ADR-0310/SMA-310: server-enforced PDF preview gate. Set by /api/contracts/send '
  'before DocuSeal dispatch. NULL until admin confirmed PDF read. '
  'Required field in SendBodySchema — 422 if missing or future timestamp.';
