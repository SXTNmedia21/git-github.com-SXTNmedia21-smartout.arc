---
title: Agent Framework Architecture
status: done
updated: 2026-03-30
created: 2026-03-30
module: ai
tags: [architecture, agent, stage-engine, guardian, voice]
---

# Agent Framework Architecture

Smartout's agent framework is a unified AI layer powering Mr. Botsson across all interaction channels — voice, chat, phone, and autonomous. The framework runs inside the Stage Engine (Hono microservice, port 5000) and uses the `@smartout/ai` package for shared abstractions.

---

## 1. Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  apps/web  ←→  useBotsson (Ultravox)  ←→  @smartout/agent-sdk  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP / WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│                     STAGE ENGINE (Hono)                         │
│  /sessions   /adapters/ultravox   /agent/chat   /guardian/ws    │
│                                                                 │
│   session-manager  ──▶  stage-manager  ──▶  prompt-builder      │
│        │                                                        │
│   agent-router  ──▶  intent-classifier  ──▶  tool-selector      │
│        │                                                        │
│   guardian-evaluator  ──▶  guardian-bus  ──▶  guardian_log      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     @smartout/ai (shared)                       │
│  SmartoutTool  ·  Capabilities  ·  Router  ·  Adapters          │
│  Prompts (mr-botsson, posture)  ·  Context Collector            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                  SUPABASE (PostgreSQL)                           │
│  engine_sessions  ·  engine_stages  ·  engine_missions          │
│  engine_memory  ·  engine_authority_config  ·  guardian_log     │
└─────────────────────────────────────────────────────────────────┘
```

### Two operation modes in the same service

| Mode | Description | `mission_id` |
|------|-------------|-------------|
| `mission` | Structured, stage-by-stage interview. Voice onboarding, guided protocols. | Required |
| `agent` | Free-form conversation with capability routing. Employee daily assistant. | `null` |

Both modes share `engine_sessions`, the auth middleware, and the Guardian system.

---

## 2. SmartoutTool Abstraction

**File:** `packages/ai/src/types.ts`

The core primitive. A tool is framework-agnostic — it has no dependency on Vercel AI SDK or LiveKit:

```typescript
type SmartoutTool<TCtx = unknown, TSchema extends z.ZodType = z.ZodType> = {
  name: string;
  description: string;
  schema: TSchema;                                            // Zod schema for input
  execute: (params: z.infer<TSchema>, ctx: TCtx) => Promise<string>;
};
```

The `TCtx` type carries session context (workspaceId, profileId, sessionId, supabaseAdmin) into every tool execution without coupling the tool definition to any specific framework.

### Adapters

Tools are converted to framework-specific formats at the boundary:

| Adapter | File | Target | Key difference |
|---------|------|--------|---------------|
| `toVercelTools()` | `adapters/vercel-ai.ts` | Vercel AI SDK `generateText()` | Uses `inputSchema` convention |
| `toLiveKitTools()` | `adapters/livekit.ts` | `@livekit/agents` | Uses `parameters` convention, peer dep |

```typescript
// Usage in agent router (Vercel AI SDK path)
const vercelTools = toVercelTools(selectedTools, agentContext);
const result = await generateText({ model, tools: vercelTools, ... });

// Usage in LiveKit agent (requires @livekit/agents)
const lkTools = toLiveKitTools(selectedTools, agentContext, llm.tool);
```

The LiveKit adapter does NOT import `@livekit/agents` — it accepts the `llm.tool` factory as a parameter, keeping the package dependency-free.

---

## 3. Stage Engine Flow (Mission Mode)

Mission mode is the primary path for guided interactions: onboarding interviews, protocol walkthroughs, etc.

```
POST /sessions
  │
  ▼
createSession()
  ├── loadMission(mission_id)         — engine_missions + engine_stages + journey
  ├── loadIdentityContext()           — workspace, profile, user_identity
  ├── INSERT engine_sessions          — status=active, current_stage_id=stages[0]
  └── buildStagePrompt(stage, ctx)    — system prompt for LLM
        │
        ▼
   { session_id, system_prompt, current_stage }
        │
        ▼  (voice path)
