---
title: "ADR Contract Audit — Slice 02: Stage Engine + BFF"
status: done
created: 2026-05-15
updated: 2026-05-15
module: botsson-harness
tags: [audit, stage-engine, bff, adr]
---

# Slice 02 — Stage Engine + BFF

**Date:** 2026-05-15
**Scope:** `services/stage-engine/`, `apps/web/src/app/api/`, `packages/ai/src/router/`, `supabase/functions/engine-dispatch/`
**ADRs in scope:** 0042, 0049, 0186, 0246, 0247, 0248, 0255, 0261, 0289, 0296

---

## Summary

9 findings (2 HIGH, 4 MEDIUM, 3 LOW/INFO). SE-02-01 from the 2026-05-13 baseline is **CLOSED** — primeContext.profileId is now server-verified before injection. F-OB-04 (/api/emma/session orphan) remains open. Three proposed ADRs (0246/0247/0248) remain in `proposed` status with zero implementation in engine-dispatch — the ADR-0248 B5 lifecycle emit gate is cleanly unshipped.

---

## Findings Table

| ID | File:Line | ADR | Severity | Description |
|----|-----------|-----|----------|-------------|
| SE02-01 | `apps/web/src/app/api/botsson/chat/route.ts:203-234` | 0151 | ~~HIGH~~ CLOSED | primeContext.profileId now server-verified before LLM injection |
| SE02-02 | `apps/web/src/app/api/emma/memory/route.ts:74` | 0151 | MEDIUM | `workspace_id` written from body directly; getProfileId verifies membership but insert uses `body.workspace_id` without the server-resolved canonical value |
| SE02-03 | `apps/web/src/app/api/emma/memory/route.ts` | 0099/0134 | HIGH | No `gate_action` call before insert into `engine_memory`; no `emit()` after write — mutation lacks both authority gate and telemetry |
| SE02-04 | `supabase/functions/engine-dispatch/index.ts` | 0248 | MEDIUM | B5 lifecycle events (`engine_step.reached`, `engine_run.completed`, `engine_run.failed`) not emitted anywhere in engine-dispatch despite being registered in telemetry registry — phantom registry entries; ADR-0248 explicitly gates A4b on B5 handler ship |
| SE02-05 | `docs/decisions/0246-*.md`, `0247-*.md`, `0248-*.md` | 0246/0247/0248 | LOW | All three ADRs remain `status: proposed`. Code gap is expected (A0–A4 not yet implemented) but the ADR status should reflect this. No phantom-body risk — engine_sessions still the write surface |
| SE02-06 | `apps/web/src/app/api/emma/session/route.ts` | — | MEDIUM | Route has zero production consumers (only `__tests__` and Next.js type files reference it). F-OB-04 confirmed open. No data risk — read-only GET — but dead surface. |
| SE02-07 | `docs/decisions/0289-*.md` | 0289 | LOW | ADR-0289 R1.3 closure (registry-driven voice tool dispatch) not yet implemented. `services/voice-agent/src/` still uses hardcoded parallel tool arrays. Expected per ADR — tactical duplication acknowledged — but cap is growing: no new tools may be added to parallel list after Fase 4 `propose_*` tools |
| SE02-08 | `supabase/migrations/20260529000000_chat_list_engine_sessions_archive_drop_emma.sql` | 0296 | LOW | DROP migration for `emma_conversation`/`emma_transcript` exists but timestamp is 2026-05-29 (future). Tables still live in DB on dev HEAD. `emma/history` route deleted; no dead-flush callers remain in BFF. Migration is correctly queued — not a gap, informational |
| SE02-09 | `services/stage-engine/src/routes/agent/chat.ts:454-458` | 0042 | LOW | Voice path bypasses `SessionLane` serializer by design (2026-05-15 fix: parallel tool calls). Correct intent is documented inline. No correctness gap — voice doesn't replay from `collected_data`. Worth flagging because the bypass is invisible to the session-recorder (D1) which reads `engine_sessions.collected_data` |

---

## Per-ADR Rollup

