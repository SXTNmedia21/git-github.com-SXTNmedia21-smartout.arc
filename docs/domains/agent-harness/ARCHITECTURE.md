---
title: "Agent Harness — Architecture"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: agent-harness
mirror: verified
last_verified: 2026-05-23
tags: [domain, agent-harness, architecture, code-map, stage-engine, gate, classifier, engine-motor, agent-sdk, specialist-layer]
---

# Agent Harness — Architecture

> L1–L5 code map (plumbing layer). **Code wins.** Every component cited with a grep-able anchor + line ±hint. Re-verified vs code 2026-05-23.

## Layer model

```
┌──────────────────────────────────────────────────────────────────┐
│  L1  CLIENT SDK — @smartout/agent-sdk                           │
│       packages/agent-sdk/src/                                   │
│       useAgent + useAgentChat + AgentChatPanel + VoiceProvider  │
│       ClientTool registry + LiveKit voice backend               │
└──────────────────────────────────────────────────────────────────┘
                    │ HTTP / WS
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L2  STAGE ENGINE — Hono BFF (port 5010)                        │
│       services/stage-engine/src/                                │
│       Routes: /health /sessions /advance /fetch /store /ws      │
│       /guardian /recorder-metrics /agent/{chat,dispatch,queue}  │
│       /adapters/telegram                                        │
│       Middleware: auth + error-handler + request-id              │
│       Workers: mission-pool-slot + sixten-orchestrator          │
│       WS: connection-manager (ws.ts)                            │
└──────────────────────────────────────────────────────────────────┘
                    │ ADR-0112 classifier → capability routing
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L3  ROUTER / GATE / CLASSIFIER — packages/ai/src/              │
│       router/intent-classifier.ts — OpenRouter structured-out   │
│       router/tool-selector.ts — channel + min-role filter       │
│       router/attachment-dispatch.ts — file attachment routing   │
│       classifiers/pii-classifier.ts — PII soft-hold (ADR-0166) │
│       gate/gatedMutation.ts — ADR-0204 dual-policy orchestrator │
│       harness/ — HarnessAdapter (ADR-0327)                      │
│       adapters/vercel-ai.ts — chat LLM adapter (ADR-0010)      │
│       adapters/livekit.ts — voice LLM adapter (ADR-0135)       │
└──────────────────────────────────────────────────────────────────┘
                    │ capability tool execute() + emit()
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L4  ENGINE MOTOR + STATE MACHINE                               │
│       engine/ — authority-pipeline + condition-evaluator        │
│       scheduler/ — eligibility + solver (engine_process sched.) │
│       supabase/functions/engine-dispatch/ — 10 action handlers  │
│       engine_process (blueprint) → engine_state (instance)      │
│         → engine_state_step (per-step tracking)                 │
└──────────────────────────────────────────────────────────────────┘
                    │ writes agent_session_* tables
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L5  SESSION RECORDING + MEMORY                                 │
│       core/session-recorder.ts + agent_session_recording        │
│       core/session-manager.ts — SessionLane serialization       │
│       core/memory-manager.ts — engine_memory read/write         │
│       context/ — collector.ts + memory-writer.ts                │
└──────────────────────────────────────────────────────────────────┘
```

## L1 — `@smartout/agent-sdk` (ADR-0049)

`packages/agent-sdk/src/` — client-side SDK for all Smartout AI agent interactions.

| File | Purpose |
|---|---|
| `hooks/useAgent.ts` | Primary hook — session lifecycle + WS connection |
| `hooks/useAgentChat.ts` | Chat-specific hook |
| `components/AgentChatPanel.tsx` | Shared chat UI component |
| `components/AgentAvatar.tsx` | Agent avatar |
| `providers/livekit.ts` | LiveKit voice backend (post-ADR-0282 migration) |
| `providers/voice-provider.ts` | Abstract VoiceProvider interface |
| `tools/registry.ts` | ClientTool registry |
| `tools/dashboard.ts` | Dashboard client tools |
| `tools/onboarding.ts` | Onboarding wizard client tools |
| `context/` | Context state for SDK consumers |
| `types.ts` | SDK type exports |

## L2 — Stage-engine service

`services/stage-engine/src/` — sole runtime for all agent traffic.

### Routes

