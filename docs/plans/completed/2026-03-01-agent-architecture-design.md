---
title: "Agent Architecture Design — Unified Mr. Botsson System"
status: done
updated: 2026-03-03
created: 2026-03-01
module: ai
tags: [agent, architecture, mr-botsson, stage-engine, design]
---

# Agent Architecture Design — Unified Mr. Botsson System

## 1. Problem Statement

Smartout has multiple agent systems that evolved independently:

- 6 text agents in `packages/ai/` called from Vercel API routes
- Stage Engine on DigitalOcean for voice-based mission workflows (Ultravox)
- 2 MCP servers for structured tool access (Shift, Interview)
- Module 12 describes "Mr. Botsson" with 8 specialized engines — mostly unbuilt

These systems don't share sessions, context, memory, or a unified interface. Employees don't have a single AI colleague — they have scattered AI features.

**Goal:** Define the unified agent architecture that makes Mr. Botsson a single AI colleague accessible via text and voice, backed by composable capability layers, with per-workspace authority control.

---

## 2. Decisions Made

| Decision                 | Choice                                     | Rationale                                                                                                                                                  |
| ------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SDK**                  | Vercel AI SDK + OpenRouter                 | Production-proven, model-flexible, web-native. Anthropic Agent SDK rejected — designed for developer tooling, not multi-tenant product agents.             |
| **Agent decomposition**  | Capability layers + workflow agents        | Module 12's "8 engines" replaced with composable capability layers. Chat/Voice are channels, not capabilities.                                             |
| **Conversation model**   | Hybrid: fresh sessions + persistent memory | Each interaction is a fresh agent session (clean context). Persistent memory layer provides continuity across sessions.                                    |
| **Deployment**           | Dedicated service on DigitalOcean          | No Vercel timeouts, persistent connections, full control. Extends existing Stage Engine.                                                                   |
| **Voice**                | Text + voice simultaneously                | Same agent, two channels from day one. Ultravox adapter for voice.                                                                                         |
| **Authority**            | Configurable per workspace per capability  | 5 levels: autonomous, confirm, suggest, read_only, disabled. Admin controls what Mr. Botsson can do.                                                       |
| **Hosting architecture** | Extend Stage Engine (Approach C)           | Single AI gateway with two modes: Mission mode (existing structured workflows) + Agent mode (new free-form conversations). Shares auth, sessions, context. |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE ENGINE (Hono, DigitalOcean)            │
│                    engine.smartout.ai                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─── MODES ─────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  MISSION MODE (existing)        AGENT MODE (new)          │ │
│  │  ├─ Sequential workflows        ├─ Free-form conversation │ │
│  │  ├─ Structured stages           ├─ Intent classification  │ │
│  │  ├─ Onboarding wizard           ├─ Capability routing     │ │
│  │  └─ Data collection             ├─ Tool execution         │ │
│  │                                  ├─ Memory retrieval       │ │
│  │                                  └─ Authority enforcement  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─── SHARED INFRASTRUCTURE ─────────────────────────────────┐ │
│  │  Sessions │ Auth (dual) │ Context │ Inbox │ Webhooks      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─── ADAPTERS ──────────────────────────────────────────────┐ │
│  │  Ultravox (voice) │ Chat (SSE) │ Webhook (SMS/Email)      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─── CAPABILITY LAYERS (packages/ai/capabilities/) ─────────┐ │
│  │  Knowledge │ Schedule │ Training │ Operations │ Profile    │ │
│  │  Communication │ Memory │ Payroll                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │              │               │
         ▼              ▼               ▼
    ┌─────────┐   ┌──────────┐   ┌──────────┐
    │Supabase │   │Shift MCP │   │OpenRouter│
    │(DB+Auth)│   │(tools)   │   │(LLM)    │
    └─────────┘   └──────────┘   └──────────┘
