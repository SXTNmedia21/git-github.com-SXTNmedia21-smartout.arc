---
title: "Module: Botsson — Voice Agent System"
status: in_progress
updated: 2026-03-22
created: 2026-03-05
module: ai-agent
tags: [botsson, voice, ultravox, agent, onboarding, mr-botsson, personality, cascade]
---

## Cascade Mapping

> This module's relationship to the Cascade Core Foundation
> (spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)

| Dimension                      | Role                                                 |
| ------------------------------ | ---------------------------------------------------- |
| C2 Context & Interaction       | Primary — voice-first conversational agent interface |
| C1 Observability & Calibration | Consumes — belief state informs agent responses      |
| C4 Policy & Governance         | Consumes — permissions gate what Botsson can do      |

# Module: Botsson — Voice Agent System

## 1. Oversikt

Botsson is Smartout's conversational AI system — a voice-first agent that talks to users in Norwegian, drives onboarding flows, answers operational questions, and guides staff through compliance tasks. Built on [Ultravox](https://ultravox.ai) for real-time voice, with a three-layer prompt system that adapts personality to context.

### Agenter (Missions)

| Mission ID             | Agent Name            | Bruk                                                             | firstSpeaker |
| ---------------------- | --------------------- | ---------------------------------------------------------------- | ------------ |
| `onboarding-interview` | **Botsson**           | Onboarding wizard — sets up a new workspace through conversation | agent        |
| `landing-demo`         | **Lise**              | Landing page ambassador — answers questions about Smartout       | agent        |
| `mr-botsson`           | **Mr. Botsson**       | In-dashboard assistant — scheduling, training, operations, HACCP | user         |
| `haccp-inspector`      | **HACCP-inspektoren** | Food safety — temperature logging, critical control points       | agent        |
| `shift-assistant`      | **Vaktassistenten**   | Shift planning — coverage gaps, overtime, staffing               | user         |

**Two primary modes:**

1. **Onboarding Botsson** (`onboarding-interview`) — Drives the admin onboarding wizard. Controls the UI via client tools (scrolling sections, filling forms, adding departments). The agent leads the conversation.
2. **Mr. Botsson** (`mr-botsson`) — In-dashboard assistant for daily operations. Adapts personality per workspace config, employee role, and relationship history. The user leads the conversation.

### Noekkelfiler

| Fil                | Sti                                                     | Formaal                                                               |
| ------------------ | ------------------------------------------------------- | --------------------------------------------------------------------- |
| Mission Registry   | `packages/ai/src/missions/registry.ts`                  | All 5 mission configs with system prompts                             |
| Mission Types      | `packages/ai/src/missions/types.ts`                     | `AgentMission`, `MissionId`, voice types                              |
| Mr. Botsson Prompt | `packages/ai/src/prompts/mr-botsson.ts`                 | Prompt builders for in-dashboard mode                                 |
| Posture System     | `packages/ai/src/prompts/posture.ts`                    | 5D personality adaptation engine                                      |
| Context Collector  | `packages/ai/src/context/collector.ts`                  | Loads profile, shift, memories, relationship                          |
| Context Types      | `packages/ai/src/context/types.ts`                      | `AgentContext`, `RelationshipData`, `AgentProfileData`                |
| Capability Types   | `packages/ai/src/capabilities/types.ts`                 | `Personality`, `Situation`, `AuthorityLevel`, `ProfileRole`           |
| Server Tools       | `packages/ai/src/tools/onboarding.ts`                   | `saveTranscription`, `saveIntelligenceReport`, `updateIntelligence`   |
| Workspace Doc Tool | `packages/ai/src/tools/workspace-docs.ts`               | `search_workspace_docs` semantic retrieval via `match_workspace_docs` |
| Client Hook        | `apps/web/src/app/onboarding/hooks/useBotsson.ts`       | Client-side Ultravox session + 14 tool implementations                |
| Ultravox Adapter   | `services/stage-engine/src/routes/adapters/ultravox.ts` | Stage Engine endpoints for Ultravox calls                             |
| Prompt Builder     | `services/stage-engine/src/core/prompt-builder.ts`      | Assembles stage prompt from mission + context + data                  |
| Ultravox Client    | `services/stage-engine/src/lib/ultravox.ts`             | API client + HTTP tool builder                                        |
| Ultravox Types     | `services/stage-engine/src/types/ultravox.ts`           | All Ultravox type definitions                                         |
| Journey Generator  | `packages/ai/src/generators/journey-botsson.ts`         | Converts journeys to Botsson voice scripts                            |
| ADR-0042           | `docs/decisions/0042-agent-architecture.md`             | Agent architecture decision                                           |

---

## 2. Arkitektur

### 2.1 Tre-lags prompt-system