| File | Path | Purpose |
|---|---|---|
| `routes/health.ts` | `GET /health` | Health check |
| `routes/sessions.ts` | `POST /sessions` | Session create/resume; `deriveProfileId` called here (ADR-0151):16 |
| `routes/advance.ts` | `POST /advance` | Advance engine_state step |
| `routes/fetch.ts` | `POST /fetch` | Workspace data fetch |
| `routes/store.ts` | `POST /store` | Store to engine_inbox |
| `routes/ws.ts` | `WS /ws` | WebSocket upgrade |
| `routes/guardian.ts` | `GET /guardian` | Guardian health probe |
| `routes/recorder-metrics.ts` | `GET /recorder-metrics` | Session recorder stats |
| `routes/agent/chat.ts` | `POST /agent/chat` | Main chat route; deriveProfileId (ADR-0151) at `chat.ts:24` |
| `routes/agent/dispatch.ts` | `POST /agent/dispatch` | Mission dispatch |
| `routes/agent/queue.ts` | `GET /agent/queue` | Sixten mission queue |
| `routes/adapters/telegram.ts` | `POST /adapters/telegram` | Telegram bridge |

### Middleware

| File | Purpose |
|---|---|
| `middleware/auth.ts` | JWT + API key auth |
| `middleware/error-handler.ts` | Sentry + structured error response |
| `middleware/request-id.ts` | Correlation ID injection |

### Core components

| File | Purpose |
|---|---|
| `core/derive-profile-id.ts:22` | `deriveProfileId()` — ADR-0151 server actor (throws `ActorDerivationError` on row-not-found) |
| `core/session-manager.ts` | Session lifecycle + expiry |
| `core/session-lane.ts` | SessionLane — serializes concurrent requests per session |
| `core/session-recorder.ts` | Ring buffer → `agent_session_recording` |
| `core/guardian-evaluator.ts` | Periodic session health evaluation |
| `core/calendar-guardian.ts` | Calendar-based trigger evaluation |
| `core/memory-manager.ts` | `engine_memory` read/write + TTL |
| `core/agent-router.ts` | Core routing + pipeline orchestration |
| `core/prompt-builder.ts` | System-prompt assembly |
| `core/stage-manager.ts` | Stage lifecycle management |
| `core/build-session-summary.ts` | Session summary compilation |
| `core/pg-notify-bus.ts` | PostgreSQL LISTEN/NOTIFY bridge |
| `core/guardian-bus.ts` | Guardian event bus |
| `core/session-event-bus.ts` | Session event fanout |
| `core/telegram-bridge.ts` | Telegram relay |
| `core/engine-world-reader.ts` | `engine_world` read helper |
| `core/engine-world-writer.ts` | `engine_world` write helper |
| `core/admin-router.ts` | Admin traffic router |
| `core/chat-tool-resolver.ts` | Tool resolution per channel |
| `core/inbox-writer.ts` | Engine inbox write helper |
| `core/mission-summary.ts` | Mission completion summary |
| `core/operations-evaluator.ts` | Operations evaluation helper |
| `core/relationship-manager.ts` | Agent relationship management |
| `core/authority.ts` | Authority context builder |
| `core/webhook-sender.ts` | Outgoing webhook sender |

### Workers

| File | Purpose |
|---|---|
| `workers/mission-pool-slot.ts` | Mission pool dispatch including sixten persona (`mission-pool-slot.ts:427`) |
| `workers/sixten-orchestrator.ts` | Sixten heartbeat orchestrator — polls `sixten.pulse_received` engine_event, runs 5 health checks (ADR-0255) |
| `workers/sixten-checks.ts` | Five Sixten health-check implementations |

### WS

| File | Purpose |
|---|---|
| `ws/connection-manager.ts` | WebSocket connection lifecycle |

## L3 — Router / Gate / Classifier

12 subdirectories of `packages/ai/src/` are harness-owned (plumbing, not capability):

