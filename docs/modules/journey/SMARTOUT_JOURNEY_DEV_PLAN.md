---
title: "Journey Dev Plan"
status: in_progress
updated: 2026-03-11
created: 2026-03-01
module: journey
language: sv
tags: [journey, plan, implementation]
---

# SMARTOUT — Journey System Development Plan

> **Tre faser. Integrerat i existerande build order.**
> March 2026
> **Kontext:** Smartout migreras från Bubble till Next.js/Supabase. Journey Portal är styrverktyget för hela migrationen — inte ett separat projekt.

---

## Översikt

|  Fas  | Namn                  | Tidsram           | Vad du får                                                                                                                      |
| :---: | --------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Foundation & Tracking | Vecka 1 (3 dagar) | Portal med alla 68 journeys synliga, pipeline, filtrering, statuskontroll. Du kan se allt och flytta journeys genom livscykeln. |
| **2** | Agent & Deep Specs    | Vecka 2-3         | Journey Agent wizard. Du kan definiera nya journeys via konversation. Output-generering (E2E, docs, Linear, Botsson).           |
| **3** | Runtime & Automation  | Löpande           | Test-runner kopplad till riktig E2E. Linear-integration. Auto-generering vid statusändring. AI-trigger för implementation.      |

---

## FAS 1: Foundation & Tracking (3 dagar)

**Mål:** Du har en fungerande portal på `/admin/journeys` där du ser alla journeys, kan filtrera, och manuellt flytta dem genom livscykeln. Detta blir ditt dagliga styrverktyg.

### Dag 1: Databas + Seed

**Morgon — Migrations:**

```
Skapa tabeller:
  journey              — huvudtabell (alla 68 journeys)
  journey_step         — steg per journey
  journey_event        — audit log (statusändringar)
  journey_test_run     — testresultat-historik

RLS:
  workspace_id isolation på alla tabeller

Index:
  idx_journey_workspace, idx_journey_module, idx_journey_status
  idx_journey_slug (unique per workspace)
```

**Eftermiddag — Seed Data:**

```
Ladda alla 68 journeys från JOURNEY_REGISTRY.md:
  - Core (3), Onboarding (5), Org (2), Scheduling (8)
  - Operations (7), HACCP (4), Training (5), Absence (3)
  - Payroll (3), Communication (4), Reports (4), Settings (3)
  - AI (3), Season (3), Governance (2), Contracts (3)
  - Certifications (2), Meta (4)

Sätt status baserat på vad som redan finns i Bubble:
  - Journeys som redan fungerar i Bubble → status: 'active'
  - Journeys som byggs just nu → status: 'building'
  - Journeys planerade → status: 'defined' eller 'idea'

Skapa steg för varje journey (från registret).
```

**Kväll — TypeScript types:**

```
packages/types/src/journey.ts
  Journey, JourneyStep, JourneyEvent, JourneyTestRun
  Alla enums: JourneyStatus, Actor, ModuleCode, Platform, Priority
  Zod-schemas för validering
```

### Dag 2: Portal UI — Table + Pipeline

**Morgon — Pipeline-vy:**

```
apps/web/app/admin/journeys/page.tsx

Komponenter:
  JourneyPipeline       — 13 statuskort med antal + progress bars
  JourneyFilters        — Modul, status, aktör, prioritet, sök
  JourneyTable          — Sortbar tabell med alla journeys
  JourneyRow            — En rad: ID, titel, modul, aktör, plattform, prioritet, status, outputs
  JourneyStatusChanger  — Dropdown med validerade övergångar
```

**Eftermiddag — Hooks + API:**

```
hooks/useJourneys.ts       — Hämta + filtrera journeys (Supabase query)
hooks/useJourneyStats.ts   — Pipeline-statistik
hooks/useJourneyStatus.ts  — Statusändring med övergångsvalidering

lib/status-transitions.ts  — Definierar tillåtna övergångar:
  idea → wizard | defined
  defined → ready_impl
  ready_impl → building
  building → review
  review → ready_test | building
  ready_test → testing
  testing → ready_validation | building
  ready_validation → implemented
  implemented → active | inactive
  active → inactive | broken
  broken → testing
```

### Dag 3: Detail View + Events

**Morgon — Journey Detail:**

```
apps/web/app/admin/journeys/[id]/page.tsx

Komponenter:
  JourneyDetail          — Header med klassificering + status
  JourneySteps           — Visuell steg-flow
  JourneyEventLog        — Historik: alla statusändringar, edits
  JourneyRelations       — Relaterade + blockerade journeys

Tabs (innehåll genereras statiskt i fas 1):
  🗺️ Journey (stegen)
  🧪 E2E Test (placeholder)
  📖 Doc (placeholder)
  🔲 Linear (placeholder)
  🤖 Botsson (placeholder)
```

