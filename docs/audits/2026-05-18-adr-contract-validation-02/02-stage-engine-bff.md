---
title: "Audit Slice 02 — Stage Engine + BFF"
status: complete
updated: 2026-05-18
created: 2026-05-18
module: MODULE_BOTSSON
tags: [audit, stage-engine, bff, adr-0042, adr-0049, adr-0151, adr-0246, adr-0247, adr-0248, adr-0255, adr-0261, adr-0367]
---

# Slice 02: Stage Engine + BFF — ADR Contract Audit

**Date:** 2026-05-18
**Pipe:** L1 overlay → L2 BFF → L3 stage-engine → L4 capability/mission/agent → L5 persistence
**Files traced:**
- `services/stage-engine/src/routes/agent/chat.ts`
- `services/stage-engine/src/core/agent-router.ts`
- `services/stage-engine/src/core/derive-profile-id.ts`
- `apps/web/src/app/api/botsson/chat/route.ts`
- `apps/web/src/app/api/emma/chat/route.ts`
- `apps/web/src/app/api/emma/session/route.ts`
- `apps/web/src/app/api/botsson/sessions/route.ts` + `[id]/route.ts`
- `supabase/functions/engine-dispatch/index.ts` (idempotency block)
- `supabase/functions/engine-dispatch/handlers/day-line-push.ts`
- `packages/ai/src/router/intent-classifier.ts`

---

## ADR-0151 — profile_id server-side derivation

| Route | Verdict |
|-------|---------|
| `POST /agent/chat` (stage-engine) | PASS — `deriveProfileId()` called for chat; voice path parses from session_id convention + DB-verify + fail-closed 403 |
| `POST /api/botsson/chat` (BFF) | PASS — profile resolved via `admin.from("profile").eq("user_id",...).eq("workspace_id",...)`. Body `primeContext.profileId` (subject employee) server-verified before interpolation |
| `POST /api/emma/chat` (BFF) | PASS — profile resolved server-side. `profile_id` forwarded to stage-engine from server-resolved row, not from body |
| `GET /api/emma/session` | PASS — workspace_id via `getServerContext()` JWT-derived; no body-supplied identifier |
| `GET /api/botsson/sessions` + `[id]` | PASS — L-0177 fail-fast on missing workspace_id/profile_id; both derived from `getServerContext()` |

**G9 gap (emma/chat + botsson/chat profile_id forgery) — CLOSED.** Both routes now resolve profile server-side before forwarding to stage-engine. The `profile_id` field in stage-engine body comes from server-verified DB row, not raw client payload.

---

## ADR-0042 — causal ordering / engine_event / engine_state

- `engine_sessions` remains the stage-engine read surface (26 call sites confirmed not regressed). `engine_state` is never read from stage-engine routes — preserves three-table boundary per ADR-0216.
- `engine_event` INSERT in `engine-dispatch/index.ts:231` uses `idempotency_key ?? null`; SELECT-before-INSERT (lines 208–228) provides idempotency. Pattern: read-then-write is NOT atomic (no FOR UPDATE lock). Concurrent ticks could double-insert on a race window before UNIQUE violation is caught. Acceptable risk per ADR-0042 (small cron window) but not enforced transactionally.
- **Finding A (low):** Idempotency SELECT in `engine-dispatch/index.ts` (L208–228) is advisory; does not hold a row lock. Under concurrent dispatch ticks the UNIQUE index is the true guard (would raise 23505). Code handles neither path explicitly at call site — silent duplicate risk at burst.

---

## ADR-0049 — mission/journey contract

`packages/ai/src/missions/registry.ts` exists. Stage-engine reads `engine_sessions.mission_id` and `engine_sessions.mode`. The `engine_state.context.mission_id` write path (journey capability) has no stage-engine consumer (confirmed from SYSTEM-MAP §L5 🟡). This is a known open gap (G12) — not a regression introduced by audited code.

---

## ADR-0186 — guardian bus (pg_notify)

`emitGuardianEvent()` called at `chat.ts:468` (user turn) and `chat.ts:682` (agent response). Body is written to `guardian_log` which triggers pg_notify via AFTER INSERT trigger. Pipe verified: in-process Set is gone.

---