```

**Key principle:** One service, two modes. Mission mode for structured workflows. Agent mode for free-form Mr. Botsson conversations. Both share sessions, auth, context, and adapters.

---

## 4. Capability Layers

Composable modules that provide domain-specific tools. Any agent or mission can use any capability.

### 4.1 Knowledge Layer (RAG)

- pgvector semantic search over 150+ internal docs
- Policy/protocol lookup by workspace
- FAQ retrieval
- **Tools:** `searchDocs`, `getPolicy`, `getProtocol`

### 4.2 Schedule Layer

- Shift queries via Shift MCP
- Availability checking
- Swap requests
- **Tools:** `listShifts`, `requestSwap`, `checkAvailability`

### 4.3 Training Layer

- Protocol assignment status
- Readiness scoring
- Knowledge test guidance
- **Tools:** `getReadiness`, `getAssignments`, `markComplete`

### 4.4 Operations Layer

- Department session status
- Routine/procedure checklists
- Session hooks context
- **Tools:** `getSessionStatus`, `getChecklist`, `logCompletion`

### 4.5 Profile Layer

- Employee profile data
- Team/department membership
- Contract status
- **Tools:** `getProfile`, `getTeam`, `getContractStatus`

### 4.6 Communication Layer

- Notification sending (SMS, push, email)
- Message formatting by channel
- **Tools:** `sendNotification`, `formatMessage`

### 4.7 Memory Layer (cross-cutting)

- Conversation history retrieval
- User preference storage
- Recent interaction context
- **Tools:** `getRecentConversations`, `getUserPreferences`

### 4.8 Payroll Layer

- Salary calculation (hourly rates, supplements, overtime)
- Pay period summaries
- Tax/deduction estimates
- **Tools:** `calculateShiftPay`, `getPayPeriodSummary`, `getDeductions`

### Implementation Pattern

Each capability is a module in `packages/ai/capabilities/{name}/`:

```typescript
// packages/ai/capabilities/schedule/index.ts
export const scheduleCapability: CapabilityDefinition = {
  name: "schedule",
  description: "Shift and schedule management",
  tools: [listShifts, requestSwap, checkAvailability],
  readOnlyTools: [listShifts], // subset for read_only authority
};
```

All tools follow the existing `SmartoutTool` pattern:

```typescript
type SmartoutTool<TCtx, TSchema> = {
  name: string;
  description: string;
  schema: TSchema; // Zod schema
  execute: (params: z.infer<TSchema>, ctx: TCtx) => Promise<string>;
};
```

---

## 5. Agent Router

The core new module that handles free-form Mr. Botsson conversations.

### 5.1 Flow

```
Employee message
       │
       ▼
┌─────────────────────────────────┐
│  1. CONTEXT LOADING             │
│     Load session, memory,       │
│     profile, authority config   │
├─────────────────────────────────┤
│  2. INTENT CLASSIFICATION       │
│     LLM call (generateObject)   │
│     → {intent, capability,      │
│        confidence}              │
├─────────────────────────────────┤
│  3. CAPABILITY SELECTION        │
│     confidence >= 0.7:          │
│       load matched capability   │
│     confidence < 0.7:           │
│       load ALL capabilities     │
├─────────────────────────────────┤
│  4. AUTHORITY CHECK             │
│     Filter tools by authority   │
│     level for this workspace    │
├─────────────────────────────────┤
│  5. TOOL-CALLING AGENT LOOP    │
│     Vercel AI SDK generateText  │
│     with filtered tools         │
│     Max steps: 5 (configurable) │
├─────────────────────────────────┤
│  6. RESPONSE FORMATTING         │
│     Adapt to channel            │
│     Store conversation turn     │
│     Extract memories (if EOD)   │
└─────────────────────────────────┘
       │
       ▼
