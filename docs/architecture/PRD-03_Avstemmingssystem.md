---
title: "PRD-03: Avstemmingssystem — Daglig, Yrkes- & Sesongavstemming"
id: PRD_03
version: "1.0"
status: canonical
layer: architecture
created: 2026-02-28
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on:
  - CORE_ARCH_V2
tags:
  - prd
  - reconciliation
  - operations
  - payroll
  - compliance
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# PRD-03: Avstemmingssystem — Daglig, Yrkes- & Sesongavstemming

**Kildeutviklere:** Pontus Lindroth & Martin Lundqvist
**Status:** Spesifikasjon
**Kontekst:** Brainstorming-sesjon i bil, renskrevet for implementering

---

## 1. Formål

Avstemmingssystemet sikrer at kritiske inputdata (timer, omsetning, avvik) bekreftes på daglig, yrkes- og sesongnivå — slik at Smartout kan beregne og styre drift, lønn, kvalitet og prestasjon uten eksterne integrasjoner.

---

## 2. Kjerneprinsipp

1. Data **skapes** i drift (punch, oppgaver, hendelser)
2. Data **bekreftes** gjennom avstemming (godkjenning, avvikhåndtering, omsetning)
3. Manglende data **trigger handoff** (AI-dialog → eskalering til telefon)
4. Alt er **policy-styrt** (frister, toleranser, eskalering)

---

## 3. Tre avstemmingsnivåer

### 3.1 Daglig avstemming (per avdeling)

**Scope:** avdeling + dato

**Start:** Første ansatt som checker inn starter en `DailyReconciliationSession`.

**Slutt:** Siste ansatt som checker ut trigger close-out prompt.

**Dekker:**

- Bemanningsoversikt (hvem var på jobb)
- Punch in/out (timer)
- Avvik (system + hendelser)
- Oppgaver (fullført / ikke fullført)
- Omsetning
- Status på avdelingens drift

### 3.2 Yrkesavstemming (periodisk, typisk månedlig)

**Scope:** rolle/yrke + periode

**Aggregerer og bekrefter:**

- Omsetning (hvis yrket knyttes til avdeling)
- Antall ansatte aktive i perioden
- Timer jobbet
- Sykefravær/perioder
- Over-/underforbruk vs forventning

### 3.3 Sesongavstemming (strategisk)

**Scope:** sesong-ID

**Bekrefter og lukker:**

- Budsjett vs faktisk
- Omsetning per uke/dagfaktor
- Arbeidstimer vs omsetning (labor %)
- Avviksmønstre
- Kapasitet og oppgaveutførelse
- Læring: oppdatering av sesongfaktorer og forventningsmodeller

---

## 4. DailyReconciliationSession — objektdefinisjon

```typescript
// Key: departmentId + date

// Felter:
// - status: OPEN | NEEDS_INPUT | READY_FOR_ADMIN | APPROVED | LOCKED
// - openedAt, openedBy (første inncheck)
// - closedAt, closedBy (siste utcheck)
// - shiftSummaries[]
// - taskSummary
// - systemDeviations[]
// - incidentDeviations[]
// - revenueStatus
// - handoffQueue[]
// - auditTrail[]
```

---

## 5. Daglig avstemming — steg for steg

### 5.1 Dagen åpnes (automatisk)

- **Trigger:** Første punch-in for avdelingen
- Opprett `DailyReconciliationSession` = OPEN
- Sett forventningsramme (oppgaver, policyer)
- Start oppgavesporing

### 5.2 Under dagen

- Punch-data samles automatisk
- Oppgaver logges
- Systemavvik genereres (sent inncheck, overtid etc.)
- Hendelser kan registreres av ansatte

### 5.3 Dagen lukkes (siste utcheck)

- **Trigger:** Siste punch-out for avdelingen
- **Close-out prompt til ansatt:**
  - Bekreft at oppgaver er utført iht beskrivelse
  - Kommenter hva som ikke er gjort
  - Kommenter hvem som manglet leveranse
  - Registrer hendelser

