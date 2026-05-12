---
title: "Audit Slice 02 — Stage Engine + BFF (ADR-0042, 0049, 0186, 0246, 0247, 0248, 0255, 0261)"
status: done
created: 2026-05-12
updated: 2026-05-12
module: audit
tags: [audit, stage-engine-bff, adr]
---

# Slice 02: Stage Engine + BFF

**ADRs in scope:** 0042, 0049, 0186, 0246, 0247, 0248, 0255, 0261
**Surface scanned:** `services/stage-engine/src/`, `apps/web/src/app/api/botsson/`, `apps/web/src/app/api/emma/`, `packages/ai/src/router/`, `supabase/functions/engine-dispatch/`
**Run date:** 2026-05-12
**Analyst:** botsson-harness-builder (sonnet)

---

## Summary — Top 5 Findings

1. **HIGH F-02-01** — `botsson/chat` and `emma/chat` BFF both forward `profile_id` in the JSON body to stage-engine. Stage-engine's `chatSchema` (Zod `z.object()`) strips it silently. The field is dead wire payload and a documentation/maintenance trap — any future `passthrough()` addition or schema relaxation would reintroduce the ADR-0151 forgery vector. Both routes were marked as carrying the G9 regression in BOTSSON-SYSTEM-MAP but the system map said the fix is pending. Code confirms it landed at stage-engine (stripping) but NOT at the BFF (still sends it).

2. **MEDIUM F-02-02** — ADR-0246, ADR-0247, and ADR-0248 remain `proposed`. No Phase A0 migration exists. Stage-engine has 27+ `engine_sessions` reads (confirmed by ADR-0246 §Phase A4a text) with zero `engine_state` consumers. The three-table ontology reconciliation is entirely unstarted. ADR-0246 Phase A4b emit is blocked by design (gates not passed), so no phantom-emit risk today, but the proposed status means the spec has no enforcement.

3. **MEDIUM F-02-03** — `supabase/functions/engine-dispatch/handlers/` contains only three handlers (`period-locked-notifier.ts`, `scan-overdue-invoices.ts`, `sync-integration.ts`). The B5 action handlers (`engine_step.reached`, `engine_run.completed`, `engine_run.failed`, `engine_run.stuck`) required by ADR-0248 as canonical emit producers do not exist. The telemetry registry also contains no `engine_step.*` or `engine_run.*` entries. This is consistent with ADR-0248 `proposed` status but must be tracked as an open gap.

4. **LOW F-02-04** — `apps/web/src/app/api/emma/session/route.ts` still carries a comment referencing "Ultravox temporaryTool (ADR-0282 Phase E T2.1)" — Phase E purged Ultravox. The route itself is the G5 orphan (Phase F0 dropped its T3 consumer). Stale header comment and orphan status both reduce maintainability. No security impact.

5. **LOW F-02-05** — ADR-0255 Phase 0.5 (file-backed queue) is implemented (`infra/sixten/queue.json` volume mount per ADR-0255 §Phase 0.5, `agentQueue` route mounted at `index.ts:115`), but `HEARTBEAT.md` job `sixten-dispatch` is documented as "paused until smoke-test green". The queue exists; the dispatcher trigger does not run. Incomplete Phase 0.5 closure — not a blocking issue but the queue can accumulate stale entries without processing.

---

## Findings Table

| ID | Severity | ADR | File:line | Evidence | In-Progress? |
|----|----------|-----|-----------|----------|--------------|
| F-02-01 | HIGH | ADR-0151 (via G9) | `apps/web/src/app/api/botsson/chat/route.ts:191` `apps/web/src/app/api/emma/chat/route.ts:234` | Both routes include `profile_id: profile.profile_id` in the JSON body forwarded to `POST /agent/chat`. Stage-engine `chatSchema` strips it (Zod default), but the dead field is a maintenance trap. ADR-0151 requires profile_id to be server-derived only; BFF sending it contradicts intent even if currently inert. | No — G9 was flagged as open in system-map |
| F-02-02 | MEDIUM | ADR-0246, ADR-0247 | `docs/decisions/0246-*.md:4` `docs/decisions/0247-*.md:3` | Both ADRs `status: proposed`. No Phase A0 migration found in `supabase/migrations/`. Stage-engine reads `engine_sessions` in 27+ places; zero `engine_state` reader paths exist. | No — ADR-0246 explicitly deferred; tracked as open gap |
| F-02-03 | MEDIUM | ADR-0248 | `supabase/functions/engine-dispatch/handlers/` (only 3 files); `packages/telemetry/src/registry.ts` (no `engine_step.*` / `engine_run.*` entries) | B5 canonical emit producers not implemented. Telemetry registry has no `engine_step.reached`, `engine_run.completed`, `engine_run.failed`, `engine_run.stuck`. ADR-0248 `status: proposed`. | No — ADR-0248 explicitly deferred |
| F-02-04 | LOW | ADR-0049 (hygiene) | `apps/web/src/app/api/emma/session/route.ts:6` | File header says "Ultravox temporaryTool (ADR-0282 Phase E T2.1)". Ultravox fully removed Phase E. Stale comment + G5 orphan (no consumer in web app after Phase F0 T3 drop). | No |
| F-02-05 | LOW | ADR-0255 | `infra/sixten/` + `HEARTBEAT.md` | Phase 0.5 queue implemented but `sixten-dispatch` heartbeat job paused. Queue can drift without processing. | Campaign daily-operation |
| F-02-06 | VERIFIED OK | ADR-0186 | `services/stage-engine/src/core/guardian-bus.ts:1-111`; `src/index.ts:193` | `guardian-bus.ts` is a thin façade delegating to `pg-notify-bus.ts`. `persistEvent()` writes to `guardian_log`; trigger broadcasts via `pg_notify`. `startPgNotifyBus()` mounted at startup. ADR-0186 fully compliant. | — |
| F-02-07 | VERIFIED OK | ADR-0042 | `services/stage-engine/src/core/agent-session.ts:34` | `mode: "agent"` set on INSERT to `engine_sessions`. Session manager at line 38 filters `mode: "mission"` for mission sessions correctly. Two-mode architecture working as designed. | — |
| F-02-08 | VERIFIED OK | ADR-0151 | `services/stage-engine/src/routes/agent/chat.ts:61,105,224-265` | `profile_id` NOT in `chatSchema`. Voice path parses from session_id convention + DB-verifies. Chat path calls `deriveProfileId(auth.userId, workspaceId, supabaseAdmin)`. Server derivation intact. | — |
| F-02-09 | VERIFIED OK | ADR-0261 | `packages/ai/src/capabilities/tips/tools.ts:47,50,72,93,121` | All 4 tools return `{ok:false, error:"not_implemented"}`. Zero `emit()` calls. Zero DB writes. Skeleton shape correct per ADR-0261 + ADR-0196 Invariant 11. | — |
| F-02-10 | VERIFIED OK | ADR-0049 | `apps/web/src/app/onboarding/hooks/__tests__/useBotsson.test.ts:8-16` | Post-Phase-E: no `UltravoxSession` import, no `ultravox-client`, no `registerToolImplementation` calls in `useBotsson.ts`. Only `advanceToNextSection` data-channel client tool retained per ADR-0282 R4 #11. | — |

