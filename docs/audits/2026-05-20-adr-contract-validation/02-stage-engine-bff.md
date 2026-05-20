---
title: Slice 02 — Stage Engine + BFF Audit
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, stage-engine, bff, adr-0042, adr-0049, adr-0186, adr-0246, adr-0247, adr-0248, adr-0255, adr-0261]
---

# Slice 02: Stage Engine + BFF — ADR Contract Audit

**Date:** 2026-05-20
**Baseline:** `docs/audits/2026-05-18-adr-contract-validation-02/02-stage-engine-bff.md`
**Files traced:**
- `services/stage-engine/src/routes/agent/chat.ts`
- `services/stage-engine/src/routes/agent/dispatch.ts`
- `services/stage-engine/src/routes/agent/queue.ts`
- `services/stage-engine/src/core/agent-router.ts`
- `services/stage-engine/src/core/mission-summary.ts`
- `services/stage-engine/src/workers/mission-pool-slot.ts`
- `services/stage-engine/src/workers/sixten-orchestrator.ts`
- `apps/web/src/app/api/botsson/chat/route.ts`
- `apps/web/src/app/api/emma/chat/route.ts`
- `apps/web/src/app/api/botsson/sessions/route.ts` + `[id]/route.ts`
- `supabase/functions/engine-dispatch/handlers/day-line-push.ts`
- `packages/ai/src/capabilities/tips/tools.ts`
- `packages/telemetry/src/registry.ts` (journey event section)

---

## Summary

Top 5 findings ranked by severity:

1. **HIGH SE-01** — `mission-pool-slot.ts` emits `journey run_started / step_reached / run_failed / completed` directly (4 call sites). ADR-0248 (status: proposed) names B5 handlers in `supabase/functions/engine-dispatch/handlers/` as the canonical producer and explicitly forbids mission-pool worker from emitting `journey.*` directly. B5 handlers have no matching emit — one-owner ambiguity remains.
2. **MEDIUM SE-02** — `services/stage-engine/src/routes/agent/dispatch.ts` (Sixten wake endpoint) has zero `emit()` calls. Sixten persona dispatch leaves no `activity_trail` or `engine_event` row on success or failure — telemetry blind spot for all production Sixten invocations. ADR-0255 Phase 0 cited `log-activity.sh` (host-side) as mitigation, but that runs only when invoked from `dispatcher.sh`; the `/agent/dispatch` HTTP endpoint path has no host-side fallback.
3. **MEDIUM SE-03** — `services/stage-engine/src/core/mission-summary.ts:62` reads `engine_state` directly from the agent-chat hot path. ADR-0246 (proposed) specifies stage-engine reads `engine_sessions`, not `engine_state`, until Phase A4a cutover. This read precedes Phase A4a — it is a soft boundary-bleed that weakens the "one reader surface" contract. The query IS workspace-scoped (`.eq("workspace_id", workspaceId)`) so no data-leak risk — observability/contract risk only.
4. **LOW SE-04** — Baseline Finding B (day-line-push profile lookup without workspace scope) is **CLOSED**: `handlers/day-line-push.ts:301-303` now includes `.eq("workspace_id", task.workspace_id)`.
5. **INFO SE-05** — ADR-0248 and ADR-0246 remain status `proposed`. Per ADR-0246, Phase A4b emit is gated on ADR-0248 `accepted`. The proposed status means no formal code-review gate enforces the single-producer rule — drift will accumulate silently until promoted.

---

## Findings table

| ID | Severity | File:line | ADR | Evidence |
|----|----------|-----------|-----|---------|
| SE-01 | HIGH | `services/stage-engine/src/workers/mission-pool-slot.ts:400,438,462,515` | ADR-0248 | mission-pool-slot emits `journey run_started / run_failed / step_reached / completed` directly; B5 handlers in engine-dispatch emit NONE — violates single-producer rule |
| SE-02 | MEDIUM | `services/stage-engine/src/routes/agent/dispatch.ts:192-262` | ADR-0134 | Sixten dispatch endpoint emits zero telemetry; persona invocations leave no activity_trail or engine_event row on success or failure |
| SE-03 | MEDIUM | `services/stage-engine/src/core/mission-summary.ts:62` | ADR-0246 | stage-engine reads `engine_state` directly in the agent-chat hot path before Phase A4a cutover; ADR-0246 reserves `engine_state` reads for workers/ADR-0248 Phase A4a |
| SE-04 | CLOSED | `supabase/functions/engine-dispatch/handlers/day-line-push.ts:301` | Law 1 | Baseline Finding B fixed: profile lookup now includes `.eq("workspace_id", task.workspace_id)` |
| SE-05 | INFO | `docs/decisions/0246*.md`, `0248*.md` | ADR-0246/0248 | Both ADRs status=proposed; no code-review enforcement of single-producer rule; SE-01 will not be caught by gate |

---

## Per-ADR rollup