POST /adapters/ultravox/create-call
  ├── createUltravoxCall(system_prompt, tools)
  └── Returns { join_url, call_id, session_id }
        │
        ▼  (Ultravox voice call, LLM calls tools)
POST /adapters/ultravox/store          — writes to engine_inbox, fires guardian eval
POST /adapters/ultravox/advance        — advanceStage(), returns X-Ultravox-Response-Type: new-stage
        │
        ▼
Mission complete → status=complete, fires callback_url webhook
```

### Mission structure

| Table | Role |
|-------|------|
| `engine_missions` | Top-level definition: name, mode, system_prompt, journey_id |
| `engine_stages` | Ordered steps: goal, instructions, success_criteria, next_stage, emotion_hint |
| `engine_inbox` | Structured data written by the agent during a session |
| `engine_sessions` | Live session state: current_stage_id, collected_data, context |

### Mission modes

- **sequential** — follows `stage.next_stage` chain. Default for onboarding.
- **free** — caller passes `next_stage_id` with each advance request.
- **hybrid** — sequential for required stages, free for optional ones.

### Prompt builder

`core/prompt-builder.ts` composes the system prompt from:
1. Mission-level `base_prompt` (personality, voice rules)
2. Stage `personality_override` + `emotion_hint`
3. `creative_freedom` level (0 = strictly follow script, 1 = improvise)
4. Stage `goal`, `instructions`, `success_criteria`
5. Session `context` (identity, workspace, journey step)
6. `collected_data` from previous stages
7. Stage `tuning_notes` and `inline_instructions`

Template variable `{{current_date}}` is substituted at build time.

---

## 4. Agent Router Pipeline (Agent Mode)

Agent mode routes free-form employee messages through a capability pipeline.

```
POST /agent/chat
  │
  ▼ 1. Load session context (profile, workspace, memories)
  │
  ▼ 2. classifyIntent(message, context)
  │      OpenRouter → claude-sonnet-4
  │      Returns: { intent, capability, confidence, reasoning }
  │
  ▼ 3. selectTools(intent, authorityConfig)
  │      High confidence (≥0.7) → tools for that capability only
  │      Low confidence        → tools for all enabled capabilities
  │
  ▼ 4. toVercelTools(tools, agentContext)
  │      Wraps SmartoutTools for Vercel AI SDK
  │
  ▼ 5. generateText({ model, tools, system_prompt })
  │      Vercel AI SDK + OpenRouter
  │
  ▼ 6. Stream response back to client
```

### Intent classifier

**File:** `packages/ai/src/router/intent-classifier.ts`

Classifies messages into one of 10 capabilities using structured output (`generateObject`):

```
knowledge | schedule | training | operations | profile
communication | memory | payroll | ui | general
```

Confidence below 0.7 triggers fallback: all enabled tools are loaded (general mode).

### Tool selector

**File:** `packages/ai/src/router/tool-selector.ts`

Capability tools are filtered by authority level:

| Authority | Tools available |
|-----------|----------------|
| `autonomous` | All tools including writes |
| `confirm` | All tools (UI must confirm before write executes) |
| `suggest` | Read-only + suggest tools |
| `read_only` | Read-only tools only |
| `disabled` | No tools from this capability |

---

## 5. Guardian System

The Guardian watches all active sessions in real time. It is the admin oversight layer — not the agent itself.

### Components

```
guardian-evaluator.ts  (server loop, every 30s)
    │
    ├── evaluateSession(id)
    │     ├── Load session + current stage + journey step
    │     ├── Check data completeness (data_writes fields)
    │     ├── Auto-advance if all required data collected + min_duration met
    │     ├── Whisper timeout warning at 80% of max_duration
    │     ├── Hard timeout whisper at max_duration
    │     └── Missing field nudge after 60s
    │
    └── whisperToSession()
          ├── Appends to collected_data._whispers[]
          └── emitGuardianEvent()

