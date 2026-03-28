---
title: "Design — Journey Testing System"
status: done
updated: 2026-03-03
created: 2026-03-01
module: journey
tags: [testing, e2e, playwright, agent, manual-testing, feedback-loop, voice, botsson, posthog]
---

# Design — Journey Testing System

## Problem

Journey-modulen har 68 definierade journeys med en komplett livscykel (13 statusar), 4 output-generatorer, och en portal-UI. Men **ingen test körs faktiskt**. E2E-generatorn producerar skelett-kod (bara kommentarer), `journey_test_run`-tabellen är tom, och det finns ingen koppling mellan testresultat och journey-status.

## Vision

Varje journey bekräftas genom två gates innan den blir aktiv:

1. **Automatiserad E2E** — Claude Code-agent kör Playwright MCP mot appen, loggar resultat
2. **Manuell guidad test** — Mr. Botsson guidar via röst, PostHog lyssnar på klick, Pontus godkänner

Testerna förbättras över tid: self-healing selektorer, nya testfall från buggar, och historik som visar trender.

**Mr. Botsson är det centrala interfacet** för hela journey-modulen:

- Skapar journeys (wizard via röst eller text)
- Guidar manuella tester (voice + PostHog event-lyssnare)
- Bekräftar steg automatiskt baserat på användarens actions

## Approach

**Playwright MCP Native** — ingen ny stack. Claude Code + Playwright MCP med accessibility tree som interface.

Valdes över Stagehand (ny beroende, mer infrastruktur) och ren generator-approach (ingen self-healing, tester blir stale).

---

## Testflödets livscykel

```
Journey defined
       │
       ▼
┌──────────────────┐
│  AUTOMATED TEST  │  Agent + Playwright MCP
│  (E2E)           │  Kör mot localhost eller CI
│                  │  Skriver till journey_test_run
└────────┬─────────┘
         │ pass
         ▼
┌──────────────────┐
│  MANUAL TEST     │  Mr. Botsson guidar via röst
│  (Voice-guided)  │  PostHog lyssnar på klick
│                  │  Pontus godkänner
└────────┬─────────┘
         │ pass (Pontus godkänner)
         ▼
   Journey → "implemented"
         │
         ▼
   Journey → "active" (release)
```

### Status-mapping

| Gate          | Status före        | Status efter                   | Vem              |
| ------------- | ------------------ | ------------------------------ | ---------------- |
| Automated E2E | `ready_test`       | `testing` → `ready_validation` | Agent            |
| Manual guided | `ready_validation` | `implemented`                  | Pontus + Botsson |
| Release       | `implemented`      | `active`                       | Pontus           |

Inga nya enums — det befintliga 13-status-flödet täcker detta.

---

## Automatiserad testning (Agent + Playwright MCP)

### Arkitektur

```
Claude Code agent (i worktree)
       │
       │ Läser journey + steg från DB
       │
       ▼
Playwright MCP Server
       │
       │ Accessibility tree snapshots
       │ (inte screenshots)
       │
       ▼
Browser (headed lokalt / headless i CI)
       │
       │ Navigerar, klickar, fyller i, assertar
       │
       ▼
Resultat → journey_test_run (DB)
       │
       ▼
Journey status transition (om pass)
```

### Hur agenten kör ett test

1. **Läser journey-definition** — steg, preconditions, test_assertion, screen-routes
2. **Seedar testdata** — skapar test-användare, workspace, nödvändig data via Supabase
3. **Kör steg för steg** — Playwright MCP ger accessibility tree, agenten bestämmer nästa action
4. **Assertar per steg** — `expects`-fältet på varje `journey_step` jämförs mot faktiskt DOM-tillstånd
5. **Final assertion** — `journey.test_assertion` ("User sees empty dashboard with onboarding prompt")
6. **Skriver resultat** — INSERT i `journey_test_run` med pass/fail, duration, error_message, test_output

### Portal-knappar

| Knapp                 | Action                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| **Run E2E Test**      | Triggar automated test via agent + Playwright MCP. Browser öppnas automatiskt (headed lokalt). |
| **Start Manual Test** | Öppnar ny browser-tab till journey-startpunkt + aktiverar Botsson voice.                       |

### Self-healing loop

