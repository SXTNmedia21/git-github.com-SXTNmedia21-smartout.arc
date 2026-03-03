---
title: "Stage Engine — Agent Trainer Reference"
status: canonical
updated: 2026-03-14
created: 2026-03-14
module: ai
tags: [stage-engine, agent, trainer, voice, missions, reference]
---

# Stage Engine — Agent Trainer Reference

> Practitioner's handbook for building and training Smartout AI agents.
> Covers missions, stages, prompts, tools, authority, posture, voice integration, and the process engine.
> For microservices architecture, see `SERVICES_ARCHITECTURE.md`. For Edge Functions, see `EDGE_FUNCTIONS_REFERENCE.md`.

---

## 1. Architecture at a Glance

```
┌─────────────────────────────────────────────────┐
│  Clients (Web, Mobile, Landing, Voice)          │
└──────────────────┬──────────────────────────────┘
                   │ HTTP / WebRTC
┌──────────────────▼──────────────────────────────┐
│  Stage Engine (Hono, port 3000)                 │
│  • Session lifecycle     • Stage transitions    │
│  • Agent chat routing    • Ultravox calls       │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│  @smartout/ai Package                           │
│  • Intent classification • Tool selection       │
│  • Context collection    • Prompt building      │
│  • Posture resolution    • Mission registry     │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│  Supabase (PostgreSQL + pgvector)               │
│  • engine_sessions    • engine_missions/stages  │
│  • engine_memory      • engine_authority_config │
│  • agent_profile      • agent_relationship      │
│  • engine_inbox                                 │
└─────────────────────────────────────────────────┘
```

**Two execution modes — same engine:**

| Mode        | Purpose                                        | Session shape                             | Navigation                        |
| ----------- | ---------------------------------------------- | ----------------------------------------- | --------------------------------- |
| **Mission** | Structured workflows (onboarding, HACCP audit) | `mission_id` set, stages loaded           | Sequential / Free / Hybrid        |
| **Agent**   | Free-form assistant (Mr. Botsson)              | `mission_id = NULL`, conversation history | Intent classification per message |

---

## 2. Concepts & Terminology

| Term             | Definition                                                                          |
| ---------------- | ----------------------------------------------------------------------------------- |
| **Mission**      | Reusable workflow template — ID, stages, mode, voice config                         |
| **Stage**        | One step in a mission — goal, instructions, success criteria, personality           |
| **Session**      | Active run of a mission or agent conversation                                       |
| **Channel**      | `voice` · `chat` · `sms` · `email` · `autonomous`                                   |
| **Authority**    | What the agent is allowed to do per capability: `autonomous` → `disabled`           |
| **Posture**      | Dynamic personality adaptation (formality, assertiveness, warmth, humor, verbosity) |
| **Capability**   | Domain of tools: `schedule`, `training`, `operations`, etc.                         |
| **Inbox**        | Staging area for agent-collected data — decoupled from production tables            |
| **SmartoutTool** | Framework-agnostic tool definition (Zod schema + execute function)                  |

---

## 3. File Map

### Stage Engine (`services/stage-engine/src/`)

```
index.ts                         Entry: Hono app, Vault secrets, cleanup cron
config.ts                        Env vars (Zod validated)
secrets.ts                       Load ULTRAVOX_API_KEY + OPENROUTER_API_KEY from Vault

types/
  session.ts                     Mission, Stage, Session, SessionMode
  agent.ts                       AgentChatRequest/Response, ConversationTurn
  api.ts                         Request/response shapes
  auth.ts                        AuthContext (method, workspaceId, scopes)
  ultravox.ts                    Ultravox API types

core/
  session-manager.ts             Create / load / abandon / expire sessions
  stage-manager.ts               Stage navigation (sequential/free/hybrid)
  agent-router.ts                Intent → context → tools → LLM → response
  agent-session.ts               Agent mode session lifecycle
  prompt-builder.ts              Build system prompt from stage + context
  authority.ts                   Load workspace authority config
  memory-manager.ts              Load / save / clean agent memories
  relationship-manager.ts        Familiarity, trust, sentiment scoring
  inbox-writer.ts                Validate + write agent data to inbox
  webhook-sender.ts              Fire webhooks on stage changes

routes/
  health.ts                      GET /health
  sessions.ts                    POST /sessions, GET /sessions/:id
  store.ts                       POST /sessions/:id/store
  fetch.ts                       POST /sessions/:id/fetch
  advance.ts                     POST /sessions/:id/advance
  agent/chat.ts                  POST /agent/chat
  adapters/ultravox.ts           Voice call adapters (create-call, store, fetch, advance)

middleware/
  auth.ts                        Dual-auth: API key + JWT
  error-handler.ts               Global error handler
```

### AI Package (`packages/ai/src/`)

