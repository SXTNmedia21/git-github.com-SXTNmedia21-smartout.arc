---
title: "Kommunikasjon"
id: MANUAL_07
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
  - communication
  - chat
  - notifications
  - norwegian
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Kommunikasjon

> Chat, varsler, kunngjøringer, eskalering og stille timer — hold teamet informert og koordinert.

---

## Oversikt

SmartOut har et innebygd kommunikasjonssystem som erstatter behovet for eksterne chat-apper og SMS-grupper. Alt skjer innenfor plattformen — med full kontroll over hvem som ser hva, og når varsler sendes.

---

## Chat

Teamchat i SmartOut er organisert i kanaler:

| Kanaltype     | Beskrivelse                | Eksempel          |
| ------------- | -------------------------- | ----------------- |
| **Avdeling**  | Alle i avdelingen          | #kjøkken, #sal    |
| **Team**      | Alle i teamet              | #kveldslaget      |
| **Driftsøkt** | Aktiv økt for dagens drift | #sal-onsdag-15jan |
| **Direkte**   | Én-til-én-samtale          | Leder ↔ ansatt    |

### Funksjoner

- **Tekst og bilder** — Send meldinger med vedlegg
- **Lest-kvitteringer** — Se hvem som har lest meldingen
- **Tråder** — Svar i tråder for å holde samtaler ryddige
- **Pinning** — Fest viktige meldinger øverst i kanalen
- **Søk** — Fulltekstsøk i alle kanaler du har tilgang til

---

## Varsler

SmartOut sender varsler gjennom flere kanaler:

| Kanal                 | Bruksområde                               |
| --------------------- | ----------------------------------------- |
| **Push-notifikasjon** | Sanntidsvarsler i appen                   |
| **SMS**               | Kritiske varsler (vaktbytte, haster)      |
| **E-post**            | Oppsummeringer, rapporter, dokumenter     |
| **Stemme**            | Automatisk ringeoppringing ved eskalering |

### Varseltyper

- **Vaktbytte-forespørsel** — Noen ønsker å bytte vakt med deg
- **Ny oppgave** — En oppgave er tildelt deg
- **Avvik** — Et kontrollpunkt er utenfor grensene
- **Kunngjøring** — Generell informasjon fra ledelsen
- **Påminnelse** — Ufullført opplæring eller utløpende sertifisering

---

## Kunngjøringer

Ledere kan sende kunngjøringer til hele arbeidsplass, avdeling eller team:

1. **Skriv kunngjøringen** — Tittel og innhold
2. **Velg mottakere** — Arbeidsplass, avdeling, team eller enkeltpersoner
3. **Velg kanal** — Push, SMS, e-post eller alle
4. **Krev bekreftelse** — Valgfritt: mottakerne må bekrefte at de har lest

> Kunngjøringer med bekreftelseskrav vises i et eget «ulest»-felt til den ansatte bekrefter.

---

## Eskalering

SmartOut har automatisk eskalering for ubesvarte varsler:

1. **Første varsel** — Push-notifikasjon til den ansatte
2. **Etter 15 minutter** — SMS sendes
3. **Etter 30 minutter** — Varselet eskaleres til nærmeste leder
4. **Etter 60 minutter** — Varselet eskaleres til admin

> Eskaleringstider kan konfigureres per arbeidsplass.

---

## Stille timer

For å respektere ansattes fritid, støtter SmartOut **stille timer**:

- **Standard:** 22:00–07:00 — ingen push-varsler
- **Tilpasset:** Hver ansatt kan sette sine egne stille timer
- **Unntak:** Kritiske varsler (haster-vaktendringer) kan bryte gjennom stille timer

> Stille timer gjelder kun push-notifikasjoner. SMS og e-post sendes normalt, men vises først når stille timer er over.

---

## Overlevering

Ved vaktskifte kan avtroppende ansatt overlevere informasjon til påtroppende:

- **Overleveringsnotat** — Fritekst med viktig informasjon
- **Uferdige oppgaver** — Automatisk overført til neste driftsøkt
- **Flaggede saker** — Markerte hendelser som trenger oppfølging
