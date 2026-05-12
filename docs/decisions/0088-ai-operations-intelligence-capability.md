---
title: "AI Operations Intelligence as Capability, Not Daemon"
id: ADR_0088
status: accepted
layer: decision
created: 2026-04-14
updated: 2026-04-14
module: ai
tags: [ai, operations, intelligence, capability, architecture]
---

# ADR-0088: AI Operations Intelligence as Capability, Not Daemon

**Status:** Accepted
**Date:** 2026-04-14

## Context and Problem Statement

Module 4 §18 specifies an "AI Operations Layer" with six functions (TRIAGE, MONITOR, COMPILE, PREDICT, ACT, LEARN) described as a persistent background daemon — the "nervous system" of every department session. The spec also proposes two new tables (`ai_session_event`, `ai_operations_config`). We need to decide how this maps to the existing Stage Engine + capability architecture.

## Decision Drivers

- Stage Engine supports mission mode and agent mode, both user-initiated. No daemon concept exists.
- The codebase has 9 discrete capabilities registered in `packages/ai/src/capabilities/registry.ts`.
- `engine_event` + `activity_trail` + `emit()` already provide unified telemetry (ADR-0004). CLAUDE.md: "No second event system."
- `engine_authority_config` already exists with per-capability authority levels.
- Current operations tools are employee-scoped; the spec's functions are manager/system-scoped.
- PREDICT and LEARN require batch/analytical workloads, not real-time request/response.

## Considered Options

1. **Build as spec describes** — persistent daemon per session, `ai_session_event` table, `ai_operations_config` table
2. **Event-driven capability pattern** — split into two capabilities, use existing tables, Event Engine triggers + scheduled Edge Functions
3. **New "operations agent"** in `packages/ai/src/agents/` — conversational agent handling all 6 functions

## Decision Outcome

Chosen option: **Option 2 — Event-driven capability pattern**, because it preserves cascade model integrity, reuses existing infrastructure, and avoids creating parallel event/config systems.

### Specific Decisions

1. **Kill `ai_session_event`.** All AI telemetry flows through existing `emit()` → `engine_event` with event_type prefixes (`ops.triage.*`, `ops.monitor.*`).
2. **Kill `ai_operations_config`.** Store as `policy_type: 'ai_operations'` in existing `policy` table with `rules_json` for thresholds.
3. **No persistent daemon.** Use Event Engine triggers for reactive monitoring + scheduled Edge Functions for batch work.
4. **Split into two capability scopes:**
   - `operations-intelligence` — MONITOR, PREDICT, ACT, LEARN (manager/system-scoped)
   - Existing `operations` — unchanged (employee-scoped)
   - COMPILE stays in `communication` capability
   - TRIAGE cross-cuts both
5. **HACCP tools inside `operations-intelligence`** with `domain` discriminator, not a separate capability.
6. **PREDICT is advisory only** — never mutates cascade state, never writes to D4 demand tables.
7. **LEARN persists to K1b** (`engine_memory`) — no new tables. Needs retention policy.
8. **Mr. Botsson ≠ operations daemon** — persona (presentation layer) vs intelligence (computation layer), separate runtimes.

### Implementation Phasing

- Phase 1: COMPILE + TRIAGE (extend existing briefing.ts, three-tier alert system)
- Phase 2: MONITOR + ACT (extend guardian-evaluator, Event Engine triggers)
- Phase 3: PREDICT + LEARN (deferred until operational data exists)

## Rules & Consequences enforced for Agents

- **Good, because** reuses existing telemetry, capability, and authority infrastructure
- **Good, because** avoids dual event systems and parallel config tables
- **Good, because** phased approach prevents multi-month scope creep
- **Bad, because** PREDICT/LEARN are deferred — no proactive intelligence until Phase 3
- **Agent Impact:** Never create `ai_session_event` or `ai_operations_config` tables. All AI operations telemetry uses `emit()`. New operations AI tools go in `operations-intelligence` capability, not existing `operations`. PREDICT outputs are read-only — no cascade mutations.

## Council Review

Reviewed by System Council on 2026-04-14. Unanimous APPROVE WITH CHANGES.
Agents: System Steward, Supervisor, System Agent Coordinator, Frontend Designer.
