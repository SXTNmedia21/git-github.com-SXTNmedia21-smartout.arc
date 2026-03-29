---
title: "Engine Agent Runtime — Journey-Driven Missions with Guardian Orchestration"
status: draft
updated: 2026-03-23
created: 2026-03-23
module: ai
tags: [engine, guardian, missions, journeys, ultravox, lise, botsson, runtime]
---

# Engine Agent Runtime — Journey-Driven Missions with Guardian Orchestration

## Summary

Runtime architecture for AI agents (Lise, Guardian, Botsson) that collaborate during a user session. Journeys provide the **what + when** (steps, expectations, timing). Missions provide the **how** (personality, tools, prompts). Guardian orchestrates progression and coaches agents in real-time. Proof of concept: Lise onboarding.

---

## System Roles

| System       | Responsibility                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Journey**  | VAD + NÄR — ordered steps with actions, expected outcomes, screens, data requirements, and time triggers                            |
| **Mission**  | HUR — agent personality, system prompt, tools, and stage-specific instructions                                                      |
| **Guardian** | ORCHESTRATION + COACHING — monitors events, drives stage progression, whisper-corrects agents, enforces journey completion criteria |
| **Lise**     | EXECUTION — conducts the conversation with the user (voice via Ultravox or text)                                                    |
| **Botsson**  | TAKEOVER — continues in dashboard after onboarding with full context from Lise's session                                            |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    ONBOARDING SESSION                │
│                                                      │
│  Journey J-001 "Ny arbeidsplass"                     │
│  ├── Step 1: Bedriftsinfo                           │
│  ├── Step 2: Sesong                                 │
│  ├── Step 3: Avdelingar                             │
│  └── Step 4: Avslutning                             │
│                                                      │
│  Mission "onboarding-interview"                      │
│  ├── Stage: greeting     ← journey_step_id: step 1  │
│  ├── Stage: discovery    ← journey_step_id: step 1  │
│  ├── Stage: confirm      ← journey_step_id: step 2  │
│  ├── Stage: season       ← journey_step_id: step 2  │
│  ├── Stage: departments  ← journey_step_id: step 3  │
│  └── Stage: closing      ← journey_step_id: step 4  │
│                                                      │
│  ┌──────────┐  whisper   ┌──────────┐               │
│  │ GUARDIAN  │ ────────→  │   LISE   │ ← user        │
│  │ (coach +  │            │ (voice/  │               │
│  │ orchestr) │ ←──events──│  text)   │               │
│  └─────┬─────┘            └──────────┘               │
│        │                                             │
│        │ trigger when onboarding complete             │
│        ▼                                             │
│  ┌──────────┐                                        │
│  │ BOTSSON  │  ← tar över i dashboard                │
│  └──────────┘                                        │
└─────────────────────────────────────────────────────┘
```

---

## 1. Journey→Mission Runtime Coupling

### Current State

Schema supports linking (`engine_missions.journey_id`, `engine_stages.journey_step_id`) but runtime ignores it. Session creation loads mission and stages but never fetches linked journey data.

### Target State

At session start, the stage engine loads the full journey alongside the mission:

```
POST /sessions (mission_id: "onboarding-interview")
  1. Load mission → get journey_id
  2. Load journey + all journey_steps (ordered by step_order)
  3. Load mission stages → each knows its journey_step_id
  4. Build "enriched context" per stage:
     - Journey step: action, expects, screen, component, data_reads, data_writes
     - Mission stage: instructions, personality_override, emotion_hint, tools
     - Combined = agent knows EXACTLY what the user should do,
       which screen they're on, and what data to collect
  5. Store enriched context in session.context.journey