**Eftermiddag — Event Logging:**

```
Varje statusändring → INSERT i journey_event:
  { journey_id, event_type: 'status_change', from_status, to_status, actor_id, timestamp }

Visa som timeline i detail view.
```

### Fas 1 Leverans

Du har:

- ✅ `/admin/journeys` med alla 68 journeys
- ✅ Pipeline-vy: se exakt hur många journeys som är i varje fas
- ✅ Filtrera på modul, aktör, status, prioritet, sök
- ✅ Klicka på journey → se steg, klassificering, relationer
- ✅ Flytta journeys genom livscykeln med validering
- ✅ Historik: varje statusändring loggad
- ✅ Fungerar med RLS — workspace-isolerat

**Du kan nu börja använda portalen som styrverktyg för migrationen.** Varje morgon: öppna portalen, se pipeline, flytta journeys som du jobbar med.

---

## FAS 2: Agent & Output-generering (Vecka 2-3)

**Mål:** Journey Agent wizard för att definiera nya journeys. Automatisk generering av E2E-tester, onboarding-docs, Linear issues, och Botsson-scripts.

### Vecka 2: Journey Agent

**Databas:**

```
Ny tabell: wizard_session
  id, workspace_id, journey_id (null tills skapad),
  status ('active' | 'completed' | 'abandoned'),
  current_phase ('discovery' | 'classification' | 'steps' | 'testing' | 'documentation' | 'review'),
  messages (jsonb array), draft_journey (jsonb),
  created_by, created_at, completed_at
```

**Agent System Prompt:**

```
Journey Agent som guider genom 6 faser:
  1. Discovery — Vad ska användaren kunna göra? Vem? När?
  2. Classification — Modul, aktör, plattform, prioritet, tags (AI föreslår)
  3. Steps — Steg-för-steg definition
  4. Testing — Generera testassertions från stegen
  5. Documentation — Norsk doc-titel + Botsson-script
  6. Review — Sammanfattning, bekräfta, spara

Agenten har tillgång till alla 68 existerande journeys för:
  - Dubblettdetektering
  - Relaterade journeys
  - Konsistenskontroll
```

**UI:**

```
apps/web/app/admin/journeys/wizard/page.tsx
apps/web/app/admin/journeys/wizard/[sessionId]/page.tsx

Komponenter:
  WizardChat             — Chatgränssnitt med agenten
  WizardPhaseIndicator   — Visar vilken fas du är i
  WizardDraftPreview     — Live-preview av journeyn som byggs
  WizardMessageBubble    — Agent vs user-meddelanden
```

**Implementation:**

- Anthropic API-anrop från Supabase Edge Function
- System prompt med fullständig kontext (taxonomi, existerande journeys)
- Varje meddelande sparas i wizard_session.messages
- Draft byggs upp progressivt i wizard_session.draft_journey
- Vid completion → INSERT i journey-tabellen med status 'defined'

### Vecka 3: Output-generering

**Output Generators:**

```
lib/output-generators/
  e2e-generator.ts       — Journey → Playwright/Detox testkod
  doc-generator.ts       — Journey → Norsk onboarding-guide (markdown)
  linear-generator.ts    — Journey → Linear issue spec (markdown)
  botsson-generator.ts   — Journey → Voice walkthrough script
```

**Hur det fungerar:**

```
1. Öppna journey detail → Klicka på tab (🧪 E2E / 📖 Doc / 🔲 Linear / 🤖 Botsson)
2. Output genereras on-demand från journey-data
3. "Kopiera" → Klistrar in i relevant verktyg
4. "Skapa i Linear" → Anropar Linear MCP → Issue skapas med full spec
5. Output cachas i journey-tabellen (för snabb återhämtning)
```

**AI-förstärkt generering (valfritt):**

```
För Deep Spec-nivå outputs (varje knapp, event, notification, poäng):
  - Generatorn skickar journey + context till Anthropic API
  - AI expanderar till full Deep Spec-format
  - Resultat sparas och visas i portalen
```

### Fas 2 Leverans

Du har:

- ✅ Journey Agent: definiera nya journeys genom konversation
- ✅ Dubblettdetektering: agenten varnar om liknande journey finns
- ✅ Auto-klassificering: AI föreslår modul, tags, prioritet
- ✅ 4 output-generatorer: E2E, doc, Linear, Botsson
- ✅ Kopiera outputs eller skapa direkt i Linear
- ✅ Wizard-historik: se alla tidigare wizard-sessioner