```
┌──────────────────────────────────────────────────────┐
│ MISSION LAYER (registry.ts)                          │
│ Base personality, voice rules, language, greeting     │
│ e.g. "Du er Botsson. Kollegaen alle liker."          │
├──────────────────────────────────────────────────────┤
│ CONTEXT LAYER (collector.ts + mr-botsson.ts)         │
│ Profile, shift, memories, relationship, posture      │
│ e.g. "Lene, manager i Kjokken, 12 samtaler"         │
├──────────────────────────────────────────────────────┤
│ STAGE LAYER (prompt-builder.ts)                      │
│ Current goal, instructions, success criteria,        │
│ personality override, tuning notes, collected data   │
│ e.g. "Samle avdelingsnavn. Foresla basert paa bransje│
└──────────────────────────────────────────────────────┘
```

**How layers combine:**

1. Mission layer provides the base system prompt (agent identity, rules, tools)
2. Context layer enriches with who the agent is talking to, their history, and adapted personality
3. Stage layer (when using Stage Engine missions) adds current assignment, goals, and collected data

For `onboarding-interview`, the mission prompt IS the full prompt — it includes conversation flow, tool descriptions, and behavioral rules in one block. No separate stage progression.

For `mr-botsson`, the context layer builds a dynamic prompt via `buildBotssonPromptFromContext()` using the resolved posture system.

### 2.2 Stage Engine integration

```
Browser (useBotsson)                Stage Engine (Hono)              Ultravox API
       │                                   │                             │
       │  POST /api/wizard/start           │                             │
       │──────────────────────────────────>│                             │
       │                                   │  POST /adapters/ultravox/   │
       │                                   │  create-call                │
       │                                   │──────────────────────────>  │
       │                                   │     createSession()         │
       │                                   │     buildStagePrompt()      │
       │                                   │     buildUltravoxTools()    │
       │                                   │                             │
       │                                   │  <── { callId, joinUrl }    │
       │  <── { joinUrl }                  │                             │
       │                                   │                             │
       │  session.joinCall(joinUrl)         │                             │
       │────────────────────────────────────────────────────────────────>│
       │                                   │                             │
       │  ← WebSocket (voice stream) ─────────────────────────────────>│
       │                                   │                             │
       │  Client tool calls (in-browser)   │                             │
       │  ← getOnboardingState()           │                             │
       │  ← updateBusiness(fields)         │                             │
       │  ← advanceToNextSection()         │                             │
       │                                   │                             │
       │                           HTTP tool calls (server-side)        │
       │                                   │  ← store(entity, data)     │
       │                                   │  ← fetch(query_type)       │
       │                                   │  ← advance(result)         │
```

### 2.3 Ultravox session lifecycle

1. **Start** — `useBotsson.startSession()` calls `POST /api/wizard/start`
2. **Route** — Next.js API route forwards to Stage Engine `POST /adapters/ultravox/create-call`
3. **Session** — Stage Engine creates an `engine_sessions` row (mode: `mission`)
4. **Call** — Stage Engine calls Ultravox API with system prompt + tools, gets `joinUrl`
5. **Connect** — Browser joins via `UltravoxSession.joinCall(joinUrl)` (WebSocket)
6. **Active** — Voice streams bidirectionally. Agent calls tools. Status cycles: LISTENING → THINKING → SPEAKING
7. **End** — `useBotsson.endSession()` calls `session.leaveCall()`, cleans up refs

### 2.4 Tool architecture: Client vs Server

**Client tools** (`client: {}` in tool definition):

- Run in the browser via `session.registerToolImplementation()`
- Direct access to React state (onboarding wizard, UI)
- No network round-trip — instant execution
- Used for: UI manipulation, state reads, local actions

**Server (HTTP) tools** (`http: { baseUrlPattern, httpMethod }` in tool definition):

- Run on Stage Engine via HTTP callbacks from Ultravox
- Access to Supabase admin, inbox writer, guardian bus
- Used for: data persistence, stage advancement, context retrieval
- Skipped in local dev (Ultravox requires HTTPS for callbacks)

**Static parameters** (invisible to the AI model):

- `session_id` — query param for session routing
- `x-api-key` — header for authentication
- Never placed in `baseUrlPattern` (would leak via logs/referrer)

---

## 3. Missions Registry

All missions are defined in `packages/ai/src/missions/registry.ts` (line 10-299).

### 3.1 onboarding-interview

| Property     | Value          |
| ------------ | -------------- |
| Agent        | Botsson        |
| Voice        | Mark           |
| Temperature  | 0.6            |
| Max Duration | 1800s (30 min) |
| firstSpeaker | agent          |
| Language     | Norwegian      |

**Purpose:** Drives the entire admin onboarding wizard. The agent asks questions, fills in data, navigates sections, and activates the workspace. The system prompt contains the full conversation flow (8 stages) and 14 tool descriptions inline.

### 3.2 landing-demo

