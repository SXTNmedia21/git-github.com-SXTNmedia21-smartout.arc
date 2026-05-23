---
title: "Agent Harness — Architecture"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: agent-harness
mirror: verified
last_verified: 2026-05-23
tags: [domain, agent-harness, architecture, code-map, stage-engine, gate, classifier, engine-motor, agent-sdk]
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

## L4 — Engine motor

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