| ADR | Status | Verdict |
|-----|--------|---------|
| ADR-0042 Agent Architecture | accepted | PASS with NOTE: SE02-09 (voice lane bypass documented) |
| ADR-0049 Agent SDK Package | accepted | PASS — SDK pattern intact; no direct `ultravox-client` imports in scope |
| ADR-0186 Guardian Bus pg_notify | accepted | PASS — `startPgNotifyBus` mounted in `index.ts:193`; `stopPgNotifyBus` in graceful shutdown; `pg-notify-bus.ts` present; `guardian-bus.ts` is facade |
| ADR-0246 engine_state implementation spec | proposed | NOT YET IMPLEMENTED — all 5 phases (A0–A4) pending. No phantom-body risk. Stage-engine still writes `engine_sessions`. ADR status should move to `accepted` when A0 lands |
| ADR-0247 engine_state nullability | proposed | NOT YET IMPLEMENTED — column relaxation DDL pending. No migration found. Expected |
| ADR-0248 B5 lifecycle emit producer | proposed | NOT YET IMPLEMENTED — `engine_step.reached/engine_run.completed/engine_run.failed` absent from engine-dispatch code. Registry entries exist as forward declaration. ADR-0246 A4b correctly gated on this |
| ADR-0255 Sixten stage-engine integration | proposed | Phase 0 (`POST /agent/dispatch`, `agentDispatch` route) present in stage-engine. Phase 0.5 file-backed queue and dispatcher.sh not audited (out of scope). No blocking gap |
| ADR-0261 BFF as mutation host | accepted | PASS — tips/payroll capability skeletons return `{ok:false, error:'not_implemented'}` with zero emit; Server Actions are sole mutation owners. Pattern verified |
| ADR-0289 Voice tool registry duplication | proposed | Tactical duplication ongoing. Hardcoded arrays in voice-agent still present. R1.3 closure not started. FREEZE on additions holds — Fase 4 `propose_*` tools are the last mandated additions |
| ADR-0296 emma_conversation deprecation | accepted | PARTIAL — code callers removed, `emma/history` route deleted, DROP migration queued (20260529). Tables still live in DB on 2026-05-15 dev HEAD. Full closure at migration apply |

---

## Verified Intentional

- **SE02-09 voice lane bypass** — explicitly documented in `chat.ts:440-458` with 2026-05-15 attribution and the "han henger igjen" user report. Correct decision; not a bug.
- **ADR-0296 pending migration** — `20260529000000_chat_list_engine_sessions_archive_drop_emma.sql` timestamp beyond today (2026-05-15); tables live pending migration. Not a regression — scheduled.
- **ADR-0261 skeleton emit gap** — zero emit in tips/payroll skeletons is the correct shape per ADR-0261 §2. Registry entries are forward declarations, not phantom contracts.

---

## In-Progress

`services/stage-engine/src/routes/agent/chat.ts` is modified on `development` HEAD (git status shows `M`). The current file reflects the 2026-05-15 voice SessionLane bypass fix. Audit treats current HEAD as the surface. No partial-write risk observed.

---

## Delta vs 2026-05-13

| Finding | 2026-05-13 | 2026-05-15 |
|---------|-----------|-----------|
| SE-02-01 primeContext.profileId injection | OPEN HIGH | **CLOSED** — server-verification added (admin DB lookup before inject) |
| F-OB-04 emma/session orphan | OPEN | Still OPEN (SE02-06) |
| emma_conversation tables | OPEN | PARTIAL — migration queued, code dead-flush removed |
| voice SessionLane bypass | not flagged | NEW LOW — SE02-09 (by-design, documented) |
| emma/memory gate+emit gap | not flagged | NEW HIGH — SE02-03 |

**Net change:** 1 HIGH closed, 1 new HIGH opened (emma/memory), 1 new LOW (voice lane). Overall severity roughly neutral. The emma/memory route is the top remediation target.

---

## Top 3 Critical

1. **SE02-03 HIGH** — `apps/web/src/app/api/emma/memory/route.ts` writes to `engine_memory` without `gate_action` and without `emit()`. This is a Law 2 + Law 4 double violation. Every mutation must gate + emit. Route is employee-facing (any authenticated profile can call it). Fix: add `callGateAction('memory.save', ...)` + `emit('memory.saved', ...)` in the POST handler, or route through stage-engine capability tool (which already gates+emits in `packages/ai/src/capabilities/memory/tools.ts`).

2. **SE02-02 MEDIUM** — `apps/web/src/app/api/emma/memory/route.ts:74` uses `body.workspace_id` directly in the insert. Although `getProfileId` verifies the user has a profile in that workspace, the canonical server-resolved workspace_id should be derived from the profile row (i.e. use `profile.workspace_id` from the DB query result), not from the body. Forged workspace_id pointing to a workspace the user has left (stale JWT) bypasses the profile-verified value.

3. **SE02-04 MEDIUM** — ADR-0248 B5 lifecycle events (`engine_step.reached`, `engine_run.completed`, `engine_run.failed`) are registered in `packages/telemetry/src/registry.ts` but never emitted in `supabase/functions/engine-dispatch/index.ts`. This is an intentional gate (ADR-0246 A4b blocked until ADR-0248 implemented), but the registry entries create observer expectation that these events fire. Any consumer wired to them today receives nothing. Should be tracked as open gap until B5 handlers ship.
