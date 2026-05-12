---
title: ADR-0024 Amendment — employment_contract vs contract System Separation
id: ADR_0079
status: accepted
layer: decision
created: 2026-04-08
updated: 2026-04-08
---

# ADR-0079: ADR-0024 Amendment — employment_contract vs contract System Separation

## Context and Problem Statement

ADR-0024 ("Contract System Architecture") fra 2026-02-28 beskriver et
kontrakt-system for B2B-klient-kontrakter (Smartout ↔ Restaurant) med framtidig
støtte for employee contracts, HACCP sign-offs, training acknowledgments og
season agreements. I praksis har kodebasen utviklet to separate systemer som
begge bruker ordet "contract":

1. **`contract`-tabellen + `contract_template`** (ADR-0024 canonical) —
   platform-legal dokumenter, terms-of-service, B2B avtaler,
   template-editoren med Tiptap + AI-tools, DocuSeal for signering.
2. **`employment_contract`-tabellen** (migration 00012) — HR-artefaktet med
   stilling, lønn, prosent, start/slutt, employment_category. Har egen
   `contract_status` enum og egen lifecycle.

Disse er koblet via `employment_contract.signing_contract_id` FK
(migration 20260428210000). Koblingen er teknisk men skaper betydelig
forvirring: council session 2026-04-07 identifiserte at brainstorm-designet
for den nye compliance-drevne kontrakt-motoren uklart refererte til begge
systemer om hverandre, med risiko for at feil tabell ble modifisert.

Samtidig har et naming-sammenstøt blitt oppdaget: migrasjon 20260228140000
har en platform-nivå `text`-kolonne kalt `contract_status` på en helt annen
tabell, ikke enum-en. Enhver migration må eksplisitt referere
`public.contract_status` for å unngå landmine.

## Decision Drivers

- ADR-0076 (Contract Composition as Cascade Derivation) er under utvikling
  og må ha klar ontologisk grense før implementasjon
- Cascade invariant #1 (én source of truth per datum) — to "contract"-systemer
  må ha eksplisitte ansvarsområder
- Council session 2026-04-07: Steward identifiserte dette som blokker
- Eksisterende kode i `/api/contracts/` og `/dashboard/contracts/` blander de
  to systemene uklart
- Naming-sammenstøt mellom enum og text-kolonne gjør ethvert ENUM-grep
  farlig

## Considered Options

1. **Ingen amendment — la ADR-0024 stå som er** — akseptere uklarhet.
   Avvises: dette er årsaken til council-blockeren i utgangspunktet.
2. **Slå sammen de to systemene** — flytt employment_contract-data inn i
   contract-tabellen som ny `contract_type = 'employment'`. Avvises: de har
   helt forskjellige lifecycle, forskjellige felt, forskjellige RLS-policies,
   forskjellige audience, forskjellig signing-flow. Sammenslåing = konstant
   nullable-felt og betinget logikk.
3. **Skriv amendment som eksplisitt separerer de to systemene, behold
   signing_contract_id FK som integrasjonspunkt** — anerkjenne virkeligheten,
   dokumentere grensen, lås ontologisk regler.

## Decision Outcome

Chosen option: **"Skriv amendment (denne ADR-en) som eksplisitt separerer
de to systemene"**.

### Canonical separation

**`contract` (ADR-0024 canonical domain):**
- Platform-legal dokumenter — terms of service, workspace-level B2B avtaler
- Editor med Tiptap + AI-tools i `packages/ai/src/tools/contract/`
- Microservice `services/contract-service/` (Fastify, port 5012)
- DocuSeal som e-signing provider
- Template-CRUD lever i platform-admin (`/platform-admin/contracts/*`)
- Status håndteres som plain text i metadata eller egen tabell
- **Eier:** `docs/modules/MODULE_15.md` (contract system) eller tilsvarende

**`employment_contract` (HR-artefaktet):**
- HR-spesifikk arbeidskontrakt — stilling, lønn, prosent, ansettelsestype,
  start/slutt