```
Test misslyckas
       │
       ▼
Agent analyserar:
  - Selector ändrats? → Uppdatera test
  - Verklig bugg? → Markera fail, logga
  - Flakyness? → Kör om (max 2 retries)
       │
       ▼
Vid selector-ändring:
  Agent läser nuvarande accessibility tree
  Matchar mot journey_step.action/expects
  Uppdaterar testlogiken
  Kör om
       │
       ▼
Resultat loggas i journey_test_run
  (inkl. om self-heal skedde i test_output JSONB)
```

### CI-körning

- GitHub Actions kör Playwright specs vid PR till `development`
- Headless Chrome, samma specs som lokalt
- Resultat postas till `journey_test_run` via Supabase service role
- Om fail → PR blockas inte (recommended-gate) men journey-status uppdateras inte

---

## Manuell guidad testning (Voice + PostHog)

### Arkitektur

```
Pontus öppnar appen i browser
       │
       ├── PostHog trackar klick, navigation, events
       │
       ▼
Mr. Botsson (voice via Ultravox/LiveKit)
       │
       │ Läser journey_step[]
       │ Lyssnar på PostHog events
       │ Guidar steg för steg via röst
       │
       ▼
PostHog event-matchning:
  $pageview       → matchar journey_step.screen
  $autocapture    → matchar journey_step.action
  custom events   → matchar journey_step.data_writes
       │
       ▼
Botsson bekräftar per steg:
  "✅ Steg 3 av 7 klart. Vidare till steg 4..."
       │
       ▼
Alla steg passerade?
  → Botsson: "Alla steg klara! Godkänner du?"
  → Pontus: "Ja"
  → Journey → "implemented"
```

### Flödet i praktiken

1. **Pontus klickar "Start Manual Test"** i journey-portalen
2. **Ny browser-tab öppnas** till journey-startpunkten (t.ex. `/onboarding`)
3. **Mr. Botsson aktiveras** — voice connection via Ultravox/LiveKit
4. **Botsson läser journey-stegen** och guidar:
   - _"Steg 1 av 7. Du ska nu fylla i företagsnamn och välja bransch. Klicka på fältet 'Företagsnamn'."_
5. **PostHog fångar klick** — agenten ser `$pageview` och `$autocapture` events
6. **Botsson bekräftar per steg:**
   - _"Bra! Jag ser att du navigerade till /onboarding/step-2. Steg 1 avklarat."_
7. **Om fel:** _"Hmm, jag förväntade mig att du skulle se en dropdown med branscher, men det verkar inte ha laddats. Kan du berätta vad du ser?"_
8. **Alla steg klara:** _"Alla 7 steg godkända! Vill du markera denna journey som implementerad?"_

### PostHog event-matchning

| journey_step fält              | PostHog event                   |
| ------------------------------ | ------------------------------- |
| `screen` (/onboarding/step-2)  | `$pageview` med `$current_url`  |
| `action` (klicka "Nästa")      | `$autocapture` med element text |
| `data_writes` (company tabell) | Custom event eller API-anrop    |

### Manuell test-logg

Skriver `journey_test_run` med steg-detaljer:

```json
{
  "type": "manual",
  "guided_by": "botsson_voice",
  "posthog_session_id": "session_abc123",
  "steps": [
    { "step": 1, "result": "pass", "note": null, "posthog_events": ["$pageview:/onboarding"] },
    { "step": 2, "result": "pass", "note": null, "posthog_events": ["$autocapture:click:Nästa"] },
    { "step": 3, "result": "fail", "note": "Bransch-dropdown tom", "posthog_events": [] }
  ]
}
```

### Skillnad automated vs manual

|                      | Automated (E2E)          | Manual (Voice-guided)       |
| -------------------- | ------------------------ | --------------------------- |
| Vem kör              | Agent + Playwright MCP   | Pontus i riktig browser     |
| Guide                | Ingen (agent är autonom) | Mr. Botsson via röst        |
| Event-lyssnare       | Playwright DOM events    | PostHog analytics events    |
| Vad testas           | Funktionell korrekthet   | UX, visuellt, logik, känsla |
| Self-healing         | Ja (selektorer)          | Nej (mänsklig bedömning)    |
| Godkännande          | Automatiskt vid pass     | Pontus explicit godkännande |
| Kan blockera release | Nej (recommended)        | Ja (required gate)          |

---

## Journey Wizard — Voice-tillägg

### Befintlig wizard (behålls)

Text-baserad chat i portalen. 6-fas wizard med AI-agent. Fungerar bra.

### Ny: Voice-alternativ

