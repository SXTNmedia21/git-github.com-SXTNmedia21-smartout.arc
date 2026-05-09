---
title: "Agent Architecture — Stage Engine Agent Mode"
id: ADR-0042
status: accepted
layer: decision
created: 2026-03-01
updated: 2026-03-02
---

# ADR-0042: Agent Architecture — Stage Engine Agent Mode

## Context and Problem Statement

Smartout had 6 independent text agents (onboarding, FAQ, training, etc.) plus Stage Engine for voice-driven missions. There was no unified employee-facing AI — each agent was a separate implementation with its own prompts, memory, and context handling. Module 12 described "8 engines" (onboarding, training, operations, HACCP, communication, scheduling, reporting, coaching) but most were unbuilt. The fragmentation meant duplicated context loading, no shared memory, and no coherent authority model.

## Decision Drivers

- Employees need one AI entry point, not 8 separate agents
- Stage Engine already handles sessions, streaming, and tool execution for voice missions
- Building a second agent service would duplicate infra (auth, sessions, streaming, Supabase client)
- Capability layers must be composable and incrementally buildable
- Per-workspace authority control is required (some workspaces may disable AI features)
- Must work with existing Vercel AI SDK patterns already used across the codebase

## Considered Options

1. **Anthropic Agent SDK** — Use Anthropic's official agent framework as the orchestration layer
2. **Separate Agent Service** — Build a new standalone microservice for the unified agent
3. **Module 12 Engines** — Implement the original 8-engine model from Module 12
4. **Extend Stage Engine with Agent Mode** — Add agent capabilities to the existing Stage Engine
5. **WebSocket-based Agent** — Real-time bidirectional agent communication via WebSocket

## Decision Outcome

Chosen option: **"Extend Stage Engine with Agent Mode"**, because it reuses existing infrastructure (sessions, auth, streaming, Supabase client), avoids a new deployment target, and allows incremental capability building. Agent mode runs alongside mission mode in the same service with a shared session model.

### Key design decisions:

- **Composable capability layers** replace the rigid engine model. Each capability (profile, schedule, training, operations, etc.) is a self-contained module with its own tools, prompts, and authority requirements.
- **Intent classifier with confidence escape hatch** routes user messages to the right capability. When confidence is below threshold, the router asks a clarifying question instead of guessing.
- **Persistent memory with fresh sessions** — each conversation starts fresh, but the agent can read/write long-term memories stored in `engine_memory` with pgvector embeddings for semantic retrieval.
- **Per-workspace authority control** via `engine_authority_config` table. Each capability has an authority level per workspace: autonomous, notify_suggest, notify, escalate, or never.
- **Vercel AI SDK** (not Anthropic Agent SDK) — Vercel AI SDK is already used throughout the codebase and provides streaming, tool calling, and multi-provider support. Anthropic Agent SDK is designed for autonomous computer-use agents, not product-embedded conversational agents.

## Rules & Consequences

- **Good, because** single AI gateway — one service to deploy, monitor, and debug
- **Good, because** incremental — capabilities can be built one at a time without changing the architecture
- **Good, because** shared session model — agent sessions and mission sessions use the same `engine_sessions` table
- **Good, because** authority control — workspaces can fine-tune what the agent is allowed to do autonomously
- **Bad, because** Stage Engine grows in complexity — more code in one service
- **Bad, because** `mission_id` becomes nullable in `engine_sessions` — agent sessions have no mission
- **Bad, because** 8 capability layers to build incrementally — significant ongoing work
- **Agent Impact:** New tables: `engine_memory` (persistent memories with pgvector embeddings, RLS workspace isolation), `engine_authority_config` (per-workspace per-capability authority levels, UNIQUE constraint on workspace_id + capability). The `engine_sessions` table gains a `mode` column ('mission' or 'agent') and `mission_id` becomes nullable. All agent endpoints go through Stage Engine — do not create separate agent services.

---