---

## Per-ADR Rollup

| ADR | Title | Verdict | Severity |
|-----|-------|---------|----------|
| ADR-0042 | Agent Architecture — Stage Engine Agent Mode | PASS | — |
| ADR-0049 | @smartout/agent-sdk | PASS (Ultravox removed) | LOW hygiene (stale emma/session comment) |
| ADR-0186 | Guardian bus pg LISTEN/NOTIFY | PASS | — |
| ADR-0246 | engine_state vs engine_sessions ontology | IN-PROGRESS (proposed) | MEDIUM — no Phase A0 migration |
| ADR-0247 | engine_state schema relaxation | IN-PROGRESS (proposed) | MEDIUM — no migration |
| ADR-0248 | B5 action handlers as canonical emit producer | IN-PROGRESS (proposed) | MEDIUM — B5 handlers not implemented |
| ADR-0255 | Sixten Stage Engine integration | PARTIAL | LOW — Phase 0.5 queue live but dispatcher paused |
| ADR-0261 | BFF as mutation host for non-agent capabilities | PASS | HIGH hygiene (profile_id in BFF body) |

---

## Verified Intentional Patterns

- **Tips skeleton `not_implemented` returns** — intentional per ADR-0261 + ADR-0196 Invariant 11. Not a phantom-emit violation. Registry entries for `tips.*` events document future intent.
- **`profile_id` stripped at chatSchema** — Zod `z.object()` strips unknown keys. The BFF sending `profile_id` is a dead field, not an active forgery vector. Confirmed by reading `chatSchema` (line 95-122): no `profile_id` field, no `.passthrough()`.
- **`emma/session` orphan** — known G5 open gap in BOTSSON-SYSTEM-MAP.md. Not re-flagged as new.
- **ADR-0246/0247/0248 proposed** — all three explicitly deferred pending Phase A0 evidence. Phantom-emit risk is controlled by the A4b gate conditions specified in ADR-0246.

---

## In-Progress (Active Campaigns)

- **F-02-02 / F-02-03** — ADR-0246/0247/0248 phases are owned by `campaign/botsson-arena`. No active sub-sortie at time of audit. Not marked as campaign churn — genuinely open.
- **F-02-05** — Sixten queue (`infra/sixten/`) touches `campaign/daily-operation` scope. Heartbeat dispatcher paused intentionally until smoke-test green.
- **G9 (F-02-01)** — System map marks as open regression from 2026-05-06. `feat/sendmessage-adr-0287-retrofit` is active but does not address this BFF.

---

## Remediation Notes (READ-ONLY — no changes made)

**F-02-01 (HIGH):** Remove `profile_id:` from the `JSON.stringify(...)` body in both `apps/web/src/app/api/botsson/chat/route.ts:191` and `apps/web/src/app/api/emma/chat/route.ts:234`. Stage-engine correctly ignores it today but the presence contradicts ADR-0151 semantics and is a future trap. One-line fix per file.

**F-02-03 (MEDIUM):** B5 handlers and telemetry registry entries are gated on ADR-0248 acceptance. Phase A4b emit must not ship until all three gates in ADR-0246 §Phase A4b pass.

**F-02-04 (LOW):** Update `apps/web/src/app/api/emma/session/route.ts` file header to remove Ultravox reference. Separately, determine whether the route has any remaining consumers or should be deleted (G5 resolution).