| Property     | Value                         |
| ------------ | ----------------------------- |
| Agent        | Lise                          |
| Voice        | Custom (UUID: `d082550b-...`) |
| Temperature  | 0.5                           |
| Max Duration | 600s (10 min)                 |
| firstSpeaker | agent                         |
| Language     | Norwegian                     |

**Purpose:** Landing page ambassador. Answers questions about Smartout, knows the product inside out. Supports `templateContext.variant_context` for A/B testing different conversation starters.

### 3.3 mr-botsson

| Property     | Value          |
| ------------ | -------------- |
| Agent        | Mr. Botsson    |
| Voice        | mark           |
| Temperature  | 0.3            |
| Max Duration | 1800s (30 min) |
| firstSpeaker | user           |
| Language     | Norwegian      |

**Purpose:** In-dashboard AI assistant. Helps with scheduling, training, HACCP, operations, and reports. Lower temperature for precision. User initiates conversation.

### 3.4 haccp-inspector

| Property     | Value             |
| ------------ | ----------------- |
| Agent        | HACCP-inspektoren |
| Voice        | sarah             |
| Temperature  | 0.2               |
| Max Duration | 900s (15 min)     |
| firstSpeaker | agent             |
| Language     | Norwegian         |

**Purpose:** Guides staff through food safety controls. Very low temperature — precision matters for temperatures and critical control points.

### 3.5 shift-assistant

| Property     | Value           |
| ------------ | --------------- |
| Agent        | Vaktassistenten |
| Voice        | tina            |
| Temperature  | 0.3             |
| Max Duration | 900s (15 min)   |
| firstSpeaker | user            |
| Language     | Norwegian       |

**Purpose:** Shift planning assistant. Has 8 schedule tools (getScheduleState, createShift, updateShift, etc.). Follows strict workflow: always call `getScheduleState` first, confirm before mutations.

### 3.6 Legge til en ny mission

1. Add entry to `MISSIONS` in `packages/ai/src/missions/registry.ts`
2. Add mission ID to `MissionIdSchema` in `packages/ai/src/missions/types.ts` (line 3)
3. Write system prompt in Norwegian (or English if the mission targets English users)
4. Choose voice, temperature, firstSpeaker, maxDuration
5. If mission needs client tools: define `CLIENT_TOOLS` array and register implementations
6. If mission needs server tools: they are auto-built by `buildUltravoxTools()` in Stage Engine
7. Test: create a call via the Stage Engine adapter and verify tools work

---

## 4. Personlighetssystem (5D-modellen)

The posture system adapts Botsson's personality dynamically based on who is talking, what the situation is, and what authority level the agent has. Defined in `packages/ai/src/prompts/posture.ts`.

### 4.1 De fem dimensjonene

| Dimensjon         | Lav (0.0)               | Hoy (1.0)                 | Default |
| ----------------- | ----------------------- | ------------------------- | ------- |
| **Formality**     | Uformell og avslappet   | Formell og profesjonell   | 0.5     |
| **Assertiveness** | Forsiktig og radgivende | Direkte og handlekraftig  | 0.5     |
| **Warmth**        | Saklig og noyaktig      | Varm og empatisk          | 0.7     |
| **Humor**         | Ingen humor             | Bruk humor der det passer | 0.2     |
| **Verbosity**     | Kort og konsis          | Detaljerte forklaringer   | 0.4     |

Defaults are set in `packages/ai/src/context/collector.ts` (line 7-12, `DEFAULT_PERSONALITY`). Per-workspace overrides come from the `agent_profile` table.

### 4.2 Rollebasert tilpasning

Adjustments applied based on the employee's role (`posture.ts` line 12-18):

| Rolle    | Formality | Assertiveness | Warmth | Humor | Verbosity |
| -------- | --------- | ------------- | ------ | ----- | --------- |
| trainee  | -0.15     | —             | +0.15  | —     | +0.2      |
| employee | —         | —             | —      | —     | —         |
| manager  | +0.05     | —             | —      | —     | —         |
| admin    | +0.05     | -0.05         | —      | —     | —         |
| owner    | +0.1      | -0.1          | —      | —     | —         |

**Logic:** More formal with owners, warmer and more verbose with trainees, neutral with employees.

### 4.3 Situasjonsbasert tilpasning

Adjustments based on current situation (`posture.ts` line 20-28):

| Situasjon  | Formality | Assertiveness | Warmth | Humor | Verbosity |
| ---------- | --------- | ------------- | ------ | ----- | --------- |
| onboarding | —         | —             | +0.2   | —     | +0.1      |
| haccp      | —         | +0.2          | -0.1   | -0.2  | —         |
| scheduling | —         | +0.1          | —      | —     | -0.1      |
| training   | —         | —             | +0.1   | —     | +0.1      |
| operations | —         | +0.1          | —      | —     | —         |
| guardian   | +0.1      | +0.1          | —      | —     | —         |
| general    | —         | —             | —      | —     | —         |

