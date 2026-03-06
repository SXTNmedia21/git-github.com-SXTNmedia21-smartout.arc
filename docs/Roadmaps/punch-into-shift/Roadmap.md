---
title: "Roadmap: Punch Into Shift"
status: draft
updated: 2026-03-06
created: 2026-03-06
module: operations
tags: [roadmap, operations, employee]
---

# Roadmap: Punch Into Shift

## Package Identity

- Package ID: `JP-R019-PUNCH-INTO-SHIFT`
- Roadmap ID: `R-019`
- Journey ID: `J-019`
- Mission ID: `M-019` (TBD)
- License ID: `L-019` (TBD)

Related package docs:

- `docs/Roadmaps/punch-into-shift/Journey.md` (pending)
- `docs/Roadmaps/punch-into-shift/Mission.md` (pending)
- `docs/Roadmaps/punch-into-shift/License.md` (pending)

## Business Intent

Ansatte skal kunne stemple seg inn på sin planlagte vakt direkte fra mobilappen. Stemplingen markerer offisiell start pa arbeidstiden, aktiverer sesjonen for avdelingen, og laster dagsaktuelt innhold (oppgaver, dagsbriefing, meldinger) i feed-en. Korrekt tidsregistrering er kritisk for lovetterlevelse (Arbeidsmiljeloven), lonnsberegning, og operasjonell oversikt.

GPS-verifisering kan konfigureres per workspace for a sikre at ansatte befinner seg pa arbeidsplassen. Gamification belonner punktlighet og bygger gode vaner gjennom poeng, streaks og achievements. Trainee-modus sikrer at nye ansatte kan ove seg uten a pavirke reelle data.

## Actor & Platform

| Field    | Value      |
| -------- | ---------- |
| Actor    | employee   |
| Platform | mobile     |
| Priority | P0         |
| Module   | operations |

## Scope

### In scope

- Visning av punch-in CTA pa Home-tab nar vakt er innenfor +/- 30 minutter
- Tap for a stemple inn med bekreftelse
- GPS-verifisering (konfigurerbar per workspace)
- Opprettelse av punch_record i databasen
- Oppdatering av skiftstatus til in_progress
- Kontekstbytte til aktiv sesjons-feed
- Gamification: poeng, bonuser, achievements, streaks
- Sanntids-broadcast til manager og medarbeidere
- Varsler til manager ved forsinkelse
- Compliance-sjekker (11-timers hvile, maks uketimer)
- Audit trail for alle stemplinger
- Trainee/sandbox-modus

### Out of scope

- Punch out (J-024)
- Manuell tidskorrigering (manager-journey)
- Vaktbytter og tilgjengelighetsregistrering
- Fravarsregistrering
- Automatisk punch via geofence (fremtidig)

## Success Criteria

1. Ansatt ser punch-in-knapp nar vakt starter innen 30 minutter
2. Stempling oppretter punch_record med korrekt tidsstempel og GPS-data
3. App bytter automatisk til aktiv sesjons-kontekst med feed
4. Poeng tildeles korrekt basert pa punktlighet (2-7 poeng for i tide, negativ for sent)
5. Manager far varsel ved forsinkelse over 5 minutter
6. Audit trail logges med timestamp, GPS, enhet og IP
7. Trainee-stempling pavirker ikke reelle sesjonsdata

## Related Journeys

| Relation        | Journey                           | Why                                      |
| --------------- | --------------------------------- | ---------------------------------------- |
| Requires        | J-011 Check My Schedule           | Ansatt ma vite at de har en vakt         |
| Leads to        | J-020 Work Through Feed Tasks     | Etter stempling lastes feed med oppgaver |
| Leads to        | J-021 View Day Brief              | Dagsbriefing vises etter stempling       |
| Opposite        | J-024 Punch Out & See Summary     | Avslutter det denne journey-en starter   |
| Sandbox variant | J-005 Module Journey (Operations) | Trainee gjor sandbox-stempling           |

## Acceptance Criteria

1. Punch CTA vises kun nar skift er innenfor +/- 30 min og ansatt ikke allerede er stemplet inn (User Test)
2. Ansatt forstaar forskjellen mellom i-tide og forsent stempling og konsekvensene (Knowledge Test)
3. punch_record opprettes korrekt, skiftstatus oppdateres, realtime-broadcast sendes (Function Test)
4. Full flyt fra CTA-visning til feed-lasting fungerer pa mobile viewport (E2E Test)

## Event Motor Pattern

- **Start-hook:** Ansatt apner appen og vakt er innenfor +/- 30 minutter av navarende tid
- **Events:** `SHIFT_PUNCHED_IN`, `SESSION_EMPLOYEE_JOINED`, `CONTEXT_SWITCH`, gamification-events, notification-events
- **Stop-hook:** Feed lastet med sesjons-innhold, poeng tildelt, audit trail logget