| Subdir | Key files | ADR anchor |
|---|---|---|
| `router/` | `intent-classifier.ts` (OpenRouter structured-output, ADR-0010), `tool-selector.ts` (channel+min-role), `attachment-dispatch.ts`, `min-role.ts` | ADR-0112 |
| `gate/` | `gatedMutation.ts` — dual-policy orchestrator (authority FIRST, then cascade) | ADR-0204 |
| `classifiers/` | `pii-classifier.ts` + `index.ts` | ADR-0166 |
| `engine/` | `authority-pipeline/`, `condition-evaluator.ts` | ADR-0099 |
| `harness/` | `factory.ts`, `authority.ts`, `types.ts`, `sources/capabilities-source.ts`, `sources/site-map-source.ts` | ADR-0327 |
| `adapters/` | `vercel-ai.ts` (chat; tool-name sanitizer for Bedrock `__` notation), `livekit.ts` | ADR-0010, ADR-0327 |
| `agents/` | `botsson.ts` + 8 named agents (contract, docs, journey-ops, onboarding, reports, schedule, context-types) | ADR-0255 |
| `tools/` | `channels.ts`, `docs.ts`, `workspace-docs.ts`, report/schedule/journey/season/onboarding helpers | shared tool primitives |
| `journey-ops/` | `runbook.ts` | runtime journey operations |
| `prompts/` | `mr-botsson.ts`, `posture.ts` | ADR-0329 (proposed) |
| `__evals__/` | `golden-transcripts/`, `golden-transcripts.eval.ts` | ADR-0073 |
| `primitives/` | `inline-confirm-card/`, `input-request/` | shared UI primitives |
| `context/` | `collector.ts`, `memory-writer.ts`, `types.ts` | session-context collection |
| `scheduler/` | `eligibility.ts`, `solver/` | engine_process orchestration scheduling |

Additional root files: `embedding.ts`, `session-context.ts`, `index.ts`, `types.ts`.

## Specialist Layer — `packages/ai/src/agents/` (8 specialists)

The `agents/` subdir is a **specialist-agent layer** inside the harness. Each specialist is a purpose-built `generateText`-based runner: it owns a system prompt, pulls tools from one `tools/` subdir (or from MCP), and exposes a single exported `run*Agent()` function. Specialists are NOT capabilities — they are standalone AI runners called directly by their own BFF routes. They do NOT flow through gatedMutation or the intent classifier. They are owned by agent-harness and linked from the edge-domain's README Agent Guardrails.

### Specialist matrix (verified 2026-05-23)

| Specialist | File | Model | Tool connection | BFF route | Auth pattern | Edge-domain |
|---|---|---|---|---|---|---|
| **botsson** | `agents/botsson.ts:166` | `anthropic/claude-sonnet-4.6` via OpenRouter (`botsson.ts:106`) | All 22 capabilities via `BOTSSON_CAPABILITIES` flatMap (`botsson.ts:176`) | `apps/web/src/app/api/botsson/chat/route.ts` → proxies to stage-engine `/agent/chat` | JWT or API-key forwarded to stage-engine; stage-engine re-checks | botsson domain (persona surface, ADR-0206 v2) |
| **contract** | `agents/contract.ts:77` | `anthropic/claude-sonnet-4.6` via OpenRouter (`contract.ts:57`) | `packages/ai/src/tools/contract/` (19 tools: read_document, search_clauses, validate_contract, edit_text, …) | `apps/web/src/app/api/contract-agent/route.ts` | JWT + godmode (`is_godmode`) guard (`contract-agent/route.ts:38–44`) | contracts (template editor, platform-admin only) |
| **docs** | `agents/docs.ts:54` | `anthropic/claude-sonnet-4.6` via OpenRouter (`docs.ts:44`) | No local tools — knowledge injected as context via `getUserManualDocs()` / `searchUserManual()` | `apps/landing/src/app/api/docs-agent/route.ts` | No auth check — public landing endpoint (`docs-agent/route.ts:21–32`) | (landing app — no dedicated domain; documentation surface) |
| **journey** | `agents/journey.ts:121` | `anthropic/claude-sonnet-4.6` via OpenRouter (`journey.ts:96`) | `packages/ai/src/tools/journey/` (4 tools: lookup_journeys, check_duplicates, save_draft, …) | `apps/web/src/app/api/journey-agent/route.ts` | godmode only via `getSuperAdminId()` (`journey-agent/route.ts:39`) | procedure-engine (journey definition wizard, platform-admin scope) |
| **journey-ops** | `agents/journey-ops.ts:90` | `anthropic/claude-sonnet-4.6` via OpenRouter (`journey-ops.ts:76`) | `packages/ai/src/tools/journey-ops/` (5 tools: read_journey, lookup_journeys, find_related, apply_binding, compile_journey, create_fix_issue, run_runbook) | `apps/web/src/app/api/platform-admin/journey-ops-agent/route.ts` | godmode only via `getSuperAdminId()` (`journey-ops-agent/route.ts:35`) | platform-admin (post-definition journey ops — pending platform-admin domain) |
| **onboarding** | `agents/onboarding.ts:63` | `anthropic/claude-sonnet-4.6` via OpenRouter (`onboarding.ts:48`) | `packages/ai/src/tools/onboarding.ts` (single-file tools) + `OnboardingIntelligenceSchema` for structured extraction | `apps/web/src/app/api/onboarding-agent/route.ts` | JWT auth + session ownership check (`onboarding-agent/route.ts:24–50`) | onboarding-wizard domain |
| **reports** | `agents/reports.ts:108` | `anthropic/claude-sonnet-4.6` via OpenRouter (`reports.ts:88`) | `packages/ai/src/tools/report/` (5 tools: list_data_sources, preview_report, save_report, list_saved_reports, delete_report) | `apps/web/src/app/api/reports-agent/route.ts` | JWT auth + workspace-profile check (`reports-agent/route.ts:31–63`) | reports domain (links via README Agent Guardrails) |
| **schedule** | `agents/schedule.ts:130` | `anthropic/claude-sonnet-4.6` via OpenRouter (`schedule.ts:96`) | MCP-live tools fetched from `services/shift-mcp/` via `@ai-sdk/mcp` `createMCPClient` (`schedule.ts:135`) | No standalone BFF route in `apps/web` — designed for stage-engine or service invocation via `ScheduleAgentContext` (jwt or apiKey) | API key (`x-api-key`) or JWT Bearer forwarded to shift-mcp (`schedule.ts:107–114`) | scheduling domain |