```

### Enriched Prompt Injection

Each stage's system prompt is augmented with journey context:

```
AKTUELT STEG (2 av 4): "Sesong"
- Brukerens skjerm: /onboarding/season
- Forventet resultat: Sesongnavn, start/sluttdato, budsjett
- Data du skal samle: season.name, season.start_date, season.end_date, season.budget
- UI-komponent: SeasonSection
- Neste steg: "Avdelinger" (steg 3)
- Samlet så langt: { company.name: "Burger Bar", company.address: "Storgata 1" }
- Progresjon: 1/4 steg fullført
```

### Time Dimension

Journey steps carry timing metadata:

| Field                     | Purpose                          | Example                       |
| ------------------------- | -------------------------------- | ----------------------------- |
| `min_duration_seconds`    | Don't auto-advance before this   | 30s (give user time to look)  |
| `max_duration_seconds`    | Guardian nudges if exceeded      | 300s (5 min timeout per step) |
| `session_timeout_seconds` | Abandon if total session exceeds | 1800s (30 min)                |

---

## 2. Guardian as Orchestrator

### Event-Driven Stage Progression

Guardian listens to all session events and evaluates them against the journey's completion criteria.

```
Event: data.collected (entity: "company", data: { name: "Burger Bar" })
  → Guardian checks journey step 1 data_writes: [company.name, company.address, company.phone]
  → company.name ✓, company.address ✗, company.phone ✗
  → Not complete. No action.

Event: data.collected (entity: "company", data: { address: "Storgata 1", phone: "+47..." })
  → company.name ✓, company.address ✓, company.phone ✓
  → Step 1 COMPLETE → Auto-advance to step 2
  → Emit: guardian.auto_advance { from_step: 1, to_step: 2 }
```

### Completion Criteria Evaluation

For each journey step, Guardian checks:

1. **Required data** — all `data_writes` fields populated in collected_data
2. **Minimum time** — `min_duration_seconds` elapsed since stage start
3. **User confirmation** — if step requires explicit confirmation (optional flag)

If all criteria met → auto-advance. If agent tries to advance without criteria met → block + whisper.

---

## 3. Guardian as Coach

### Whisper Injection

Guardian sends corrections to the agent via the existing whisper mechanism (`collected_data._whispers[]`). Whispers are delivered when the agent next calls `fetch`.

### Coaching Triggers

| Trigger         | Detection                                           | Whisper                                   |
| --------------- | --------------------------------------------------- | ----------------------------------------- |
| Missing fields  | Timer: 60s into step, required fields not collected | "Spør om: {missing_fields}"               |
| Off-topic       | Last 3 agent utterances don't relate to step.action | "Styr tilbake til {step.title}"           |
| Timeout warning | 80% of max_duration_seconds reached                 | "Tid: {remaining}s igjen på dette steget" |
| Hard timeout    | max_duration_seconds exceeded                       | "Avslutt steget og gå videre"             |
| User silence    | No user message in 45 seconds                       | "Brukeren er stille — engasjer dem"       |
| Data quality    | Collected data fails validation                     | "Ugyldig {field}: {reason}"               |

### Off-Topic Detection

Simple heuristic (v1): Compare last N events' content against the current journey step's `action` and `expects` fields using keyword overlap. No LLM call needed for v1.

Future (v2): Use intent classifier to score relevance.

---

## 4. Guardian Evaluation Loop

New process in the stage engine that evaluates session health:

```typescript
// Triggered by: events + 30-second timer
async function evaluateSession(sessionId: string) {
  const session = await loadSession(sessionId);
  const journey = await loadJourney(session.journey_id);
  const currentStep = journey.steps[session.stage_index];

  // 1. Data completeness check
  const required = currentStep.data_writes;
  const collected = session.collected_data;
  const missing = required.filter((field) => !hasValue(collected, field));

  if (missing.length === 0 && stageTimeElapsed > currentStep.min_duration_seconds) {
    await advanceStage(session);
    emit("guardian.auto_advance", { session_id: sessionId, step: currentStep.title });
    return;
  }

  // 2. Timeout check
  const stageTime = elapsedSeconds(session.stage_started_at);
  if (stageTime > currentStep.max_duration_seconds) {
    whisper(session, `Timeout på "${currentStep.title}". Saknar: ${missing.join(", ")}`);
    emit("guardian.timeout", { session_id: sessionId, missing });
    return;
  }

  // 3. Nudge for missing fields (after 60s)
  if (stageTime > 60 && missing.length > 0) {
    whisper(session, `Spør om: ${missing.join(", ")}`);
    emit("guardian.nudge", { session_id: sessionId, missing });
  }

  // 4. Off-topic detection
  const recentEvents = await getRecentEvents(sessionId, 5);
  const relevance = assessTopicRelevance(recentEvents, currentStep);
  if (relevance < 0.5) {
    whisper(session, `Styr tilbake til: ${currentStep.title}`);
    emit("guardian.off_topic", { session_id: sessionId, relevance });
  }
}
```

**Trigger points:**

- Every `data.collected` event
- Every `user.message` / `agent.response` event
- Timer: every 30 seconds for active sessions

---

## 5. Voice Integration (Ultravox ↔ Guardian)

### Current Flow

```
Dashboard → POST /adapters/ultravox/create-call
  → Creates session + 3 HTTP tools (store, fetch, advance)
  → Starts Ultravox call
  → Returns joinUrl

