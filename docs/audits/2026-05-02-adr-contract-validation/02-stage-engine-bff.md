---
title: "Slice 2 — Stage Engine + BFF + Agent Router + Dispatcher Audit"
status: complete
updated: 2026-05-02
created: 2026-05-02
module: MODULE_BOTSSON
tags: [audit, stage-engine, bff, agent-router, dispatcher, adr-validation]
slice: 2
auditor: botsson-harness-builder
---

# Slice 2: Stage Engine + BFF + Agent Router + Dispatcher

## Summary — Top 5 Findings

**F1 (HIGH) — wizard_session_id workspace fallback is L-0177 violation** `services/stage-engine/src/routes/agent/chat.ts:116-125`. When `wizard_session_id` is supplied but the `wizard_session` row is not found, `effectiveWorkspaceId` silently falls back to `rawWorkspaceId` (JWT-first-workspace). No 4xx. Exact forbidden pattern from CLAUDE.md L-0177: `if (wizardRow?.workspace_id) { effectiveWorkspaceId = ... }` with no else-branch.

**F2 (MEDIUM) — Both BFF routes forward dead `profile_id` body field to stage-engine.** `apps/web/src/app/api/botsson/chat/route.ts:191` and `apps/web/src/app/api/emma/chat/route.ts:192` both include `profile_id: profile.profile_id` in the JSON body sent to stage-engine. Stage-engine's `chatSchema` explicitly removed this field (ADR-0151, `chat.ts:36,73`). Zod silently strips it — no error. Effect: dead payload, latent confusion when code readers see the BFF and assume it controls actor identity in stage-engine.

**F3 (MEDIUM) — JWT workspace derivation picks first-created active workspace, not request-targeted workspace.** `services/stage-engine/src/middleware/auth.ts:136-143`. `validateJwt` returns `ORDER BY created_at ASC LIMIT 1` profile workspace. For admins with profiles in multiple workspaces, `auth.workspaceId` may differ from the intended workspace. The BFF forwards a Bearer JWT but does NOT encode the intended workspace — stage-engine has no way to know which workspace the user intended, and the wizard flow partially works around this via the `wizard_session_id` lookup (which has F1). Non-wizard multi-workspace admins are silently scoped to wrong workspace.

**F4 (LOW) — BFF `workspaceId` is body-supplied, not session-derived.** `apps/web/src/app/api/emma/chat/route.ts:41` and `apps/web/src/app/api/botsson/chat/route.ts:34`. Both accept `workspaceId: z.string().uuid()` from the request body and use it to scope the profile lookup. This means a client can send any workspace UUID. The profile lookup (`user_id + workspace_id`) prevents access to workspaces where the user has no profile — not a full bypass — but the pattern violates the "workspace_id NEVER from request body" law. Stage-engine correctly ignores this and uses JWT-derived workspace.

**F5 (INFO) — dispatcher dual event-key fix confirmed present; helpdesk path verified.** `supabase/functions/engine-dispatch/index.ts:439-448`. The `event_type ?? event` fallback is correctly implemented. The P0 helpdesk dispatcher bug (STATE-SUMMARY) is resolved at this code level. Onboarding/wizard seeds (`event`) and helpdesk seed (`event_type`) both resolve. No regression.

---

## Pipe-Status Table

