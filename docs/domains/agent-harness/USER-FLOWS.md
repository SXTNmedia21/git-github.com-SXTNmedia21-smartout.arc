---
title: "Agent Harness — User Flows"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: agent-harness
mirror: verified
last_verified: 2026-05-23
tags: [domain, agent-harness, user-flows, plumbing, upstream-links]
---

# Agent Harness — User Flows

> Agent Harness is **infrastructure plumbing**. It has no user-facing flows of its own. All user flows that EXERCISE the harness are owned by upstream domains (botsson, capability domains). This file is a link index to those flows.

## Why no direct user flows

The harness is invisible to users. What users see is Botsson's persona (orb, chat panel, voice call), capability tools in action (payroll result, schedule query, contract signing). The harness is the rail they run on — the classifier that routes their message, the gate that evaluates their authority, the engine that advances their workflow.

## Upstream flows that exercise the harness

| Domain | Journey file | Harness components exercised |
|---|---|---|
| botsson | `docs/journeys/JOURNEY-botsson-*.md` (see botsson domain) | L2 stage-engine chat route, intent classifier, session recorder, memory manager |
| payroll | `docs/journeys/JOURNEY-payroll-*.md` | gatedMutation (38 call-sites), authority gate, cascade gate |
| scheduling | `docs/journeys/JOURNEY-scheduling-*.md` | intent routing, tool-selector, session lane |
| contracts | `docs/journeys/JOURNEY-contracts-*.md` | engine_process (contract-intake blueprint), engine-dispatch |
| billing | `docs/journeys/JOURNEY-billing-*.md` | engine_process (billing fase 2, dunning blueprints), engine-dispatch |
| onboarding | `docs/journeys/JOURNEY-onboarding-wizard.md` | agent-sdk useAgent + VoiceProvider, stage-engine sessions route |
| day-session | `docs/journeys/JOURNEY-day-session-*.md` | engine-dispatch (session hooks, task assignment) |
| training | `docs/journeys/JOURNEY-training-*.md` | engine_process (employee activation blueprint) |
| year-wheel | `docs/journeys/JOURNEY-year-wheel-*.md` | engine-dispatch (season activation process) |
| procedure-engine | `docs/journeys/JOURNEY-procedure-engine-*.md` | engine_process (protocol assignment workflow) |
| announcements | `docs/journeys/JOURNEY-announcements-*.md` | engine_dispatch (notification routing) |

## Harness-internal observable behaviors (operational, not user-visible)

These are visible to admins/operators, not end-users:

| Behavior | Trigger | Observable evidence |
|---|---|---|
| Session transcript | Any agent conversation | `agent_session_recording` rows + recorder-metrics endpoint |
| Intent routing | User message received | stage-engine logs + `agent.schedule.*` telemetry events |
| Authority gate evaluation | Any capability mutation | `gate_evaluation` rows + correlation chain (ADR-0204) |
| Engine motor advancement | Domain workflow trigger | `engine_state.current_step` increment + `engine_state_step` rows |
| Memory write | Session end + significant context | `engine_memory` rows + `agent.memory.*` telemetry events |
| Sixten health checks | Sixten pulse (5 min cadence) | `engine_event` rows with type `sixten.check_result` |

## E2E specs that exercise harness paths

See [E2E-COVERAGE.md](./E2E-COVERAGE.md) for full list. Representative:

- `apps/e2e/tests/contract-harness-e2e.spec.ts` — contract intake engine_process
- `apps/e2e/tests/billing-query-harness-e2e.spec.ts` — billing-query capability routing
- `apps/e2e/tests/mission-harness-e2e.spec.ts` — mission dispatch + session recording
- `apps/e2e/tests/engine-world-harness-e2e.spec.ts` — engine_world observer
- `apps/e2e/engine-world/agent-rapporterer-tilstand.spec.ts` — agent state reporting
- `apps/e2e/engine-world/agent-leser-status.spec.ts` — agent status read