**Logic:** HACCP kills humor and increases directness. Onboarding adds warmth. Scheduling keeps it concise.

### 4.4 Autoritetsbasert tilpasning

Adjustments based on what the agent is allowed to do autonomously (`posture.ts` line 30-36):

| Authority  | Formality | Assertiveness | Warmth | Humor | Verbosity |
| ---------- | --------- | ------------- | ------ | ----- | --------- |
| autonomous | —         | +0.1          | —      | —     | —         |
| confirm    | —         | —             | —      | —     | —         |
| suggest    | —         | -0.2          | —      | —     | —         |
| read_only  | +0.1      | -0.3          | —      | —     | -0.1      |
| disabled   | —         | —             | —      | —     | —         |

**Logic:** When restricted to read-only, the agent becomes less assertive and more formal. When autonomous, it acts more decisively.

### 4.5 Relasjonsbasert tilpasning

Always applied, based on `relationshipScore` (`posture.ts` line 78-83):

| Condition                | Formality | Assertiveness | Warmth | Humor | Verbosity |
| ------------------------ | --------- | ------------- | ------ | ----- | --------- |
| score > 0.6 (well-known) | -0.1      | —             | —      | +0.1  | -0.05     |
| score < 0.2 (stranger)   | +0.1      | —             | —      | -0.05 | +0.1      |

**Logic:** More casual and humorous with people the agent knows well. More formal and verbose with strangers.

### 4.6 Adapt flags

Per-workspace control over which adaptations are active (`agent_profile` table):

| Flag                 | Default | Effect                      |
| -------------------- | ------- | --------------------------- |
| `adapt_to_role`      | true    | Apply role adjustments      |
| `adapt_to_situation` | true    | Apply situation adjustments |
| `adapt_to_authority` | true    | Apply authority adjustments |

Relationship adaptation is always applied (not flag-gated).

### 4.7 Resolving the final personality

`resolvePosture()` (`posture.ts` line 52-85) applies adjustments in order:

```
base personality (from agent_profile or DEFAULT_PERSONALITY)
  → role adjustment (if adaptFlags.role)
    → situation adjustment (if adaptFlags.situation)
      → authority adjustment (if adaptFlags.authority)
        → relationship adjustment (always)
          → clamp all values to [0, 1]
            → ResolvedPosture
```

The `ResolvedPosture` is then converted to natural language by `postureToText()` (`mr-botsson.ts` line 19-37) for inclusion in the system prompt:

```
Example output: "uformell og avslappet, varm og empatisk, bruk litt humor der det passer, vaer kort og konsis"
```

---

## 5. Onboarding-flyt (steg for steg)

The onboarding conversation follows 8 stages defined in the `onboarding-interview` system prompt (`registry.ts` line 72-151). The agent controls both the conversation AND the visual wizard.

### 5.1 Samtaleflyten

```
1. AAPNING
   Agent: "Hei! Jeg er Botsson. Hva heter du?"
   → Vent paa svar
   → addKeyFact("Kontakt", navn)
   → triggerScrape(bedrift, by)
   → advanceToNextSection
   → "Fint — jeg soker opp [bedrift] naa."

2. BEDRIFTSINFO
   ← Systemmelding med skanneresultat (eller feil)
   → Succes: Les opp kort, addKeyFact x4, updateBusiness
   → Feil: "Fant ikke noe automatisk — jeg legger inn manuelt."
   → advanceToNextSection

3. SESONG
   → advanceToNextSection FOERST
   → "De fleste restauranter kjoerer sesong..."
   → updateSeason, addKeyFact("Sesong", type)
   → advanceToNextSection

4. AVDELINGER
   → advanceToNextSection FOERST
   → "Basert paa bransjen har jeg satt opp [liste]."
   → addDepartments for tillegg
   → advanceToNextSection

5. LOKASJONER
   → advanceToNextSection FOERST
   → "Lokasjoner er de fysiske stedene..."
   → addLocations, addZones
   → advanceToNextSection

6. RUTINER
   → advanceToNextSection FOERST
   → "Rutiner er det som holder driften i gang."
   → addProcedures (multiple rounds)
   → advanceToNextSection

7. KONTRAKT
   → advanceToNextSection FOERST
   → Beskriv kort
   → advanceToNextSection

8. AVSLUTNING
   → Oppsummering med tall
   → "Klar til aa aktivere arbeidsplassen?"
   → VENT PAA EKSPLISITT "ja"
   → finalizeOnboarding
```

### 5.2 System messages (context push)

The WizardContext pushes system messages to the agent via `sendContext()` when external events happen:

- **Scrape completion** — When web scraping finishes, the scraped data is pushed as a system message so the agent can narrate the results
- **Section changes** — When the wizard UI changes section (user scrolling or agent navigating), context is pushed
- **Scrape failure** — When scraping fails, a system message tells the agent to proceed manually

