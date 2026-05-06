---
title: "Slice 02 — Stage Engine + BFF ADR/Contract Audit"
status: complete
created: 2026-05-06
updated: 2026-05-06
module: stage-engine
tags: [audit, stage-engine, bff, adr-compliance, security]
auditor: botsson-harness-builder
---

# Slice 02 — Stage Engine + BFF Audit

**Scope:** `services/stage-engine/`, `apps/web/src/app/api/`, `packages/ai/src/router/`, `supabase/functions/engine-dispatch/`
**ADRs checked:** 0042, 0049, 0186, 0246, 0247, 0248, 0255, 0261
**Baseline:** 2026-05-02 top finding was `chat.ts:116-125` L-0177 silent fallback.

---

## Summary — Top 5 Findings

| # | Severity | Title |
|---|----------|-------|
| 1 | HIGH | BFF routes send `profile_id` in stage-engine body (ADR-0151 forward-channel leak) |
| 2 | HIGH | `/agent/dispatch` and `/agent/queue` emit zero telemetry (ADR-0116 violation) |
| 3 | HIGH | `/agent/queue` PUT has no workspace scope or auth role check — any valid API key can patch any task |
| 4 | MEDIUM | ADR-0246/0247/0248 are still `proposed` — 5-phase engine_state migration unstarted |
| 5 | LOW | `validateJwt` resolves workspace from first-profile order — multi-workspace user gets first-created workspace, not the body-supplied one |

---

## Findings Table

| ID | File | Line(s) | Severity | ADR | Description |
|----|------|---------|----------|-----|-------------|
| F-01 | `apps/web/src/app/api/emma/chat/route.ts` | 192 | HIGH | ADR-0151 | Sends `profile_id: profile.profile_id` in body to stage-engine. Stage-engine's `chatSchema` does NOT accept `profile_id` anymore (removed per ADR-0151 comment at line 36), so the field is silently dropped. Net effect: no security breach (stage-engine ignores it) but the BFF still resolves profile server-side then forwards it — creating a false confidence the field does something useful. More critically, if schema is ever relaxed this becomes a forgeable injection vector. |
| F-02 | `apps/web/src/app/api/botsson/chat/route.ts` | 191 | HIGH | ADR-0151 | Same as F-01. `profile_id: profile.profile_id` sent in body. Same risk. |
| F-03 | `services/stage-engine/src/routes/agent/dispatch.ts` | full file | HIGH | ADR-0116 | `/agent/dispatch` (POST) invokes Sixten persona, records no `emit()` to `engine_event` or `activity_trail`. The only logging is `baseLogger.info`. Mutations triggered by Sixten are not auditable at the harness level. ADR-0255 Phase 0 is explicit that "telemetry (run_started / step_reached / completed) is emitted by stage-engine" — but the route body has no `emit()` calls. |
| F-04 | `services/stage-engine/src/routes/agent/queue.ts` | 139-177 | HIGH | ADR-0116 | `PUT /agent/queue/:id` patches task status with no `emit()`. No `activity_trail` row. No workspace scope on the JSON file entries. Any authenticated API-key holder can patch any task ID. |
| F-05 | `services/stage-engine/src/routes/agent/queue.ts` | full file | HIGH | ADR-0042 | Queue route exposes no workspace scoping — `queue.json` has no workspace_id field per ADR-0255 Phase 0.5 design (file-based, pre-migration). Any authenticated agent can read/write all queued Sixten tasks regardless of workspace. This is intentional per ADR-0255 (Sixten has no workspace authority) but is undocumented as a deliberate exception, making it look like a gap. |
| F-06 | `docs/decisions/0246-*.md`, `0247-*.md`, `0248-*.md` | — | MEDIUM | ADR-0246 | All three ADRs remain `proposed`. Engine_state migration Phase A0-A4 unstarted. Stage-engine still reads `engine_sessions` exclusively (26+ call sites noted in ADR-0246). No dual-write flag, no schema relaxation migration, no B5 emit producer. All code paths that would satisfy these ADRs are future work. |
| F-07 | `services/stage-engine/src/middleware/auth.ts` | 136-143 | LOW | ADR-0042 | `validateJwt` resolves workspace via `.order("created_at", { ascending: true }).limit(1)` — returns first-ever profile. A user in multiple workspaces who logs in via JWT gets workspace context from their oldest workspace, not the one the BFF passed in `workspaceId`. The BFF body `workspaceId` is then re-used to scope `deriveProfileId` in `chat.ts` (correcting the slot), but the `auth.workspaceId` in the middleware-set context retains the first-profile workspace until overridden. |
| F-08 | `supabase/functions/engine-dispatch/index.ts` | 677-681 | LOW | ADR-0248 | `gate_action` in `assign_task` handler passes `p_actor_profile_id: state.assignee_id ?? null`. A NULL assignee means the gate call proceeds with no actor, which could produce incorrect allow/deny verdicts for workspaces with actor-specific policies. Not a bypass but a potential permission gap when assign_task is used before an assignee is resolved. |

---

## Per-ADR Rollup

