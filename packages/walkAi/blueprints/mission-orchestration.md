---
title: "Mission Orchestration Blueprint — Stage Engine Reference"
status: draft
updated: 2026-03-10
created: 2026-03-10
module: walkAi
tags: [blueprint, mission, stage-engine, guardian]
---

# Mission Orchestration Blueprint

Reference document for building WalkAi on top of the Stage Engine. Based on comprehensive code analysis of the production implementation.

---

## 1. System Overview

The Stage Engine is a **Hono microservice** (port 5010) that acts as the universal AI agent gateway for Smartout. It is channel-agnostic — the same engine drives voice calls (Ultravox), text chat, SMS, email, and autonomous agent sessions.

**Key properties:**

- Hono framework on Node.js with `@hono/node-server`
- WebSocket support via `@hono/node-ws` (agent sessions + Guardian dashboard)
- Auth middleware validates JWT tokens or API keys on every request
- LLM calls go through OpenRouter (model: `anthropic/claude-sonnet-4`)
- Session state persisted in Supabase (PostgreSQL)
- Background loops: session cleanup (configurable interval), Guardian evaluation (30s), calendar guardian (60s)

**Architecture principle:** The engine does NOT contain agent personality or business logic. Those live in `packages/ai/`. The engine manages session lifecycle, prompt construction, data collection, and stage transitions.

**Source files:**

- `services/stage-engine/src/index.ts` — entry point, route registration, background loops
- `services/stage-engine/src/config.ts` — Zod-validated env config

---

## 2. Core Data Model

### 2.1 engine_missions

Blueprint table. Defines reusable multi-stage workflows.

| Column                  | Type        | Notes                                            |
| ----------------------- | ----------- | ------------------------------------------------ |
| id                      | text PK     | Human-readable slug, e.g. `onboarding-interview` |
| name                    | text        | Display name                                     |
| description             | text        |                                                  |
| mode                    | enum        | `sequential`, `free`, `hybrid`                   |
| context_source          | text        |                                                  |
| workspace_id            | uuid        | NULL = global mission                            |
| journey_id              | uuid        | FK to `journey` table (optional)                 |
| is_active               | boolean     | Only active missions can start sessions          |
| system_prompt           | text        | Base agent prompt (personality, rules)           |
| created_at / updated_at | timestamptz |                                                  |

### 2.2 engine_stages

Steps within a mission. Ordered, chainable, linkable to journey steps.

| Column                  | Type    | Notes                                         |
| ----------------------- | ------- | --------------------------------------------- |
| id                      | uuid PK | Auto-generated                                |
| mission_id              | text FK | References engine_missions                    |
| stage_id                | text    | Human-readable slug, e.g. `welcome`           |
| stage_order             | int     | Sort order                                    |
| goal                    | text    | What the agent must achieve                   |
| instructions            | text    | Detailed agent instructions                   |
| success_criteria        | text    | When this stage is "done"                     |
| escalation_instructions | text    | Fallback if agent gets stuck                  |
| personality_override    | text    | Stage-specific tone override                  |
| emotion_hint            | text    | e.g. "excitement", "calm professionalism"     |
| creative_freedom        | float   | 0.0 = strict script, 1.0 = full improv        |
| next_stage              | text    | Stage ID of the next stage (sequential chain) |
| is_required             | boolean | Required for mission completion               |
| journey_step_id         | uuid FK | Links to `journey_step` for UI-aware stages   |
| tuning_notes            | text    | Coaching hints for behavior shaping           |
| deferred_templates      | jsonb[] |                                               |
| inline_instructions     | jsonb[] | Post-action guidance: `[{after, message}]`    |

### 2.3 engine_sessions

Live instance of a mission. One per user per active run.

