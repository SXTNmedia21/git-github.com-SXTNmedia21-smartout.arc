---
title: "contract" Word Overloaded Across Two Unrelated Systems
id: LEARNING_0030
status: canonical
layer: learning
created: 2026-04-08
updated: 2026-04-08
tags: [naming, ontology, contracts, migrations, schema]
---

# Learning-0030: "contract" Word Overloaded Across Two Unrelated Systems

## Context

Under council review av contract-composition-designet oppdaget Steward at
kodebasen har **to helt separate systemer** som begge bruker ordet "contract":

- **`contract`** (ADR-0024) — platform-legal dokumenter, B2B terms of service,
  Tiptap editor, DocuSeal signing, microservice-basert
- **`employment_contract`** (migration 00012) — HR-artefakt med stilling,
  lønn, prosent, ansettelsestype, egen lifecycle

Brainstorm-designet for ny composition-engine blandet de to systemene uklart,
med risiko for at feil tabell ble modifisert.

Samtidig ble det oppdaget at migration 20260228140000 har en plain `text`-
kolonne kalt `contract_status` på en *annen* platform-tabell — som kolliderer
navnmessig med den `public.contract_status` ENUM som tilhører
`employment_contract`. Enhver migration som refererer `contract_status` uten
`public.`-prefiks risikerer å ALTER'e feil kolonne.

## Discovery

1. **Navnekollisjoner overlever merges.** Når to feature-grener begge legger
   til noe med samme navn (enum vs text-kolonne) på forskjellige tabeller,
   merger Postgres dem inn uten konflikt — men kodebasen har nå en landmine.
2. **FK-kobling mellom to systemer er ikke sammenslåing.**
   `employment_contract.signing_contract_id` → `contract(contract_id)` gjør
   ikke de to systemene til ett. Koblingen er et integrasjonspunkt, ikke en
   samling.
3. **Ord alene er ikke ontologi.** Både `contract` og `employment_contract`
   er "kontrakter" på norsk, men de har forskjellige felt, lifecycle, RLS,
   audience og signing-flow. Å dele ett navn på tvers av to systemer skaper
   forvirring når nye features designes.

## Impact

**Regler fremover:**

1. **Alle nye migrasjoner må bruke `public.contract_status`** (eller
   tilsvarende skjema-prefiks) for å unngå navnekollisjonen. Aldri bare
   `contract_status` i ALTER TYPE eller referanser.

2. **Variable naming speiler tabellen, ikke konseptet.** Et
   `employment_contract`-objekt er aldri bare `contract` i kode. Variable
   som heter `contract` refererer til `contract`-tabellen (platform legal).

3. **UI-tekst til sluttbruker:** "Arbeidsavtale" for `employment_contract`.
   "Brukeravtale" / "Vilkår" for `contract`.

4. **I18n-keys separeres i namespaces** — `employment_contract.*` vs
   `contract.*`.

5. **Schema-review av nye migrasjoner** må inkludere grep etter eksisterende
   kolonne-/type-navn på tvers av alle historiske migrasjoner, ikke bare
   nylige. Navnekollisjoner kan ligge i gamle migrasjoner som aldri blir
   touched.

6. **Future refactor flagged:** `/api/contracts/` blander i dag de to
   systemene (håndterer `contract`-tabellen med `contract_type='employee'`
   som integrasjonspunkt). Bør splittes til `/api/employment-contracts/` +
   `/api/contracts/` i ADR-0076 Phase 2 for semantisk klarhet.

## References

- ADR-0024 (Contract System Architecture)
- ADR-0079 (ADR-0024 Amendment — employment_contract vs contract system separation)
- ADR-0076 (Contract Composition as Cascade Derivation)
- Migration 00012 (employment_contract foundation)
- Migration 20260228140000 (contract_status text column kollisjon)
- Migration 20260428210000 (signing_contract_id FK — integrasjonspunkt)
- Council session 2026-04-07
