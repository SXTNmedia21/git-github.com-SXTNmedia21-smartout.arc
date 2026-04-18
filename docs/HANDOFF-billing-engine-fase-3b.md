---
title: "Handoff — Billing Engine Fase 3B (EHF CSV/PDF-eksport)"
status: done
updated: 2026-04-18
created: 2026-04-18
module: billing
tags: [handoff, billing, fase-3b, csv, pdf, regnskapsfører]
---

# Handoff — Billing Engine Fase 3B

## Sammendrag

Fase 3B ble opprinnelig speccet som Peppol/Tickstar/OAuth/poll-stack (ADR-0136, ADR-0137, ADR-0138). Ved en rescope-samtale 2026-04-18 ble den reelle workflowen avklart: Smartout lager fakturagrunnlaget, ekstern regnskapsfører lager EHF-fakturaer og markerer betalinger i Smartout på melding tilbake. Dette fjerner behovet for Peppol-transport, OAuth, Vault-tokens og inbound-poll.

Fase 3B-v2 leverer i stedet:

1. Workspace-admin-toggle for `company.ehf_enabled` + `peppol_participant_id`
2. Platform-admin EHF-eksport-side (`/platform-admin/billing/ehf-export`) med checkbox-form for grouping + format
3. Pure server-action `generateEhfExport` som bygger CSV med UTF-8 BOM + CRLF + `line_items_json`
4. Ny `payment_method_type = 'accountant_manual'` + ny `payment_channel = 'accountant_manual'`
5. `billing accountant_marked_paid` telemetry-event som emitter i tillegg til standard `invoice marked_paid` når kanalen er valgt
6. `invoice.ehf_exported_at` timestamp for å spore hvilke fakturaer som er inkludert i eksport

## Beslutninger (ADRer)

| ADR | Status | Resultat |
|-----|--------|----------|
| **ADR-0139** | accepted | EHF-leveranse via månedlig CSV/PDF-eksport fra platform-admin (ny) |
| ADR-0136 | superseded by 0139 | Workspace OAuth Vault — droppet, ingen OAuth i Fase 3B-v2 |
| ADR-0137 | superseded by 0139 | Tickstar Peppol-transport — droppet, regnskapsfører transporterer |
| ADR-0138 | superseded by 0139 | integration_poll_payments — droppet, ingen inbound poll |

## Læringer

1. **Spec-drevet over-engineering er vanskelig å oppdage før kode er skrevet.** Første iterasjon av Fase 3B-speccen (Peppol/Tickstar/OAuth/poll) virket rimelig gitt at "EHF-fakturering er neste fase", men ingen stillte spørsmålet "hvordan gjør vi det *i dag*?". Et 90-sekunder rescope-samtaler avslørte at den reelle workflowen er manual + ekstern. Læring: for alle feature-specs med ekstern integrasjon, verifiser nåværende/faktisk workflow før transport-valg.

2. **`col_has_check` fra pgTAP treffer ikke multi-kolonne CHECK-constraints.** Fase 3B B1 første pgTAP-test feilet fordi `col_has_check('ehf_enabled')` leter etter CHECK der `ehf_enabled` er eneste kolonnen referert. Vi måtte bytte til `has_check(table)` som bare verifiserer at tabellen har minst én CHECK. For stramme assertions på navngitte constraints, bruk `SELECT col_has_check ON ... WHERE conname = '...'` direkte.

3. **Sletting vs. DROP-migrasjon for ikke-pushede branches.** B1 hadde commitet 7 migrasjoner + 9 telemetry-events + OAuth-state-tabell. Siden branchen ikke var pushet, slettet vi filene (cleanere migration-history) i stedet for å skrive reverse-migrasjoner. Dette funker kun fordi: (a) branchen er privat, (b) vi kan `supabase db reset` lokalt. For pushede branches må man alltid skrive reverse-migrasjoner.

