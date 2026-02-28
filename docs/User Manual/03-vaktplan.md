---
title: "Vaktplan"
id: MANUAL_03
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
  - scheduling
  - shifts
  - norwegian
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Vaktplan

> Tre visningsmodi, vaktkort, maler, tilgjengelighet, vaktbytte og stemplingsur — alt du trenger for skiftplanlegging.

---

## Oversikt

Vaktplanen er kjernen i daglig drift. Her planlegger du skift, tildeler personale, håndterer tilgjengelighet og følger opp faktisk arbeidstid. SmartOut tilbyr tre ulike visningsmodi for å gi deg full oversikt.

---

## Visningsmodi

### Ansa-visning (person)

Viser vaktplanen organisert etter ansatte. Hver rad er en person, og kolonnene er dager. Du ser raskt hvem som jobber når, og kan dra-og-slippe vakter mellom ansatte.

### Jobb-visning (stilling)

Organisert etter stillingstyper (Kokk, Hovmester, Bartender). Hver rad er en stilling, og du ser om det er nok folk i hver funksjon per dag. Nyttig for å sikre riktig bemanning.

### Team-visning

Grupperer skift etter team. Ideelt for sesongbaserte lag eller kryssfunksjonelle grupper.

> Du kan bytte mellom visningsmodi når som helst — dataene er de samme, bare perspektivet endres.

---

## Vaktkort

Hvert skift er representert som et **vaktkort** med følgende informasjon:

| Felt     | Beskrivelse                             |
| -------- | --------------------------------------- |
| Person   | Hvem som er tildelt vakten              |
| Stilling | Hvilken funksjon (Kokk, Servitør, osv.) |
| Tid      | Start- og sluttidspunkt                 |
| Lokasjon | Hvor vakten utføres                     |
| Status   | Planlagt, bekreftet, pågår, fullført    |
| Oppgaver | Tilknyttede driftsoppgaver for vakten   |

### Vaktkortdetaljer

Klikk på et vaktkort for å se utvidet informasjon:

- **Detaljer** — Tidspunkt, pause, stilling og notater
- **Funksjoner** — Spesielle oppgaver for denne vakten
- **Historikk** — Endringer og byttinger
- **Lønn** — Beregnet kostnad inkludert tillegg
- **Oppgaver** — Tildelte driftsoppgaver og prosedyrer

---

## Maler

SmartOut støtter vaktplanmaler for å spare tid:

1. **Lag mal fra eksisterende uke** — Kopier en ferdig vaktplan som mal
2. **Bruk mal** — Appliser en lagret mal på en ny uke
3. **Automatisk generering** — La SmartOut foreslå en vaktplan basert på historikk, budsjett og tilgjengelighet

---

## Tilgjengelighet

Ansatte kan registrere sin tilgjengelighet direkte i appen:

- **Tilgjengelig** — Kan jobbe
- **Foretrukket fri** — Ønsker fri, men kan kontaktes
- **Utilgjengelig** — Kan ikke jobbe (ferie, sykdom, annet)

> Tilgjengelighetsinformasjon vises direkte i vaktplanen med fargekoder, slik at planleggeren ser konflikter umiddelbart.

---

## Vaktbytte

Ansatte kan be om å bytte vakter seg imellom:

1. Den ansatte velger vakten de vil bytte bort
2. Systemet viser hvem som er tilgjengelig og kvalifisert
3. Den andre ansatte aksepterer bytteforespørselen
4. Lederen godkjenner (eller avslår) byttet

> Vaktbytte er kun mulig mellom ansatte som har riktig kompetanse for stillingen.

---

## Stemplingsur

SmartOut har et integrert stemplingsur som registrerer faktisk arbeidstid:

- **Stemple inn** — Registrer oppmøte ved vaktstart
- **Stemple ut** — Registrer avgang ved vaktende
- **Pauseregistrering** — Dokumenter pauser automatisk
- **Avviksrapportering** — Systemet varsler om for sen ankomst eller for tidlig avgang

Stemplingsurdata brukes til lønnsberegning, rapportering og KPI-oppfølging.