- Lever i `public.employment_contract`, migration 00012
- Egen `public.contract_status` ENUM (`'draft', 'sent', 'viewed', 'signed',
  'expired', 'terminated'`, snart utvidet med `'pending_data'` via ADR-0076)
- Composition engine er en cascade derivation (ADR-0076)
- Intake av ansatt-data er separat engine_process (ADR-0077)
- **Eier:** `docs/modules/MODULE_03.md` (HR / employment) eller tilsvarende

### Integration point

`employment_contract.signing_contract_id` er en FK til `contract(contract_id)`
og forblir den eneste tillatte koblingen. Når en `employment_contract` er
klar for signering, oppretter den en `contract`-rad av type `employee` og
setter `signing_contract_id`. Dette gir:

- DocuSeal-kompatibilitet (signing-infra bor i `contract`-systemet)
- `employment_contract` beholder sin HR-spesifikke struktur
- RLS på begge sider kan være uavhengige

### Forbidden patterns

1. **Forbudt:** Å legge HR-spesifikke felter (lønn, stilling, prosent) på
   `contract`-tabellen.
2. **Forbudt:** Å legge platform-legal-felter (ToS-versjoner, B2B-terms)
   på `employment_contract`-tabellen.
3. **Forbudt:** Migrasjoner som refererer til `contract_status` uten
   kvalifikasjon — må alltid være `public.contract_status` for å unngå
   sammenstøt med text-kolonnen i migration 20260228140000.
4. **Forbudt:** API-routes som blander handler for de to systemene. Dagens
   `/api/contracts/` håndterer `contract`-tabellen med
   `contract_type = 'employee'` — dette er teknisk korrekt for integration
   point men er semantisk misvisende. **Plan framover:** `/api/contracts/`
   håndterer kun `contract`-tabellen, nytt `/api/employment-contracts/`
   håndterer `employment_contract`-tabellen. Denne refactoren er ikke del
   av ADR-0076 Phase 1 men bør gjøres før Phase 2.

### Naming convention going forward

- **UI-tekst til sluttbruker:** "Arbeidsavtale" for `employment_contract`.
  "Brukeravtale" eller "Vilkår" for `contract`.
- **Kode:** variabelnavn skal speile tabellen. `employmentContract`-objekter
  er aldri `contract`-objekter.
- **I18n-keys:** separate namespaces (`employment_contract.*` vs
  `contract.*` eller tilsvarende)

## Rules & Consequences

- **Good, because** to systemer med klare grenser er enklere å reasonere om
  enn ett uklart system
- **Good, because** eksisterende kode overlever — ingen tvungen migrering
- **Good, because** `signing_contract_id` FK gjør integrasjonen tydelig og
  enveis (HR trigger signing, ikke omvendt)
- **Good, because** naming-sammenstøt dokumenteres og `public.`-prefiks blir
  obligatorisk konvensjon
- **Bad, because** "contract" som ord er fortsatt overloaded — nye
  developere må lære forskjellen
- **Bad, because** dagens `/api/contracts/` vil være semantisk inkonsistent
  inntil refactoren i Phase 2
- **Agent Impact:**
  - Botsson sin `createEmployeeContract` operer på `employment_contract`
    (via composition derivation per ADR-0076) og setter
    `signing_contract_id` når den oppretter signing-entity
  - Alle nye migrasjoner må bruke `public.contract_status` eksplisitt
  - Kode-review må fange opp "contract" variabelnavn som refererer til
    `employment_contract`-data

## References

- ADR-0024 (Contract System Architecture) — denne amendment bygger på men
  utvider ikke. ADR-0024 står som canonical for `contract`-domenet.
- ADR-0076 (Contract Composition as Cascade Derivation) — krever denne
  amendment for å ha klar ontologisk grense
- Council session 2026-04-07
- Migration 00012 (employment_contract foundation)
- Migration 20260228140000 (naming-sammenstøt — `contract_status` text column)
- Migration 20260428210000 (signing_contract_id FK)

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
