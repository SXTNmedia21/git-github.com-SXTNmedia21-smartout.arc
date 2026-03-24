---
title: "Ansatte"
id: MANUAL_04
version: "1.0"
status: canonical
layer: manual
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on: []
slug_en: staff-management
tags:
  - manual
  - employees
  - organization
  - roles
  - norwegian
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Ansatte

> Organisasjonsstruktur, profiler, roller, kompetansesporing — administrer teamet ditt effektivt.

---

## Organisasjonsstruktur

SmartOut organiserer ansatte gjennom en hierarkisk struktur med fire byggeklosser:

| Element      | Beskrivelse                               | Permanent?                |
| ------------ | ----------------------------------------- | ------------------------- |
| **Avdeling** | Faglig enhet (Kjøkken, Sal, Bar)          | Ja                        |
| **Lokasjon** | Fysisk plassering (Hovedbygg, Terrasse)   | Ja                        |
| **Team**     | Arbeidsgruppe (Kveldslaget, Brunchteamet) | Kan være sesongbasert     |
| **Stilling** | Funksjon per vakt (Kokk, Hovmester)       | Per vakt, ikke per person |

> Avdelinger er permanente og endres sjelden. Team kan opprettes og avvikles etter sesong. Stillinger tildeles per vakt — en person kan ha ulike stillinger på ulike vakter.

---

## Profiler

Hver ansatt har en **profil** som er knyttet til en spesifikk arbeidsplass. En person kan ha profiler i flere arbeidsplasser.

### Profilinformasjon

- **Visningsnavn** — Navnet som vises i dashbordet
- **Rolle** — employee, manager, admin eller owner
- **Status** — trainee, active, inactive eller offboarding
- **Avdeling** — Primæravdeling
- **Kompetanser** — Fullførte protokoller og sertifiseringer
- **Kontaktinfo** — E-post, telefon, nødkontakt

### Profilstatus

| Status          | Beskrivelse                                                         |
| --------------- | ------------------------------------------------------------------- |
| **Trainee**     | Nyansatt i opplæring. Sandbox-modus — ingen påvirkning på live data |
| **Aktiv**       | Fullt operativ ansatt med tilgang til alle funksjoner               |
| **Inaktiv**     | Pause eller permisjon. Vises ikke i vaktplan                        |
| **Offboarding** | I ferd med å slutte. Begrensede tilganger                           |

---

## Roller og tilganger

SmartOut har fire rollenivåer med stigende tilgang:

1. **Employee** — Kan se sin egen vaktplan, fullføre oppgaver, chatte
2. **Manager** — Alt i employee + kan redigere vaktplan, godkjenne fravær, se rapporter for sitt team
3. **Admin** — Alt i manager + kan konfigurere arbeidsplass, invitere ansatte, administrere protokoller
4. **Owner** — Alt i admin + kan administrere bedrift, abonnement og fakturering

> Rollene gjelder per arbeidsplass. En person kan være admin i én arbeidsplass og employee i en annen.

### Teamleder

Teamleder er ikke en rolle, men en egenskap på teamet. Teamlederen har utvidet innsyn i sitt eget team, men ingen ekstra systemtilganger utover sin vanlige rolle.

---

## Kompetansesporing

SmartOut sporer kompetansen til hver ansatt gjennom fullførte protokoller:

- **Protokoller** — Hvilke retningslinjer den ansatte har gjennomført
- **Sertifiseringer** — HACCP-kurs, allergenhåndtering, brannvern, osv.
- **Utløpsdatoer** — Varsling når sertifiseringer nærmer seg fornyelse
- **Readiness score** — Prosentvis fullføring av alle tildelte krav

> Kompetansedataene brukes automatisk i vaktplanlegging — systemet varsler hvis du prøver å tildele en vakt til noen uten riktig kompetanse.

---

## Ansattvisninger

### For ledere

- **Personalliste** — Oversikt over alle ansatte med filtrering per avdeling, status og rolle
- **Kompetansematrise** — Visuell oversikt over hvem som kan hva
- **Progresjonsrapport** — Følg med på onboarding og opplæringsstatus

### For ansatte

- **Min profil** — Se og oppdater egen kontaktinformasjon
- **Min opplæring** — Oversikt over tildelte og fullførte moduler
- **Min CV** — Eksporterbar oversikt over kompetanser og erfaring
