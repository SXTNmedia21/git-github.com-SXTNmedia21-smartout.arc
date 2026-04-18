SET search_path TO public, extensions;

-- ============================================
-- 20260513000001_invoice_ehf_exported_at.sql
-- Billing Engine Fase 3B — B2 Migration
--
-- Sporer hvilke fakturaer som er inkludert i en EHF-eksport til
-- regnskapsfører. Fase 3B ehf-export-siden setter kolonnen for alle
-- fakturaer som er med i en generert eksport.
--
-- Default-filter i UI: "ikke allerede eksportert" (ehf_exported_at IS NULL).
-- Platform-admin kan re-eksportere ved behov (tapt fil hos regnskapsfører)
-- ved å slå av filteret. UI viser en markør på rader som allerede er
-- eksportert tidligere.
--
-- Indexet er partial over "eksporterte" rader fordi "ikke-eksportert"
-- er den dominerende filter-path (default-toggle i UI). Full index ville
-- duplisert primær-b-tree uten å raske opp den dominerende queryen.
--
-- Ref: ADR-0139, Fase 3B-v2 spec §6.
-- ============================================

ALTER TABLE public.invoice
  ADD COLUMN ehf_exported_at timestamptz NULL;

CREATE INDEX invoice_ehf_exported_at_idx
  ON public.invoice(ehf_exported_at)
  WHERE ehf_exported_at IS NOT NULL;

COMMENT ON COLUMN public.invoice.ehf_exported_at IS
  'Timestamp for når fakturaen ble inkludert i en EHF-eksport til regnskapsfører (platform-admin click). NULL = ikke eksportert ennå. Default-filter i /platform-admin/billing/ehf-export ekskluderer eksporterte rader; platform-admin kan re-eksportere ved tap.';

COMMENT ON INDEX public.invoice_ehf_exported_at_idx IS
  'Partial index over eksporterte fakturaer. Dominerende spørring er "ikke eksportert" (IS NULL) — indexet støtter den motsatte path ved re-eksport-listing.';
