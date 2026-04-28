---
title: "Roadmap: Check My Schedule"
status: draft
updated: 2026-03-06
created: 2026-03-06
module: scheduling
tags: [roadmap, scheduling, employee]
---

# Roadmap: Check My Schedule

## Package Identity

- Package ID: `JP-R011-CHECK-MY-SCHEDULE`
- Roadmap ID: `R-011`
- Journey ID: `J-011`
- Mission ID: `M-011` (TBD)
- License ID: `L-011` (TBD)

Related package docs:

- `./Journey.md`
- `./Mission.md` (pending)
- `./License.md` (pending)

## Business Intent

En ansatt trenger raskt og enkelt tilgang til sine kommende vakter. Dette er den mest brukte handlingen i appen -- ansatte sjekker vaktplanen daglig for aa vite naar de skal jobbe, hvor de skal vaere, hvilken rolle de har, og hvem de jobber med.

Reisen er skrivebeskyttet og skal fungere feilfritt paa mobil. Rask lasting og tydelig visuell oversikt er kritisk for brukeropplevelsen.

## Actor & Platform

| Field    | Value      |
| -------- | ---------- |
| Actor    | Employee   |
| Platform | Mobile     |
| Priority | P1         |
| Module   | scheduling |

## Scope

### In scope

- Vise kalender/listeoversikt over ansattes egne publiserte vakter
- Trykke paa en vakt for aa se detaljer (tid, lokasjon, rolle, kollegaer)
- Filtrere/navigere mellom uker

### Out of scope

- Redigere eller bytte vakter (J-017 Swap Shift)
- Opprette nye vakter (J-015 Build Weekly Schedule)
- Se andres vakter (admin-funksjon)
- Varsler om vaktendringer (separat notifikasjonsreise)
- Godkjenne eller avslaa vakter

## Success Criteria

1. Ansatt kan se sine publiserte vakter innen 2 sekunder etter navigasjon til vakt-fanen
2. Vaktdetaljer viser korrekt tid, lokasjon, rolle og kollegaer for hver vakt
3. Kun publiserte vakter (`is_published = true`) er synlige for ansatte

## Related Journeys

| Relation | Journey                        | Why                                                            |
| -------- | ------------------------------ | -------------------------------------------------------------- |
| Requires | J-003 Login & Route to Context | Ansatt maa vaere innlogget og ha en profil i workspace         |
| Requires | J-015 Build Weekly Schedule    | Vakter maa vaere opprettet og publisert foer ansatt kan se dem |
| Leads to | J-017 Swap Shift               | Ansatt kan onske aa bytte en vakt etter aa ha sett planen      |
| Leads to | J-016 Handle Sick Call         | Ansatt kan melde seg syk fra vaktvisningen                     |

## Acceptance Criteria

These map directly to verification gates in the License:

1. Ansatt kan navigere til vaktfanen og se en liste over sine kommende vakter (User Test)
2. Ansatt kan forklare hvor de finner vaktdetaljer og hva de ser (Knowledge Test)
3. Kun vakter der `employee_id` matcher innlogget profil og `is_published = true` returneres (Function Test)
4. Navigasjon til vaktfane -> vakter vises -> trykk paa vakt -> detaljer korrekte (E2E Test)

## Event Motor Pattern

- **Start-hook:** Ansatt navigerer til "Vakter"-fanen i mobilappen
- **Events:**
  - `schedule.viewed` -- Ansatt aapner vaktlisten
  - `shift.detail_viewed` -- Ansatt trykker paa en spesifikk vakt
- **Stop-hook:** Ansatt har sett vaktinformasjonen og navigerer videre
