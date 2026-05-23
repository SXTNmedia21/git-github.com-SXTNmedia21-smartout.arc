---
title: "Agent Harness — Roadmap"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: agent-harness
mirror: aspirational
last_verified: 2026-05-23
tags: [domain, agent-harness, roadmap, adr, milestones, forward-plan]
---

# Agent Harness — Roadmap

> Aspirational. ADR-completed milestones + forward work. Mirror: aspirational (forward section is intent, not code).

## Completed milestones (ADR-backed evidence)

| ADR | Status | Milestone | Evidence anchor |
|---|---|---|---|
| ADR-0010 | ✅ accepted | OpenRouter as LLM provider via AI SDK | `packages/ai/src/adapters/vercel-ai.ts` + `packages/ai/src/router/intent-classifier.ts` |
| ADR-0029 | ✅ accepted | workspace-api-gateway pattern | `services/stage-engine/src/middleware/auth.ts` |
| ADR-0049 | ✅ accepted | `@smartout/agent-sdk` unified client SDK | `packages/agent-sdk/src/` full implementation |
| ADR-0073 | ✅ accepted | Eval harness for `packages/ai` | `packages/ai/src/__evals__/golden-transcripts/` + `golden-transcripts.eval.ts` |
| ADR-0091 | ✅ accepted | `cascade_gate_write` RPC placement (Postgres-side) | `packages/ai/src/gate/gatedMutation.ts` — Pathway B |
| ADR-0099 | ✅ accepted | Unified authority gate (`gate_action` RPC) | `packages/ai/src/gate/gatedMutation.ts` — Pathway A; `invariants:gate-singleton` CI check |
| ADR-0101 | ✅ accepted | Four-eyes confirmation | `gate_action` RPC — `four_eyes` policy path |
| ADR-0112 | ✅ accepted | Intent classifier coverage invariant | `packages/ai/src/router/intent-classifier.ts`; `invariants:intent-coverage` CI green |
| ADR-0137 | ✅ accepted | Gate stacking | `gatedMutation.ts` — stacked authority evaluation |
| ADR-0138 | ✅ accepted | Tool result schema | `packages/ai/src/types.ts` SmartoutTool result type |
| ADR-0151 | ✅ accepted | `profile_id` server derivation (never from body) | `core/derive-profile-id.ts:22`; `invariants:server-actor` CI; `agent-chat-forged-profile.test.ts` |
| ADR-0184 | ✅ accepted | Session recorder architecture | `core/session-recorder.ts`; `agent_session_recording` migration `20260515120100` |
| ADR-0199 | ✅ accepted | Harness invariants doc | `docs/architecture/INVARIANTS.md` (status: canonical); 10 invariants I1–I10 with CI enforcement |
| ADR-0204 | ✅ accepted | `gatedMutation` composition orchestrator | `packages/ai/src/gate/gatedMutation.ts`; 38 call-sites in capabilities; 57 total repo-wide |
| ADR-0206 v2 | ✅ accepted | Scope split — botsson (persona) vs agent-harness (plumbing) | botsson domain absorbed; this domain defines plumbing |
| ADR-0239 | ✅ accepted | journey-authoring capability in stage-engine | `packages/ai/src/capabilities/journey-authoring/` |
| ADR-0255 | ✅ accepted | Sixten stage-engine integration | `workers/sixten-orchestrator.ts` + `workers/sixten-checks.ts` + mission-pool-slot sixten dispatch |
| ADR-0327 | ✅ shipped (proposed→code) | HarnessAdapter — unified LLM consumer | `packages/ai/src/harness/factory.ts` + `authority.ts` + `sources/` |

## Forward work (aspirational, not built)

### Near-term

| Item | Rationale | Depends on |
|---|---|---|
| ADR-0329 soul compilation (server-side) | Proposed; code partially built (`packages/ai/src/prompts/mr-botsson.ts`); soul-on-platform-admin sortie not shipped | botsson P1 campaign |
| Intent classifier continuous coverage improvement | ADR-0112 CI check is green but new capabilities require enum addition before merge. Pattern: every new capability = 1 enum entry + intent description update | each capability PR |
| Eval harness golden transcript expansion | ADR-0073 eval harness exists; only golden-transcripts present. Need regression transcripts per capability cluster (payroll, scheduling, contracts, day-session) | capability domain champions |
| gatedMutation feature-flag graduation | `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED` flag is ON. Stabilize + remove flag scaffolding once ADR-0204 SS-4/SS-5 complete | SS-4/SS-5 sorties |

### Medium-term

| Item | Rationale | Depends on |
|---|---|---|
| Stage-engine cluster (horizontal scaling) | Single-instance with setInterval workers. Future: distributed session pool + pg_notify fan-out for multi-node | infra maturity |
| lovsen-mcp MCP boundary | Harness calls lovsen via MCP (future). Clean protocol seam already designed. | lovsen-mcp domain |
| Voice agent service boundary clarification | `services/voice-agent/` is adjacent to harness — LiveKit protocol layer. Need formal harness↔voice-agent ADR boundary. | voice-agent domain |
| ESLint rule: OKLCH literals in capability tool code | ADR-0366 replay risk. Add lint rule to catch hardcoded colors in packages/ai (rare, but L-0083 mobile pattern shows accumulated debt) | linting sprint |

### Long-term

| Item | Rationale |
|---|---|
| Harness-level circuit breaker | Harness hardening spec 2026-04-23: capability circuit breaker deferred pending fix-forward merge. Pattern: fail-open per capability, degrade gracefully. |
| Capability protocol versioning | As capabilities grow independently, version-contract between harness router and capability execute() signature becomes load-bearing. ADR draft needed. |
| Subagent delegation tracing | `agent_session_recording` captures turns but not cross-agent delegation chains. Tracing gap surfaced in L-0176 (docstring drift) analysis. |