Ultravox → calls store/fetch/advance tools → Stage Engine
```

### Enhanced Flow

```
POST /adapters/ultravox/create-call (mission_id with journey)
  → Load mission + journey
  → First stage prompt = mission.systemPrompt + journey step context
  → Build 4 HTTP tools (store, fetch, advance, getJourneyContext)
  → Start Ultravox call

During call:
  Ultravox → store → Stage Engine → Guardian listens
  Guardian → "step 1 complete!" → auto-advance triggered
  → Ultravox advance tool called automatically
  → New prompt with step 2 context injected
  → X-Ultravox-Response-Type: new-stage (seamless transition)

Guardian coaching:
  → Whisper written to collected_data._whispers[]
  → Next time agent calls fetch → whisper included in response
  → Agent adjusts behavior (< 5 second delay in practice)
```

### Ultravox Limitation

Ultravox has no push channel — we cannot interrupt the agent mid-utterance. Whispers are delivered at the next tool call. In practice, Lise calls tools frequently enough that whisper delay is < 5 seconds.

---

## 6. Botsson Takeover

### Trigger

When Guardian detects `session.completed` for an onboarding mission:

1. Emit `onboarding.completed` event
2. Store session summary in `engine_memory` for the profile
3. Mark handoff data: `{ handoff_to: "mr-botsson", context_session_id: session.id }`

### Context Transfer

Botsson receives full context from Lise's session:

```typescript
// When Botsson session starts for this profile:
const liseSession = await getCompletedSession(profileId, "onboarding-interview");
const memories = await loadMemories(profileId);

// Botsson's enriched context:
{
  prior_onboarding: {
    collected_data: liseSession.collected_data,
    duration_minutes: liseSession.duration,
    journey_steps_completed: liseSession.journey_progress,
    key_facts: liseSession.collected_data.key_facts,
  },
  memories: memories, // Lise's saveMemory() data
  relationship: {
    first_contact: liseSession.created_at,
    onboarding_completed: liseSession.completed_at,
  }
}
```

### Botsson's Opening

Botsson doesn't start from scratch:

```
"Hei Pontus! Lise fortalte meg at dere driver Burger Bar i Oslo
med 3 avdelinger. Jeg er Mr. Botsson — din AI-assistent for
daglig drift. Skal vi ta en titt på vaktplanen?"
```

---

## 7. Data Model Changes

### New/Modified Tables

**`journey_step` additions:**

- `min_duration_seconds` (INT, nullable) — minimum time before auto-advance
- `max_duration_seconds` (INT, nullable) — Guardian timeout trigger
- `required_confirmation` (BOOL, default false) — explicit user OK needed

**`engine_sessions` additions:**

- `journey_id` (UUID FK → journey, nullable) — the journey driving this session
- `stage_started_at` (TIMESTAMPTZ) — when current stage began (for timing)
- `guardian_whisper_count` (INT, default 0) — coaching intensity metric

**`guardian_log` new event types:**

- `guardian.auto_advance` — Guardian drove stage progression
- `guardian.nudge` — Guardian whispered about missing fields
- `guardian.off_topic` — Guardian corrected off-topic behavior
- `guardian.timeout` — Guardian flagged timeout
- `guardian.user_silence` — Guardian detected idle user

### No New Tables

Everything fits in existing schema. The Guardian evaluation loop is in-process (stage engine), not a separate service.

---

## 8. Proof of Concept: Lise Onboarding

### Journey Definition

```
Journey J-001: "Ny arbeidsplass i Smartout"
  Actor: admin
  Platform: desktop
  Module: onboarding

  Step 1: "Bli kjent + bedriftsinfo"
    action: "Presentér deg og oppgi bedriftens navn, adresse, telefon"
    expects: "Lise fyller inn bedriftsinfo i UI"
    screen: /onboarding/business
    component: BusinessSection
    data_writes: [company.name, company.address, company.phone, company.org_number]
    max_duration_seconds: 300

  Step 2: "Sesong"
    action: "Fortell om årets sesonger og budsjett"
    expects: "Lise oppretter sesong med datoer og mål"
    screen: /onboarding/season
    component: SeasonSection
    data_writes: [season.name, season.start_date, season.end_date]
    max_duration_seconds: 300

  Step 3: "Avdelinger og team"
    action: "Beskriv avdelingene og hvem som jobber der"
    expects: "Lise legger til avdelinger i systemet"
    screen: /onboarding/departments
    component: DepartmentsSection
    data_writes: [departments[]]
    max_duration_seconds: 300

  Step 4: "Avslutning"
    action: "Bekreft at alt stemmer"
    expects: "Oppsummering og overgang til dashboard"
    screen: /onboarding/done
    component: DoneSection
    required_confirmation: true
    max_duration_seconds: 120