| Segment | Status | File:Line | Note |
|---------|:------:|-----------|------|
| BFF `/api/emma/chat` → auth | 🟢 | `route.ts:66-89` | Bearer + cookie, admin-client validate |
| BFF `/api/emma/chat` → workspace scope | 🟡 | `route.ts:41,118` | `workspaceId` from request body, not session-derived |
| BFF `/api/emma/chat` → profile lookup | 🟢 | `route.ts:113-123` | user_id + workspace_id scoped, fail-fast 403 |
| BFF → stage-engine proxy | 🟡 | `route.ts:191-192` | Dead `profile_id` field in body (ADR-0151 violation at BFF layer) |
| Stage-engine auth middleware | 🟢 | `middleware/auth.ts:25-86` | Dual-auth: api-key + JWT |
| Stage-engine JWT workspace derivation | 🟡 | `middleware/auth.ts:136-143` | First-created workspace; wrong for multi-workspace admins |
| Stage-engine profile_id derivation (ADR-0151) | 🟢 | `core/derive-profile-id.ts`, `chat.ts:141` | Server-derived, not from body |
| wizard_session_id workspace override | 🔴 | `chat.ts:116-125` | L-0177: silent fallback when wizard row missing |
| `gate_action` call | 🟢 | `core/agent-router.ts:257-291` | Called with workspace_id + capability + channel + actor |
| Intent classifier context (Phase A5) | 🟢 | `core/agent-router.ts:210-237` | `buildClassifierContext()` returns typed object, no `""` |
| Guardian bus → pg_notify (ADR-0186) | 🟢 | `core/guardian-bus.ts:42-52,100-102` | `emitGuardianEvent` → `guardian_log` INSERT → trigger → pg_notify |
| Session recorder hooks | 🟢 | `core/agent-router.ts:191-493` | 6 recorder calls: authority_load, classifier_in/out, memory_read, llm_request/response |
| `emit()` telemetry | 🟢 | `routes/agent/chat.ts:218-307` | `botsson.turn_started` + `botsson.turn_completed` with non-null workspace_id + actor_id |
| Dispatcher event_type/event dual-key | 🟢 | `engine-dispatch/index.ts:445-448` | Fallback: `event_type ?? event` — both seeds work |
| Dispatcher trigger matching | 🟢 | `engine-dispatch/index.ts:243-269` | Workspace-scoped + condition filter |
| engine_sessions (ADR-0246 boundary) | 🟡 | `core/agent-session.ts:32,104,119` | Still reads/writes `engine_sessions`, not `engine_state` |
| ADR-0255 sixten integration | 🟡 | `workers/mission-pool-slot.ts:71,420` | Phase 0 CLI invocation in place; Phase 1 heartbeat-native not started |
| ADR-0261 BFF mutation host | 🟡 | — | ADR accepted; no non-agent BFF mutation routes exist yet (by design, Phase pending) |

---

## Per-ADR Rollup

### ADR-0042 — Agent Architecture
**PASS.** Stage-engine is the single routing layer between BFF and capabilities. No capability is called directly from BFF. `routeAgentMessage` in `agent-router.ts` is the canonical pipeline entry point.

### ADR-0049 — Agent SDK Package
**PASS.** `@smartout/agent-sdk` types are imported at L1. Stage-engine uses `@smartout/ai` capability layer. No raw capability calls from BFF.

### ADR-0186 — Telemetry Fanout via emitGuardianEvent → guardian_log → pg_notify
**PASS.** `guardian-bus.ts:42-52` confirms `emitGuardianEvent` is fire-and-forget + writes to `guardian_log`. ADR states the AFTER INSERT trigger on `guardian_log` fires `pg_notify('guardian_events')`. Stage-engine listens and broadcasts to WebSocket clients per `core/pg-notify-bus.ts`. This boundary is confirmed green per BOTSSON-SYSTEM-MAP.md (Phase A6, 2026-04-22). Code trace confirms the `emitGuardianEvent` call at `routes/agent/chat.ts:209,273` for user.message and agent.response events.

### ADR-0246 — engine_state vs engine_sessions Ontology
**PARTIAL — 🟡.** ADR-0246 ratifies the three-table boundary (`engine_missions` / `engine_state+engine_state_step` / `engine_sessions`). Stage-engine still reads/writes `engine_sessions` (agent-session.ts:32,104,119) for the chat session layer. `engine_state` context is written by journey tools but stage-engine has zero reads of `engine_state` for session management. The ontology is not yet converged — `engine_sessions` is the live-session table, `engine_state` is the mission-run table. No code contradiction but boundary remains as documented.

### ADR-0247 — engine_state Schema Relaxation
**NOT VERIFIED IN SCOPE.** ADR concerns schema columns; migration landing confirmed in BOTSSON-SYSTEM-MAP.md. No stage-engine code paths in scope read the relaxed columns.

