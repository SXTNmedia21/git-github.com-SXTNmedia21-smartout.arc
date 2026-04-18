SET search_path TO public, extensions;

-- ============================================
-- 20260513000000_company_ehf_columns.sql
-- Billing Engine Fase 3B — B1 Migration A
--
-- Prepare `company` for EHF/Peppol invoice dispatch (Spor B). The
-- PeppolEhfAdapter reads `peppol_participant_id` when building the UBL
-- 2.1 <cac:AccountingSupplierParty> block; `ehf_enabled` is the
-- feature-flag gate the adapter checks before it calls Tickstar.
--
-- Columns are added NULL / DEFAULT false so existing rows remain valid.
-- The CHECK constraint enforces the invariant: a company cannot claim
-- `ehf_enabled = true` without a registered Peppol participant id. This
-- prevents silent "looks enabled, produces malformed XML" failures.
--
-- peppol_participant_id format: '0192:<orgnr>' for Norwegian senders.
-- The '0192:' prefix is the Peppol scheme code for NO:ORG (Norwegian
-- organisation numbers). The column is `text` — validation of the full
-- format lives in the adapter, not in the constraint, so we can accept
-- other schemes (e.g. '9908:' legacy EHF) without a schema change.
--
-- Vault availability confirmed in supabase_db_smartout.ai at B1 start:
--   supabase_vault 0.3.1 installed, `vault.secrets` table present.
-- This unblocks ADR-0136 (OAuth token storage in Vault) for B4.
--
-- Ref: Fase 3B spec §3.1, ADR-0137 (Tickstar transport).
-- ============================================

ALTER TABLE public.company
  ADD COLUMN peppol_participant_id text NULL;

ALTER TABLE public.company
  ADD COLUMN ehf_enabled boolean NOT NULL DEFAULT false;

-- Invariant: can only enable EHF once a participant id is registered.
-- Prevents the UI from flipping the flag without Peppol-onboarding the
-- org first. Enforced at the row level so bypass-RLS service writes
-- still hit the gate.
ALTER TABLE public.company
  ADD CONSTRAINT company_ehf_requires_participant
  CHECK (ehf_enabled = false OR peppol_participant_id IS NOT NULL);

-- ── Comments ────────────────────────────────────────────────
COMMENT ON COLUMN public.company.peppol_participant_id IS
  'Peppol participant identifier, format "0192:<orgnr>" for Norwegian senders. Used by PeppolEhfAdapter when building UBL 2.1 AccountingSupplierParty. See ADR-0137.';

COMMENT ON COLUMN public.company.ehf_enabled IS
  'Feature-flag gating EHF/Peppol dispatch for this company. PeppolEhfAdapter returns {status:"failed", error_code:"ehf_not_enabled"} when false. CHECK enforces participant_id presence when true. See ADR-0137 + Fase 3B spec §3.4.';

COMMENT ON CONSTRAINT company_ehf_requires_participant ON public.company IS
  'Fase 3B invariant: ehf_enabled=true requires peppol_participant_id. Enforced at row level so service-role writes cannot bypass.';