Employee response
```

### 5.2 Intent Classification Schema

```typescript
const intentSchema = z.object({
  intent: z.string(), // e.g., "schedule:query", "training:status"
  capability: z.enum([
    "knowledge",
    "schedule",
    "training",
    "operations",
    "profile",
    "communication",
    "payroll",
    "general",
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(), // why this classification
});
```

### 5.3 Routing Logic

```
if confidence >= 0.7:
  tools = capabilities[matched].tools (filtered by authority)
elif confidence < 0.7:
  tools = ALL capabilities' tools (filtered by authority)
```

This escape hatch ensures Mr. Botsson never gets stuck on ambiguous intent. Optimization with real usage data comes later.

### 5.4 System Prompt Structure

```markdown
# Mr. Botsson — AI-kollega hos {workspace.name}

Du er Mr. Botsson, en hjelpsom AI-kollega. Du snakker norsk med {employee.name}.

## Din personlighet

- Vennlig, direkte, profesjonell
- Tilpass tonen til konteksten (casual for daglige spørsmål, formell for HR)
- Aldri late som du vet noe du ikke vet

## Om {employee.name}

- Rolle: {profile.role} i {department.name}
- Team: {team.name} (teamleder: {team.leader})
- Status: {profile.status}
- Readiness: {readiness_score}%

## Nylige samtaler

{recent_memories}

## Tilgjengelige handlinger

{tool_descriptions filtered by authority}

## Regler

- Svar alltid på norsk med mindre brukeren skriver på engelsk
- Bruk verktøyene dine for å slå opp informasjon — aldri gjett
- Hvis du er usikker, si det og foreslå hvem de kan kontakte
```

---

## 6. Channel Adapters

### 6.1 Chat Adapter (SSE)

- **Protocol:** Server-Sent Events for streaming
- **Endpoint:** `POST /agent/chat`
- **Input:** `{session_id?, message, profile_id}`
- **Output:** SSE stream of tokens + final message
- **Client:** React component in `apps/web`

Why SSE over WebSocket: simpler protocol, HTTP/2 native, works through Caddy, Vercel AI SDK has first-class support. WebSocket only needed for bidirectional features (typing indicators) — not MVP.

### 6.2 Voice Adapter (Ultravox, extended)

- **Protocol:** WebRTC via Ultravox
- **Endpoint:** `POST /adapters/ultravox/agent-call` (NEW)
- **Difference from missions:** No stages. Uses Agent Router for free-form conversation.
- Ultravox STT → Agent Router → TTS
- Same HTTP tools pattern (store/fetch via staticParameters)

### 6.3 Webhook Adapter (SMS/Email, future)

- **Protocol:** HTTP webhooks from Twilio/SendGrid
- **Endpoint:** `POST /adapters/webhook/{channel}`
- **Input:** `{from, body, channel_metadata}`
- **Output:** Response sent back via channel provider
- Async: response may be delayed

---

## 7. Memory System

### 7.1 Session Memory (ephemeral)

- **Storage:** `engine_sessions.collected_data` (JSONB)
- **Contents:** Conversation turns from current session
- **Lifetime:** Session duration (24h default)
- **Purpose:** Multi-turn context within one conversation

### 7.2 Persistent Memory (durable)

New table:

```sql
CREATE TABLE engine_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profile(id),
  workspace_id UUID NOT NULL REFERENCES workspace(id),
  memory_type TEXT NOT NULL CHECK (memory_type IN ('preference', 'fact', 'summary')),
  content TEXT NOT NULL,
  embedding vector(1536),
  source_session_id UUID REFERENCES engine_sessions(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE engine_memory ENABLE ROW LEVEL SECURITY;
-- JWT policy
CREATE POLICY "jwt_read_memory" ON engine_memory FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
-- API key policy
CREATE POLICY "api_key_read_memory" ON engine_memory FOR SELECT
  USING (workspace_id = get_api_workspace_id());
```

### 7.3 Context Loading (at session start)

```
1. Profile data (name, role, department, team)
2. Recent memories (top 5 by relevance + recency via pgvector)
3. Current shift (if applicable)
4. Training status (readiness score)
5. Workspace authority config
```

### 7.4 Memory Extraction (at session end)

After each conversation, a lightweight LLM call extracts durable facts:

- **Preferences:** "Maria prefers Norwegian", "Erik likes brief answers"
- **Facts:** "Maria asked about overtime rules on 2026-02-28"
- **Summaries:** "Maria had a question about her schedule. Resolved."

Uses `generateObject()` with a memory extraction schema. Cheap, fast, runs async after response.

---

## 8. Authority System

### 8.1 Configuration Table

```sql
CREATE TABLE engine_authority_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id),
  capability TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('autonomous', 'confirm', 'suggest', 'read_only', 'disabled')),
  updated_by UUID NOT NULL REFERENCES user_identity(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, capability)
);

ALTER TABLE engine_authority_config ENABLE ROW LEVEL SECURITY;
```

### 8.2 Authority Levels

| Level        | Behavior                                   | Tool Set                                      |
| ------------ | ------------------------------------------ | --------------------------------------------- |
| `autonomous` | Agent acts without confirmation            | All read + write tools                        |
| `confirm`    | Agent suggests action, user confirms in UI | All tools, but writes wrapped in confirmation |
| `suggest`    | Agent suggests, sends to manager queue     | Read tools + suggest/request tools            |
| `read_only`  | Agent can look up information, no actions  | Read tools only                               |
| `disabled`   | Capability turned off                      | No tools, polite decline message              |

### 8.3 Enforcement

Authority is enforced at the Router level, not the tool level:

```typescript
function getToolsForCapability(
  capability: CapabilityDefinition,
  authorityLevel: AuthorityLevel,
): SmartoutTool[] {
  switch (authorityLevel) {
    case "disabled":
      return [];
    case "read_only":
      return capability.readOnlyTools;
    case "suggest":
      return [...capability.readOnlyTools, ...capability.suggestTools];
    case "confirm":
      return capability.tools; // + confirmation wrapper
    case "autonomous":
      return capability.tools;
  }
}
```

### 8.4 Defaults

All capabilities start at `read_only`. Workspace admins upgrade via settings UI. This is the safest default — Mr. Botsson can answer questions from day one but can't take any actions until explicitly enabled.

---

## 9. Database Changes Summary

New tables:

- `engine_memory` — Persistent employee memories with pgvector embeddings
- `engine_authority_config` — Per-workspace, per-capability authority levels

Extended tables:

- `engine_sessions` — New `mode` column: `'mission' | 'agent'`

Both tables get JWT + API key RLS policies per existing patterns.

---

## 10. File Structure (New/Modified)

```
services/stage-engine/
├── src/
│   ├── routes/
│   │   ├── agent/
│   │   │   ├── chat.ts              # POST /agent/chat (SSE)
│   │   │   └── voice.ts             # POST /adapters/ultravox/agent-call
│   │   └── ... (existing routes)
│   │
│   ├── core/
│   │   ├── agent-router.ts          # Intent classification + routing
│   │   ├── authority.ts             # Authority config loading + enforcement
│   │   ├── memory-manager.ts        # Load/save persistent memories
│   │   └── ... (existing core)
│   │
│   └── types/
│       ├── agent.ts                 # AgentSession, Intent, AuthorityLevel
│       └── ... (existing types)