| Column                  | Type        | Notes                                          |
| ----------------------- | ----------- | ---------------------------------------------- |
| id                      | uuid PK     | Auto-generated                                 |
| mode                    | enum        | `mission` (structured) or `agent` (free-form)  |
| mission_id              | text FK     | NULL for agent-mode sessions                   |
| journey_id              | uuid FK     | Copied from mission at creation                |
| workspace_id            | uuid        | Workspace isolation                            |
| user_id                 | uuid        | Auth user                                      |
| profile_id              | uuid        | Employee profile                               |
| channel                 | enum        | `voice`, `sms`, `chat`, `email`, `autonomous`  |
| current_stage_id        | text        | Current stage slug                             |
| stage_index             | int         | 0-based position (-1 for free mode)            |
| stage_started_at        | timestamptz | When current stage began (for Guardian timing) |
| status                  | enum        | `active`, `complete`, `expired`, `abandoned`   |
| context                 | jsonb       | Identity context, workspace, journey data      |
| collected_data          | jsonb       | Data from all stages + `_whispers[]`           |
| summary                 | text        |                                                |
| callback_url            | text        | Webhook URL for lifecycle events               |
| guardian_whisper_count  | int         | Total whispers received                        |
| expires_at              | timestamptz | NULL = never expires (long-lived missions)     |
| completed_at            | timestamptz |                                                |
| created_at / updated_at | timestamptz |                                                |

### 2.4 engine_inbox

Structured data stored by the agent during a session. Each store call creates one row.

| Column       | Type        | Notes                                            |
| ------------ | ----------- | ------------------------------------------------ |
| id           | uuid PK     | Auto-generated                                   |
| session_id   | uuid FK     |                                                  |
| stage_id     | text        | Which stage stored this                          |
| workspace_id | uuid        |                                                  |
| entity_type  | text        | Freeform category, e.g. `business`, `department` |
| data         | jsonb       | The actual data                                  |
| validated    | boolean     |                                                  |
| processed    | boolean     |                                                  |
| created_at   | timestamptz |                                                  |

### 2.5 Supporting Tables

| Table                       | Purpose                                                                           |
| --------------------------- | --------------------------------------------------------------------------------- |
| **engine_memory**           | Persistent agent memories with pgvector embeddings. Workspace-isolated via RLS.   |
| **engine_authority_config** | Per-workspace, per-capability authority levels. UNIQUE(workspace_id, capability). |
| **guardian_log**            | Persisted audit trail of all Guardian events.                                     |
| **guardian_signal**         | Dashboard signals from the Guardian system.                                       |

---

## 3. Session Lifecycle

### 3.1 Status Transitions

```
                  +-----------+
                  |  active   |
                  +-----+-----+
                 /      |      \
     (expire)   /       |       \  (abandon)
               v        |        v
         +---------+    |    +-----------+
         | expired |    |    | abandoned |
         +---------+    |    +-----------+
                        | (all stages done)
                        v
                  +-----------+
                  | complete  |
                  +-----------+
```

### 3.2 Create

1. Client calls `POST /sessions` with `mission_id`, `workspace_id`, `channel`
2. Engine loads mission + stages from DB (only `is_active` missions)
3. If mission has a `journey_id`, loads journey + journey steps
4. Loads identity context (workspace, profile, user_identity)
5. Merges request context with identity context
6. Inserts `engine_sessions` row with status `active`
7. Builds system prompt for the first stage via `buildStagePrompt()`
8. Emits `session.started` Guardian event
9. Returns `session_id`, `system_prompt`, `current_stage`, `progress`
10. Long-lived missions (e.g. `season-lifecycle`) get `expires_at = null`; others expire in 24h

### 3.3 Loop (store / fetch / advance)

During an active session, the agent (or client) calls:

- **Store** — write collected data to `engine_inbox`, triggers Guardian evaluation
- **Fetch** — read context, inbox entries, stage info, or history (delivers pending whispers)
- **Advance** — move to the next stage, saves current stage result, rebuilds system prompt

This loop repeats until all stages are completed or the session is abandoned/expired.

### 3.4 Complete

When `advanceStage()` finds no next stage:

1. Session status set to `complete`, `completed_at` timestamped
2. `session.completed` Guardian event emitted
3. Completion webhook fired if `callback_url` is set
4. Mission-specific handoffs execute (e.g. onboarding -> season-lifecycle)

### 3.5 Expiry & Cleanup

- Background job runs every N minutes (default: 5)
- Marks active sessions past `expires_at` as `expired`
- Also cleans expired memories via `cleanExpiredMemories()`
- `getSession()` checks expiry on every read (lazy expiry)

---

## 4. API Contracts

Base URL: `http://localhost:5010` (local) or the `ENGINE_URL` config value.

All endpoints require auth via `Authorization: Bearer <jwt>` or `x-api-key: <key>` header.

### 4.1 POST /sessions