### ADR-0248 — B5 Action Handlers as Canonical Emit Producers
**PASS.** `engine-dispatch/index.ts:1296-1298` (`ops.deviation_created`), `:1381-1383` (`ops.settlement_validated`), `:1517-1519` (`ops.checkout_locked`) — all three handlers emit to `engine_event` with `event_type` in dot-notation. B5 gap confirmed closed (per BOTSSON-SYSTEM-MAP.md 2026-04-28).

### ADR-0255 — Sixten Stage-Engine Integration
**PARTIAL — 🟡.** Phase 0 CLI invocation is present at `workers/mission-pool-slot.ts:174,190`. The mission-pool-slot worker LISTENs on `mission_dispatch` and spawns `claude` CLI for persona="sixten" missions. Phase 1 (heartbeat-native via `@anthropic-ai/claude-code-agent-sdk`) is tracked but not started. No violation — ADR is implemented at the phase that was landed.

### ADR-0261 — BFF as Mutation Host for Non-Agent Capabilities
**PENDING — by design.** ADR accepted but no non-agent mutation BFF routes exist yet. The BFF currently proxies all traffic to stage-engine. ADR-0261 routes are a future phase. No violation — gap is known and tracked.

---

## Specific Bugs Found

### BUG-02-01: L-0177 wizard_session_id silent workspace fallback
**Severity:** HIGH  
**File:** `services/stage-engine/src/routes/agent/chat.ts:116-125`  
**Pattern:**
```ts
if (wizardRow?.workspace_id) {
  effectiveWorkspaceId = nonEmpty(wizardRow.workspace_id, "workspaceId");
}
// else: silently stays on rawWorkspaceId (JWT-first-workspace)
```
**Fix required:** Replace with explicit 4xx when `wizard_session_id` supplied but wizard row not found, or when `wizardRow.workspace_id` is null. Allowed: `return c.json({ error: "WIZARD_NOT_FOUND" }, 404)`. Forbidden: silent fallback.

### BUG-02-02: Dead profile_id body field sent from both BFF routes
**Severity:** MEDIUM (latent confusion, not a security bug)  
**Files:** `apps/web/src/app/api/botsson/chat/route.ts:191`, `apps/web/src/app/api/emma/chat/route.ts:192`  
**Pattern:** Both BFF routes include `profile_id: profile.profile_id` in the proxied body. Stage-engine's `chatSchema` removed this field (ADR-0151). The field is silently stripped by Zod. No functional impact today, but it sends a misleading signal to future readers that the BFF controls profile_id resolution.  
**Fix:** Remove `profile_id` from both fetch body payloads.

### BUG-02-03: validateJwt returns first-created workspace, not request-targeted workspace
**Severity:** MEDIUM  
**File:** `services/stage-engine/src/middleware/auth.ts:136-143`  
**Pattern:** `ORDER BY created_at ASC LIMIT 1` — godmode admin with profiles in multiple workspaces will always be scoped to their oldest workspace, not the workspace they are acting in. Non-wizard flows have no override path.  
**Note:** This is a known phase gap (ADR-0151 scope amendment — server-derivation fixed for profile_id but workspace derivation via JWT metadata still uses first-profile heuristic).

### BUG-02-04: BFF `workspaceId` accepted from request body (ADR law violation)
**Severity:** MEDIUM (defense-in-depth gap, not full bypass)  
**Files:** `apps/web/src/app/api/emma/chat/route.ts:41`, `apps/web/src/app/api/botsson/chat/route.ts:34`  
**Pattern:** `workspaceId: z.string().uuid()` in RequestSchema is body-supplied. Used to scope profile lookup at the BFF layer. A client can forge this to any UUID — if they have no profile in that workspace, they get 403. Stage-engine ignores the body workspace_id and uses JWT-derived workspace. Not a full bypass but violates the "workspace_id NEVER from request body" law.

### CONFIRMED RESOLVED: P0 helpdesk dispatcher event_type/event key
**File:** `supabase/functions/engine-dispatch/index.ts:439-448`  
**Status:** Fixed. `stepEventKey = (stepPayload?.event_type ?? stepPayload?.event)` resolves both `event_type` (helpdesk seeds) and `event` (legacy onboarding/wizard seeds). The STATE-SUMMARY P0 bug is closed at the code level.
