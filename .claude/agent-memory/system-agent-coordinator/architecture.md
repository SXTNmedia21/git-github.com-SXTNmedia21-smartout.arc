# Agent Architecture — Full System Map

## System Diagram

```
                        ┌──────────────────────────┐
                        │      Next.js Web App      │
                        │    (apps/web, port 3050)   │
                        └────────┬─────────┬────────┘
                                 │         │
               Voice (Ultravox)  │         │  Chat (REST)
                ┌────────────────┘         └──────────────┐
                │                                         │
                v                                         v
     ┌─────────────────┐                       ┌──────────────────┐
     │  /api/wizard/    │                       │  Stage Engine    │
     │  start (Next.js) │                       │  POST /agent/chat│
     └────────┬─────────┘                       │  (port 3000)    │
              │                                 └────────┬─────────┘
              │ startMissionCall()                        │
              v                                          v
     ┌─────────────────┐                       ┌──────────────────┐
     │   Ultravox API   │                      │  Agent Router    │
     │  (voice infra)   │                      │  Pipeline        │
     └────────┬─────────┘                      │                  │
              │                                │  1. classifyIntent│
              │ WebRTC                         │  2. loadAuthority │
              │ client tools                   │  3. collectContext│
              v                                │  4. selectTools   │
     ┌─────────────────┐                      │  5. buildPrompt  │
     │  useBotsson.ts   │                      │  6. generateText │
     │  (browser, React)│                      └────────┬─────────┘
     │  Registers:      │                               │
     │  - updateBusiness│                               v
     │  - addDepartments│                      ┌──────────────────┐
     │  - saveMemory    │                      │  @smartout/ai    │
     │  - addKeyFact    │                      │  packages/ai/    │
     │  - etc.          │                      └──────────────────┘
     └─────────────────┘
```

## Two Session Modes

### Mission Mode (voice-first)

- `engine_sessions.mode = 'mission'`
- `mission_id` is NOT NULL
- Has `current_stage_id`, `stage_index`
- Stages loaded from `engine_missions` + `engine_stages`
- Stage navigation: sequential, free, or hybrid
- Stage transitions via `POST /sessions/:id/advance`
- Data stored via `POST /sessions/:id/store` -> `engine_inbox`
- System prompt rebuilt per stage by `prompt-builder.ts`
- Ultravox adapter wraps store/fetch/advance for voice calls

### Agent Mode (chat-first)

- `engine_sessions.mode = 'agent'`
- `mission_id` is NULL (constraint enforced)
- No stages — free-form conversation
- Conversation stored in `collected_data.conversation[]`
- Pipeline: intent -> authority -> context -> tools -> prompt -> LLM
- Tools selected dynamically based on intent + authority config
- System prompt built by `mr-botsson.ts` using full AgentContext

## Current Onboarding (Voice via Ultravox, NOT using Stage Engine missions)

The current onboarding uses Ultravox directly with CLIENT tools:

1. Frontend calls `/api/wizard/start` which calls `startMissionCall()`
2. This sends the Lise system prompt + client tools to Ultravox API
3. Ultravox runs the voice session
4. When Lise calls a tool, Ultravox calls it CLIENT-SIDE in the browser
5. The browser-side tool implementations update React state
6. State is persisted to `onboarding_session` table (NOT engine_sessions)

This is important: the current onboarding does NOT use `engine_missions`/`engine_stages`.
It's a flat prompt in `missions/registry.ts` with client-side tools in `useBotsson.ts`.

## Package Exports (subpath imports)

```
@smartout/ai                        -> core types, tools, missions
@smartout/ai/agents/onboarding      -> runOnboardingAgent
@smartout/ai/agents/docs            -> doc agent
@smartout/ai/agents/contract        -> contract agent
@smartout/ai/agents/reports         -> report agent
@smartout/ai/agents/schedule        -> schedule agent
@smartout/ai/agents/journey         -> journey agent
@smartout/ai/capabilities           -> registry
@smartout/ai/capabilities/types     -> CapabilityDefinition, AuthorityLevel, etc.
@smartout/ai/capabilities/profile   -> profileCapability
@smartout/ai/router/intent-classifier -> classifyIntent
@smartout/ai/router/tool-selector   -> selectTools
@smartout/ai/prompts/mr-botsson     -> buildBotssonPrompt, buildBotssonPromptFromContext
@smartout/ai/prompts/posture        -> resolvePosture
@smartout/ai/context/collector      -> collectContext
@smartout/ai/context/types          -> AgentContext
@smartout/ai/adapters/vercel-ai     -> toVercelTools
@smartout/ai/adapters/livekit       -> toLiveKitTools
@smartout/ai/missions               -> MISSIONS, getMission, startMissionCall
@smartout/ai/embedding              -> getQueryEmbedding
```