Create a new session for a mission.

**Request:**

```json
{
  "mission_id": "onboarding-interview",
  "workspace_id": "uuid",
  "user_id": "uuid",
  "profile_id": "uuid",
  "channel": "voice" | "sms" | "chat" | "email" | "autonomous",
  "callback_url": "https://...",
  "context": { "custom": "data" }
}
```

**Response (200):**

```json
{
  "session_id": "uuid",
  "mission": { "id": "onboarding-interview", "name": "Botsson — Onboarding", "mode": "sequential" },
  "current_stage": { "stage_id": "welcome", "goal": "...", "instructions": "...", "success_criteria": "...", "emotion_hint": "..." },
  "stages": [],
  "context": { "workspace": {...}, "profile": {...} },
  "progress": "1/5",
  "system_prompt": "..."
}
```

**Notes:** `stages` array only populated for `free` mode missions. For `sequential` and `hybrid`, the client only sees the current stage.

### 4.2 GET /sessions/:id

Get session status and collected data.

**Response (200):**

```json
{
  "session_id": "uuid",
  "status": "active",
  "current_stage_id": "welcome",
  "stage_index": 0,
  "collected_data": {},
  "context": {},
  "summary": null,
  "channel": "voice",
  "expires_at": "2026-03-11T...",
  "created_at": "2026-03-10T..."
}
```

### 4.3 POST /sessions/:id/store

Agent stores structured data to the inbox.

**Request:**

```json
{
  "entity_type": "business",
  "data": { "name": "Sjobris", "city": "Trondheim" },
  "stage_id": "company-info"
}
```

**Response (200):**

```json
{
  "inbox_id": "uuid",
  "confirmed": true,
  "message": "Data stored successfully. Type: business. Continue with the conversation."
}
```

**Side effects:** Emits `data.collected` Guardian event. Triggers fire-and-forget Guardian evaluation (may auto-advance if all required fields are collected).

### 4.4 POST /sessions/:id/fetch

Agent requests context or data. Four query types.

**Request:**

```json
{
  "query_type": "context" | "inbox" | "stage" | "history",
  "filters": { "entity_type": "business", "stage_id": "..." }
}
```

**Response (200):**

```json
{
  "data": {
    "_guardian_whispers": ["[Guardian 2026-03-10T...] Spor om: business.city"]
  }
}
```

**Query types:**
| Type | Returns |
|------|---------|
| `context` | Session identity + workspace context |
| `inbox` | Stored inbox entries (filterable by entity_type, stage_id) |
| `stage` | Current stage goal, instructions, success_criteria |
| `history` | All collected_data across stages |

**Whisper delivery:** On `context` and `stage` queries, pending Guardian whispers are included as `_guardian_whispers` and cleared from the session.

### 4.5 POST /sessions/:id/advance

Move to the next stage.

**Request:**

```json
{
  "result": { "company_name": "Sjobris", "employees": 14 },
  "next_stage_id": "departments",
  "force": false
}
```

**Response (200) — next stage:**

```json
{
  "new_stage": {
    "stage_id": "departments",
    "goal": "...",
    "instructions": "...",
    "success_criteria": "..."
  },
  "progress": "3/5",
  "complete": false,
  "system_prompt": "..."
}
```

**Response (200) — mission complete:**

```json
{
  "complete": true,
  "progress": "5/5",
  "summary": "Mission complete. Collected data for 5 stages."
}
```

**Notes:** `result` is saved to `collected_data[current_stage_id]`. For `free` mode, `next_stage_id` is required. For `sequential`, the chain follows `stage.next_stage`.

### 4.6 POST /sessions/:id/abandon

Mark session as abandoned.

**Response (200):**

```json
{
  "session_id": "uuid",
  "status": "abandoned"
}
```

### 4.7 POST /adapters/ultravox/create-call

Creates a voice call via Ultravox with Stage Engine tools pre-wired.

**Request:**

```json
{
  "mission_id": "onboarding-interview",
  "workspace_id": "uuid",
  "user_id": "uuid",
  "profile_id": "uuid",
  "voice": "Mark",
  "language": "no",
  "first_speaker": "user" | "agent",
  "context": {},
  "selected_tools": []
}
```

**Response (200):**

```json
{
  "session_id": "uuid",
  "call_id": "ultravox-call-id",
  "join_url": "wss://..."
}
```

