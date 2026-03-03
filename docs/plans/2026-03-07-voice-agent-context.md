---
title: "Voice Agent Context — Full Architecture Reference"
status: draft
updated: 2026-03-07
created: 2026-03-07
module: ai
tags: [voice, agent, ultravox, livekit, stage-engine, mr-botsson, context]
---

# Voice Agent Context — Full Architecture Reference

> Everything needed to build the Smartout voice agent. Compiled from codebase, ADRs, modules, and plans.

---

## 1. Vision

**Mr. Botsson** — a voice-first AI colleague for shift-based businesses in Norway. Employees talk to it like a coworker: quick, spoken answers. Not a chatbot — a conversational colleague.

**Core principle:** Voice is the primary interface for restaurant staff. They don't type — they talk.

**8 capability domains:** Profile, Schedule, Training, Operations, HACCP, Communication, Reporting, Coaching. Each composable, authority-controlled, incrementally buildable.

---

## 2. What's Running on the Droplet

All services on one DigitalOcean Droplet behind Caddy (HTTPS, Let's Encrypt).

| Service              | Port   | Domain                   | What it does                                           |
| -------------------- | ------ | ------------------------ | ------------------------------------------------------ |
| **Caddy**            | 80/443 | \*.smartout.ai           | Reverse proxy, TLS                                     |
| **Stage Engine**     | 3000   | engine.smartout.ai       | AI agent orchestration, missions, voice tool callbacks |
| **Shift MCP**        | 3001   | schedule-mcp.smartout.ai | 5 MCP tools: create/update/get/list/delete shift       |
| **Contract Service** | 3100   | contract.smartout.ai     | DocuSeal e-signatures, reminders                       |
| **Scrapling**        | 8000   | (internal only)          | Python web scraper, no auth                            |
| **n8n**              | 5678   | n8n.smartout.ai          | Workflow automation (not deployed yet)                 |

**Infra files:** `infra/docker-compose.yml`, `infra/Caddyfile`, `infra/docker-compose.prod.yml`
**Deploy:** `infra/scripts/deploy.sh` → pull, rebuild, restart, health check
**ADR:** ADR-0040 (infrastructure stays in monorepo)

---

## 3. State Machines (Services)

### Stage Engine — Session FSM

```
active → complete    (all stages done)
active → expired     (24h timeout)
active → abandoned   (user/system abandons)
```

Two modes: **mission** (multi-stage with progress) and **agent** (free-form conversation).

### Shift MCP — Shift Lifecycle

```
created → assigned → published → active → completed
                                    ↓
                              unpublished
```

### Contract Service — Contract + Reminder FSM

```
draft → sent → viewed → signed → expired | terminated
```

Reminders: self-service (21 days, 9 reminders) or sales-assisted (13 days, 7 reminders).

### Other State Machines (in web app/DB)

- **Journey status** — 13 states across 5 phases (definition → planning → build → test → release)
- **Profile status** — trainee → active ↔ inactive → offboarding
- **Department session** — upcoming → active → pending_signoff → closed | missed (PLANNED)
- **Protocol assignment** — pending → completed | expired
- **Invitation** — pending → accepted | expired | cancelled

---

## 4. Voice Architecture — Two Call Paths

### Path A: Direct Ultravox (simpler)

```
Browser → /api/wizard/start (Next.js) → Ultravox API → WebRTC joinUrl → Browser
```

- Used by: Landing page, dashboard voice assistant
- No mission state, no tool callbacks
- Client-side tools supported via `selectedTools`

### Path B: Stage Engine (multi-stage missions)

```
Browser → /api/wizard/engine-start → Stage Engine → Ultravox API with tools
                                         ↓
              store/fetch/advance callbacks → session persistence in DB
```

- Used by: Onboarding interviews, complex training
- Persistent memory via `engine_memory` (pgvector)
- Authority control via `engine_authority_config`

### Tech Stack

- **Ultravox** — speech-native LLM (~150ms latency)
- **ultravox-client** v0.5.0 — browser WebRTC SDK
- **Ultravox API** v0.7 — server-side call creation
- **OpenRouter** → Claude Sonnet 4 — intent classification + agent responses
- **Vercel AI SDK** — `generateText()` with tools

---

## 5. Missions (Voice Personas)

Defined in `packages/ai/src/missions/registry.ts`:

| Mission ID             | Persona         | Voice | Temp | Max | First Speaker | Purpose             |
| ---------------------- | --------------- | ----- | ---- | --- | ------------- | ------------------- |
| `onboarding-interview` | Mr. Botsson     | mark  | 0.4  | 30m | agent         | Map org structure   |
| `landing-demo`         | Lise Botsson    | tina  | 0.6  | 10m | agent         | Platform intro      |
| `mr-botsson`           | Mr. Botsson     | mark  | 0.3  | 30m | user          | Dashboard assistant |
| `haccp-inspector`      | HACCP Inspector | sarah | 0.2  | 15m | agent         | Food safety         |
| `shift-assistant`      | Vaktassistenten | tina  | 0.3  | 15m | user          | Shift planning      |

**Landing variants:** 7 unique personas (Ingrid/Lars Erik/Thomas/Katrine/Ahmad/Fatima/Signe) with variant-specific prompts in `apps/landing/src/lib/variant-voice-config.ts`.

---

## 6. AI Agent Architecture (ADR-0042)

**Decision:** Extend Stage Engine with Agent Mode (not Anthropic Agent SDK, not separate service).

**Why:** Reuses existing infrastructure. Vercel AI SDK is better for product-embedded conversations than Anthropic Agent SDK (designed for computer-use agents).

### Pipeline

```
User message
  → Intent Classifier (Claude Sonnet via OpenRouter)
    → Tool Selector (authority-aware)
      → Mr. Botsson system prompt (Norwegian, dynamic context)
        → generateText() with tools
          → Response
```

### Capability Layers

| Capability        | Status              | Tools                                      |
| ----------------- | ------------------- | ------------------------------------------ |
| **Profile**       | Built               | get_profile, get_team, get_contract_status |
| **Schedule**      | Built (client-side) | 8 voice tools via useScheduleVoiceTools    |
| **Training**      | Planned             | assign protocols, track progress           |
| **Operations**    | Planned             | session management, day briefs             |
| **HACCP**         | Planned             | compliance checks, deviations              |
| **Communication** | Planned             | message routing, channel selection         |
| **Reporting**     | Planned             | KPI queries, summaries                     |
| **Coaching**      | Planned             | proactive suggestions, escalations         |

### Authority Levels (per workspace, per capability)

```
autonomous     → AI acts without asking
confirm        → AI does it after user confirms
suggest        → AI suggests, user executes
read_only      → AI can only read data
disabled       → AI doesn't participate
```

Stored in `engine_authority_config` table (UNIQUE on workspace_id + capability).

---

## 7. SmartoutTool Type System

Framework-agnostic tool definitions. Adapters convert at runtime.

```typescript
// packages/ai/src/types.ts
type SmartoutTool<TCtx, TSchema extends z.ZodType> = {
  name: string;
  description: string;
  schema: TSchema; // Zod validation
  execute: (params, ctx) => Promise<string>;
};

// Context for all agent tools
type AgentToolContext = {
  workspaceId: string;
  profileId: string;
  userId?: string;
  sessionId: string;
  supabaseAdmin: SupabaseClient;
};
```

**Adapters:**

- `toVercelTools()` → Vercel AI SDK format (`packages/ai/src/adapters/vercel-ai.ts`)
- `toLiveKitTools()` → LiveKit agent format (`packages/ai/src/adapters/livekit.ts`)

---

## 8. Client-Side Voice Tools (Schedule Page)

Hook `useScheduleVoiceTools` gives Ultravox live access to schedule data in the browser.

**Read tools (4):** getScheduleState, getShiftsForDay, getEmployeeSchedule, getCoverage
**Write tools (4):** createShift, updateShift, deleteShift, publishShifts

Uses refs for fresh React state without tool recreation. Registered via `VoiceToolsContext` provider → `VoiceAssistant` component.

---

## 9. Stage Engine Internals

### Core Files

| File                              | Purpose                                                       |
| --------------------------------- | ------------------------------------------------------------- |
| `src/core/agent-router.ts`        | Message pipeline: classify → select tools → prompt → generate |
| `src/core/agent-session.ts`       | Create/load/append to agent sessions                          |
| `src/core/authority.ts`           | Load per-workspace authority config                           |
| `src/core/memory-manager.ts`      | Load/save/expire memories (pgvector)                          |
| `src/core/stage-manager.ts`       | Mission stage progression                                     |
| `src/core/prompt-builder.ts`      | Dynamic system prompt construction                            |
| `src/lib/ultravox.ts`             | createUltravoxCall(), buildUltravoxTools()                    |
| `src/routes/agent/chat.ts`        | POST /agent/chat endpoint                                     |
| `src/routes/adapters/ultravox.ts` | store/fetch/advance tool callbacks                            |

### Ultravox Tool Callbacks (Learning-0013)

Uses `staticParameters` — NOT headers on http object, NOT query strings in baseUrlPattern:

```typescript
staticParameters: [
  { name: "session_id", location: "PARAMETER_LOCATION_QUERY", value: sessionId },
  { name: "x-api-key", location: "PARAMETER_LOCATION_HEADER", value: apiKey },
];
```

---

## 10. Database Tables (Agent)

### engine_sessions

- `mode`: 'mission' | 'agent' (ADR-0042)
- `mission_id`: nullable (NULL for agent mode)
- `channel`: voice | sms | chat | email | autonomous
- `status`: active | complete | expired | abandoned
- `collected_data`: JSONB (conversation turns, stage results)
- RLS: workspace isolation

### engine_memory

- `memory_type`: preference | fact | summary
- `embedding`: vector(1536) — pgvector, HNSW index (cosine)
- `expires_at`: optional TTL
- RLS: workspace isolation

### engine_authority_config

- `capability`: text (profile, schedule, training, etc.)
- `level`: autonomous | confirm | suggest | read_only | disabled
- UNIQUE(workspace_id, capability)
- RLS: admin/owner only

---

## 11. Module 18: LiveKit (Future — Human-to-Human)

LiveKit Cloud for voice/video calls between employees. Coexists with Ultravox.

**Call types:** Direct 1:1, group calls, push-to-talk (walkie-talkie), SIP (phone)
**Mr. Botsson as participant:** LiveKit Agents framework lets AI join any room
**Cost:** $50/month Ship plan covers ~50 restaurants

**Migration path:** Keep Ultravox for AI voice. Use LiveKit for human-to-human. Eventually Mr. Botsson can join LiveKit rooms as a participant.

**Full spec:** `docs/modules/SMARTOUT_MODULE_18_WEBRTC.md`

---

## 12. Key File Map

### packages/ai/

| Path                              | What                                                   |
| --------------------------------- | ------------------------------------------------------ |
| `src/types.ts`                    | SmartoutTool, defineTool, AgentToolContext             |
| `src/capabilities/`               | Capability definitions + profile tools                 |
| `src/router/intent-classifier.ts` | Message → capability routing                           |
| `src/router/tool-selector.ts`     | Authority-aware tool selection                         |
| `src/prompts/mr-botsson.ts`       | Dynamic system prompt builder                          |
| `src/adapters/vercel-ai.ts`       | SmartoutTool → Vercel AI SDK                           |
| `src/adapters/livekit.ts`         | SmartoutTool → LiveKit format                          |
| `src/missions/registry.ts`        | 5 voice missions with prompts                          |
| `src/missions/ultravox.ts`        | startMissionCall()                                     |
| `src/agents/`                     | onboarding, docs, contract, journey, reports, schedule |
| `src/tools/`                      | onboarding, contract (17), report, journey, docs (RAG) |
| `src/embedding.ts`                | OpenAI text-embedding-3-small via OpenRouter           |

### services/stage-engine/

| Path                              | What                               |
| --------------------------------- | ---------------------------------- |
| `src/core/agent-router.ts`        | Main agent pipeline                |
| `src/core/agent-session.ts`       | Session CRUD                       |
| `src/core/authority.ts`           | Authority config loader            |
| `src/core/memory-manager.ts`      | pgvector memory                    |
| `src/lib/ultravox.ts`             | Ultravox API client + tool builder |
| `src/routes/agent/chat.ts`        | POST /agent/chat                   |
| `src/routes/adapters/ultravox.ts` | Voice tool callbacks               |

### services/shift-mcp/

| Path                     | What                      |
| ------------------------ | ------------------------- |
| `src/server.ts`          | 5 MCP tools registered    |
| `src/tools/*.ts`         | Individual tool handlers  |
| `src/middleware/auth.ts` | Dual-auth (API key + JWT) |

### Voice UI Components

| Path                                                                     | What                     |
| ------------------------------------------------------------------------ | ------------------------ |
| `apps/web/src/components/voice-assistant.tsx`                            | Main voice UI            |
| `apps/web/src/components/voice-tools-context.tsx`                        | Client tool registration |
| `apps/web/src/components/dashboard/DashboardShell.tsx`                   | Voice integration point  |
| `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts` | 8 schedule tools         |
| `apps/web/src/app/api/wizard/start/route.ts`                             | Ultravox call creation   |
| `apps/landing/src/components/voice-assistant.tsx`                        | Landing voice widget     |
| `apps/landing/src/lib/variant-voice-config.ts`                           | 7 persona configs        |

### Documentation

| Path                                                   | What                       |
| ------------------------------------------------------ | -------------------------- |
| `docs/modules/SMARTOUT_MODULE_12_AI.md`                | AI module spec (8 engines) |
| `docs/modules/SMARTOUT_MODULE_18_WEBRTC.md`            | LiveKit voice/video spec   |
| `docs/decisions/ADR-0042-agent-architecture.md`        | Agent mode decision        |
| `docs/decisions/0036-shift-mcp-server.md`              | Shift MCP decision         |
| `docs/learnings/0013-ultravox-http-tool-parameters.md` | staticParameters fix       |
| `services/interview-mcp/README.md`                     | Voice mission system docs  |

---

## 13. Environment Variables (Voice-Related)

| Variable                    | Where                      | Purpose                                   |
| --------------------------- | -------------------------- | ----------------------------------------- |
| `ULTRAVOX_API_KEY`          | web, landing, stage-engine | Ultravox API access                       |
| `OPENROUTER_API_KEY`        | stage-engine               | LLM for intent classification + responses |
| `ENGINE_URL`                | stage-engine               | Self-reference URL for tool callbacks     |
| `STAGE_ENGINE_URL`          | web, landing               | URL to reach stage engine                 |
| `STAGE_ENGINE_API_KEY`      | web, landing               | Auth for stage engine                     |
| `SUPABASE_URL`              | all services               | Database access                           |
| `SUPABASE_SERVICE_ROLE_KEY` | all services               | Privileged DB access                      |

---

## 14. What's Built vs. Planned

### Built & Working

- 5 voice missions with Norwegian system prompts
- Direct Ultravox path (landing + dashboard)
- Stage Engine mission mode (multi-stage with tool callbacks)
- Agent mode in Stage Engine (POST /agent/chat)
- Intent classifier + tool selector (authority-aware)
- Profile capability (3 tools)
- Schedule client-side voice tools (8 tools)
- Mr. Botsson prompt builder (dynamic, context-aware)
- Persistent memory with pgvector embeddings
- Authority config framework
- Shift MCP server (5 tools)
- All services on Droplet with HTTPS

### Planned / Not Started

- Training capability
- Operations capability
- HACCP capability
- Communication capability
- Reporting capability
- Coaching capability
- LiveKit human-to-human calls
- LiveKit Mr. Botsson as room participant
- Agent mode for free-form voice conversations
- n8n deployment on Droplet
