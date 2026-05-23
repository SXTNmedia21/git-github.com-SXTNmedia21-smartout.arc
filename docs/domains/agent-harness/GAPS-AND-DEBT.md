---
title: "Agent Harness — Gaps and Debt"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: agent-harness
mirror: verified
last_verified: 2026-05-23
tags: [domain, agent-harness, gaps, debt, deviations, overlap, specialist-layer]
---

# Agent Harness — Gaps and Debt

> Honest delta between spec/ADR intent and code reality. **Code wins** — every finding is code-verified.

## Deviations (spec says X, code does Y)

### DEV-1: ADR-0329 soul compilation — proposed, not accepted
**ADR claim:** Botsson soul should be server-compiled (ADR-0329 proposed 2026-05-15).
**Code reality:** `packages/ai/src/prompts/mr-botsson.ts` and `posture.ts` exist, but soul-on-platform-admin sortie not shipped. ADR-0329 status = proposed (not accepted).
**Impact:** Soul still partly frontend-asserted in some paths.
**Action:** Dedicated sortie for ADR-0329 acceptance + platform-admin integration.

### DEV-2: `engine_state.context.mission_id` — write exists, no stage-engine consumer
**ADR claim / system-map claim:** `journey.run_guided` packs `mission_id` into `engine_state.context` JSONB.
**Code reality (from botsson GAPS-AND-DEBT confirmed 2026-05-23):** `services/stage-engine/src/` reads `engine_sessions`, not `engine_state`. The write path exists but there is no consumer. B1 ontology decision in campaign.
**Impact:** mission_id context is a dead write. No routing based on it currently.
**Action:** Tracked in botsson campaign as ontology decision B1.

### DEV-3: gatedMutation feature-flag scaffolding still present
**ADR claim:** ADR-0204 gatedMutation is the single path for all capability mutations.
**Code reality:** `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED` env flag present; when OFF, falls back to legacy path. SS-3 scaffold notes in `gatedMutation.ts` note "until SS-4/SS-5".
**Impact:** Partial dual-path risk until flag removed after SS-4/SS-5.
**Action:** SS-4/SS-5 sorties complete graduation; remove flag + scaffold comments.

### DEV-4: Schedule voice tools — 3 mutations bypass gatedMutation (G4 from botsson GAPS)
**ADR claim:** ADR-0204 — every capability tool mutation flows through gatedMutation.
**Code reality:** 3 voice-added schedule mutations bypass gatedMutation orchestrator. ADR-0204 cascade integrity invariant #8 violated.
**Impact:** Those 3 tool calls have no authority evaluation or correlation chain.
**Action:** Voice schedule tool audit sortie. Apply gatedMutation to all 3 sites.

### DEV-5: ADR-0073 eval harness — golden transcripts only, no per-capability regression matrix
**ADR claim:** Eval harness is the regression gate for `packages/ai`.
**Code reality:** `packages/ai/src/__evals__/golden-transcripts/` exists with 2 files. No per-capability regression transcripts for payroll/scheduling/contracts/day-session.
**Impact:** Regressions in individual capability routing may be undetected.
**Action:** Each capability domain should contribute golden transcripts to `__evals__/`.

## Gaps (not built)

### GAP-1: E2E for session recorder round-trip
Session recorder (`agent_session_recording`) has unit tests (`core/session-recorder.test.ts`) and integration mock (`agent-router-recording.test.ts`). No Playwright E2E that proves a full conversation is stored and queryable.

### GAP-2: voice-agent harness boundary ADR missing
`services/voice-agent/` (LiveKit realtime audio) is a sibling service to stage-engine. No formal ADR defines the harness↔voice-agent API contract. Harness controls `adapters/livekit.ts` (tool dispatch adapter), but the audio transport layer is voice-agent's.

### GAP-3: circuit breaker deferred
Harness hardening spec 2026-04-23 included a capability circuit breaker (fail-open per capability, degrade gracefully). This was deferred pending `feat/contract-hub-fix-forward` merge. Still not built.

