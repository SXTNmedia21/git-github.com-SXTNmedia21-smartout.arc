---
title: "Guardian Real-Time WebSocket Architecture"
id: ADR-0052
status: accepted
layer: decision
created: 2026-03-14
updated: 2026-04-07
module: ai
tags: [guardian, websocket, stage-engine, real-time]
---

# ADR-0052: Guardian Real-Time WebSocket Architecture

> Renumbered from ADR-0049 → ADR-0052 on 2026-04-07. Original 0049 number collided with `0049-agent-sdk-package.md`, which had stronger references (ADR-0070 supersedes-relationship). Agent SDK kept the 0049 slot.

## Context and Problem Statement

Guardian needs real-time visibility into active stage engine sessions so admins can monitor conversations, see events as they happen, and intervene (change stages, whisper to agent). The question is how to transport events from the stage engine to the admin dashboard.

## Decision Drivers

- True real-time delivery (sub-100ms) — admin must see events as they happen, not after a polling delay
- Bidirectional communication — dashboard sends commands (subscribe, change_stage, whisper) back to the engine
- Minimal infrastructure — avoid adding new services or dependencies beyond what the stage engine already provides
- Auth consistency — reuse existing Supabase JWT/API key auth patterns

## Considered Options

1. **Supabase Realtime** — Write events to `guardian_log` table, subscribe via `postgres_changes` channel
2. **Direct WebSocket from stage engine** — Stage engine serves `/guardian/ws` endpoint, broadcasts events in-process

## Decision Outcome

Chosen option: **"Direct WebSocket from stage engine"**, because events originate in the stage engine process and can be broadcast immediately without a database round-trip. Supabase Realtime adds ~200ms latency and cannot receive commands back from the dashboard.

## Rules & Consequences

- **Good, because** zero-latency event delivery — events broadcast the instant they occur in the engine
- **Good, because** bidirectional — dashboard sends subscribe/unsubscribe/change_stage/whisper commands over the same connection
- **Good, because** no new infrastructure — `ws` package on the existing Node.js server
- **Bad, because** events only delivered while stage engine is running (no offline replay from DB alone)
- **Bad, because** WebSocket state is in-process — horizontal scaling requires sticky sessions or a pub/sub layer
- **Agent Impact:** All guardian event emission goes through `emitGuardianEvent()` in `guardian-bus.ts`. Events are both broadcast to WebSocket clients AND persisted to `guardian_log` table (fire-and-forget). New lifecycle events must call `emitGuardianEvent()` in the emitting file.

---

> Registered in `docs/decisions/0000-decision-log.md`.