- **"Start med röst"**-knapp bredvid befintlig wizard-chat
- Samma 6-fas wizard, men via Mr. Botsson voice
- Botsson kan föreslå en **färdig draft direkt** baserat på kort beskrivning:
  - Pontus: _"Jag behöver en journey för när en anställd byter lösenord"_
  - Botsson: _"Jag har förberett ett utkast med 5 steg: ..."_
  - Pontus: _"Ser bra ut, spara"_
- Text-chat finns alltid som fallback

### Arkitektur

```
Pontus klickar "Start med röst"
       │
       ▼
Ultravox/LiveKit voice session
       │
       ▼
Botsson kör samma journey-agent (packages/ai/src/agents/journey.ts)
  men med voice in/out istället för text
       │
       ▼
Kan generera färdig draft direkt (skip 6-fas-flow om simple journey)
       │
       ▼
Draft sparas i wizard_session.draft_journey
       │
       ▼
Pontus godkänner → journey skapas
```

---

## Feedback-loop och testförbättring

### Tre feedback-typer

**1. Selector-healing (automatisk)**

- Test failar → agent inspekterar nuvarande accessibility tree
- Hittar elementet via semantisk matchning mot `journey_step.action`
- Uppdaterar testet → kör om → loggar att self-heal skedde

**2. Test-expansion (agent-initierad)**

- Mönster i `journey_test_run`-historik → mer robust setup
- Manuellt test hittade edge case → agent skapar nytt automated test
- Bugrapporter → agent genererar nya testfall

**3. Journey-definition uppdatering (manuell trigger)**

- Manuellt test avslöjar att `expects` inte matchar verkligheten
- Agent föreslår uppdatering av journey_step
- Pontus godkänner → definition uppdateras → alla outputs regenereras

---

## Teknisk implementation

### Nya beroenden

| Beroende           | Syfte                                                 |
| ------------------ | ----------------------------------------------------- |
| `@playwright/mcp`  | Browser-styrning för agent via Claude Code MCP-server |
| PostHog API client | Läsa events i realtid under manuell test              |

Ultravox/LiveKit redan i stacken.

### Databasändringar

Inga nya tabeller. En kolumn:

- `journey_test_run.test_type` — `'automated'` \| `'manual'` (skilja i historik)

### Kodändringar

| Komponent                         | Ändring                                           | Prio        |
| --------------------------------- | ------------------------------------------------- | ----------- |
| E2E-generatorn (`journey-e2e.ts`) | Körbar output med faktiska selektorer             | Hög         |
| Test-runner API                   | `POST /api/platform-admin/journeys/[id]/run-test` | Hög         |
| Test-historik API                 | `GET /api/platform-admin/journeys/[id]/test-runs` | Hög         |
| Portal UI — test-tab              | Historik, Run E2E-knapp, Start Manual Test-knapp  | Hög         |
| Playwright MCP config             | `.claude/settings.json`                           | Hög (setup) |
| Journey test agent skill          | Claude Code skill för automated tests             | Hög         |
| Manual test voice session         | Botsson voice + PostHog event-lyssnare            | Hög         |
| Wizard voice-alternativ           | "Start med röst"-knapp + Botsson voice wizard     | Medium      |
| CI integration                    | GitHub Action för journey E2E-specs               | Medium      |
| Portal UI — historik              | Trendvy per journey                               | Låg (v2)    |
| Self-healing logic                | Agent analyserar fail, uppdaterar test            | Låg (v2)    |

### Fasning

**Fas 1 — Grund (test-infrastruktur)**

- DB-migration: `test_type`-kolumn
- Test-runner API + test-historik API
- Playwright MCP config
- Portal: Run E2E-knapp + Start Manual Test-knapp + resultatvisning
- Journey test agent skill (Claude Code)
- Agent kan köra automated test och logga resultat

**Fas 2 — Voice + PostHog (manuell test-upplevelse)**

- PostHog event-lyssnare (query events under test-session)
- Mr. Botsson voice session för manuell test-guide
- Botsson bekräftar steg automatiskt via PostHog events
- Wizard voice-alternativ ("Start med röst" + färdig draft)
- CI-pipeline med GitHub Actions

**Fas 3 — Feedback loop (self-improvement)**

- Self-healing selektorer
- Test-expansion från bugrapporter
- Journey-definition uppdateringar från testresultat
- Portal: trendvy och historik

---

## Medvetet utelämnat

- Ingen auto-generering av tester utan mänsklig trigger
- Ingen auto-merge vid pass
- Inget LLM-as-judge för assertions (hard assertions först)
- Ingen Linear-sync (skapas som issues manuellt vid behov)