### GAP-4: engine_event.processed_at column missing
`workers/sixten-orchestrator.ts` comment: "engine_event has no processed_at column (Gap B5 note). Idempotency enforced via idempotency_key uniqueness." Architectural gap — no timestamp of when an event was consumed by the dispatch worker.

### GAP-5: ADR-0199 I8 — Edge Function dual-auth not CI-enforced
`docs/architecture/INVARIANTS.md:I8` — "Every Edge Function has dual-auth or explicit `verify_jwt=false` + signature verification" — status 🔴 (prose-only, no CI signal). `engine-dispatch` has `verifyInternalAuth()` but the invariant is not checked by CI.

### GAP-6: ADR-0199 I9 — activity_trail emit partial
`docs/architecture/INVARIANTS.md:I9` — "Every mutation emits to `activity_trail`" — status 🟡 (partial via auto-emit). Harness-layer mutations do not all include explicit `activity_trail` routing.

## Specialist layer gaps

### GAP-7: schedule specialist has no dedicated BFF route in `apps/web`
**Evidence:** `grep -rn "runScheduleAgent" apps/web/ --include="*.ts"` returns 0 hits. `packages/ai/src/agents/schedule.ts:130` defines `runScheduleAgent()` but only the function definition exists. The agent is designed for service invocation via `ScheduleAgentContext` (jwt or apiKey to shift-mcp).
**Impact:** The schedule specialist is not surfaced as a chat UI endpoint in the dashboard. Scheduling AI is routed through stage-engine → `schedule` capability instead.
**Action:** If a standalone schedule-agent wizard UI is planned, add `apps/web/src/app/api/schedule-agent/route.ts` + register `runScheduleAgent` call. Until then, stage-engine handles scheduling AI via the capability pipeline.

### GAP-8: docs specialist is on landing app, not dashboard — edge-domain ownership ambiguous
**Evidence:** `apps/landing/src/app/api/docs-agent/route.ts:4` imports `runDocsAgent`. No dashboard equivalent. The "docs" specialist answers questions about Smartout documentation (user manual). It is NOT workspace-scoped.
**Impact:** `docs.ts` has no edge-domain mapping to an existing domain folder. The landing app has no dedicated `docs/domains/` entry.
**Action:** Register docs specialist as "landing-app infra" in this file. Do NOT create a docs domain unless/until a dedicated product docs area is defined.

### GAP-9: botsson specialist `runBotssonAgent()` — no direct call-site outside tests/definition
**Evidence:** `grep -rn "runBotssonAgent" /apps /services --include="*.ts"` = 0 call-sites outside `packages/ai/`. The `apps/web/src/app/api/botsson/chat/route.ts` proxies to stage-engine, which runs the intent classifier → capability pipeline (NOT `runBotssonAgent`). `runBotssonAgent` exists as a standalone runner but is not currently wired into any production path.
**Impact:** `botsson.ts` is potentially orphaned as a standalone runner — the actual Botsson chat flow goes through stage-engine. The botsson specialist may be the "future direct mode" or a testing harness.
**Action:** Clarify in botsson domain whether `runBotssonAgent` is (a) a fallback / test harness, (b) a planned "dev shortcut mode", or (c) dead code. Document in botsson GAPS until decided.

## Overlap edges (cross-domain)