### 5.4 Admin avstemmer fra dashboard

Admin ser liste over dager med status (trafikklys). Klikk på dag → Avstemmingsvindu:

**Vinduet viser:**

**A. Vakter (timer)**

- Antall ansatte på jobb
- Inncheck/utcheck per person
- Beregnede timer
- Avvik per skift
- Actions: Godkjenn / Editer / Be om handoff

**B. Omsetning**

- Registrer / bekreft dagsomsetning

**C. Avvik**

- Systemavvik (policy)
- Hendelser (HMS/kunde/drift/materiell)

**D. Oppgaver**

- Fullført / ikke fullført
- Status per avdeling

### 5.5 Godkjenn dag

**Precondition (dag kan IKKE godkjennes før):**

- Alle vakter håndtert (approved / disputed)
- Omsetning registrert
- CRITICAL avvik behandlet
- Close-out prompt gjennomført (hvis policy krever)

**Resultat:** `DayApproval.status = APPROVED`
Låses etter policy (umiddelbart, etter N dager, eller etter lønnseksport).

---

## 6. Handoff-motor

Når admin trykker **"Handoff"** på en vakt/avvik:

### Steg 1: Chat-dialog (AI-assistent)

- System sender chatmelding til ansatt
- AI stiller målrettede spørsmål:
  - "Du sjekket ut 22:14, men pause mangler. Hadde du pause?"
  - "Du jobbet 40 min over plan. Var det godkjent overtid?"
  - "Oppgave X står ufullført. Ble den gjort?"
- AI strukturerer svarene

### Steg 2: Eskalering til telefon

Trigger: Ingen svar innen policyfrist, lav kvalitet, eller kritisk avvik.

- Telefonsamtale trigges
- Samtale oppsummeres i rapport

### Steg 3: Admin varsles

- "Handoff complete"
- Admin godkjenner/avslår
- Audit logges

---

## 7. Vaktgodkjenning — systemberegning og avvik

### Systemets jobb (automatisk)

Beregn `calculatedHours` fra punch-data og flagg:

- `late_checkin` — sent inncheck
- `early_checkout` — tidlig utcheck
- `missing_punch` — manglende punch
- `overtime_detected` — overtid
- `break_violation` — pausebrudd
- `overlap` — skiftoverlapp
- `anomaly_long_shift` — uvanlig lang vakt

### Adminens jobb (per vakt)

- Godkjenn som den er
- Juster timer (krever begrunnelse)
- Markér som DISPUTED
- "Godkjenn alle" kun hvis ingen HIGH/CRITICAL avvik

---

## 8. Policy-regler (systemnivå)

### Fristregler

"Dager kan ikke ligge mer enn **X dager** uavstemt i en periode på **Y**."
Settes per workspace og/eller avdeling.

### Eskaleringsregler

- Manglende omsetning innen X dager → eskalering
- CRITICAL incident → umiddelbar eskalering
- Overtid uten bekreftelse → blokkér daggodkjenning

### Datakrav for APPROVED

- Alle skift håndtert
- Omsetning registrert (hvis policy)
- Alle HIGH/CRITICAL avvik håndtert
- Close-out prompt gjennomført (hvis policy)

---

## 9. Viktig designprinsipp

Daglig avstemming er en **avstemmingssession**, ikke bare en admin-approval.

Den har:

- **Operativ sign-off** fra drift (første/siste ansatt)
- **Administrativ sign-off** fra leder/admin

---

## 10. Åpne spørsmål

1. "Første" og "siste" ansatt — basert på faktisk punch, plan, eller rolle (skiftleder)?
2. Skal close-out prompt være obligatorisk?
3. Kan admin overstyre omsetning etter godkjenning, eller låses den?
4. Skal avstemming alltid være per avdeling, eller kan den gjøres på workspace-nivå?
5. Skal yrkesavstemming trigge lønnskjøring/eksport, eller bare bekreftelse?
6. Skal handoff-frister være konfigurerbare per workspace?
