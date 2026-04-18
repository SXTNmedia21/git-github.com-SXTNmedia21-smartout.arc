SET search_path TO public, extensions;

-- ============================================
-- 20260513000000_company_ehf_columns.sql
-- Billing Engine Fase 3B (CSV-eksport-scope)
--
-- EHF-leveransen skjer UTENFOR Smartout: regnskapsfører genererer EHF
-- fra CSV-eksport + markerer fakturaer betalt manuelt. Disse kolonnene
-- beskriver workspacets EHF-deltakelse, ikke Smartout-transport.
--
--   peppol_participant_id — Peppol participant identifier,
--     typisk '0192:<orgnr>' for norske avsendere. Regnskapsfører bruker
--     verdien når han sender EHF fra sitt eget system. Smartout viser
--     verdien i CSV-eksporten + lar platform-admin filtrere på den.
--
--   ehf_enabled — Feature-flag: kun workspaces med ehf_enabled=true er
--     inkludert i platform-admin CSV-/PDF-eksport. CHECK sikrer at
--     flagget ikke kan settes uten at participant_id finnes.
--
-- Kolonnene er NULL / DEFAULT false slik at eksisterende rader er
-- gyldige. CHECK-constrainten håndheves på rad-nivå så service-role-
-- skriv ikke kan omgå gaten.
--
-- Ref: Fase 3B CSV-eksport-spec (supercedes ADR-0137 Tickstar).
-- ============================================

ALTER TABLE public.company
  ADD COLUMN peppol_participant_id text NULL;

ALTER TABLE public.company
  ADD COLUMN ehf_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.company
  ADD CONSTRAINT company_ehf_requires_participant
  CHECK (ehf_enabled = false OR peppol_participant_id IS NOT NULL);

COMMENT ON COLUMN public.company.peppol_participant_id IS
  'Peppol participant identifier, format "0192:<orgnr>" for norske avsendere. Vist i platform-admin EHF-eksport (CSV/PDF) slik at regnskapsfører har identifikatoren når han lager EHF-levering eksternt.';

COMMENT ON COLUMN public.company.ehf_enabled IS
  'Feature-flag: workspaces med ehf_enabled=true inkluderes i platform-admin EHF-eksport (månedlig CSV/PDF til regnskapsfører). CHECK krever peppol_participant_id.';

COMMENT ON CONSTRAINT company_ehf_requires_participant ON public.company IS
  'Fase 3B invariant: ehf_enabled=true krever peppol_participant_id. Håndheves på rad-nivå.';