| ADR | Status | Verdict | Notes |
|-----|--------|---------|-------|
| ADR-0042 (Agent Architecture) | accepted | PARTIAL | Stage Engine agent mode works end-to-end. `/agent/queue` lacks workspace scope (intentional per ADR-0255 but undocumented exception). |
| ADR-0049 (Agent SDK Package) | accepted | PASS | SDK boundary respected. No direct `ultravox-client` imports in app code found in audit scope. |
| ADR-0186 (Guardian Bus pg_notify) | accepted | PASS | `pg-notify-bus.ts` live, `guardian-bus.ts` is façade, trigger installed. System map shows 🟢. `emitGuardianEvent` called correctly in `chat.ts:222,286`. |
| ADR-0246 (Engine State migration spec) | **proposed** | PENDING | Zero implementation. All gates (A0–A4) unstarted. Stage-engine reads `engine_sessions` exclusively. |
| ADR-0247 (engine_state schema relaxation) | **proposed** | PENDING | Migration not written. `workspace_id` and `process_id` still NOT NULL on `engine_state`. |
| ADR-0248 (B5 emit producer) | **proposed** | PENDING | B5 handlers exist for `create_deviation`/`validate_settlement`/`lock_checkout` (confirmed 🟢 per system map) but lifecycle events `engine_step.reached`/`engine_run.completed`/`engine_run.failed` are NOT registered in telemetry registry. A4b gate not met. |
| ADR-0255 (Sixten stage-engine integration) | **proposed** | PARTIAL | Phase 0 route `POST /agent/dispatch` exists and works. Phase 0.5 `queue.json` + `GET/PUT /agent/queue` routes exist. No telemetry emitted (F-03, F-04). Phase 1 unstarted. |
| ADR-0261 (BFF as mutation host) | accepted | PASS | Applies to tips/payroll capabilities. No tips mutations observed in stage-engine BFF routes. Pattern respected within audit scope. |

---

## Per-Tool Compliance Table (agent-router pipeline)

| Tool/Component | gate_action | emit() | workspace_id scope | Verdict |
|---|---|---|---|---|
| `agent-router.ts` — gate_action call | N/A (is the gate) | `botsson.turn_started` + `botsson.turn_completed` with non-null workspaceId + profileId | `workspaceId` from JWT-derived + L-0177-fixed wizard path | PASS |
| `agent-router.ts` — guardian events | `emitGuardianEvent` delegates to `guardian_log` → pg_notify | via guardian_log INSERT | workspace_id in every call | PASS |
| `/agent/dispatch` | none (Sixten has no workspace authority per ADR-0255) | **NONE — zero emit()** | no workspace scope (by design) | FAIL (F-03) |
| `/agent/queue` PUT | none | **NONE — zero emit()** | no workspace scope (by design) | FAIL (F-04) |

---

## Delta vs 2026-05-02 Baseline

| Finding | Baseline State | Current State |
|---------|----------------|---------------|
| `chat.ts:116-125` L-0177 silent fallback | CRITICAL open | **FIXED** — explicit 404 return when `wizard_session_id` row missing. `effectiveWorkspaceId = nonEmpty(wizardRow.workspace_id, ...)` on success path. |
| `profile_id` in body | Not tracked | **NEW** — F-01/F-02. BFF still sends the field; stage-engine ignores it. Residual risk vector. |
| Dispatch/queue telemetry gap | Not tracked | **NEW** — F-03/F-04. Both new routes have zero emit(). |
| ADR-0246/0247/0248 proposed | Known | Unchanged — still proposed, no Phase A0 work started. |

---

## Verified Intentional (not findings)

- **`profile_id` in `chat.ts` chatSchema removed** — `chatSchema` at line 70 has no `profile_id` field. BFF fields are ignored by stage-engine. ADR-0151 compliant server-side. BFF F-01/F-02 are forward-channel leaks, not security bypasses.
- **`/agent/queue` no workspace scope** — ADR-0255 Phase 0.5 explicitly documents this as pre-migration state. Sixten has no workspace authority. Intentional but undocumented exception.
- **`/agent/dispatch` no engine_state write** — ADR-0255 Phase 0 explicitly defers engine_state integration to Phase 1.
- **`validateJwt` first-profile resolution** — workspace is subsequently overridden by `deriveProfileId` in `chat.ts` using the BFF-provided `workspaceId`. Low practical risk.
- **ADR-0186 compliance** — `guardian-bus.ts` rewired as façade over `pg-notify-bus.ts`. LISTEN started in `index.ts`. `stopPgNotifyBus()` in graceful shutdown.

---

## In-Progress / Active-Campaign Notes

- `feat/botsson-sdk` and `campaign/botsson-arena` are DIRTY — these audited routes may have uncommitted changes. Findings F-01/F-02 were verified against committed code on `development` branch.
- ADR-0246 Phase A0 gate remains the critical blocker for engine_state migration. No code changes in active campaigns address this yet.
- B5 lifecycle events (`engine_step.reached`, `engine_run.completed`, `engine_run.failed`) absent from `packages/telemetry/src/registry.ts` — ADR-0248 acceptance gate #3 not met.

---

**Word count:** ~950
