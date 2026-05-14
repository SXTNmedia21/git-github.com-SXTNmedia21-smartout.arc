---
title: "ADR-0311: Trekk-samtykke som payroll-domain artifact (Aml. §14-15 tredje ledd)"
id: ADR-0311
status: proposed
created: 2026-05-14
updated: 2026-05-14
module: payroll
tags: [payroll, trekk, samtykke, consent, aml-14-15, lovsen, docuseal, deduction]
---

# ADR-0311: Trekk-samtykke som payroll-domain artifact (Aml. §14-15 tredje ledd)

## Status

proposed

## Context

Aml. §14-15 tredje ledd nr. 1-6 (arbeidsmiljøloven) krever lovhjemmel eller skriftlig samtykke
for ethvert trekk i lønn. `LineOverrideModal` hadde kun et fritekstfelt for "grunn" — compliance-
teater som gir null garanti for at samtykket faktisk finnes.

**Rejected path: Extend `confirmation_signature`**

Opprinnelig plan (Option A, council Phase 5) var å legge til `confirmation_type = 'deduction_consent'`
i eksisterende `confirmation_signature`. FK-kjedeanalyse avdekket fatal feil:

- `confirmation_signature.confirmation_id → confirmation.confirmation_id` er NOT NULL
- Det finnes ingen `confirmation`-rad for `type='deduction_consent'`
- INSERT ville gi FK-violation uten ny `confirmation`-rad
- En ny `confirmation`-rad ville kreve tilhørende `procedure/routine/control_list` — et
  training-governance-artifact, ikke et payroll-artifact

**Cascade invariant 2 (brudd):** én entitet = én rolle.
`confirmation_signature` er governance/training-attestasjon (C4-layer onboarding-bekreftelse).
Trekk-samtykke er et payroll-domain wage-trekk-artifact (D2/C1-layer lønnsdokumentasjon).
Ulike livssykluser, ulike RLS-audiences, ulike DocuSeal document templates.

**Council Phase 5 (2026-05-14) verdict:** APPROVE WITH CHANGES. New dedicated table.

## Decision

Ny tabell `payroll.consent_document` med:
- Eget RLS-sett (service_role for DocuSeal callback INSERT; JWT/API-key for manager SELECT)
- Egen livssyklus (status: active/expired/revoked/superseded + expires_at)
- Eget DocuSeal-binding (deduction_consent document type → skiller fra training-templates)
- Selvreference `superseded_by_id` for samtykke-fornyelseskjede
- `paragraph_ref TEXT NOT NULL DEFAULT 'Aml. §14-15 tredje ledd nr. 1-6'` (immutable per rad)

FK `consent_document_id` lagt til `public.change_proposal` for å linke trekk-forslag til signert samtykke.

**Shared utility:** `validateAml1415Logic` i `packages/ai/src/capabilities/legal/aml-14-15.ts`.
Brukes direkte av BFF-route (server-side enforcement uten agent-context) og wrappet av
`validateAml1415` capability tool (system-kanal, + channel guard + emit()).

## Key Rules

1. **`category='deduction'`** på `change_proposal` MÅ ha `consent_document_id`, UNNTATT
   `deduction_type='court_order'` (se punkt 3).

2. **workspaceId** er alltid server-derived fra JWT (ADR-0151). Aldri akseptert fra request body.
   BFF validerer at `consent_document.workspace_id === jwt_workspace_id` (L-0177 fail-fast → 403).

3. **Court orders (utleggstrekk):** Lovhjemmel er tilstrekkelig per lovsen Q3-vedtak.
   Krever likevel en `payroll.consent_document`-rad med `consent_type='court_order'` og
   `court_order_reference IS NOT NULL` (saksnummeret beviser at kjennelsen er på fil).
   Ansattsignatur ikke påkrevd.

4. **Union dues (fagforeningstrekk):** Tariffavtale er tilstrekkelig hjemmel per lovsen Q4-vedtak.
   Advisory-mode i UI: ikke-blokkerende advarsel "Bekreft at ansatt er registrert som
   fagforeningsmedlem" vises når `deduction_type='union_dues'`. Fremtidig ADR for
   tariff_framework FK-binding.

5. **`validateAml1415` capability tool:** `systemTools`-tier ONLY — ikke `readOnlyTools`.
   Chat-sessions på `read_only` authority skal ikke kunne invokere compliance-validering.
   Layer 2 `allowedChannels: ["chat", "system"]` (legal capability). "autonomous" ekskludert.

6. **Backfill:** Historiske trekk-forslag uten `consent_document_id` merkes med
   `deviation_class = 'consent_gap_aml_14_15_tredje_ledd'` i `payroll.deviation`.
   BLOKKERER IKKE eksport (Bokf.lov §7 journalføring — historiske bilag må kunne leveres til
   regnskapsfører). Gap dokumenteres for revisor.

7. **DocuSeal callback:** Forutsetter at callback-handler brancher på submission type:
   `deduction_consent` → INSERT `payroll.consent_document`;
   training/governance → eksisterende `confirmation_signature`-sti uberørt.
   Callback-implementasjon er et FOLLOWUP-sortie (se HANDOFF).

## Consequences

**Positive:**
- Klar ansvarsfordeling: payroll ↔ governance/training separate entiteter
- Sterk compliance-tvungen: trekk kan ikke foreslås uten gyldig signert samtykke
- Auditbar kjede: `change_proposal.consent_document_id` → `payroll.consent_document` → DocuSeal
- paragraph_ref per rad = immutable historisk referanse (statuttendringer bryter ikke eksisterende)
- Delt utility-logikk: BFF + capability tool deler identisk regellogikk (ingen avvik)

**Negative / Debt:**
- DocuSeal callback-routing er ikke implementert i dette sortiet (flagget i HANDOFF §Known issues)
- Samtykke-UI mangler direkte DocuSeal-lenke fra modalen (manager må gå til separat flate)
- Tariff-framework FK for union_dues deferred til fremtidig ADR

## Bindings

- ADR-0151: workspace_id server-derived; aldri fra client body
- ADR-0235: field_classification_metadata foundation (classify_amendment dependency chain)
- ADR-0244: GDPR retention — samtykkedokumenter underlagt same-retention som contracts
- ADR-0249: legal capability registration (legal = tredje capability-søsken til contract + payroll)

## References

- `supabase/migrations/20260615110000_create_payroll_consent_document.sql`
- `supabase/migrations/20260615110100_change_proposal_consent_fk.sql`
- `packages/ai/src/capabilities/legal/aml-14-15.ts` (shared utility)
- `packages/ai/src/capabilities/legal/tools.ts` (validateAml1415 tool)
- `apps/web/src/app/api/payroll/propose-line-override/route.ts` (BFF enforcement)
- `apps/web/src/app/api/payroll/deduction-consents/route.ts` (consent picker BFF)
- `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineOverrideModal.tsx` (UI)
- `docs/journeys/JOURNEY-sma-328-manager-applies-trekk-with-consent.md`
- `docs/journeys/JOURNEY-sma-328-manager-applies-trekk-without-consent-rejected.md`
- `docs/journeys/JOURNEY-sma-328-lovsen-validates-paragraph-binding.md`
- `docs/HANDOFF-sma-328-aml-14-15-trekk-consent.md`
- L-0177: fail-fast on row.workspace_id mismatch
- L-0176: body written before docstring