guardian-bus.ts  (event bus + WS manager)
    ├── emitGuardianEvent()      → broadcast to dashboard + persist to guardian_log
    ├── addClient(ws, workspaceId)
    └── subscribeSession(client, sessionId)

guardian.ts (route /guardian/ws)
    ├── JWT auth in query param (?token=...)
    ├── Requires admin or owner role
    ├── Commands: subscribe | unsubscribe | change_stage | whisper
    └── Sends active session list on connect
```

### Guardian events

| Event type | Trigger | Actor |
|-----------|---------|-------|
| `session.started` | Session created | system |
| `session.completed` | All stages done | system |
| `session.abandoned` | Client calls /abandon | system |
| `stage.changed` | Stage advanced | system |
| `data.collected` | Voice store called | agent |
| `guardian.auto_advance` | All fields collected, min_duration met | guardian |
| `guardian.nudge` | Missing fields after 60s | guardian |
| `guardian.timeout` | Hard timeout exceeded | guardian |
| `guardian.timeout_warning` | 80% of max duration | guardian |
| `guardian.nudge_confirm` | Needs confirmation prompt | guardian |
| `admin.stage_change` | Admin forced stage change | admin |
| `admin.whisper` | Admin injected message | admin |

### Guardian whispers

Whispers are injected into `collected_data._whispers[]` and included in the next prompt build. The agent sees them as implicit coaching without the user seeing the instruction.

---

## 6. Voice Provider Abstraction

Current production provider: **Ultravox** (Speechmatics + Claude or GPT behind the scenes).

### Session flow

```
Client (apps/web)
  │
  ├── useBotsson (or @smartout/agent-sdk useAgent)
  │     ├── Registers client tool implementations (UltravoxSession.registerToolImplementation)
  │     ├── Fetches join URL from /api/wizard/start → POST /adapters/ultravox/create-call
  │     └── session.joinCall(joinUrl)
  │
Ultravox platform
  │
  ├── Transcribes speech → routes to LLM
  ├── Client tools → calls registerToolImplementation() in browser
  └── HTTP tools  → calls back to /adapters/ultravox/store, /fetch, /advance