4. **Per-workspace zip i Next.js uten jszip er ugunstig.** ZIP-stored-method kan implementeres i ~60 linjer Node, men det er kode uten direkte forretningsverdi. Når scope-kravet ble "kan velge grouping + format", falt vi tilbake til bundled+CSV i MVP og viser "kommer snart" på per-workspace + PDF. Beslutning: kjøp jszip-deps senere når feature-demand er bekreftet, ikke preemptivt.

5. **Payment-channel-skille i Fase 2 var allerede bred nok.** Fase 2 spec hadde `payment_channel` som `text` (ikke enum), så å legge til `accountant_manual` var en én-linje schema-utvidelse. Payment_method_type (på payment-tabellen) er enum, så her trengte vi en ALTER TYPE. Læring: `text`-kolonner for klassifikasjon er fleksible, men gjør domene-query-filtrering vanskeligere — vi har hatt PaymentChannelSchema Zod som defacto-enum, som gir det beste av begge.

## Kjent gjeld

- **PDF-builder:** returnerer `format_not_supported_yet` både i action + route. B4 (PDF-generator) skrevet inn i spec, ikke implementert.
- **Per-workspace-zip:** action støtter grouping=`per_workspace`, men route avviser fordi vi ikke har jszip-dep. Klientens UI viser "kommer snart" på checkbox.
- **Preview-summering:** UI har ikke live-count "47 fakturaer, 123 450 kr" før klikk. Krever ekstra preview-action som queryer uten å bygge CSV.
- **Accountant-login / rolle:** eksplisitt dropped fra scope. Flaggerer i spec §12 som Fase 4+.
- **Total-beløp i emit:** `ehf_export_generated.data.total_amount_incl_vat` sendes som `0` fordi action ikke returnerer aggregat. Enkel tillegg i B3-action senere (sum over artifacts).

## Neste steg (Fase 3B-oppfølging)

1. **B4 PDF-builder** når første måned er kjørt og regnskapsfører bekrefter behov for PDF.
2. **Per-workspace zip** — legg til jszip-dep hvis regnskapsfører vil ha split-leveranse.
3. **Preview-summering** — forbedring i UI for "hvor mange fakturaer, hvor mye".
4. **Accountant-dashboard** — hvis workflow modnes til at en spesifikk regnskapsfører skal logge inn og selv plukke fakturaer, designe egen rolle/login (Fase 4+).

## Merge-rekkefølge

Fase 2 er klar for merge først, deretter Fase 3A, deretter Fase 3B:

1. `feat/billing-engine-fase-2` → `development` (pushet, ikke mergd)
2. `feat/billing-engine-fase-3` (Fase 3A) → `development` (pushet, ikke mergd)
3. `feat/billing-engine-fase-3b` → `development` (IKKE pushet — venter på manuell testing av setup-journey)

## Testing

Kjør disse etter merge:

```
pnpm --filter @smartout/billing test   # 179/179
pnpm --filter @smartout/telemetry test # 198/198 + 1 todo
pnpm turbo typecheck --filter=@smartout/billing --filter=@smartout/telemetry --filter=@smartout/supabase
npx supabase db reset && npx supabase db test   # 11/11 B3B schema test + pre-existing billing suites
```

Kjør manuelt:
- `/dashboard/billing/settings` → toggle EHF + peppol_id, lagre
- `/platform-admin/billing/ehf-export` → velg forrige måned + generer CSV
- `/platform-admin/billing/invoices/<id>` → marker betalt med kanal=Regnskapsfører (EHF), verifiser to events i billing_activity_log

## Referanser

- ADR-0139 — EHF-leveranse via CSV/PDF-eksport
- Spec: `docs/superpowers/specs/2026-04-17-billing-engine-fase-3b-design.md`
- Journey: `docs/journeys/JOURNEY-billing-engine-fase-3b.md`
- Handoff Fase 2: `docs/HANDOFF-billing-engine-fase-2.md`
- Handoff Fase 3A: `docs/HANDOFF-billing-engine-fase-3a.md`