```

### Mission Stages (linked)

```
Mission: onboarding-interview
  journey_id: J-001

  Stage: greeting → journey_step: step 1
  Stage: discovery → journey_step: step 1
  Stage: confirm → journey_step: step 2
  Stage: season → journey_step: step 2
  Stage: departments → journey_step: step 3
  Stage: closing → journey_step: step 4
```

### Guardian Rules for PoC

| Rule                | Trigger                                          | Action                                     |
| ------------------- | ------------------------------------------------ | ------------------------------------------ |
| Auto-advance        | All data_writes collected + min_duration elapsed | Advance stage                              |
| Missing field nudge | 60s into step, fields missing                    | Whisper: "Spør om {fields}"                |
| Off-topic redirect  | 3 utterances without step-relevant keywords      | Whisper: "Styr tilbake til {step}"         |
| Timeout warning     | 80% of max_duration reached                      | Whisper: "Tid snart ute"                   |
| Hard timeout        | max_duration exceeded                            | Whisper: "Avslutt steget"                  |
| User silence        | No user input 45s                                | Whisper: "Brukeren er stille"              |
| Session complete    | All steps done + step 4 confirmed                | Emit onboarding.completed, trigger Botsson |

---

## 9. Key Design Decisions

| Decision                         | Choice                                     | Reason                                                                                         |
| -------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Guardian runs in-process         | Part of stage engine, not separate service | Sub-100ms event handling, no network overhead, shares session state                            |
| Whispers via fetch poll          | Not push-based                             | Ultravox has no push channel; polling on tool calls gives < 5s delay                           |
| Auto-advance by Guardian         | Not by agent                               | Agent shouldn't decide progression — Guardian enforces journey completion criteria objectively |
| Off-topic detection: keywords v1 | Not LLM-based                              | Fast, cheap, sufficient for PoC. Upgrade to intent classifier in v2                            |
| Botsson gets full context        | Via engine_memory + session data           | No separate handoff protocol needed — just read the data                                       |
| Time fields on journey_step      | Not on mission stage                       | Time belongs to the journey (what + when), not the mission (how)                               |

---

## 10. Success Criteria

The PoC is successful when:

1. Lise starts an onboarding conversation with journey-enriched prompts
2. Guardian auto-advances stages when all required data is collected
3. Guardian whispers corrections when Lise misses fields or goes off-topic
4. Voice flow (Ultravox) works end-to-end with Guardian oversight
5. Botsson opens with personalized greeting using Lise's collected data
6. Full session is visible in Guardian dashboard with all events logged
