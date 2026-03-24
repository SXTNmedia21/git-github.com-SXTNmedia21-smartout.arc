---
title: "Lise AI-assistent"
id: MANUAL_08
version: "1.0"
status: canonical
layer: manual
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on: []
tags:
  - manual
  - ai
  - lise
  - voice
  - norwegian
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Lise AI-assistent

> 8 AI-motorer, autorisasjonsnivåer, stemmegrensesnitt og hendelseslogg — møt Lise, din operative medarbeider.

---

## Hva er Lise?

Lise er SmartOuts AI-assistent. Hun er designet som en operativ medarbeider — ikke bare en chatbot. Lise forstår din arbeidsplass, kjenner reglene, og kan hjelpe med alt fra vaktplanlegging til HACCP-spørsmål.

> Lise er ikke en generell AI. Hun er trent på SmartOuts domene og har kun tilgang til data du har rett til å se.

---

## 8 AI-motorer

Lise drives av åtte spesialiserte motorer som samarbeider:

| Motor             | Funksjon                                                              |
| ----------------- | --------------------------------------------------------------------- |
| **Kontekst**      | Forstår hvem du er, hvilken rolle du har, og hva som skjer akkurat nå |
| **Kunnskap**      | Søker i retningslinjer, protokoller og opplæringsmateriell            |
| **Reise**         | Guider trainees gjennom onboarding-moduler steg for steg              |
| **Lønn**          | Besvarer spørsmål om lønn, tillegg og arbeidstid                      |
| **Kommunikasjon** | Hjelper med å forfatte meldinger, kunngjøringer og varsler            |
| **Drift**         | Gir oversikt over pågående driftsøkter, oppgaver og avvik             |
| **Opplæring**     | Forklarer prosedyrer og hjelper med kunnskapstester                   |
| **Forretning**    | Analyserer KPIer, trender og gir anbefalinger                         |

---

## Autorisasjonsnivåer

Lise respekterer SmartOuts rollemodell. Hva hun kan gjøre avhenger av din rolle:

| Rolle        | Lise kan                                                                          |
| ------------ | --------------------------------------------------------------------------------- |
| **Employee** | Besvare spørsmål om egen vaktplan, oppgaver og opplæring                          |
| **Manager**  | Alt over + vise teamrapporter, foreslå vaktendringer, hjelpe med avvikshåndtering |
| **Admin**    | Alt over + gi innsikt i arbeidsplass-KPIer, foreslå konfigurasjonsendringer       |
| **Owner**    | Alt over + forretningsanalyse, abonnementsinformasjon                             |

> Lise kan aldri se data du ikke har tilgang til. Autorisasjonssjekken skjer i sanntid.

---

## Grensesnitt

### Chat

Lise er tilgjengelig som chat i dashbordet. Du kan stille spørsmål på norsk (eller engelsk) og få svar i sanntid.

**Eksempler på spørsmål:**

- «Hvem jobber i morgen?»
- «Vis meg HACCP-loggen for i dag»
- «Forklar prosedyren for åpning av kjøkkenet»
- «Hva er readiness score for de nye ansatte?»

### Stemme

Lise støtter stemmegrensesnitt via Ultravox. Du kan snakke med henne direkte fra dashbordet — nyttig i travle situasjoner der du ikke kan skrive.

> Stemmegrensesnittet bruker sanntids tale-til-tekst og tekst-til-tale for naturlig samtale.

---

## Hendelseslogg

Alle interaksjoner med Lise logges i en hendelseslogg:

- **Spørsmål og svar** — Hva ble spurt, og hva Lise svarte
- **Handlinger** — Hva Lise gjorde (f.eks. endret vaktplan, sendte varsel)
- **Feilregistrering** — Hvis Lise ga feil informasjon, kan det rapporteres

> Hendelsesloggen er tilgjengelig for administratorer og brukes til å forbedre Lise over tid.

---

## Begrensninger

- Lise kan **ikke** ta avgjørelser som krever lederens godkjenning uten eksplisitt bekreftelse
- Lise har **ikke** tilgang til personopplysninger utover det som er relevant for forespørselen
- Lise **logger** alle handlinger for transparens og revisjon
