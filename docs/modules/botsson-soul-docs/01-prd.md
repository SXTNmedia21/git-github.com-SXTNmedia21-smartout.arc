---
title: PRD — Botsson Soul
status: draft
version: 0.1
created: 2026-05-15
module: agent-system
tags: [botsson, prd, agent, soul]
---

# PRD — Botsson Soul

## Problem

Botsson oppleves ikke konsekvent på tvers av chat og voice.

I dagens løsning kan brukeren justere persona, rank, blend og custom instruction i UI, men disse valgene påvirker primært voice-kanalen. Chat-kanalen bruker fortsatt mission-default / standard Botsson-oppsett.

Dette skaper produktmessig dissonans:

- Brukeren tror han har tunet hele Botsson.
- Voice endrer oppførsel.
- Chat oppfører seg uendret.
- Tilliten til agenten svekkes.

---

## Mål

Brukeren skal kunne justere Botssons personlighet og oppleve samme Botsson i chat, voice og fremtidige kanaler.

Målet er ikke at alle kanaler skal ha samme tekniske evner. Målet er at Botsson skal ha samme løste identitet, posture, context, memory og authority envelope, selv om modell og tool-bundle varierer per kanal.

---

## Brukere

| Bruker | Behov |
|---|---|
| Owner/admin | Definere workspace-default for Botsson |
| Manager | Ha en operativ assistent som følger rolle og autoritet |
| Employee | Få trygg, forståelig og kontekstuell hjelp |
| Trainee | Få mer veiledning, varme og steg-for-steg støtte |

---

## Use cases

1. Bruker velger Botsson-personlighet.
2. Bruker justerer tone og svarstil.
3. Bruker velger stemme og hastighet for voice.
4. Bruker legger inn egen instruks.
5. Bruker får samme Botsson-opplevelse i chat og voice.
6. Admin definerer workspace-default.
7. Systemet logger hva som faktisk ble løst per agent-run.

---

## Ikke-mål

Dette prosjektet skal ikke:

- Gi bruker mer authority gjennom persona.
- La frontend sende autoritativ system-prompt.
- Bygge full agent marketplace.
- Erstatte eksisterende C4 authority-system.
- Gjøre voice og chat identiske teknisk.
- Eksponere alle avanserte posture-akser i første versjon.

---

## Suksesskriterier

- Chat og voice deler samme resolved identity.
- Brukerpreferanser overlever ny browser/device.
- Authority kan ikke overstyres av persona eller custom instruction.
- Channel policy kan blokkere verktøy uavhengig av persona.
- Hver agent-run kan spores til et soul snapshot.
- UI blir enklere: brukeren styrer opplevelse, ikke intern arkitektur.

---

## Kjernebeslutning

Botsson Soul skal behandles som et server-kompilert runtime-kontraktlag, ikke som frontend prompt-state.

Frontend sender preferanser. Stage-engine løser endelig sjel.
