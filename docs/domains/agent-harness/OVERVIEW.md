---
title: "Agent Harness — Overview"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: agent-harness
mirror: verified
last_verified: 2026-05-23
tags: [domain, agent-harness, overview, stage-engine, cascade, event-motor, gate, router]
---

# Agent Harness — Overview

> What it is, why it exists, and where it sits in the cascade. **Code wins.**

## What

Agent Harness is the universal AI runtime infrastructure for Smartout. It is NOT a user-facing product — it is the plumbing every AI-powered capability runs on top of. It provides:

1. **Request gateway** — Stage-engine (`services/stage-engine/`, port 5010) receives all agent traffic (chat + voice) and routes it through classifier → gate → capability → response.
2. **Gate/authority system** — `gatedMutation()` (ADR-0204) serializes every capability mutation through dual policy evaluation: authority gate (`gate_action` RPC per ADR-0099) then cascade gate (`cascade_gate_write` RPC per ADR-0091).
3. **Intent classification** — `intent-classifier.ts` routes each user message to the correct capability using OpenRouter structured-output (ADR-0010, ADR-0112 coverage invariant enforced by CI).
4. **Engine motor** — `engine-dispatch` Edge Function advances `engine_process` blueprints through `engine_state` instances step-by-step (10 action-type handlers: assign_task, send_notification, wait_for_event, update_entity, create_deviation, validate_settlement, lock_checkout, schedule_control, start_process, upsert_session).
5. **Session infrastructure** — SessionLane serializes concurrent agent calls per session. Session recorder (ADR-0184) writes transcripts to `agent_session_recording`. Memory manager reads/writes `engine_memory`.
6. **LLM adapters** — Unified consumer (ADR-0327): `vercel-ai.ts` for chat, `livekit.ts` for voice. OpenRouter backend (ADR-0010). Tool-name sanitization for Bedrock boundary.
7. **Client SDK** — `@smartout/agent-sdk` (ADR-0049) provides `useAgent`, `useAgentChat`, `VoiceProvider`, `ClientTool` registry for all client surfaces.

## Why

Before harness existed, AI code was duplicated across three surfaces (onboarding wizard, dashboard chat, mobile voice) with no shared authority enforcement, no session recording, no capability registry, and no unified LLM abstraction. The harness closes the following structural gaps:

- **Authority enforcement gap**: any capability tool could write to the DB without policy evaluation. `gatedMutation` closes this.
- **Actor forgery gap**: profile_id/workspace_id could be supplied by the request body. `deriveProfileId` + ADR-0151 close this.
- **Intent routing gap**: each surface had its own routing logic. The classifier + registry close this.
- **Observability gap**: no session transcript, no correlation between LLM turns and DB writes. Session recorder + `agent_session_recording` close this.
- **Provider coupling gap**: Ultravox was directly imported in app code. `VoiceProvider` abstraction + LiveKit migration close this.

## Cascade placement

Agent Harness is a **cross-cutting infrastructure layer**. It is NOT at a specific cascade dimension — it serves all of them.

```
                 C2 Context & Interaction
                 ┌──────────────────────────────────┐
                 │  Primary cascade role             │
                 │  Agent conversation runtime       │
                 │  Tool dispatch across D1–D6 dims  │
                 └──────────────────────────────────┘

      C4 Policy & Governance          K1b Workspace Knowledge
      ┌──────────────────────┐        ┌──────────────────────┐
      │ Consumes             │        │ Consumes             │
      │ engine_authority_config│       │ engine_memory         │
      │ gates all mutations  │        │ workspace context     │
      └──────────────────────┘        └──────────────────────┘
```

The harness is BELOW C2 — it is the infrastructure that enables C2 to function. Every capability domain (payroll, scheduling, contracts, etc.) operates at its respective dimension; harness provides the rails they all run on.

## Event motor pattern

The event motor is the harness's async workflow engine. Three tables form a hierarchy:

```
engine_process  →  engine_state  →  engine_state_step
(blueprint)        (live instance)   (per-step tracking)
```

Per CLAUDE.md: "cascade produces, event engine consumes." Domain capability tools create `engine_process` blueprints (e.g. billing Fase 2, dunning, contract intake). The `engine-dispatch` EF advances each live `engine_state` by executing the next `engine_step` based on `action_type`. State machine governs lifecycle: pending → active → completed/failed.

## Gate → Route → Tool pipeline

```
User message / voice turn
        │
        ▼ services/stage-engine/src/routes/agent/chat.ts (ADR-0151: deriveProfileId here)
        │
        ▼ packages/ai/src/router/intent-classifier.ts (ADR-0112: capability routing)
        │
        ▼ packages/ai/src/router/tool-selector.ts (channel filter + min-role filter)
        │
        ▼ capability tool execute() callback
        │
        ▼ packages/ai/src/gate/gatedMutation() (ADR-0204: authority FIRST, then cascade)
              ├── gate_action RPC (ADR-0099: channel guard + four-eyes + min_role)
              ├── cascade_gate_write RPC (ADR-0091: framework triggers + change_proposal)
              └── domain execute(client) callback — DB write
```