These messages arrive in the agent's context as injected text via `session.sendText()`, which Ultravox treats as system-injected content (not user speech).

### 5.3 Navigation rule

**CRITICAL:** The agent MUST call `advanceToNextSection` BEFORE speaking about the next topic. This ensures the user sees the correct section when the agent starts talking about it. Navigate first, talk second.

---

## 6. Client Tools — Referanse

All 14 client tools are defined in `apps/web/src/app/onboarding/hooks/useBotsson.ts` (line 60-316) as `CLIENT_TOOLS` and registered via `session.registerToolImplementation()` (line 350-549).

### 6.1 State & Navigation

| Tool                   | Parameters | Returns                                                     | Bruk                                                    |
| ---------------------- | ---------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| `getOnboardingState`   | (none)     | JSON: section, business, season, departments, scrape status | Check what is filled in. Use actively.                  |
| `advanceToNextSection` | (none)     | `{ success: true }`                                         | Scroll wizard to next section. CALL FIRST, talk second. |

### 6.2 Data Entry

| Tool             | Parameters                                                                                                     | Returns                                   | Bruk                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `updateBusiness` | `fields`: JSON with name, orgNumber, website, email, phone, address, postalCode, city, industry, employeeCount | `{ success: true }`                       | Fill in or correct business fields. Act immediately when you know data. |
| `updateSeason`   | `fields`: JSON with name, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)                                         | `{ success: true }`                       | Set season info.                                                        |
| `addDepartments` | `names`: JSON array of strings                                                                                 | `{ success: true, added: [...] }`         | Add departments by name.                                                |
| `addLocations`   | `locations`: JSON array of `{ name, type? }`                                                                   | `{ success: true, added: N }`             | Add physical locations. Type: "main", "outdoor", "satellite", "other".  |
| `addZones`       | `locationName`: string, `zones`: JSON array of `{ name }`                                                      | `{ success: true, location, zonesAdded }` | Add zones within a location (sal, bar, uteservering).                   |
| `addProcedures`  | `names`: JSON array of strings                                                                                 | `{ success: true, added: [...] }`         | Add or enable procedures. Existing ones are enabled, new ones created.  |

### 6.3 Company Lookup Pipeline

| Tool              | Parameters                      | Returns                                                                                                                                                            | Bruk                                                                                  |
| ----------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `searchCompany`   | `name`: string, `city?`: string | `{ found, count, candidates: [{ orgNumber, name, city, industry, employeeCount, highConfidence }] }`                                                               | Search Bronnoeysundregistrene. Use as soon as you know the company name.              |
| `identifyCompany` | `orgNumber`: string (9 digits)  | `{ success, company: { legalName, address, city, industry, employeeCount, dagligLeder, website }, google: { rating, ratingCount, priceLevel }, workspaceCreated }` | Confirm company by org number. Creates workspace. Returns full details + Google data. |
| `scrapeWebsite`   | `url`: string                   | `{ success, email, phone, locationCount, departmentCount }`                                                                                                        | Scrape website for contact info, locations, departments.                              |

### 6.4 Visual & Memory

| Tool         | Parameters                                                                        | Returns             | Bruk                                                                                           |
| ------------ | --------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| `addKeyFact` | `label`: string, `value`: string                                                  | `{ success: true }` | Add a fact to the visual panel. Use actively: "Bedrift", "By", "Bransje", "Ansatte", "Sesong". |
| `saveMemory` | `content`: string, `memoryType`: "constant" or "temporal", `expiresAt?`: ISO date | `{ success: true }` | Save long-term memory. ALWAYS ask "Skal jeg notere det?" first.                                |

### 6.5 Finalization

| Tool                 | Parameters | Returns                      | Bruk                                                                                                                                   |
| -------------------- | ---------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `finalizeOnboarding` | (none)     | `{ success, slug?, error? }` | Activate workspace. Creates departments, locations, procedures. Redirects to dashboard. NEVER call without explicit user confirmation. |

### 6.6 Tool registration flow

```
1. CLIENT_TOOLS array (line 60-316) — tool definitions sent to Ultravox
2. useBotsson() → startSession() → new UltravoxSession()
3. session.registerToolImplementation("toolName", handler)
   - Each handler reads params, calls actionsRef.current.action()
   - Returns JSON string result
4. actionsRef keeps a mutable ref to current BotssonActions
5. BotssonActions is passed from WizardContext (parent component)
6. When Ultravox model calls a tool → browser executes handler → returns result
```

---

## 7. Server Tools — Referanse

Defined in `packages/ai/src/tools/onboarding.ts`. Used by the Stage Engine for server-side data persistence during voice sessions.

### 7.1 saveTranscription

```typescript
save_transcription({ speaker: "user" | "agent", text: string });
```

Saves a voice transcription entry via `ctx.appendTranscript()`. Called for each meaningful statement during the interview.