### Key structural facts (all verified 2026-05-23)

- **All 8 specialists use the same model**: `anthropic/claude-sonnet-4.6` via `createOpenRouter()` from `@openrouter/ai-sdk-provider`. Provider is OpenRouter (ADR-0010). Model bumped from `claude-sonnet-4` on 2026-04-07 per ADR-0073 Phase 4 audit.
- **Transport**: `generateText()` from Vercel AI SDK, **not** streaming. Reason: tool-chaining (list → check → create → confirm) requires collecting all tool results before reply. `stopWhen: stepCountIs(N)` limits recursion.
- **Tool wiring**: 7 of 8 specialists use `toVercelTools()` from `packages/ai/src/adapters/vercel-ai.ts` to convert domain-specific tool arrays to AI SDK ToolSet. Exception: `schedule.ts` fetches tools live from the shift-mcp MCP server.
- **Botsson is different**: `botsson.ts` routes to stage-engine rather than running `generateText` directly from its BFF route. The `apps/web/src/app/api/botsson/chat/route.ts` is a **proxy** to stage-engine `/agent/chat`. The stage-engine runs the full intent classifier + gate + capability pipeline. `runBotssonAgent()` is defined but only called internally by stage-engine workers, not directly by the web BFF.
- **gatedMutation**: Specialists themselves do NOT call `gatedMutation`. Their tools are either read-only (docs, journey, journey-ops read tools) or write via their own tool layer without the authority gate. The gatedMutation path is the stage-engine → capability path (ADR-0204), not the specialist path. Specialists are purpose-built runners for editor/wizard UX, not the main AI agent pipeline.
- **No per-specialist session recording**: Specialists do not write to `agent_session_recording`. Session recording is stage-engine's responsibility for the main Botsson/capability pipeline.

### Per-specialist detail blocks

**botsson** (`packages/ai/src/agents/botsson.ts`)
- System prompt: Admin chat — "Du er Mr. Botsson … en arbeider, ikke en chatbot" — delegates all 22 capabilities. Full capability parity with voice path.
- Tool layer: all capabilities via `BOTSSON_CAPABILITIES` constant (`botsson.ts:114`). 22 capabilities flat-mapped.
- BFF auth: `apps/web/src/app/api/botsson/chat/route.ts` proxies to stage-engine `/agent/chat` with user JWT forwarded as `Authorization: Bearer`. Stage-engine's `deriveProfileId` (ADR-0151) runs server-side.

**contract** (`packages/ai/src/agents/contract.ts`)
- System prompt: "Du er en kontraktsassistent … bygge, redigere og forbedre kontraktsmaler" — contract template editor for admins.
- Tool layer: `CONTRACT_TOOLS` from `packages/ai/src/tools/contract/` — 19 files including read_document, search_clauses, edit_text, validate_contract, add_signature_field.
- BFF auth: `is_godmode` check via admin client (`contract-agent/route.ts:38–44`). Platform-admin only.