| Edge | Recommendation | Status |
|---|---|---|
| **botsson ↔ agent-harness** (ADR-0206 scope split seam) | Soul compilation: harness compiles (`prompts/`), botsson defines. Agent registry (`agents/botsson.ts`): harness registers, botsson configures. Boundary is the BFF HTTP call. | active seam, documented |
| **All 14 capability domains ↔ agent-harness** | Each capability's `execute()` callback enters gatedMutation in gate/. Harness routes to them; never owns their business logic. | resolved (keep — 14 consumer seams) |
| **journey-protocol ↔ agent-harness** | Schema (journey tables) = journey-protocol. Runtime ops (`packages/ai/src/journey-ops/`) = agent-harness. `engine_process↔journey` FK bridge (`20260308194427`). | resolved (keep) |
| **notifications ↔ agent-harness** | `engine_event` rows trigger notification dispatch via `engine-dispatch` `send_notification` handler. Harness fans out to notification_outbox; notifications domain owns dispatch pipeline. | resolved (keep) |
| **voice-agent service ↔ agent-harness** | harness owns `adapters/livekit.ts` (tool dispatch); voice-agent owns LiveKit realtime audio transport. Sibling services. ADR boundary not formalized yet (GAP-2). | open |
| **lovsen-mcp (future) ↔ agent-harness** | Harness will call lovsen via MCP for legal capability. Protocol boundary not yet built. | open (deferred) |
| **reports ↔ agent-harness** | `packages/ai/src/agents/reports.ts` + `packages/ai/src/tools/report/` (5 tools) owned by harness. Reports domain links via README Agent Guardrails. BFF route `/api/reports-agent` is in reports domain's code path but the AI runner is harness-owned. | resolved (CONSOLIDATE-toward-harness — reports links only, per _DASHBOARD.md:132) |
| **contracts ↔ agent-harness** | `packages/ai/src/agents/contract.ts` + `packages/ai/src/tools/contract/` (19 tools) owned by harness. Contracts domain uses the specialist for template editing. BFF route is platform-admin only (godmode). | resolved (keep boundary — contracts domain invokes, harness owns runner + tools) |
| **procedure-engine / journey-protocol ↔ agent-harness** | `agents/journey.ts` (6-phase wizard) + `agents/journey-ops.ts` (post-definition ops) both owned by harness. Procedure-engine domain owns the `journey` table schema; harness owns the AI runners + `tools/journey/` + `tools/journey-ops/`. | resolved (keep — schema vs AI-runner split is the seam) |
| **onboarding-wizard ↔ agent-harness** | `packages/ai/src/agents/onboarding.ts` + `packages/ai/src/tools/onboarding.ts` owned by harness. Onboarding-wizard domain owns the wizard UI + session management. BFF route at `/api/onboarding-agent` belongs to onboarding-wizard domain. | resolved (keep — onboarding-wizard invokes, harness owns runner + tools) |
| **scheduling ↔ agent-harness** | `packages/ai/src/agents/schedule.ts` owned by harness. No dedicated BFF route exists in `apps/web` (GAP-7). Scheduling domain owns `services/shift-mcp/` tool backend. | open (GAP-7 — no BFF route yet) |

## Debt

### D1 — L-0176 docstring drift lives in harness gate
**Source:** L-0176 (2026-04-29). "Never write capability tool docstrings claiming ADR compliance before the body satisfies it." Root site: `tools.ts:282` claimed ADR-0204 while body had 3 direct writes outside gatedMutation. Pattern recurs wherever new capability tools are added.
**Mitigation:** Tool Compliance Self-Check mandated in CLAUDE.md. `smartout-agent-dev` skill enforces.

### D2 — L-0177 silent fallback pattern lives in harness derivation
**Source:** L-0177 (2026-04-29). "`if (row?.workspace_id)` with no else-branch = forgeable ID bug." `deriveProfileId` already throws `ActorDerivationError`; risk is in new capability tools that don't call `deriveProfileId` and instead read workspace_id from a body-supplied row without fail-fast guard.
**Mitigation:** `invariants:server-actor` CI check; code-review gate.

### D3 — Intent classifier enum lag (recurring blocker, ADR-0112)
**Source:** L from closure sessions (4+ occurrences as of 2026-05-17). Registering a capability without same-commit intent-classifier enum entry + system-prompt update → blocks close-feature.sh push.
**Mitigation:** `invariants:intent-coverage` CI check catches it. Pattern: every new capability PR must include the 2-line enum + prose update as part of Definition of Done.