### 7.2 saveIntelligenceReport

```typescript
save_intelligence_report({ topic: string, content_markdown: string });
```

Saves a markdown intelligence report for a specific topic (e.g., "departments", "leadership", "locations") via `ctx.saveAnalysis()`.

### 7.3 updateIntelligence

```typescript
update_intelligence({
  departments?: string[],
  teams?: string[],
  locations?: string[],
  positions?: string[]
})
```

Updates structured intelligence data via `ctx.updateSuggestions()`. Keeps a running record of discovered organizational structure.

### 7.4 HTTP Tools (Stage Engine)

Built automatically by `buildUltravoxTools()` (`services/stage-engine/src/lib/ultravox.ts` line 60-174):

| Tool                | Endpoint                                             | Purpose                                                               |
| ------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| `store`             | `POST /adapters/ultravox/store`                      | Persist collected data to `engine_inbox`                              |
| `fetch`             | `POST /adapters/ultravox/fetch`                      | Retrieve context, inbox, stage, or history                            |
| `advance`           | `POST /adapters/ultravox/advance`                    | Advance to next stage (returns `X-Ultravox-Response-Type: new-stage`) |
| `getJourneyContext` | `POST /adapters/ultravox/fetch` (query_type=context) | Get current journey step details                                      |

These tools include static parameters (`session_id`, `x-api-key`) that are invisible to the AI model but sent with every call for routing and authentication.

---

## 8. Minnessystem (Memory)

### 8.1 engine_memory table

| Column         | Type        | Purpose                                               |
| -------------- | ----------- | ----------------------------------------------------- |
| `workspace_id` | UUID        | Workspace isolation (RLS)                             |
| `profile_id`   | UUID        | Who the memory is about (nullable for workspace-wide) |
| `content`      | text        | The memory content                                    |
| `memory_type`  | text        | "constant" (permanent) or "temporal" (expires)        |
| `scope`        | text        | "personal", "workspace", or "team"                    |
| `importance`   | numeric     | 0-1, higher = more important                          |
| `expires_at`   | timestamptz | When temporal memories expire (null = permanent)      |
| `embedding`    | vector      | pgvector embedding for semantic search                |

### 8.2 Memory loading

In `collector.ts` (line 69-78), memories are loaded with this query:

```sql
SELECT content, memory_type, scope, importance
FROM engine_memory
WHERE workspace_id = $1
  AND (profile_id = $2 OR scope != 'personal')
  AND (expires_at IS NULL OR expires_at > now())
ORDER BY importance DESC, created_at DESC
LIMIT 10
```

**Rules:**

- Top 10 memories by importance, then recency
- Personal memories only for the current profile
- Workspace/team memories visible to all in the workspace
- Expired temporal memories excluded automatically

### 8.3 Memory types

| Type       | Persistence        | Bruk                                                             |
| ---------- | ------------------ | ---------------------------------------------------------------- |
| `constant` | Permanent          | Business facts, preferences, team structure, important decisions |
| `temporal` | Until `expires_at` | Season-specific info, temporary arrangements, project timelines  |

### 8.4 saveMemory tool behavior

The `saveMemory` client tool (`useBotsson.ts` line 521-527) has strict rules:

1. Agent MUST ask "Skal jeg notere det?" before saving
2. Only save after explicit user confirmation
3. Only factual knowledge — NEVER tasks or reminders
4. Content should be descriptive and self-contained

---

## 9. Kontekstinnsamling (Context Collection)

### 9.1 AgentContext structure

Built by `collectContext()` in `packages/ai/src/context/collector.ts` (line 36-177). All queries run in parallel via `Promise.all()`.

```typescript
type AgentContext = {
  profile: {
    id;
    name;
    role;
    department;
    team;
    status;
    preferredLanguage;
  };
  currentTime: string; // "Mandag 14:30"
  dayOfWeek: string; // "mandag"
  activeShift: {
    // null if not on shift
    start;
    end;
    role;
    department;
  } | null;
  relationship: {
    familiarityScore; // 0-1
    trustScore; // 0-1
    sentimentScore; // 0-1
    relationshipScore; // 0-1 (composite)
    totalConversations; // count
    lastInteraction; // ISO date or null
  };
  relevantMemories: [
    {
      content;
      type;
      scope;
      importance;
    },
  ];
  agentProfile: {
    // from agent_profile table or defaults
    displayName;
    greeting;
    language;
    defaultVoice;
    voiceSpeed;
    voiceTemperature;
    voiceStability;
    personality: { formality; assertiveness; warmth; humor; verbosity };
    adaptFlags: { role; situation; authority };
  };
  resolvedPosture: {
    // after 5D adaptation
    formality;
    assertiveness;
    warmth;
    humor;
    verbosity;
  };
  priorOnboarding?: {
    // if user completed onboarding
    collected_data;
    completed_at;
    created_at;
  };
};
```