```

### Client tools

Registered with `UltravoxSession.registerToolImplementation(name, fn)`. They execute in the browser — no round trip to Stage Engine. Used for:
- Updating UI state (form fields, key facts panel, section scroll)
- Triggering scraping jobs
- Saving memories

### HTTP tools (server-side)

Registered as `selectedTools` in the Ultravox call config. Require HTTPS — skipped in local dev. Used for:
- `store` — write structured entity data to `engine_inbox`
- `fetch` — read session context, inbox, or stage data
- `advance` — trigger stage transition, returns `X-Ultravox-Response-Type: new-stage`

### Ultravox new-stage response

Stage transitions during a live call use Ultravox's Call Stages feature:

```typescript
c.header("X-Ultravox-Response-Type", "new-stage");
return c.json({
  systemPrompt: newSystemPrompt,  // replaces the LLM's system prompt mid-call
  toolResultText: `Stage: now in "${nextStageId}". Goal: ${goal}`,
});
```

The LLM receives a new system prompt without the call ending.

---

## 7. Authority/Capability System

Each capability can be given different authority levels per workspace. This is the governance layer that controls what Mr. Botsson is allowed to do autonomously.

### engine_authority_config table

```sql
UNIQUE(workspace_id, capability)
-- capability: one of the CapabilityName enum values
-- level: 'autonomous' | 'confirm' | 'suggest' | 'read_only' | 'disabled'
```

Default when no row exists: `read_only`.

### Capability registry

**File:** `packages/ai/src/capabilities/registry.ts`

Currently registered:

| Capability | Description | Status |
|-----------|-------------|--------|
| `profile` | Employee info, team membership, contract status | Active |
| `ui` | Screen navigation, form filling, toast notifications | Active |
| `knowledge` | Policies, procedures, FAQs | Planned |
| `schedule` | Shifts, availability | Planned |
| `training` | Protocol assignments, readiness | Planned |
| `operations` | Department sessions, checklists | Planned |
| `communication` | Sending messages, notifications | Planned |
| `memory` | Past conversations, preferences | Planned |
| `payroll` | Salary, overtime, pay periods | Planned |

### Posture adaptation

**File:** `packages/ai/src/prompts/posture.ts`

The agent's communication style adapts based on:
- **Role** — trainee gets warmer, more verbose responses; manager gets slightly more formal
- **Situation** — onboarding (+warmth), HACCP (+assertiveness, -humor), scheduling (-verbosity)
- **Authority level** — `read_only` makes the agent more cautious and formal; `autonomous` adds assertiveness
- **Relationship score** — more familiarity → less formal, slightly more humor, more concise

Five personality dimensions: `formality`, `assertiveness`, `warmth`, `humor`, `verbosity` (all 0–1).

---

## 8. Agent SDK (`@smartout/agent-sdk`)

The `packages/agent-sdk` package is the unified client-side interface for all agent interactions. It replaces the ad-hoc `useBotsson` hook and any future duplicate implementations.

**See:** `docs/modules/MODULE_AGENT_SDK.md` for the module reference.
**See:** `docs/decisions/0043-agent-sdk-package.md` for the decision rationale.

### Design

```typescript
// Single hook — works for voice, chat, and phone
const agent = useAgent({
  missionId: "onboarding-interview",
  tools: buildToolKit(onboardingTools),
  provider: "ultravox",
  onTranscript: setTranscript,
});
```

### VoiceSession interface

```typescript
type VoiceSession = {
  join(url: string): void;
  leave(): void;
  muteMic(): void;
  unmuteMic(): void;
  sendText(text: string): void;
  registerTool(name: string, impl: ClientToolImplementation): void;
  on(event: VoiceSessionEvent, handler: VoiceSessionEventHandler): void;
};
```

Ultravox and LiveKit implement this interface. Future providers (WebRTC, Twilio) plug in without consumer changes.

---

## Key File Map

| File | Role |
|------|------|
| `packages/ai/src/types.ts` | SmartoutTool type + defineTool helper |
| `packages/ai/src/adapters/vercel-ai.ts` | Converts to Vercel AI SDK format |
| `packages/ai/src/adapters/livekit.ts` | Converts to LiveKit agent format |
| `packages/ai/src/router/intent-classifier.ts` | OpenRouter-based capability classifier |
| `packages/ai/src/router/tool-selector.ts` | Authority-filtered tool selection |
| `packages/ai/src/capabilities/registry.ts` | Capability registration + lookup |
| `packages/ai/src/capabilities/types.ts` | CapabilityName, AuthorityLevel, AgentToolContext |
| `packages/ai/src/prompts/mr-botsson.ts` | System prompt builder (legacy + context-aware) |
| `packages/ai/src/prompts/posture.ts` | Personality adaptation logic |
| `services/stage-engine/src/core/session-manager.ts` | Session CRUD, mission loading |
| `services/stage-engine/src/core/stage-manager.ts` | Stage navigation, mode resolution |
| `services/stage-engine/src/core/prompt-builder.ts` | Stage prompt assembly |
| `services/stage-engine/src/core/authority.ts` | Load authority config from DB |
| `services/stage-engine/src/core/guardian-bus.ts` | Event bus + WS client management |
| `services/stage-engine/src/core/guardian-evaluator.ts` | Session evaluation loop |
| `services/stage-engine/src/routes/adapters/ultravox.ts` | Ultravox adapter endpoints |
| `services/stage-engine/src/routes/guardian.ts` | Guardian WS route |
| `packages/agent-sdk/src/types.ts` | SDK types (AgentConfig, AgentSession, VoiceProvider) |
| `packages/agent-sdk/src/tools/registry.ts` | Client tool registry + buildToolKit |
| `apps/web/src/app/onboarding/hooks/useBotsson.ts` | Legacy voice hook (to be replaced by SDK) |