**Notes:** In local dev (HTTP), HTTP tools are skipped (Ultravox requires HTTPS callbacks). Client tools (with `client: {}`) always work. The adapter also exposes `/adapters/ultravox/store`, `/adapters/ultravox/fetch`, `/adapters/ultravox/advance` — Ultravox-formatted wrappers with `session_id` as query param and plain-text responses. Advance returns `X-Ultravox-Response-Type: new-stage` header for seamless voice stage transitions.

### 4.8 POST /agent/chat

Text chat endpoint for agent-mode (free-form) conversations.

**Request:**

```json
{
  "message": "Hvem jobber i morgen?",
  "session_id": "uuid",
  "profile_id": "uuid",
  "channel": "chat" | "voice"
}
```

**Response (200):**

```json
{
  "session_id": "uuid",
  "response": "I morgen jobber Kari (08-16) og Ola (12-20) i kjokken.",
  "intent": { "capability": "schedule", "confidence": 0.92 }
}
```

**Notes:** If `session_id` is omitted, a new agent session is created automatically. Conversation history is stored in `collected_data._conversation` and replayed to the LLM on each turn.

### 4.9 WebSocket Endpoints

| Path                       | Purpose                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| `/ws/:sessionId`           | Real-time mission protocol — bidirectional UI events during onboarding |
| `/guardian/ws?token=<jwt>` | Guardian dashboard — live session monitoring and control               |

**Guardian commands (client -> server):**

- `{ type: "subscribe", session_id }` — subscribe to events for a session
- `{ type: "unsubscribe", session_id }` — unsubscribe
- `{ type: "change_stage", session_id, target_stage_id }` — force stage change
- `{ type: "whisper", session_id, message }` — inject whisper to agent

**Guardian server messages:**

- `{ type: "sessions", sessions: [...] }` — active session list (on connect)
- `{ type: "event", session_id, event_type, actor, summary, data, timestamp }` — real-time event

---

## 5. Prompt Construction

The `buildStagePrompt()` function in `services/stage-engine/src/core/prompt-builder.ts` assembles a system prompt from 12 sections, concatenated with double newlines.

### Section Order

| #   | Section                          | Source                          | Condition                     |
| --- | -------------------------------- | ------------------------------- | ----------------------------- |
| 1   | Base mission prompt              | `mission.system_prompt`         | If present                    |
| 2   | Personality override             | `stage.personality_override`    | If present                    |
| 3   | Emotional tone                   | `stage.emotion_hint`            | If present                    |
| 4   | Creative freedom                 | `stage.creative_freedom`        | Always                        |
| 5   | Current assignment (goal)        | `stage.goal`                    | Always                        |
| 6   | Instructions                     | `stage.instructions`            | Always                        |
| 7   | Success criteria                 | `stage.success_criteria`        | Always                        |
| 8   | Escalation instructions          | `stage.escalation_instructions` | If present                    |
| 9   | Context (JSON)                   | `session.context`               | If non-empty                  |
| 10  | Journey step enrichment          | `context.journeyStep`           | If present (Norwegian labels) |
| 11  | Previously collected data (JSON) | `session.collected_data`        | If non-empty                  |
| 12  | After-action instructions        | `stage.inline_instructions`     | If present                    |
| 13  | Tuning notes                     | `stage.tuning_notes`            | If present                    |

**Template variables:** `{{current_date}}` is replaced with the current date in Norwegian locale format (`nb-NO`).

**Journey step enrichment** includes: step order/total, title, user action, expected result, screen name, UI component, required data writes, confirmation requirement, and progress indicator.

---

## 6. Guardian System

The Guardian is an autonomous oversight layer that monitors active sessions in real-time. It has three components.

### 6.1 Guardian Evaluator

File: `services/stage-engine/src/core/guardian-evaluator.ts`

**Evaluation loop:** Runs every 30 seconds for all active sessions with a `journey_id`. Also triggered immediately after each `/store` call.

**Evaluation pipeline:**

1. Load session, current stage, and linked journey step
2. Calculate `elapsedSeconds` since `stage_started_at`
3. Check data completeness against `journey_step.data_writes[]`
4. Decision tree:

```
All required fields collected?
  YES + elapsed >= min_duration_seconds?
    required_confirmation AND elapsed < min_duration + 30?
      -> WAIT (action: none)
    required_confirmation AND elapsed >= min_duration + 30?
      -> WHISPER: "Ask user for confirmation"
    no confirmation required?
      -> AUTO-ADVANCE to next stage
  NO + elapsed > max_duration_seconds?
    -> WHISPER: timeout, list missing fields
  NO + elapsed > 80% of max_duration?
    -> WHISPER: timeout warning with remaining seconds
  NO + elapsed > 60s?
    -> WHISPER: nudge to ask about missing fields
  Otherwise:
    -> WAIT (action: none)
```

**Whisper mechanism:** Whispers are stored in `session.collected_data._whispers[]` as timestamped strings. They are delivered to the agent on the next `/fetch` call (query_type `context` or `stage`) and then cleared.

### 6.2 Guardian Bus

File: `services/stage-engine/src/core/guardian-bus.ts`

Event types emitted throughout the system:

| Event Type                 | Actor    | Trigger                          |
| -------------------------- | -------- | -------------------------------- |
| `session.started`          | system   | Session created                  |
| `session.completed`        | system   | All stages done                  |
| `session.abandoned`        | system   | Abandon called                   |
| `stage.changed`            | system   | Stage advanced                   |
| `data.collected`           | agent    | Store endpoint called            |
| `user.message`             | user     | Agent chat message received      |
| `agent.response`           | agent    | Agent chat response sent         |
| `guardian.auto_advance`    | guardian | Auto-advance after data complete |
| `guardian.nudge`           | guardian | Missing field nudge (>60s)       |
| `guardian.nudge_confirm`   | guardian | Confirmation nudge               |
| `guardian.timeout`         | guardian | Hard timeout exceeded            |
| `guardian.timeout_warning` | guardian | 80% of max_duration reached      |
| `admin.stage_change`       | admin    | Dashboard forced stage change    |
| `admin.whisper`            | admin    | Dashboard whisper injected       |

All events are:

- Broadcast to subscribed Guardian WebSocket clients in real-time
- Persisted to `guardian_log` table (fire-and-forget)

### 6.3 Calendar Guardian

File: `services/stage-engine/src/core/calendar-guardian.ts`

Runs every 60 seconds. Evaluates long-lived sessions (e.g. `season-lifecycle`) against time-based rules (season transitions, deadline triggers).

---

## 7. Missions Registry

File: `packages/ai/src/missions/registry.ts`

Five registered missions with full prompt definitions:

| Mission ID             | Agent Name        | Channel | Max Duration | Mode       | Purpose                                                                                                                                              |
| ---------------------- | ----------------- | ------- | ------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onboarding-interview` | Botsson           | voice   | 30 min       | sequential | Onboarding wizard. Drives screen + conversation simultaneously. Has 8 sections with tool calls (triggerScrape, updateBusiness, addDepartments, etc.) |
| `landing-demo`         | Lise              | voice   | 10 min       | sequential | Landing page demo. "Founding AI ambassador". Warm, direct, knows Smartout. Agent speaks first.                                                       |
| `mr-botsson`           | Mr. Botsson       | voice   | 30 min       | agent      | In-dashboard assistant. Free-form. Routes through capability system.                                                                                 |
| `haccp-inspector`      | HACCP-inspektoren | voice   | 15 min       | sequential | Food safety checks. Low temperature (0.2). Strict, precise. Agent speaks first.                                                                      |
| `shift-assistant`      | Vaktassistenten   | voice   | 15 min       | sequential | Schedule management. Has client tools for read/write/navigate shifts.                                                                                |

**Mission config shape (`AgentMission`):**

```typescript
{
  id: string;
  name: string;
  description: string;
  agentDisplayName: string;
  greeting: string;
  uiDescription: string;
  language: "no" | "en";
  voice: string;
  temperature: number;
  maxDurationSeconds: number;
  firstSpeaker: "user" | "agent";
  initialOutputMedium: "voice";
  systemPrompt: string;
  clientTools?: UltravoxClientToolDefinition[];
  templateContext?: Record<string, string>;
}
```

**Helper functions:**

- `getMission(id)` — returns single mission or undefined
- `listMissions()` — all missions as array
- `getMissionIds()` — all IDs as string array

---

## 8. AI Integration (packages/ai/)

### 8.1 Agent Router Pipeline

File: `services/stage-engine/src/core/agent-router.ts`

The pipeline runs on every `/agent/chat` message:

```
1. loadAuthorityConfig(workspaceId)
   -> Reads engine_authority_config table
   -> Returns Record<capability, level>