### 9.2 Data sources

| Data         | Table                | Query                                          |
| ------------ | -------------------- | ---------------------------------------------- |
| Profile      | `profile`            | By `profile_id`, joins `department` and `team` |
| Agent config | `agent_profile`      | By `workspace_id` (per-workspace personality)  |
| Relationship | `agent_relationship` | By `profile_id` + `workspace_id`               |
| Memories     | `engine_memory`      | Top 10, filtered by workspace, scope, expiry   |
| Active shift | `schedule_shift`     | By `employee_id`, status = "active", limit 1   |

### 9.3 Default values

When database rows are missing (new workspace, first conversation):

| Data         | Default                                                                     |
| ------------ | --------------------------------------------------------------------------- |
| Agent name   | "Mr. Botsson"                                                               |
| Language     | "no"                                                                        |
| Voice        | "mark"                                                                      |
| Personality  | formality: 0.5, assertiveness: 0.5, warmth: 0.7, humor: 0.2, verbosity: 0.4 |
| Relationship | All scores 0, totalConversations: 0                                         |
| Profile name | "Ansatt"                                                                    |
| Profile role | "employee"                                                                  |

---

## 10. Treningsnotater — Atferdsregler

These rules govern how Botsson behaves. They are embedded in system prompts and critical for consistent agent quality.

### 10.1 BESKRIV → FORESLA → BEKREFT

The core conversation pattern. NEVER ask an open question without first providing context.

```
FEIL:  "Hvilke avdelinger har dere?"
RIKTIG: "Restaurant med 14 ansatte — da kjoerer vi kjokken, sal og bar. Stemmer det?"

FEIL:  "Hva mer trenger dere?"
RIKTIG: "Varemottak og renhold — det har alle restauranter. Jeg legger dem til."
```

### 10.2 MAKS EN setning

The agent says ONE sentence, then waits. Always. This prevents monologues and keeps the conversation natural in voice.

### 10.3 Reager foerst, spoer etterpaa

```
"Restaurant i Trondheim? Nice."
```

Acknowledge what the user said BEFORE asking the next question.

### 10.4 Tool-first approach

Call the tool, then talk about the result. Never announce that you will call a tool — just do it.

```
FEIL:  "La meg legge til kjokken og bar som avdelinger." → addDepartments
RIKTIG: addDepartments(["Kjokken", "Bar"]) → "Kjokken og bar — lagt til."
```

### 10.5 Navigate first, talk second

```
advanceToNextSection() → "Neste: avdelinger."
```

NEVER talk about the next section while the user is still looking at the current one.

### 10.6 Fill in data immediately

When you know something — use `updateBusiness` or `addKeyFact` immediately. Do not wait for confirmation on obvious facts.

### 10.7 Spraak

- Primary: Norwegian (bokmal)
- Understand: Swedish and Danish
- Always respond in Norwegian unless the user switches language
- Mr. Botsson switches to English if the user speaks English

### 10.8 ALDRI

- Repeat information the user already confirmed
- Summarize what was just said (unless closing)
- Say "steg", "seksjon", or "neste steg" — the user should not feel a scripted flow
- Mention tool names — the agent "just does things"
- Say "hva mer trenger dere?" — suggest the next thing yourself
- Ask open questions without context (see BESKRIV → FORESLA → BEKREFT)

---

## 11. Konfigurasjonspunkter

Botsson can be tuned at four levels, from broad to narrow:

### 11.1 Mission level

**Where:** `packages/ai/src/missions/registry.ts`

| Setting               | Effect                                             |
| --------------------- | -------------------------------------------------- |
| `systemPrompt`        | Base personality, rules, conversation flow         |
| `voice`               | Ultravox voice (mark, sarah, tina, or custom UUID) |
| `temperature`         | LLM temperature (0.2 = precise, 0.6 = creative)    |
| `maxDurationSeconds`  | Call time limit                                    |
| `firstSpeaker`        | Who starts (agent or user)                         |
| `initialOutputMedium` | "voice" or "text"                                  |

### 11.2 Workspace level

**Where:** `agent_profile` table (one row per workspace)

| Column                                                       | Effect                           |
| ------------------------------------------------------------ | -------------------------------- |
| `display_name`                                               | Agent display name               |
| `greeting`                                                   | Default greeting                 |
| `language`                                                   | Primary language                 |
| `default_voice`                                              | Voice override                   |
| `voice_speed`, `voice_temperature`, `voice_stability`        | Voice tuning                     |
| `formality`, `assertiveness`, `warmth`, `humor`, `verbosity` | Base personality (5D)            |
| `adapt_to_role`, `adapt_to_situation`, `adapt_to_authority`  | Enable/disable adaptation layers |

### 11.3 Relationship level

**Where:** `agent_relationship` table (one row per profile per workspace)