**docs** (`packages/ai/src/agents/docs.ts`)
- System prompt: "You are LISA, Smartout Documentation Agent … answers ONLY from provided context" — RAG over user manual docs. No tool calls (`generateText` without tools).
- Tool layer: none — knowledge injected via `getUserManualDocs()` + `searchUserManual()` in the BFF route, passed as `knowledge` array to `runDocsAgent()`.
- BFF: `apps/landing/src/app/api/docs-agent/route.ts` — public, no auth. Landing app only.

**journey** (`packages/ai/src/agents/journey.ts`)
- System prompt: 6-phase wizard (Discovery → Classification → Steps → Testing → Documentation → Review) for defining new journeys.
- Tool layer: `JOURNEY_TOOLS` from `packages/ai/src/tools/journey/` — 4 tools: lookup_journeys, check_duplicates, save_draft + index.
- BFF auth: `getSuperAdminId()` godmode check + `wizard_session` ownership validation (`journey-agent/route.ts:39–54`).

**journey-ops** (`packages/ai/src/agents/journey-ops.ts`)
- System prompt: "Journey Operations Agent — read spec, keep index, apply binding, compile journey" — post-definition ops on existing journeys. Evidence-driven, never applies blindly.
- Tool layer: `JOURNEY_OPS_TOOLS` from `packages/ai/src/tools/journey-ops/` — 7 tools: read_journey, lookup_journeys, find_related, run_runbook, apply_binding, compile_journey, create_fix_issue.
- BFF auth: `getSuperAdminId()` godmode check (`journey-ops-agent/route.ts:35`). Platform-admin scope.

**onboarding** (`packages/ai/src/agents/onboarding.ts`)
- System prompt: "Mr. Botsson — Workspace Architect and AI Onboarding Copilot" — voice-compatible interview to map org structure. One question at a time.
- Tool layer: `ONBOARDING_TOOLS` from `packages/ai/src/tools/onboarding.ts` + `extractOnboardingIntelligence` uses `generateObject` with `OnboardingIntelligenceSchema`.
- BFF auth: JWT auth + `onboarding_session` ownership check (session.user_id === user.id, `onboarding-agent/route.ts:44–50`).

**reports** (`packages/ai/src/agents/reports.ts`)
- System prompt: Step-by-step report wizard (datakilde → metrikker → gruppering → filtre → visualisering → forhåndsvisning → lagring). Norwegian language.
- Tool layer: `REPORT_TOOLS` from `packages/ai/src/tools/report/` — 5 tools: list_data_sources, preview_report, save_report, list_saved_reports, delete_report.
- BFF auth: JWT auth + workspace-profile guard (`reports-agent/route.ts:54–63` — verifies `profile` row exists for `(workspace_id, user_id)`).

**schedule** (`packages/ai/src/agents/schedule.ts`)
- System prompt: "Du er Lise — Smartouts AI-drevne vaktplanlegger" — shift planning via MCP tools. No standalone web BFF route.
- Tool layer: MCP-live from `services/shift-mcp/` — fetched via `createMCPClient({ transport: { type: "http", url: mcpUrl/mcp } })`. Tools: create_shift, update_shift, delete_shift, list_shifts, get_shift.
- Auth: `ScheduleAgentContext` passes `jwt` or `apiKey` as HTTP headers to shift-mcp. Designed for service invocation; no dedicated `apps/web` BFF route exists yet.

`supabase/functions/engine-dispatch/index.ts` — single dispatch core per CLAUDE.md. Advances `engine_state` through 10 action-type handlers:

| Action type | Line ±hint |
|---|---|
| `wait_for_event` | `:776` |
| `assign_task` | `:787` |
| `send_notification` | `:813` |
| `update_entity` | `:846` |
| `create_deviation` | `:1431` |
| `validate_settlement` | `:1541` |
| `lock_checkout` | `:1626` |
| `schedule_control` | `:1760` |
| `start_process` | `:1830` |
| `upsert_session` | `:1857` |

## L5 — Session recording + memory

`services/stage-engine/src/core/session-recorder.ts` — ADR-0184 singleton ring buffer. Fire-and-forget. Hooks at every pipeline stage (prompt-builder, agent-router, authority, guardian, memory). Writes to `agent_session_recording` via service-role client. Init at `index.ts:~55` via `createRecorder` + `setRecorder`.

Memory manager: `core/memory-manager.ts` — reads/writes `engine_memory`. Feeds context collector which feeds next session's system prompt.