```
types.ts                         SmartoutTool<TCtx, TSchema> definition
session-context.ts               Supabase-backed session memory

missions/
  registry.ts                    MISSIONS object — all 5 missions with full prompts
  types.ts                       MissionId, AgentMission, UltravoxVoice
  manifest.ts                    MISSION_MANIFEST for UI display
  ultravox.ts                    startMissionCall() — create Ultravox voice calls

prompts/
  mr-botsson.ts                  System prompt builder for agent mode
  posture.ts                     Personality adaptation logic

router/
  intent-classifier.ts           Classify message → capability + confidence
  tool-selector.ts               Select tools by intent + authority level

context/
  collector.ts                   Parallel fetch: profile, agent, memories, shift
  types.ts                       AgentContext, AgentProfileData, RelationshipData

capabilities/
  types.ts                       CapabilityName, AuthorityLevel, Personality, etc.
  registry.ts                    getCapability(), getAllCapabilities()
  profile/tools.ts               getProfile, getTeam, getContractStatus

adapters/
  vercel-ai.ts                   SmartoutTool[] → Vercel AI SDK format
  livekit.ts                     SmartoutTool[] → LiveKit format

embedding.ts                     Generate vector embeddings for memories
```

---

## 4. The Five Missions

### 4.1 Lise — Onboarding Guide (`onboarding-interview`)

| Field         | Value                                        |
| ------------- | -------------------------------------------- |
| Voice         | Custom Lise (UUID: `d082550b-...`)           |
| Language      | Norwegian                                    |
| Temperature   | 0.45                                         |
| Max duration  | 1800s (30 min)                               |
| First speaker | User                                         |
| Personality   | Warm, curious, direct — "mammaen i Smartout" |

**Character brief:** Lise is the mother figure. She makes sure people show up on time, dressed right, doing things in order. She has style and etiquette but is never strict. She's genuinely happy when someone comes to her — quiet, warm happy.

**Conversation flow (7 themes):**

| Theme                   | Goal                                 | Tools used                                   |
| ----------------------- | ------------------------------------ | -------------------------------------------- |
| A — Get to know         | Name + business name                 | `addKeyFact`                                 |
| B — Find the business   | Website, city, org number, industry  | `triggerScrape`, `addKeyFact`                |
| C — Confirm & fill in   | Verify scraped data, fill gaps       | `getOnboardingState`, `updateBusiness`       |
| D — Seasons             | Season name, dates, revenue, margin  | `updateSeason`, `addKeyFact`                 |
| E — Departments & teams | Department names, leaders, headcount | `addDepartments`, `addKeyFact`, `saveMemory` |
| F — Locations           | Physical locations                   | `addKeyFact`                                 |
| G — Key procedures      | Routines, HACCP, opening procedures  | `saveMemory`                                 |

**Critical rules:**

- Never starts the conversation — waits for trigger message
- Max 1-2 sentences per turn, then WAIT
- Confirms before advancing: "Stemmer det?"
- Themes flow naturally — no "now we go to step 2"
- Uses `addKeyFact` for every piece of information learned
- Uses `saveMemory` only for important, lasting knowledge
- Always asks user before saving a memory

**Available tools:**

| Tool                   | Purpose                                          |
| ---------------------- | ------------------------------------------------ |
| `updateBusiness`       | Update company info (name, address, phone, etc.) |
| `updateSeason`         | Set season (name, dates, revenue, margin)        |
| `addDepartments`       | Add department list                              |
| `triggerScrape`        | Start website intelligence scan                  |
| `getOnboardingState`   | See what's already filled in                     |
| `advanceToNextSection` | Scroll to next UI section                        |
| `addKeyFact`           | Add fact to key facts panel (top-left)           |
| `saveMemory`           | Store memory across conversations                |

---

### 4.2 Lise — Landing Demo (`landing-demo`)

| Field         | Value               |
| ------------- | ------------------- |
| Voice         | Same Lise voice     |
| Temperature   | 0.5                 |
| Max duration  | 600s (10 min)       |
| First speaker | Agent (Lise greets) |

**Purpose:** Ambassador on the public landing page. Knows Smartout inside and out.

**Pitch points:** Employee readiness, 75% annual turnover in Norwegian service industry, scheduling, training, HACCP compliance, daily operations, communications.

**Template context:** Supports `{{variant_context}}` for A/B testing different landing page variants.

---

### 4.3 Mr. Botsson — Workspace Assistant (`mr-botsson`)

| Field         | Value             |
| ------------- | ----------------- |
| Voice         | "mark" (built-in) |
| Temperature   | 0.3               |
| Max duration  | 1800s (30 min)    |
| First speaker | User              |

**Purpose:** In-dashboard AI assistant for managers and employees.

**Domains:** Shift planning, training, HACCP, routines, reports/KPIs.

**Rules:** Uses workspace data via tools. Precise and action-oriented. Honest about limitations. Refers to relevant dashboard modules.

---

### 4.4 HACCP Inspector (`haccp-inspector`)

| Field         | Value              |
| ------------- | ------------------ |
| Voice         | "sarah"            |
| Temperature   | 0.2 (very precise) |
| Max duration  | 900s (15 min)      |
| First speaker | Agent              |

**Purpose:** Guide staff through food safety controls.

**Domains:** Temperature logging (receiving, storage, preparation, serving), critical control points, deviation handling, daily HACCP checklists.

**Critical:** Precise with numbers. Stops immediately on deviations and instructs corrective action.

---

### 4.5 Shift Assistant (`shift-assistant`)

