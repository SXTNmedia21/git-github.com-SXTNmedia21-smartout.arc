---
title: "Agent Harness — Domain Index"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: agent-harness
mirror: verified
last_verified: 2026-05-23
tags: [domain, agent-harness, stage-engine, gate, classifier, router, engine-motor, agent-sdk, source-of-truth, specialist-layer]
---

# Agent Harness — Source of Truth

> Authoritative folder for the **agent-harness** domain (plumbing under botsson). If code contradicts this folder → **CODE wins**, update these docs.
>
> **Scope boundary (ADR-0206 v2):** agent-harness = infrastructure plumbing. botsson = persona surface. The seam is the BFF→stage-engine HTTP call. Persona (soul, missions, orb, host) is botsson. Router, gate, classifier, engine motor, adapters — all agent-harness.

## Build state

| Part | Built | Tested | Notes |
|---|---|---|---|
| Stage-engine service (`services/stage-engine/src/`) | ✅ | ✅ | Hono BFF port 5010; 22 unit tests + 3 integration tests |
| `packages/ai/src/router/` — intent classifier + tool dispatch | ✅ | 🟡 | `intent-classifier.ts` live (ADR-0112); router `__evals__` + `__tests__`; invariants:intent-coverage CI check green |
| `packages/ai/src/gate/` — gatedMutation orchestrator | ✅ | 🟡 | ADR-0204 composition orchestrator; 38 call-sites in capabilities; feature-flagged ON |
| `packages/ai/src/classifiers/` — PII classifier | ✅ | 🟡 | `pii-classifier.ts` + `index.ts`; `invariants:emit-coverage` green |
| `packages/ai/src/engine/` — engine_state lifecycle | ✅ | 🟡 | authority-pipeline + condition-evaluator; state machine |
| `packages/ai/src/harness/` — HarnessAdapter (ADR-0327) | ✅ | 🟡 | factory + authority + sources (capabilities + site-map); ADR-0327 proposed→shipped |
| `packages/ai/src/adapters/` — LLM adapters (ADR-0327, ADR-0010) | ✅ | 🟡 | vercel-ai.ts + livekit.ts; tool-name sanitization for OpenRouter/Bedrock |
| `packages/ai/src/agents/` — specialist layer (8 specialists) | ✅ | 🟡 | botsson, contract, docs, journey, journey-ops, onboarding, reports, schedule — all `anthropic/claude-sonnet-4.6` via OpenRouter; 6 active BFF routes (botsson proxies to stage-engine); schedule lacks standalone BFF route (GAP-7) |
| `packages/ai/src/prompts/` — system-prompt compilation (ADR-0329) | 🟡 | 🔴 | mr-botsson.ts + posture.ts built; ADR-0329 proposed; soul-on-platform-admin sortie not shipped |
| `packages/ai/src/context/` — session-context | ✅ | 🟡 | collector.ts + memory-writer.ts + types.ts |
| `packages/ai/src/journey-ops/` — runtime journey ops | ✅ | 🟡 | runbook.ts |
| `packages/ai/src/scheduler/` — engine_process orchestration | ✅ | 🟡 | eligibility + solver |
| `packages/ai/src/__evals__/` — eval harness (ADR-0073) | ✅ | ✅ | golden-transcripts + eval runner |
| `packages/ai/src/primitives/` — shared primitives | ✅ | 🟡 | inline-confirm-card + input-request |
| `packages/agent-sdk/` — client-side SDK (ADR-0049) | ✅ | 🟡 | useAgent + useAgentChat + AgentChatPanel + VoiceProvider + LiveKit backend |
| Engine motor (`supabase/functions/engine-dispatch/`) | ✅ | 🟡 | 10 action-type handlers; 83 packages/ai test files |
| 45 engine_* + agent_session_* migrations | ✅ | 🟡 | See DATA-MODEL.md for full audit |

> Full honest delta: [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Status matrix across all domains: [../_DASHBOARD.md](../_DASHBOARD.md).

## Reading order

| # | Doc | mirror | Purpose |
|---|---|---|---|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why + cascade placement |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | verified | L1–L5 code map |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | verified | Tables, migrations, RPCs, telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | n/a | Upstream link index (harness has no direct UX) |
| 5 | [ROADMAP.md](./ROADMAP.md) | aspirational | Forward plan + 16 ADR milestones |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Built-vs-planned delta |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | verified | Test coverage map |

## Agent Guardrails

> Read before touching any harness code. These rules are load-bearing — violations are architecture errors.

- **NEVER claim agent-harness owns persona behavior.** ADR-0206 v2 scope split is binding: harness = plumbing (router/gate/classifier/engine/adapters). Soul, missions, orb overlay = botsson domain. The seam is the BFF→stage-engine HTTP call.
- **NEVER derive `profile_id`/`workspace_id` from request body.** ADR-0151: always server-derived via `deriveProfileId()` (`services/stage-engine/src/core/derive-profile-id.ts:22`). Silent fallback to JWT-default workspace = forgeable ID bug. Fail-fast with `ActorDerivationError`.
- **NEVER bypass `gatedMutation` on any capability tool mutation.** ADR-0204: every DB mutation routes through `gatedMutation()` in `packages/ai/src/gate/gatedMutation.ts`. Authority gate (ADR-0099) runs FIRST, then cascade gate (ADR-0091), then domain write. 38 current call-sites in capabilities.
- **NEVER register a capability without updating the intent classifier enum.** ADR-0112 coverage invariant: `invariants:intent-coverage` CI check verifies every registered capability appears in `intentSchema.capability`. A delegation-only capability still needs its enum entry.
- **NEVER add LLM-consuming code outside `packages/ai/src/adapters/`.** ADR-0327: unified consumer. Two adapters: vercel-ai (chat) + livekit (voice). Mobile BFF traffic routes to web BFF, never direct to adapters. ADR-0132.
- **NEVER write capability tool docstrings claiming ADR compliance before the body satisfies it.** L-0176: write body first, verify with Tool Compliance Self-Check, then docstring.
- **NEVER build new eval cases outside `packages/ai/src/__evals__/`.** ADR-0073: eval harness is the regression gate. Golden transcripts live in `__evals__/golden-transcripts/`.
- **NEVER add engine_* table writes outside `engine-dispatch/`.** CLAUDE.md: `supabase/functions/engine-dispatch/index.ts` is the sole dispatch core. Stage-engine calls the EF; it does not write engine tables directly.
- **NEVER mix botsson persona content into agent-harness spine.** Mission framework (`packages/ai/src/missions/`) belongs to botsson domain (already absorbed). Re-claiming it here = dual ownership.
- Owning packages: `services/stage-engine/src/` · `packages/agent-sdk/src/` · `packages/ai/src/{router,gate,classifiers,scheduler,engine,harness,adapters,agents,tools,journey-ops,prompts,__evals__,primitives,context,embedding.ts,session-context.ts,index.ts,types.ts}` · Edge Functions: `supabase/functions/engine-dispatch/` · Tables: `engine_*` (10+ tables) + `agent_session_*` (3 tables) + `agent_profile` (1 table)
