---
title: "Rapporter og avstemming"
id: MANUAL_09
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
  - reports
  - reconciliation
  - kpi
  - norwegian
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Rapporter og avstemming

> Daglig avstemming, KPI-dashboard, sesongavstemming og rapporttyper — datadrevet innsikt for bedre drift.

---

## Oversikt

SmartOuts rapportmodul gir deg innsikt i driften gjennom tre nivåer: daglig avstemming, løpende KPI-oppfølging og sesongbasert evaluering. Alt bygger på data som samles inn automatisk gjennom vaktplan, driftsøkter og stemplingsur.

---

## Daglig avstemming

Daglig avstemming (Daily Reconciliation) er prosessen der dagens drift oppsummeres og godkjennes:

1. **Automatisk oppsummering** — Systemet samler data fra alle driftsøkter
2. **Kasseavstemming** — Registrer kontant- og kortomsetning (OCR-støtte for POS-kvitteringer)
3. **Avviksrapport** — Oversikt over ufullførte oppgaver, temperaturavvik og fravær
4. **Lederens godkjenning** — Lederen signerer avstemmingen digitalt

| Data              | Kilde                   |
| ----------------- | ----------------------- |
| Arbeidstimer      | Stemplingsur            |
| Oppgavefullføring | Driftsøkter             |
| Omsetning         | Kasseavstemming         |
| Temperaturlogg    | HACCP-rutiner           |
| Avvik             | Automatisk registrering |

> OCR-funksjonen lar deg ta bilde av POS-kvitteringen med mobilen. SmartOut leser av tallene automatisk.

---

## KPI-dashboard

KPI-dashbordet gir sanntids oversikt over nøkkeltall:

### Drifts-KPIer

- **Oppgavefullføring** — Prosent av tildelte oppgaver som er fullført
- **Readiness score** — Gjennomsnittlig onboarding-progresjon
- **HACCP-compliance** — Andel godkjente temperaturlogger
- **Fravær** — Fraværsprosent per avdeling

### Økonomi-KPIer

- **Lønnskostnad per omsetning** — Personalkostnad som andel av inntekt
- **Omsetning per arbeidtime** — Produktivitetsmåling
- **Budsjett vs. faktisk** — Avvik fra planlagt bemanning
- **Overtidskostnad** — Totale overtidstimer og kostnader

### Personal-KPIer

- **Turnover** — Personalgjennomtrekk per periode
- **Opplæringstid** — Gjennomsnittlig tid fra trainee til aktiv
- **Kompetansedekning** — Andel ansatte med riktige sertifiseringer

---

## Sesongavstemming

Ved sesongslutt genererer SmartOut en komplett sesongrapport:

- **Totaler** — Samlet omsetning, arbeidstimer, lønnskostnad
- **Trender** — Utvikling over sesongen med grafer
- **Sammenligning** — Mot forrige sesong eller budsjett
- **Topp og bunn** — Beste og svakeste avdelinger/perioder
- **Anbefalinger** — AI-genererte forslag til forbedringer

---

## Rapporttyper

| Rapport           | Frekvens         | Mottaker           |
| ----------------- | ---------------- | ------------------ |
| Daglig avstemming | Daglig           | Leder, admin       |
| Ukerapport        | Ukentlig         | Admin, owner       |
| Lønnsrapport      | Per lønnsperiode | Admin              |
| HACCP-rapport     | På forespørsel   | Admin, Mattilsynet |
| Sesongrapport     | Per sesong       | Owner              |
| Kompetanserapport | På forespørsel   | Admin              |

> Alle rapporter kan eksporteres som PDF eller CSV.

---

## Automatiske varsler

SmartOut sender automatiske varsler basert på KPI-terskler:

- **Fravær over grense** — Varsler når fraværsprosenten overstiger konfigurert nivå
- **Budsjettavvik** — Varsler når lønnskostnad avviker mer enn 10 % fra budsjett
- **HACCP-brudd** — Umiddelbar varsling ved temperaturavvik
- **Lav readiness** — Varsler når nye ansatte ikke gjør fremgang