| Column                | Effect                                                     |
| --------------------- | ---------------------------------------------------------- |
| `familiarity_score`   | How well agent knows the person (affects formality, humor) |
| `trust_score`         | Trust level (for future use)                               |
| `sentiment_score`     | Historical conversation sentiment (affects tone)           |
| `relationship_score`  | Composite score used by posture system                     |
| `total_conversations` | Conversation count (first-time detection)                  |

### 11.4 Stage level

**Where:** Stage definitions in Stage Engine (for mission-mode sessions)

| Setting                | Effect                                         |
| ---------------------- | ---------------------------------------------- |
| `personality_override` | Stage-specific tone text                       |
| `emotion_hint`         | Emotional approach for the stage               |
| `creative_freedom`     | 0-1 scale (0 = strict script, 1 = full improv) |
| `tuning_notes`         | Coaching hints that shape behavior             |
| `inline_instructions`  | Post-action guidance ("After X, do Y")         |

### 11.5 Authority level

**Where:** `engine_authority_config` table (per workspace, per capability)

| Authority    | Agent behavior                          |
| ------------ | --------------------------------------- |
| `autonomous` | Acts on its own, notifies after         |
| `confirm`    | Proposes action, waits for confirmation |
| `suggest`    | Suggests but does not act               |
| `read_only`  | Only reads and reports                  |
| `disabled`   | Capability completely off               |

---

## 12. Feilsoeking (Debugging)

### 12.1 useBotsson.debugLog

The `debugLog` array in `useBotsson` state (`useBotsson.ts` line 52, 329-331) captures all events:

| Type           | Content                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| `status`       | Session status changes (CONNECTING, LISTENING, THINKING, SPEAKING, idle) |
| `tool_call`    | `toolName(params)` — every tool invocation                               |
| `tool_result`  | Tool execution results                                                   |
| `context_push` | System messages sent via `sendContext()`                                 |
| `event`        | Other Ultravox data messages (first 200 chars)                           |

Access in dev: The `debugLog` is part of the `useBotsson` return value and can be rendered in a debug panel.

### 12.2 Transcript

The `transcript` array captures all speech:

```typescript
{ role: "user" | "agent", text: string }[]
```

Updated in real-time via the `transcripts` event listener (`useBotsson.ts` line 580-596).

### 12.3 Context log

The `contextLog` array (`useBotsson.ts` line 323) records every system message pushed via `sendContext()`.

### 12.4 Stage Engine logs

The Stage Engine logs all operations to console:

- `[ultravox]` — Ultravox API interactions
- Session creation, stage advancement, store/fetch operations
- Guardian events emitted after data collection

### 12.5 Common issues

| Problem                             | Cause                                                   | Fix                                                            |
| ----------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| Tools not working in local dev      | Ultravox requires HTTPS for HTTP tool callbacks         | Client tools still work. HTTP tools need HTTPS (staging/prod). |
| Agent does not navigate             | `advanceToNextSection` not called or `actionsRef` stale | Check that `BotssonActions` is passed to `useBotsson()`        |
| Agent repeats itself                | Temperature too high or missing tool results            | Lower temperature, ensure tool handlers return proper JSON     |
| Double session start                | Race condition from concurrent clicks                   | Protected by `startingRef` guard (`useBotsson.ts` line 340)    |
| Agent speaks before section visible | `advanceToNextSection` called after speech              | System prompt explicitly says "NAVIGER FOERST, SNAKK ETTERPAA" |

---

## 13. Journey Script Generator

`packages/ai/src/generators/journey-botsson.ts` transforms journey definitions (from the `journey` + `journey_step` tables) into voice walkthrough scripts for Mr. Botsson.

### Input

- `Journey` record with title, code, outcomes
- `JourneyStep[]` array with step_order, title, action, expects

### Output

A Norwegian markdown script with:

- Intro greeting
- Per-step instructions and dialogue
- Wait-for-confirmation points
- Closing with success outcome

### Usage

Used to auto-generate Botsson scripts for any user journey defined in the system. Enables Mr. Botsson to guide users through any workflow without custom prompt engineering per journey.

---

## Relaterte ADR-er

| ADR      | Tittel                                       | Relevans                                      |
| -------- | -------------------------------------------- | --------------------------------------------- |
| ADR-0042 | Agent Architecture — Stage Engine Agent Mode | Core decision: unified agent via Stage Engine |

## Relaterte moduler

| Modul               | Kobling                                  |
| ------------------- | ---------------------------------------- |
| MODULE_1_ONBOARDING | Botsson drives the onboarding wizard     |
| MODULE_12_AI        | AI module overview (8 capability layers) |
| MODULE_AGENT_SDK    | Agent SDK patterns                       |
| MODULE_3_SCHEDULING | Shift assistant tools                    |
| MODULE_5_HACCP      | HACCP inspector tools                    |