| Field         | Value         |
| ------------- | ------------- |
| Voice         | "tina"        |
| Temperature   | 0.3           |
| Max duration  | 900s (15 min) |
| First speaker | User          |

**Purpose:** Help managers with shift planning.

**Tools:**

| Tool                  | Purpose                                |
| --------------------- | -------------------------------------- |
| `getScheduleState`    | See full week: employees, shifts, gaps |
| `getShiftsForDay`     | All shifts for a specific day          |
| `getEmployeeSchedule` | One employee's shifts and absences     |
| `getCoverage`         | Staffing gaps and overtime risk        |
| `createShift`         | Create new shift                       |
| `updateShift`         | Modify existing shift                  |
| `deleteShift`         | Remove a shift                         |
| `publishShifts`       | Publish draft shifts                   |

**Workflow:** Always call `getScheduleState` first → use concrete names and numbers → confirm before mutations → verify after mutations.

---

## 5. Mission Mode — How It Works

### Session Creation

```
POST /sessions
{
  "mission_id": "onboarding-interview",
  "workspace_id": "uuid",
  "channel": "voice",
  "callback_url": "https://app.smartout.ai/webhooks"
}
```

1. Load mission + stages from `engine_missions` / `engine_stages`
2. Determine first stage (sequential: `stages[0]`, free: `null`)
3. Load identity context (workspace, profile)
4. Insert `engine_sessions` row with `status: "active"`
5. Build system prompt from first stage
6. Return `session_id`, mission info, stage, progress, prompt

### Stage Navigation

Three modes:

| Mode           | How next stage is chosen                         |
| -------------- | ------------------------------------------------ |
| **Sequential** | Follow `stage.next_stage` chain (predefined)     |
| **Free**       | Client sends `next_stage_id` in advance request  |
| **Hybrid**     | Required stages sequential, optional stages free |

### Advancing a Stage

```
POST /sessions/:id/advance
{
  "result": { "name": "Pontus", "restaurant": "Burger Bar" },
  "next_stage_id": null
}
```