packages/ai/
├── src/
│   ├── capabilities/
│   │   ├── knowledge/index.ts       # RAG tools
│   │   ├── schedule/index.ts        # Shift MCP tools
│   │   ├── training/index.ts        # Protocol/readiness tools
│   │   ├── operations/index.ts      # Department session tools
│   │   ├── profile/index.ts         # Employee profile tools
│   │   ├── communication/index.ts   # Notification tools
│   │   ├── memory/index.ts          # Memory retrieval tools
│   │   ├── payroll/index.ts         # Salary calculation tools
│   │   └── index.ts                 # Registry of all capabilities
│   │
│   ├── router/
│   │   ├── intent-classifier.ts     # generateObject() for intent
│   │   └── tool-selector.ts         # Authority-aware tool filtering
│   │
│   └── prompts/
│       ├── mr-botsson.ts            # System prompt template
│       └── intent-classification.ts # Intent classification prompt
```

---

## 11. Integration Points

| System                    | How It Connects                                  |
| ------------------------- | ------------------------------------------------ |
| **Dashboard (apps/web)**  | Chat widget component → SSE to `/agent/chat`     |
| **Mobile (React Native)** | Same SSE endpoint, adapted UI                    |
| **Shift MCP**             | Schedule capability calls Shift MCP tools        |
| **Supabase**              | All data access via RLS-enforced queries         |
| **OpenRouter**            | LLM calls (intent classification + agent loop)   |
| **Ultravox**              | Voice adapter creates agent-calls (not missions) |
| **n8n (future)**          | Webhook adapter receives automated triggers      |

---

## 12. What This Design Does NOT Cover

- **LiveKit migration** — Separate ADR when voice needs upgrade
- **Admin-facing agents** — This design is for employee-facing Mr. Botsson. Admin agents (onboarding wizard, contract AI, journey wizard) continue as separate workflows via Mission mode or Vercel API routes
- **Proactive agent** — Mr. Botsson initiating conversations (push notifications, reminders). Requires event system. Phase 2+
- **Multi-language** — Norwegian default, English fallback. Full i18n integration deferred
- **Rate limiting** — Per-employee, per-workspace. Implementation detail, not architectural decision
- **Observability** — Logging, metrics, cost tracking. Important but separate concern

---

## 13. Challenged & Rejected Alternatives

| Alternative                        | Why Rejected                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Anthropic Agent SDK**            | Designed for developer tooling (CLI, file system, bash). Wrong fit for multi-tenant product agents. No voice, no web streaming, no OpenRouter.                                 |
| **Module 12's 8 engines**          | Chat/Voice are channels, not capabilities. Context Engine is a session concern, not a standalone engine. Business Engine too vague. Replaced with 8 focused capability layers. |
| **Separate Agent Service**         | Clean separation but adds another Docker service, duplicates auth/context patterns. Stage Engine already has all the infrastructure.                                           |
| **WebSocket for chat**             | Overkill for MVP. SSE is simpler, HTTP/2 native, works through proxies. Upgrade to WebSocket when bidirectional features needed.                                               |
| **Single persistent conversation** | Context window bloat. Long conversations degrade quality. Fresh sessions + persistent memory gives clean context with continuity.                                              |

---

## 14. Success Criteria

1. An employee can text Mr. Botsson "Når jobber jeg i morgen?" and get their shift back
2. Same employee can ask via voice and get the same answer spoken
3. Workspace admin can disable schedule capability → Mr. Botsson declines schedule questions
4. Mr. Botsson remembers that Maria prefers Norwegian across conversations
5. Intent routing works for ambiguous questions with the confidence escape hatch
6. All interactions are workspace-isolated via RLS

---

## Changelog

| Date       | Change         | Author          |
| ---------- | -------------- | --------------- |
| 2026-03-01 | Initial design | Claude + Pontus |