| ADR | Files checked | Verdict | Notes |
|-----|---------------|---------|-------|
| ADR-0042 (agent architecture) | `agent-session.ts`, `chat.ts` | ✅ compliant | `mode="agent"` set on create; `engine_sessions` write correct |
| ADR-0049 (mission/journey contract) | `mission-summary.ts`, `mission-pool-slot.ts` | ⚠️ partial | G12 known (registry/DB drift); not introduced here |
| ADR-0151 (profile_id server-derivation) | all BFF + chat.ts | ✅ compliant | G9 confirmed closed: both BFFs resolve profile server-side; stage-engine strips body.profile_id via schema; voice path parses session_id + DB-verifies |
| ADR-0186 (guardian bus) | `chat.ts:468,682` | ✅ compliant | `emitGuardianEvent()` on user turn and agent response; pg_notify path active |
| ADR-0246 (engine-sessions ontology) | `agent-router.ts`, `mission-summary.ts`, `session-manager.ts` | ⚠️ partial | `mission-summary.ts:62` reads `engine_state` before Phase A4a cutover; all other agent-router paths read `engine_sessions` only |
| ADR-0247 (schema relaxation) | `mission-pool-slot.ts:350` | ✅ compliant | workspace_id null-check + fail-closed (`markFailed`) before nonEmpty() — no silent fallback |
| ADR-0248 (B5 canonical emit producer) | `mission-pool-slot.ts`, `engine-dispatch/handlers/` | 🔴 violation | mission-pool-slot emits `journey.*` at 4 sites; B5 handlers have 0 `journey.*` emit calls; ADR-0248 proposed (no enforcement gate) |
| ADR-0255 (Sixten dispatch) | `dispatch.ts`, `sixten-orchestrator.ts` | ⚠️ partial | `dispatch.ts` has no telemetry; orchestrator emits only `sixten.*` namespace (compliant); dispatch endpoint telemetry blind spot |
| ADR-0261 (BFF as mutation host) | `tips/tools.ts` | ✅ compliant | All 4 tips tools return `{ok:false, error:"not_implemented"}` with zero emit() and zero DB writes |
| ADR-0134 (telemetry contract) | `chat.ts`, `dispatch.ts`, `mission-pool-slot.ts` | ⚠️ partial | `chat.ts` emits `botsson.turn_started` + `turn_completed` with non-null ids; `dispatch.ts` zero emits; `mission-pool-slot.ts` SE-01 |

---

## Verified intentional

**G9 (emma/chat + botsson/chat profile_id forgery) — CONFIRMED CLOSED.**
`apps/web/src/app/api/botsson/chat/route.ts:181-196` resolves profile via `admin.from("profile").eq("user_id",...).eq("workspace_id",...)`. BFF forwards `profile_id: profile.profile_id` in body, but `services/stage-engine/src/routes/agent/chat.ts` chatSchema has no top-level `profile_id` field — body value is stripped by Zod validator. Stage-engine derives independently via `deriveProfileId()` (chat path) or session_id parse + DB verify (voice path). Both paths fail-closed on missing/invalid profile. G9 is closed, not a finding.

**Baseline Finding B (day-line-push profile scope) — CLOSED.**
`handlers/day-line-push.ts:301-303` now includes `.eq("workspace_id", task.workspace_id)`. Comment at line 297 explicitly references Law 1. Do not re-flag.

**mission-summary.ts reads engine_state — NOT a phantom violation of ADR-0042.**
ADR-0042 says stage-engine chat sessions write `engine_sessions`, not `engine_state`. It does not prohibit stage-engine reads of `engine_state`. The read in `mission-summary.ts:62` predates ADR-0246 Phase A4a and is correctly scoped. Flagged as SE-03 (MEDIUM) because it bleeds past the ADR-0246 proposed boundary, but it is not an ADR-0042 violation.

**B5 handlers not emitting journey.* — NOT a standalone finding.**
The engine-dispatch handlers (`day-line-push.ts`, `period-locked-notifier.ts`, etc.) are domain-specific handlers, not the Phase A4b journey lifecycle handlers. ADR-0248 Phase A4b is gated on ADR-0246 Phase A4b which is itself blocked. The handlers' non-emission is intentional per the gate — no phantom-emit here. The violation (SE-01) is the mission-pool-slot emitting journey.* directly in the interim.

---

## In-progress (mid-campaign)

No surface files identified as belonging to active campaign worktrees (ui-shell, payroll, mobile, bubble-migration, botsson-arena, daily-operation, world-best-wfm) were observed in the traced paths. All findings above are against `development` tip.

**Note on ADR-0248/0246 proposed status:** Both ADRs are marked `proposed`. Campaign `campaign/botsson-arena` owns B5 handler implementation per ADR-0248 §Open Items. SE-01 is a real violation of the proposed contract — but because the ADR is not `accepted`, it cannot trigger a formal PR block. Recommend promoting both ADRs to `accepted` to activate enforcement gate, or adding a `grep -c "journey\." mission-pool-slot.ts` check to `close-feature.sh` interim guard.