1. Save `result` to `collected_data[current_stage_id]`
2. Resolve next stage based on mode
3. If no next stage → mark session `"complete"`, fire webhook
4. Build new system prompt with full context (including previous stages' data)
5. Fire `stage.changed` webhook
6. Return new stage info + progress + prompt

### System Prompt Composition (per stage)

The prompt builder assembles these blocks in order:

1. **Personality override** — Stage-specific tone
2. **Emotion hint** — "empathy", "urgency", etc.
3. **Creative freedom** — 0 (strict script) to 1 (full improv)
4. **Assignment** — Goal + instructions
5. **Success criteria** — When the stage is done
6. **Escalation** — What to do if stuck
7. **Context** — Workspace/profile data as JSON
8. **Previously collected data** — Data from earlier stages
9. **Inline instructions** — Post-action guidance

---

## 6. Agent Mode — How It Works

### The Pipeline

Every message flows through this pipeline:

```
User message
    ↓
1. Load authority config (engine_authority_config)
    ↓
2. Classify intent → { capability, confidence }
    ↓
3. Collect context (parallel fetch: profile, agent, memories, shift, relationship)
    ↓
4. Resolve posture (personality adaptation)
    ↓
5. Select tools (by capability + authority level)
    ↓
6. Build system prompt (Mr. Botsson prompt with full context)
    ↓
7. Call LLM (Claude Sonnet 4 via OpenRouter)
    ↓
8. Execute tool calls (max 5 per turn)
    ↓
9. Save conversation turn
    ↓
Response
```

### Intent Classification

**Model:** Claude Sonnet 4 via OpenRouter

**Input:** User message + employee context + registered capabilities

**Output:**

```typescript
{
  intent: "schedule:query",     // Specific intent
  capability: "schedule",       // One of 9 capabilities
  confidence: 0.92,             // 0.0–1.0
  reasoning: "User asks about weekend shifts"
}
```

**High confidence (≥ 0.7):** Use tools from the matched capability only.
**Low confidence (< 0.7):** Include read-only tools from ALL capabilities as fallback.

### 9 Capabilities

| Capability      | Domain                                           | Status     |
| --------------- | ------------------------------------------------ | ---------- |
| `knowledge`     | Company policies, procedures, FAQs               | Planned    |
| `schedule`      | Shifts, schedule changes, availability, swaps    | Planned    |
| `training`      | Protocol assignments, readiness, knowledge tests | Planned    |
| `operations`    | Department sessions, checklists, routines        | Planned    |
| `profile`       | Employee info, team, contract status             | **Active** |
| `communication` | Messages, notifications                          | Planned    |
| `memory`        | Past conversations, preferences                  | Planned    |
| `payroll`       | Salary, overtime, deductions                     | Planned    |
| `general`       | Greetings, small talk, unclear intent            | Always     |

### Agent Chat Endpoint

```
POST /agent/chat
{
  "message": "Hva er bemanningen på fredag?",
  "profile_id": "uuid",
  "session_id": "uuid-optional",
  "channel": "chat"
}
```

**Response:**

```json
{
  "session_id": "uuid",
  "response": "Fredag er full bemannet. Du jobber 17-23...",
  "intent": { "capability": "schedule", "confidence": 0.95 }
}
```

---

## 7. Authority System

### Authority Levels

Controls what the agent can DO within each capability:

| Level        | Behavior                            | Tools available                  |
| ------------ | ----------------------------------- | -------------------------------- |
| `autonomous` | Acts without confirmation           | All tools                        |
| `confirm`    | Can act, requires user confirmation | All tools                        |
| `suggest`    | Suggests actions, cannot execute    | `readOnlyTools` + `suggestTools` |
| `read_only`  | View/query only                     | `readOnlyTools` only             |
| `disabled`   | Capability unavailable              | No tools                         |

### Configuration

Stored in `engine_authority_config` (per workspace, per capability):

```sql
-- Example: workspace allows autonomous scheduling but read-only payroll
INSERT INTO engine_authority_config (workspace_id, capability, level) VALUES
  ('ws-uuid', 'schedule', 'autonomous'),
  ('ws-uuid', 'payroll', 'read_only'),
  ('ws-uuid', 'operations', 'confirm');
```

**Default:** If no row exists for a capability, the tool selector applies a system default.

### Tool Distribution by Authority

Each `CapabilityDefinition` has three tool tiers:

```typescript
{
  name: "schedule",
  description: "Shift planning and scheduling",
  tools: [querySchedule, createShift, deleteShift],        // Full execution
  readOnlyTools: [querySchedule, getShiftsForDay],          // View only
  suggestTools: [suggestShiftChange],                        // Suggestions
}
```

| Authority                | Gets                             |
| ------------------------ | -------------------------------- |
| `autonomous` / `confirm` | `tools` (all)                    |
| `suggest`                | `readOnlyTools` + `suggestTools` |
| `read_only`              | `readOnlyTools`                  |
| `disabled`               | Nothing                          |

---

## 8. Posture System — Dynamic Personality

### The 5 Dimensions

All values are `0.0` to `1.0`:

| Dimension         | Low (0)                  | High (1)             |
| ----------------- | ------------------------ | -------------------- |
| **Formality**     | Casual, first-name basis | Formal, professional |
| **Assertiveness** | Passive, suggestive      | Direct, commanding   |
| **Warmth**        | Neutral, business-like   | Empathetic, caring   |
| **Humor**         | Serious, no jokes        | Light-hearted, witty |
| **Verbosity**     | Terse, minimal           | Elaborate, detailed  |

### Base Personality

Set per agent in `agent_profile` table:

```sql
-- Mr. Botsson's default personality
UPDATE agent_profile SET
  personality_formality = 0.5,
  personality_assertiveness = 0.5,
  personality_warmth = 0.7,
  personality_humor = 0.2,
  personality_verbosity = 0.4
WHERE display_name = 'Mr. Botsson';
```

### Adaptation Pipeline

```
Base personality (agent_profile)
    ↓  if adapt_to_role = true
Role adjustment
    ↓  if adapt_to_situation = true
Situation adjustment
    ↓  if adapt_to_authority = true
Authority adjustment
    ↓  always
Relationship adjustment
    ↓
Clamp all to [0, 1]
    ↓
= Resolved Posture
```

### Adjustment Tables

**By role** (who am I talking to):

| Role     | Formality | Assertiveness | Warmth | Humor | Verbosity |
| -------- | --------- | ------------- | ------ | ----- | --------- |
| trainee  | -0.15     | —             | +0.15  | —     | +0.20     |
| employee | —         | —             | —      | —     | —         |
| manager  | +0.05     | —             | —      | —     | —         |
| admin    | +0.05     | -0.05         | —      | —     | —         |
| owner    | +0.10     | -0.10         | —      | —     | —         |

**By situation** (what are we doing):

| Situation  | Formality | Assertiveness | Warmth | Humor | Verbosity |
| ---------- | --------- | ------------- | ------ | ----- | --------- |
| onboarding | —         | —             | +0.20  | —     | +0.10     |
| haccp      | —         | +0.20         | -0.10  | -0.20 | —         |
| scheduling | —         | +0.10         | —      | —     | -0.10     |
| training   | —         | —             | +0.10  | —     | +0.10     |
| operations | —         | +0.10         | —      | —     | —         |
| general    | —         | —             | —      | —     | —         |

**By authority level** (what can I do):

| Authority  | Formality | Assertiveness | Warmth | Humor | Verbosity |
| ---------- | --------- | ------------- | ------ | ----- | --------- |
| autonomous | —         | +0.10         | —      | —     | —         |
| confirm    | —         | —             | —      | —     | —         |
| suggest    | —         | -0.20         | —      | —     | —         |
| read_only  | +0.10     | -0.30         | —      | —     | -0.10     |
| disabled   | —         | —             | —      | —     | —         |

**By relationship** (how well do we know each other):

| Condition              | Formality | Assertiveness | Warmth | Humor | Verbosity |
| ---------------------- | --------- | ------------- | ------ | ----- | --------- |
| score > 0.6 (familiar) | -0.10     | —             | —      | +0.10 | -0.05     |
| score < 0.2 (stranger) | +0.10     | —             | —      | -0.05 | +0.10     |

### Worked Example

```
Base:        { formality: 0.5, assertiveness: 0.5, warmth: 0.7, humor: 0.2, verbosity: 0.4 }
Role=employee: no change
Situation=scheduling: assertiveness +0.1, verbosity -0.1
  After:     { formality: 0.5, assertiveness: 0.6, warmth: 0.7, humor: 0.2, verbosity: 0.3 }
Authority=suggest: assertiveness -0.2
  After:     { formality: 0.5, assertiveness: 0.4, warmth: 0.7, humor: 0.2, verbosity: 0.3 }
Relationship=0.4: formality +0.1, humor -0.05, verbosity +0.1
  Final:     { formality: 0.6, assertiveness: 0.4, warmth: 0.7, humor: 0.15, verbosity: 0.4 }
```

---

## 9. Tool System

### SmartoutTool Definition

```typescript
type SmartoutTool<TCtx = unknown, TSchema extends z.ZodType = z.ZodType> = {
  name: string; // Unique identifier (e.g., "get_profile")
  description: string; // Shown to LLM
  schema: TSchema; // Zod input validation
  execute: (params: z.infer<TSchema>, ctx: TCtx) => Promise<string>;
};
```

### Creating a Tool

```typescript
import { defineTool } from "@smartout/ai";
import { z } from "zod";

const getProfile = defineTool({
  name: "get_profile",
  description: "Look up an employee's profile by ID",
  schema: z.object({
    employee_id: z.string().uuid().describe("The employee's profile ID"),
  }),
  execute: async ({ employee_id }, ctx: AgentToolContext) => {
    const { data } = await ctx.supabaseAdmin
      .from("profile")
      .select("display_name, role, status, department:department_id(name)")
      .eq("id", employee_id)
      .single();
    return JSON.stringify(data);
  },
});
```

### Tool Context

```typescript
type AgentToolContext = {
  workspaceId: string;
  profileId: string;
  userId?: string;
  sessionId: string;
  supabaseAdmin: SupabaseClient; // Service role client
};
```

### Adapters

Tools are framework-agnostic. Adapters convert them for specific runtimes:

| Adapter       | File                                   | Used by                        |
| ------------- | -------------------------------------- | ------------------------------ |
| Vercel AI SDK | `adapters/vercel-ai.ts`                | Agent router (text generation) |
| LiveKit       | `adapters/livekit.ts`                  | Voice agents on LiveKit        |
| Ultravox HTTP | Built in `routes/adapters/ultravox.ts` | Voice calls via Ultravox       |

### Registering a Capability

```typescript
// capabilities/schedule/index.ts
import type { CapabilityDefinition } from "../types.js";
import { querySchedule, getShiftsForDay, getCoverage } from "./tools.js";
import { createShift, updateShift, deleteShift } from "./tools.js";
import { suggestShiftChange } from "./tools.js";

export const scheduleCapability: CapabilityDefinition = {
  name: "schedule",
  description: "Shift planning, schedule queries, coverage analysis",
  tools: [querySchedule, getShiftsForDay, getCoverage, createShift, updateShift, deleteShift],
  readOnlyTools: [querySchedule, getShiftsForDay, getCoverage],
  suggestTools: [suggestShiftChange],
};
```

Then register in `capabilities/registry.ts`.

---

## 10. Context Collection

### What Gets Fetched (in parallel)

| Source            | Data                                                             | Table                |
| ----------------- | ---------------------------------------------------------------- | -------------------- |
| **Profile**       | Name, role, department, team, status, language                   | `profile` + FKs      |
| **Agent profile** | Display name, greeting, voice settings, personality, adapt flags | `agent_profile`      |
| **Relationship**  | Familiarity, trust, sentiment, total conversations               | `agent_relationship` |
| **Memories**      | Top 10 non-expired, by importance                                | `engine_memory`      |
| **Active shift**  | Start/end time, role, department                                 | `schedule_shift`     |

### Relationship Scoring

| Score         | Calculation                                         | Range            |
| ------------- | --------------------------------------------------- | ---------------- |
| Familiarity   | `log10(conversations + 1) / log10(50)`              | 0–1 (asymptotic) |
| Trust         | Set per workspace (manual)                          | 0–1              |
| Sentiment     | Ratio positive / total interactions                 | 0–1              |
| **Composite** | `0.3 × familiarity + 0.4 × trust + 0.3 × sentiment` | 0–1              |

### Memory System

**Types:**

| Type         | Purpose                | Example                                    |
| ------------ | ---------------------- | ------------------------------------------ |
| `preference` | User preferences       | "Prefers morning shifts"                   |
| `fact`       | Learned information    | "Has 3 kids, works part-time"              |
| `summary`    | Conversation summaries | "Discussed schedule changes on 2026-03-01" |

**Scopes:**

| Scope       | Visibility            |
| ----------- | --------------------- |
| `personal`  | Only this user        |
| `team`      | Team members          |
| `workspace` | All workspace members |
| `shared`    | Cross-workspace       |

**Persistence:**

- `constant` — Never expires (user name, role, preferences)
- `temporal` — Expires at `expires_at` (seasonal info, temporary notes)
- Cleanup cron runs every 5 minutes, deletes expired memories

**Storage:** `engine_memory` table with pgvector embedding (1536 dimensions) for semantic search.

**Rules for Lise:**

- Only save important, lasting knowledge
- Always ask user before saving: "Skal jeg notere det?"
- Never save tasks or reminders — only facts and preferences

---

## 11. Ultravox Voice Integration

### Creating a Voice Call

```
POST /adapters/ultravox/create-call
{
  "mission_id": "onboarding-interview",
  "workspace_id": "uuid",
  "voice": "d082550b-...",
  "language": "no"
}
```

**Server flow:**

1. Create engine session with `channel = "voice"`
2. Get first stage system prompt
3. Build 3 Ultravox HTTP tools (store, fetch, advance)
4. Call Ultravox API → get `call_id` + `join_url`
5. Return to client for WebRTC connection

### Ultravox HTTP Tools

Three tools are injected into every voice call:

| Tool      | Purpose                     | Parameters                                               |
| --------- | --------------------------- | -------------------------------------------------------- |
| `store`   | Save data to `engine_inbox` | `entity_type`, `data`                                    |
| `fetch`   | Get session info            | `query_type` ("context" / "inbox" / "stage" / "history") |
| `advance` | Move to next stage          | `result` (optional), `next_stage_id` (optional)          |

**Authentication:** Session ID and API key are injected as static parameters — invisible to the AI.

### Stage Transitions During Voice

When `advance` is called during a voice call, the response includes:

```json
// Header: X-Ultravox-Response-Type: new-stage
{
  "systemPrompt": "Du er Lise... [new stage prompt]",
  "toolResultText": "Stage transition: now in 'business'. Goal: Confirm details",
  "voice": "d082550b-...",
  "temperature": 0.45,
  "languageHint": "no"
}
```

Ultravox seamlessly swaps the system prompt mid-call — no reconnection needed.

### Voice Configuration

| Field                 | Mission default       | Notes                              |
| --------------------- | --------------------- | ---------------------------------- |
| `voice`               | Per mission (see §4)  | UUID for custom, name for built-in |
| `temperature`         | 0.2–0.5               | Lower = more predictable           |
| `maxDurationSeconds`  | 600–1800              | 10–30 minutes                      |
| `firstSpeaker`        | `"user"` or `"agent"` | Who talks first                    |
| `initialOutputMedium` | `"voice"`             | Always voice for calls             |
| `languageHint`        | `"no"`                | Norwegian default                  |

---

## 12. Database Tables

### Core Session Tables

**`engine_missions`**

| Column           | Type    | Notes                                    |
| ---------------- | ------- | ---------------------------------------- |
| `id`             | TEXT PK | e.g., "onboarding-interview"             |
| `name`           | TEXT    | Human-readable name                      |
| `description`    | TEXT    | Long description                         |
| `mode`           | TEXT    | `sequential` / `free` / `hybrid`         |
| `context_source` | TEXT    | Where to load context                    |
| `workspace_id`   | UUID    | NULL = global, UUID = workspace-specific |
| `is_active`      | BOOLEAN | FALSE to disable                         |

**`engine_stages`**

| Column                    | Type    | Notes                                 |
| ------------------------- | ------- | ------------------------------------- |
| `id`                      | UUID PK | Auto-generated                        |
| `mission_id`              | TEXT FK | → engine_missions                     |
| `stage_id`                | TEXT    | Unique within mission (e.g., "greet") |
| `stage_order`             | INTEGER | Sort order                            |
| `goal`                    | TEXT    | What to accomplish                    |
| `instructions`            | TEXT    | How to do it                          |
| `success_criteria`        | TEXT    | When it's done                        |
| `escalation_instructions` | TEXT    | What to do if stuck                   |
| `personality_override`    | TEXT    | Stage-specific tone                   |
| `emotion_hint`            | TEXT    | "empathy", "urgency"                  |
| `creative_freedom`        | REAL    | 0–1 improvisation scale               |
| `next_stage`              | TEXT    | → another stage_id (sequential mode)  |
| `is_required`             | BOOLEAN | Required or optional (hybrid)         |

**`engine_sessions`**

| Column             | Type        | Notes                                                  |
| ------------------ | ----------- | ------------------------------------------------------ |
| `id`               | UUID PK     | Session identifier                                     |
| `mode`             | TEXT        | `"mission"` or `"agent"`                               |
| `mission_id`       | TEXT FK     | NULL for agent mode                                    |
| `workspace_id`     | UUID FK     | Workspace isolation                                    |
| `profile_id`       | UUID FK     | Who is the user                                        |
| `channel`          | TEXT        | voice / chat / sms / email / autonomous                |
| `current_stage_id` | TEXT        | Current stage (NULL for agent mode)                    |
| `stage_index`      | INTEGER     | 0-based (-1 for agent)                                 |
| `status`           | TEXT        | active / complete / expired / abandoned                |
| `context`          | JSONB       | Workspace + profile + custom data                      |
| `collected_data`   | JSONB       | Stage data (mission) or `{ conversation: [] }` (agent) |
| `expires_at`       | TIMESTAMPTZ | Auto-expiry (default: 24h)                             |

### Agent Data Tables

**`engine_inbox`** — Staging area for agent-collected data

| Column        | Type    | Notes                           |
| ------------- | ------- | ------------------------------- |
| `session_id`  | UUID FK | Which session                   |
| `stage_id`    | TEXT    | Which stage collected this      |
| `entity_type` | TEXT    | "person", "problem", "note"     |
| `data`        | JSONB   | Arbitrary key-value (max 100KB) |
| `validated`   | BOOLEAN | Passed validation?              |
| `processed`   | BOOLEAN | Written to production tables?   |

**`engine_memory`** — Persistent agent memories

| Column         | Type         | Notes                        |
| -------------- | ------------ | ---------------------------- |
| `profile_id`   | UUID FK      | Whose memory                 |
| `workspace_id` | UUID FK      | Workspace scope              |
| `memory_type`  | TEXT         | preference / fact / summary  |
| `content`      | TEXT         | The memory content           |
| `embedding`    | vector(1536) | pgvector for semantic search |
| `expires_at`   | TIMESTAMPTZ  | NULL = permanent             |

**`agent_profile`** — Agent identity and personality

| Key columns                         | Purpose                       |
| ----------------------------------- | ----------------------------- |
| `display_name`                      | "Mr. Botsson", "Lise"         |
| `greeting`                          | First message                 |
| `language`                          | Default language              |
| `personality_*`                     | 5 base personality dimensions |
| `adapt_to_role/situation/authority` | Boolean flags                 |
| `default_voice`                     | Voice ID                      |
| `voice_speed/temperature/stability` | Voice tuning                  |

**`agent_relationship`** — User↔Agent relationship tracking

| Key columns                       | Purpose                           |
| --------------------------------- | --------------------------------- |
| `profile_id` + `agent_profile_id` | Relationship pair                 |
| `familiarity_score`               | 0–1 (log growth per conversation) |
| `trust_score`                     | 0–1 (manual)                      |
| `sentiment_score`                 | 0–1 (ratio-based)                 |
| `total_conversations`             | Counter                           |
| `last_interaction`                | Timestamp                         |

**`engine_authority_config`** — Per-workspace capability authority

| Key columns                   | Purpose                                               |
| ----------------------------- | ----------------------------------------------------- |
| `workspace_id` + `capability` | UNIQUE pair                                           |
| `level`                       | autonomous / confirm / suggest / read_only / disabled |

---

## 13. Process Engine (State Machine)

The process engine handles automated workflows separate from agent conversations.

### Tables

| Table                    | Purpose                                        |
| ------------------------ | ---------------------------------------------- |
| `engine_process`         | Workflow templates (e.g., "onboarding-30-day") |
| `engine_step`            | Steps within a process                         |
| `engine_trigger`         | Events that start a process                    |
| `engine_event`           | Recorded events (idempotent)                   |
| `engine_state`           | Active process instances                       |
| `engine_delayed_trigger` | Scheduled future triggers                      |

### Action Types

| Action                | Purpose                       |
| --------------------- | ----------------------------- |
| `wait_for_event`      | Pause until matching event    |
| `assign_task`         | Create task for a user        |
| `send_notification`   | Push notification / SMS       |
| `update_entity`       | Modify a database record      |
| `create_deviation`    | Log a deviation               |
| `validate_settlement` | Trigger settlement validation |
| `lock_checkout`       | Block day closing             |
| `schedule_control`    | Create/modify shifts          |
| `start_process`       | Nest another process          |

### Condition Language

```json
{ "match": { "field": "entity_type", "value": "shift" } }
{ "step_status": { "step_id": "training", "status": "complete" } }
{ "all": [condition1, condition2] }
{ "any": [condition1, condition2] }
```

### Dispatch

Edge Function `engine-dispatch` handles all event processing:

1. Record event (idempotency check)
2. Match active triggers (condition evaluation)
3. Create `engine_state` + execute first step
4. Resume waiting states on matching events

### Design Constraints (v1)

- No branching (no if/else in steps)
- No rollback
- Max 50 steps per process
- Minute-resolution delays (pg_cron)
- Parallel steps via `step_group` field

---

## 14. Authentication

### Dual-Auth Pattern

| Method  | Header                          | Extracts             |
| ------- | ------------------------------- | -------------------- |
| API Key | `x-api-key: smo_sk_live_...`    | workspace_id, scopes |
| JWT     | `Authorization: Bearer <token>` | workspace_id, userId |

**Workspace isolation:** Every query filters by `auth.workspaceId`. Cross-workspace access is impossible.

### Service Secrets

Loaded from Supabase Vault at startup:

- `ultravox_api_key` → Ultravox API
- `openrouter_api_key` → OpenRouter (LLM calls)

---

## 15. Trainer Checklist

### Adding a New Mission

1. Define in `packages/ai/src/missions/registry.ts`:
   - Unique ID, name, description
   - Voice, temperature, max duration, first speaker
   - Full system prompt (Norwegian)
2. Add UI manifest entry in `missions/manifest.ts`
3. Create stages in `engine_stages` table (if multi-stage)
4. Define tools specific to this mission
5. Test via `POST /adapters/ultravox/create-call`

### Adding a New Capability

1. Create `packages/ai/src/capabilities/<name>/`
2. Define tools in `tools.ts` (SmartoutTool with Zod schemas)
3. Export `CapabilityDefinition` with `tools`, `readOnlyTools`, `suggestTools`
4. Register in `capabilities/registry.ts`
5. Add default authority in `engine_authority_config` for each workspace
6. Intent classifier will automatically pick up the new capability name

### Adding a New Tool

1. Define tool with `defineTool()`:
   - Clear `name` (snake_case)
   - Descriptive `description` (LLM reads this)
   - Zod `schema` with `.describe()` on each field
   - `execute` function returning a string
2. Add to appropriate capability's tool arrays
3. Test in isolation before deploying

### Tuning Agent Personality

1. **Base personality:** Update `agent_profile` table
2. **Situation adjustments:** Edit `SITUATION_ADJUSTMENTS` in `posture.ts`
3. **Role adjustments:** Edit `ROLE_ADJUSTMENTS` in `posture.ts`
4. **Authority adjustments:** Edit `AUTHORITY_ADJUSTMENTS` in `posture.ts`
5. **Per-workspace authority:** Insert/update rows in `engine_authority_config`

### Tuning Voice

| Parameter         | Effect                        | Range                            |
| ----------------- | ----------------------------- | -------------------------------- |
| `temperature`     | Creativity vs predictability  | 0.0–1.0 (lower = safer)          |
| `voice_speed`     | Speech rate                   | 0.5–2.0                          |
| `voice_stability` | Consistency vs expressiveness | 0.0–1.0                          |
| Voice ID          | Character voice               | UUID (custom) or name (built-in) |

### Debugging a Session

1. Query `engine_sessions` for session data:
   ```sql
   SELECT id, mode, mission_id, status, context, collected_data, created_at
   FROM engine_sessions WHERE id = '<session-id>';
   ```
2. Check `engine_inbox` for stored data:
   ```sql
   SELECT * FROM engine_inbox WHERE session_id = '<session-id>';
   ```
3. Check `engine_memory` for saved memories:
   ```sql
   SELECT * FROM engine_memory WHERE profile_id = '<profile-id>'
   ORDER BY created_at DESC LIMIT 10;
   ```
4. Check authority config:
   ```sql
   SELECT * FROM engine_authority_config WHERE workspace_id = '<workspace-id>';
   ```

---

## 16. Key Patterns

### Stateless LLM Calls

Every agent router call is stateless:

- Fresh context loaded from Supabase
- New system prompt built
- Full conversation history sent
- No in-memory session state

**Benefits:** Horizontal scaling, fault tolerance, easy replay/debug.

### Inbox Pattern

Agents never write directly to production tables:

1. Agent stores data → `engine_inbox` (unvalidated)
2. Async job validates → production tables
3. Human review possible before commit
4. Full audit trail of agent actions

### Conversation as Data

Agent mode stores conversation in `collected_data.conversation`:

```json
{
  "conversation": [
    { "role": "user", "content": "Hva er min vakt?", "timestamp": "..." },
    { "role": "assistant", "content": "Du jobber fredag 17-23.", "timestamp": "..." }
  ]
}
```

Mission mode stores per-stage results in `collected_data[stage_id]`:

```json
{
  "greet": { "name": "Pontus", "restaurant": "Burger Bar" },
  "business": { "address": "...", "org_number": "..." }
}
```

---

## 17. Quick Reference — Endpoints

| Method | Path                             | Purpose                      |
| ------ | -------------------------------- | ---------------------------- |
| GET    | `/health`                        | Health check                 |
| POST   | `/sessions`                      | Create mission session       |
| GET    | `/sessions/:id`                  | Load session                 |
| POST   | `/sessions/:id/store`            | Store data to inbox          |
| POST   | `/sessions/:id/fetch`            | Fetch session context        |
| POST   | `/sessions/:id/advance`          | Advance to next stage        |
| POST   | `/agent/chat`                    | Agent mode conversation      |
| POST   | `/adapters/ultravox/create-call` | Create Ultravox voice call   |
| POST   | `/adapters/ultravox/store`       | Ultravox tool: store data    |
| POST   | `/adapters/ultravox/fetch`       | Ultravox tool: fetch context |
| POST   | `/adapters/ultravox/advance`     | Ultravox tool: advance stage |

---

## 18. Environment & Secrets

**Config (`.env`):**

| Variable                    | Default | Purpose                                  |
| --------------------------- | ------- | ---------------------------------------- |
| `PORT`                      | 3000    | HTTP port                                |
| `ENGINE_URL`                | —       | Public URL for webhooks + Ultravox tools |
| `SUPABASE_URL`              | —       | Supabase project URL                     |
| `SUPABASE_ANON_KEY`         | —       | Public key                               |
| `SUPABASE_SERVICE_ROLE_KEY` | —       | Admin key (server only)                  |
| `LOG_LEVEL`                 | info    | Logging verbosity                        |
| `SESSION_EXPIRY_HOURS`      | 24      | Session auto-expiry                      |
| `CLEANUP_INTERVAL_MINUTES`  | 5       | Cleanup cron interval                    |

**Vault secrets (loaded at startup):**

| Vault key            | Purpose                     |
| -------------------- | --------------------------- |
| `ultravox_api_key`   | Ultravox API authentication |
| `openrouter_api_key` | OpenRouter LLM calls        |