---

## FAS 3: Runtime & Automation (Löpande)

**Mål:** Portalen blir levande — koppla till riktiga tester, automatisera statusflöden, och förbered för AI-driven implementation.

### 3.1 Test Runner (när E2E-tester finns)

```
Koppling: Journey Portal ↔ Playwright/Detox test suite

Varje journey med output_e2e = true:
  - "Kör test" → Triggar Playwright via CI/CD webhook
  - Resultat rapporteras tillbaka → journey_test_run
  - Pass/fail visas i portalen
  - Regression: om Active journey failar → auto-status: 'broken'

Nattlig körning:
  - Alla 'active' journeys testas
  - Rapport nästa morgon i portalen
```

### 3.2 Linear-integration (live)

```
Vid status → 'ready_impl':
  - Auto-erbjud: "Skapa Linear issue?"
  - Om ja → Anropa Linear MCP:
    - Skapa issue med full spec (från linear-generator)
    - Länka issue-ID tillbaka till journey.linear_issue_id
    - Label: modulens namn, prioritet

Synk:
  - Linear issue stängs → Journey status → 'ready_test' (förslag)
  - Journey status ändras → Kommentar på Linear issue
```

### 3.3 Auto-generering vid statusändring

```
Status → 'defined':
  - Auto-generera alla 4 outputs (e2e, doc, linear, botsson)

Status → 'active':
  - Publicera onboarding doc till help center
  - Aktivera Botsson-script i AI-lagret
  - Aktivera E2E-test i nattlig körning

Status → 'inactive':
  - Avpublicera onboarding doc
  - Inaktivera Botsson-script
  - Exkludera från nattlig testkörning

Status → 'broken':
  - Skapa Linear issue automatiskt: "REGRESSION: [Journey titel]"
  - Notifiera via Slack/push
```

### 3.4 AI Implementation Trigger (framtid)

```
Status → 'ready_impl' + klicka "Implementera med AI":
  1. Generera execution contract (DECISIONS.md, BREAKDOWN.md format)
  2. Kontraktet innehåller:
     - Alla steg från Deep Spec
     - Databas-operationer → migrations att skapa
     - UI-element → komponenter att bygga
     - Test assertions → tester att skriva
  3. Execution contract → Claude Code / Cursor
  4. AI-agent bygger → PR skapas
  5. Status auto → 'review'
```

---

## Integrering med Smartout Build Order

Journey Portal mappar direkt till din existerande fasplan:

| Smartout Build Phase       | Journey Portal Action                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Phase 0: Foundation**    | Bygg Fas 1 av portalen (3 dagar). Seed alla 68 journeys.                                                                  |
| **Phase 1: Onboarding**    | Öppna portalen → Filtrera modul = Onboarding → 5 journeys. Flytta J-001, J-002, J-004-008 genom pipeline medan du bygger. |
| **Phase 2: Org Structure** | Filtrera modul = Org → 2 journeys. J-009, J-010.                                                                          |
| **Phase 3: Scheduling**    | Filtrera modul = Scheduling → 8 journeys. Biggest module. Använd Agent om du upptäcker fler journeys.                     |
| **Phase 4: Operations**    | Filtrera modul = Operations → 7 journeys. Bygg Deep Specs för de kritiska (J-019 Punch har vi redan).                     |
| **Phase 5-11: Resten**     | Varje modul → filtera → se exakt vilka journeys att bygga → flytta genom pipeline.                                        |

**Dagligt arbetsflöde:**

```
1. Öppna /admin/journeys
2. Se pipeline: var står jag? Vad är 'building'? Vad är 'broken'?
3. Välj nästa journey att jobba med
4. Generera Linear issue (output-tab)
5. Bygg → Flytta till 'review' → 'testing' → 'active'
6. Portalen visar progress i realtid
```

---

## Summering

|  Fas  |   Effort   | Vad det ger dig                                            |
| :---: | :--------: | ---------------------------------------------------------- |
| **1** |  3 dagar   | Styrverktyg. Se allt. Flytta genom pipeline. Dagligt bruk. |
| **2** | 1-2 veckor | Skapa & specificera. Agent wizard. Auto-generera outputs.  |
| **3** |  Löpande   | Automation. Live tester. Linear-synk. AI-implementation.   |

Fas 1 är allt du behöver för att börja. Fas 2 gör dig snabbare. Fas 3 gör systemet intelligent.

**Fas 1 är 3 dagars arbete. Efter det har du ett komplett styrverktyg för hela Smartout-migrationen.**
