---
title: ADR-0113 — Runtime Telemetry Standard for services/
status: accepted
created: 2026-04-16
updated: 2026-04-16
module: ai
tags: [adr, telemetry, logging, runtime]
---

# ADR-0113 — Runtime Telemetry Standard for services/

## Context

Council review 2026-04-16 found stage-engine has **0** imports of `@smartout/telemetry`, 64 `console.*` calls, no requestId propagation, no Sentry wiring, and 11 of 14 capabilities missing `emit()`. The runtime is the largest mutation surface in the system and is currently exempt from the "no mutation without emit" law.

## Decision

Every service under `services/` MUST adopt the following four primitives:

1. **Structured logger** — pino instance with JSON output. One line per event. Required fields: `requestId`, `service`, `level`, `time`, `msg`. Context-bound via Hono per-request child logger.

2. **requestId middleware** — UUID generated at request entry, set on Hono context, propagated to every supabase call, every `emit()` payload (via `correlation_id` field already in `BaseEvent`), and every log line. Response header `x-request-id` returned to clients.

3. **Typed errors** — `StageEngineError` base with `code`, `httpStatus`, `context`. Concrete subclasses: `AuthorityDenied`, `ToolFailure`, `ClassifierTimeout`, `SchemaCacheStale`, `GateActionFailed`. Error handler maps `code` → `httpStatus`, logs with full context, reports to Sentry for HTTP status >= 500.

4. **Mandatory `emit()`** — every capability tool invocation emits `botsson.tool_invoked` with `{ capability, tool, latency_ms, success, requestId }`. Auto-emitted via `toVercelTools` adapter. Individual capabilities never call `emit()` manually for tool-invocation telemetry — only for domain events.

## Consequences

**Positive:** Observable runtime. Root-cause-able 500s. Cost/latency per capability becomes queryable. C4 authority decisions auditable via `gate_evaluation_id` correlation.

**Negative:** 4-5× write volume to `activity_trail` in the first month. Must verify partitioning and retention before Phase 3 of the Botsson Observability Foundation plan lands.

**Neutral:** `emitGuardianEvent()` deprecated but not removed in P0. Removed in P2 when `engine_session_event` projection ships.

## Scope

Applies to all services under `services/` — `stage-engine`, `contract-service`, `shift-mcp`, `interview-mcp`, `scrapling` (if/when migrated from Python). This ADR does NOT mandate retroactive rewrite — only new code and code touched by the Botsson Observability Foundation plan.

## Related

- Builds on: ADR-0084 (Telemetry Conditional Exports — the `@smartout/telemetry` package this ADR mandates every service import)
- Closes observability gaps identified in Council 2026-04-16
- Learning 0034 (docs/learnings/0034-capability-without-emit-invisible-to-cascade.md)

## Addendum 2026-04-16 — activity_trail Entity Contract for Agent Events

Council R2 review discovered that `packages/telemetry/src/providers/activity-trail.ts` rejects any event without `properties.entity`. The 6 `botsson.*` events registered in Phase 3 did not declare an entity → every activity_trail write was silently dropped.

**Rule:** Any event routing to `activity_trail` MUST declare `properties.entity` with `entity_type` (from EntityType union in registry.ts) + `entity_id` + optional `entity_label`.

For agent-originated events, the canonical entity is the engine session itself (`entity_type: "agent_session"` or the existing valid equivalent). This ties the activity row to the agent's session scope for compliance auditing.

**Registry must not declare `activity_trail` routing without an entity contract.** A pre-merge fix landed to add `entity` to the 6 `botsson.*` emit sites and updated their types. See commit [fix SHA] for reference.
