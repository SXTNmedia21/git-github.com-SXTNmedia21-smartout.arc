---
title: "Agent Harness — E2E Coverage"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: agent-harness
mirror: verified
last_verified: 2026-05-23
tags: [domain, agent-harness, e2e, tests, coverage, eval-harness]
---

# Agent Harness — E2E Coverage

> Test = proof of built. Verified vs `apps/e2e/` + `services/stage-engine/src/__tests__/` + `packages/ai/src/__evals__/`. **Code wins.**

## Playwright E2E (harness pipeline exercises)

| Spec | Path | What it exercises |
|---|---|---|
| `contract-harness-e2e.spec.ts` | `apps/e2e/tests/` | Contract intake engine_process pipeline |
| `billing-query-harness-e2e.spec.ts` | `apps/e2e/tests/` | billing-query capability intent routing |
| `mission-harness-e2e.spec.ts` | `apps/e2e/tests/` | Mission dispatch + session recording |
| `engine-world-harness-e2e.spec.ts` | `apps/e2e/tests/` | engine_world observer pipeline |
| `governance-harness-e2e.spec.ts` | `apps/e2e/tests/` | Governance capability routing |
| `kb-query-harness-e2e.spec.ts` | `apps/e2e/tests/` | Knowledge-base query routing |
| `contract-intake-harness-e2e.spec.ts` | `apps/e2e/tests/` | Contract intake capability |
| `payroll-harness-e2e.spec.ts` | `apps/e2e/tests/` | Payroll capability routing |
| `operations-intelligence-harness-e2e.spec.ts` | `apps/e2e/tests/` | Operations intelligence routing |
| `onboarding-harness-e2e.spec.ts` | `apps/e2e/tests/` | Onboarding harness pipeline |
| `shift-swap-harness-e2e.spec.ts` | `apps/e2e/tests/` | Shift-swap tool routing |
| `agent-rapporterer-tilstand.spec.ts` | `apps/e2e/engine-world/` | Agent state reporting to engine_world |
| `agent-leser-status.spec.ts` | `apps/e2e/engine-world/` | Agent status read from engine_world |

## Stage-engine unit + integration tests (22 files)

| Test | What it exercises |
|---|---|
| `agent-chat-forged-profile.test.ts` | ADR-0151: profile_id cannot be forged from body |
| `chat.workspace-derivation.test.ts` | Workspace derivation from JWT |
| `agent-router-classifier-context.test.ts` | Classifier context propagation |
| `agent-router-classifier-context-propagation.test.ts` | Extended classifier context |
| `agent-router-recording.test.ts` | Session recorder integration |
| `admin-router.test.ts` | Admin routing |
| `telegram-webhook.test.ts` | Telegram bridge |
| `telegram-bridge.test.ts` | Telegram relay |
| `telegram-client.test.ts` | Telegram client |
| `core/session-recorder.test.ts` | Ring buffer write/read |
| `routes/agent/__tests__/chat-harness-pipeline.test.ts` | Full chat pipeline: classifier → gate → tool; ADR-0151 profile derivation at line 420 |
| `core/derive-profile-id.test.ts` | `deriveProfileId` fail-fast on row-not-found; `ActorDerivationError` throws |
| `core/recorder-metrics.test.ts` | Recorder metrics endpoint |

## packages/ai eval harness (ADR-0073)

| File | What it exercises |
|---|---|
| `__evals__/golden-transcripts/` | Golden transcript fixtures |
| `__evals__/golden-transcripts.eval.ts` | Eval runner against golden fixtures |

**Gap:** No per-capability regression transcripts (payroll, scheduling, contracts, day-session). See GAPS-AND-DEBT.md §DEV-5.

## packages/ai unit tests (83 test files in packages/ai/src)

These cover individual capability tools, gate paths, classifier edge cases. Key harness-focused files:

| File (search path) | What |
|---|---|
| `gate/__tests__/` | gatedMutation unit tests |
| `router/__tests__/` | intent classifier + tool selector |
| `classifiers/__tests__/` | PII classifier coverage |
| `engine/__tests__/` | authority pipeline + condition evaluator |
| `harness/__tests__/` | HarnessAdapter factory + sources |
| `context/__tests__/` | Context collector + memory writer |

## Gaps

| Gap | Impact |
|---|---|
| No Playwright E2E for session recorder round-trip | ADR-0184 session recording unproven end-to-end in browser context |
| No eval transcripts per capability cluster | Classifier regression risk for payroll/scheduling/contract turns |
| No E2E for ADR-0199 I8 edge-function dual-auth | `engine-dispatch` internal auth not integration-tested |
| No E2E for sixten orchestrator health checks | `workers/sixten-orchestrator.ts` health check execution unverified in CI |
| Voice agent harness pipeline E2E missing | LiveKit adapter + voice tool dispatch exercised only in manual testing |