2. classifyIntent(message)
   -> LLM call (Claude Sonnet) with Zod structured output
   -> Returns { intent, capability, confidence, reasoning }

3. Resolve situation from intent
   -> schedule -> "scheduling"
   -> training -> "training"
   -> operations -> "operations"
   -> else -> "general"

4. collectContext({ workspaceId, profileId, situation, authority })
   -> Parallel fetch: profile, agent profile, relationship, memories, active shift
   -> Returns full AgentContext object

5. loadOnboardingContext(profileId, workspaceId)
   -> If exists, injects prior onboarding data into context

6. selectTools(intent, authorityConfig)
   -> High confidence (>=0.7) + specific capability -> tools for that capability
   -> Low confidence or "general" -> all tools from all capabilities

7. buildBotssonPromptFromContext(ctx, toolDescriptions)
   -> Builds posture-aware system prompt with identity, relationship, memories

8. Inject buffered WebSocket UI actions into message

9. generateText({ model, system, messages, tools })
   -> OpenRouter -> Claude Sonnet
   -> Max 5 tool-use steps (stopWhen: stepCountIs(5))

10. Return { session_id, response, intent }
```

### 8.2 Intent Classifier

File: `packages/ai/src/router/intent-classifier.ts`

Uses `generateObject()` (Vercel AI SDK) with Zod schema for structured output. Classifies user messages into one of 10 capabilities + confidence score.

Output schema:

```typescript
{
  intent: string; // e.g. "schedule:query", "training:status"
  capability: CapabilityName | "general";
  confidence: number; // 0.0 - 1.0
  reasoning: string; // Why this classification
}
```

### 8.3 Tool Selector

File: `packages/ai/src/router/tool-selector.ts`

Maps authority levels to tool access:

| Authority Level | Tools Available              |
| --------------- | ---------------------------- |
| `disabled`      | None                         |
| `read_only`     | `capability.readOnlyTools`   |
| `suggest`       | readOnlyTools + suggestTools |
| `confirm`       | All tools                    |
| `autonomous`    | All tools                    |

When confidence is high (>=0.7) and not "general", only the matched capability's tools are selected. When confidence is low, tools from ALL registered capabilities are included.

---

## 9. Capability System

File: `packages/ai/src/capabilities/types.ts` + `registry.ts`

### 9.1 Defined Capabilities

| Capability      | Description                                         | Status          |
| --------------- | --------------------------------------------------- | --------------- |
| `knowledge`     | Company policies, procedures, rules, FAQs           | Defined         |
| `schedule`      | Shift queries, changes, availability, swaps         | Defined         |
| `training`      | Protocol assignments, readiness, tests              | Defined         |
| `operations`    | Department sessions, checklists, daily ops          | Defined         |
| `profile`       | Employee info, team, contract status                | Registered      |
| `communication` | Messages, notifications                             | Defined         |
| `memory`        | Past conversations, preferences                     | Defined         |
| `payroll`       | Salary, overtime, deductions                        | Defined         |
| `ui`            | Screen navigation, form filling, highlights, toasts | Registered      |
| `general`       | Greetings, small talk, meta-questions               | Classifier-only |

**Currently registered** (with tool implementations): `profile`, `ui`. Others are defined as types but not yet registered with tool implementations.

### 9.2 Capability Definition Shape

```typescript
type CapabilityDefinition = {
  name: CapabilityName;
  description: string;
  tools: ReadonlyArray<SmartoutTool>; // Full access tools
  readOnlyTools: ReadonlyArray<SmartoutTool>; // Read-only subset
  suggestTools?: ReadonlyArray<SmartoutTool>; // Suggest-level tools
};
```

### 9.3 Authority Levels

Per-workspace configuration in `engine_authority_config` table:

| Level        | Meaning           | Agent behavior                             |
| ------------ | ----------------- | ------------------------------------------ |
| `autonomous` | Act independently | Execute without asking                     |
| `confirm`    | Ask before acting | Propose action, wait for user confirmation |
| `suggest`    | Suggest only      | Describe what could be done, never execute |
| `read_only`  | Read access only  | Can look up data, cannot modify            |
| `disabled`   | No access         | Capability completely hidden               |

---

## 10. Prompts & Personas

### 10.1 Mr. Botsson Personality

File: `packages/ai/src/prompts/mr-botsson.ts`

Two prompt builders:

1. **`buildBotssonPromptFromContext(ctx, toolDescriptions)`** — Primary path. Uses full `AgentContext` with posture system, relationship history, memories, shift info, and onboarding context.

2. **`buildBotssonPrompt(input)`** — Legacy path. Simpler input shape without posture.

**Prompt structure (primary):**

- Agent identity and language
- Personality text (from resolved posture)
- Employee profile (role, department, team, status, active shift)
- Relationship context (conversation count, familiarity, sentiment)
- Relevant memories
- Available tools
- Rules (language, tool usage, uncertainty handling, privacy)
- Onboarding context (if prior onboarding data exists)

### 10.2 Five-Dimension Posture System

File: `packages/ai/src/prompts/posture.ts`

The posture system dynamically adjusts agent personality based on who it is talking to and what about.

**Dimensions (0.0 - 1.0):**

| Dimension         | Low (< 0.3)       | High (> 0.7)                  |
| ----------------- | ----------------- | ----------------------------- |
| **Formality**     | Casual, relaxed   | Formal, professional          |
| **Assertiveness** | Careful, advisory | Direct, action-oriented       |
| **Warmth**        | Factual, precise  | Warm, empathetic              |
| **Humor**         | Serious           | Light humor where appropriate |
| **Verbosity**     | Brief, concise    | Detailed explanations         |

**Adaptation layers (applied in order):**

1. **Role adjustments** — Trainee: warmer, more verbose. Owner: more formal, less assertive.
2. **Situation adjustments** — HACCP: more assertive, less warm, no humor. Onboarding: warmer, more verbose.
3. **Authority adjustments** — Autonomous: more assertive. Suggest: less assertive. Read-only: more formal, less assertive.
4. **Relationship adjustments** — High familiarity (>0.6): less formal, more humor. New relationship (<0.2): more formal, more verbose.

All values are clamped to [0, 1] after each adjustment layer.

---

## 11. WalkAi Integration Points

### 11.1 Starting a Mission Session

```bash
# Create a session for a mission
curl -X POST http://localhost:5010/sessions \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "mission_id": "onboarding-interview",
    "workspace_id": "<uuid>",
    "profile_id": "<uuid>",
    "channel": "chat",
    "context": { "source": "walkAi" }
  }'