## ADR-0246/0247/0248 — router/orchestrator/dispatcher contracts

- `routeAgentMessage` in `agent-router.ts` calls `gate_action` RPC at line 455 per ADR-0099. Gate result written to `gate_evaluation` via RPC. `emit("botsson.turn_started")` + `emit("botsson.turn_completed")` fire from `chat.ts:477` and `694` with non-null `workspace_id` + `actor_id` — ADR-0134 satisfied.
- `fetchActiveStateSummary` fire-and-forget (swallows DB errors) — keeps chat path alive when mission state is unavailable. Correct per ADR-0246 progressive-enhancement rule.
- ADR-0248 canonical emit producer: `engine_step.reached`, `engine_run.completed`, `engine_run.failed` should come only from `engine-dispatch/handlers/`. Stage-engine does NOT emit these events — compliant.

---

## ADR-0255 — sixten dispatcher

`services/stage-engine/src/workers/sixten-orchestrator.ts` uses `sixten.pulse_processing_claimed` idempotency guard via engine_event INSERT before processing. Correct application of ADR-0248 pattern. Sixten emits `sixten.*` namespace only — does not emit `engine_*` or `journey.*` events directly. Compliant.

---

## ADR-0261 — intent classification

Intent classifier (`intent-classifier.ts:36`) `z.enum([...])` contains 37 capability names including `day-line` and `routine` (ADR-0367, BT0-FOUNDATION 2026-05-18). `cascade` present with docstring "DELEGATION-ONLY, classifier should never pick." `buildClassifierContext()` feeds role + department + channel — ADR-0112 context requirement satisfied (Phase A5 closed).

---

## ADR-0367 — day-line-push handler (active in-flight)

`handlers/day-line-push.ts` — full trace:

| Check | Result |
|-------|--------|
| Idempotency via engine_event UNIQUE(idempotency_key) | PASS — INSERT attempted first; 23505 = skip |
| emit() contract (workspace_id + actor_id non-null) | PASS — `actor_id="system:engine-dispatch"`, `workspace_id=task.workspace_id` |
| Workspace scope on all queries | PASS — all queries filter on workspace_id or entity FK |
| No gate_action (system actor, not user-initiated mutation) | ACCEPTABLE — system-cron actor pattern; no capability tool context |
| emit() AFTER push success, not before | PASS — emit at line 339 is after `sendExpoPush` ok check |

**Finding B (low):** Profile query at `day-line-push.ts:296` uses `profile_id = session.employee_id` without workspace scope. An `employee_id` UUID that exists in a different workspace would still be found. Low risk (shift_session_day_line is workspace-scoped upstream), but violates Law 1 (workspace scope on every query).

---

## G9 (open gap from BOTSSON-SYSTEM-MAP) — status update

**CLOSED.** Both `emma/chat` and `botsson/chat` BFF routes derive `profile_id` from server-resolved JWT + DB lookup before forwarding to stage-engine. Stage-engine chat.ts derives independently via `deriveProfileId()`. The regression noted as "carried from 2026-05-06" is not present in current code.

---

## Summary

| ADR | Verdict | Note |
|-----|---------|------|
| ADR-0151 | PASS | All 5 routes derive profile_id server-side |
| ADR-0042 | PASS with Finding A | Idempotency advisory-only; UNIQUE index is true guard |
| ADR-0049 | OPEN (known) | G12 mission/engine_state consumer gap — pre-existing |
| ADR-0186 | PASS | Guardian bus via pg_notify wired |
| ADR-0246/0247/0248 | PASS | gate_action + canonical emit producer pattern |
| ADR-0255 | PASS | Sixten emits only sixten.* namespace |
| ADR-0261 | PASS | 37 capability names including BT0 additions |
| ADR-0367 | PASS with Finding B | Profile query in day-line-push missing workspace scope |

**Two findings:**
- **Finding A** (low): `engine-dispatch/index.ts` idempotency check is advisory; no FOR UPDATE lock. True guard is DB UNIQUE index, not SELECT. Documented, not a blocking defect.
- **Finding B** (low): `handlers/day-line-push.ts:296` — profile lookup by `employee_id` without workspace filter. Add `.eq("workspace_id", task.workspace_id)` to harden.