```

### 11.2 Sending a Chat Message

```bash
# Agent-mode free-form chat (creates session if needed)
curl -X POST http://localhost:5010/agent/chat \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hvem jobber i morgen?",
    "profile_id": "<uuid>",
    "channel": "chat"
  }'
```

### 11.3 Storing Data During a Session

```bash
curl -X POST http://localhost:5010/sessions/<session_id>/store \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "business",
    "data": { "name": "Sjobris", "city": "Trondheim", "employees": 14 }
  }'
```

### 11.4 Fetching Context (with Whispers)

```bash
curl -X POST http://localhost:5010/sessions/<session_id>/fetch \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "query_type": "context" }'
```

### 11.5 Advancing to Next Stage

```bash
curl -X POST http://localhost:5010/sessions/<session_id>/advance \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "result": { "company_name": "Sjobris" },
    "next_stage_id": "departments"
  }'
```

### 11.6 Creating a Voice Call

```bash
curl -X POST http://localhost:5010/adapters/ultravox/create-call \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "mission_id": "mr-botsson",
    "workspace_id": "<uuid>",
    "profile_id": "<uuid>",
    "voice": "Mark",
    "language": "no",
    "first_speaker": "user"
  }'
```

### 11.7 Guardian WebSocket

```javascript
const ws = new WebSocket("ws://localhost:5010/guardian/ws?token=<jwt>");
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "sessions") {
    // List of active sessions
  } else if (msg.type === "event") {
    // Real-time event: msg.event_type, msg.summary, msg.data
  }
};
// Subscribe to a specific session
ws.send(JSON.stringify({ type: "subscribe", session_id: "<uuid>" }));
// Whisper to agent
ws.send(JSON.stringify({ type: "whisper", session_id: "<uuid>", message: "Ask about allergies" }));
```

### 11.8 Key Integration Considerations for WalkAi

1. **Channel:** Use `"chat"` for text-based WalkAi interactions, `"voice"` for voice
2. **Session management:** `/agent/chat` auto-creates sessions if `session_id` is omitted. For mission-mode, create explicitly via `POST /sessions`
3. **Webhooks:** Set `callback_url` to receive `session.started`, `stage.changed`, `session.completed` events
4. **Context injection:** Pass custom context in the `context` field at session creation to influence agent behavior
5. **Authority config:** Configure `engine_authority_config` to control what the agent can do per workspace
6. **Guardian monitoring:** Connect to `/guardian/ws` for real-time session oversight

---

## Key File Index

| File                                                    | Purpose                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `services/stage-engine/src/index.ts`                    | Entry point, route registration, background loops             |
| `services/stage-engine/src/config.ts`                   | Zod-validated env config                                      |
| `services/stage-engine/src/core/session-manager.ts`     | Session CRUD, mission loading, identity context               |
| `services/stage-engine/src/core/stage-manager.ts`       | Stage navigation (sequential/free/hybrid), advance logic      |
| `services/stage-engine/src/core/prompt-builder.ts`      | 12-section system prompt assembly                             |
| `services/stage-engine/src/core/guardian-evaluator.ts`  | Session evaluation, auto-advance, nudges, timeouts            |
| `services/stage-engine/src/core/guardian-bus.ts`        | Event broadcasting + persistence                              |
| `services/stage-engine/src/core/agent-router.ts`        | Full agent pipeline: intent -> tools -> LLM                   |
| `services/stage-engine/src/core/authority.ts`           | Workspace authority config loader                             |
| `services/stage-engine/src/core/agent-session.ts`       | Agent-mode session management                                 |
| `services/stage-engine/src/core/inbox-writer.ts`        | Inbox validation + write                                      |
| `services/stage-engine/src/core/memory-manager.ts`      | Memory CRUD + cleanup                                         |
| `services/stage-engine/src/core/webhook-sender.ts`      | Fire-and-forget webhook delivery                              |
| `services/stage-engine/src/core/calendar-guardian.ts`   | Time-based triggers for long-lived sessions                   |
| `services/stage-engine/src/routes/sessions.ts`          | POST /sessions, GET /sessions/:id, POST /sessions/:id/abandon |
| `services/stage-engine/src/routes/store.ts`             | POST /sessions/:id/store                                      |
| `services/stage-engine/src/routes/fetch.ts`             | POST /sessions/:id/fetch                                      |
| `services/stage-engine/src/routes/advance.ts`           | POST /sessions/:id/advance                                    |
| `services/stage-engine/src/routes/agent/chat.ts`        | POST /agent/chat                                              |
| `services/stage-engine/src/routes/adapters/ultravox.ts` | Ultravox voice adapter endpoints                              |
| `services/stage-engine/src/routes/guardian.ts`          | Guardian WebSocket route                                      |
| `services/stage-engine/src/routes/ws.ts`                | Mission protocol WebSocket                                    |
| `services/stage-engine/src/types/session.ts`            | Mission, Stage, Session, InboxEntry types                     |
| `services/stage-engine/src/types/api.ts`                | Request/response types for all endpoints                      |
| `services/stage-engine/src/types/guardian.ts`           | Guardian event, command, message types                        |
| `services/stage-engine/src/types/agent.ts`              | Agent chat request/response types                             |
| `packages/ai/src/missions/registry.ts`                  | 5 mission definitions with prompts                            |
| `packages/ai/src/capabilities/types.ts`                 | CapabilityName, AuthorityLevel, Personality types             |
| `packages/ai/src/capabilities/registry.ts`              | Capability registration (profile, ui)                         |
| `packages/ai/src/router/intent-classifier.ts`           | LLM-based intent classification                               |
| `packages/ai/src/router/tool-selector.ts`               | Authority-aware tool selection                                |
| `packages/ai/src/prompts/mr-botsson.ts`                 | Mr. Botsson prompt builder                                    |
| `packages/ai/src/prompts/posture.ts`                    | 5-dimension posture resolution                                |
| `packages/ai/src/context/collector.ts`                  | Parallel context collection                                   |
