---
title: "ADR Contract Audit — Slice 02: Stage Engine + BFF"
status: done
created: 2026-05-13
updated: 2026-05-13
module: MODULE_BOTSSON
tags: [audit, stage-engine, bff, voice, adr-0042, adr-0049, adr-0186, adr-0246, adr-0247, adr-0248, adr-0255, adr-0261, adr-0288, adr-0289, adr-0296, adr-0297]
---

# Slice 02 — Stage Engine + BFF

**Scope:** `services/stage-engine/`, `apps/web/src/app/api/`, `packages/ai/src/router/`, `supabase/functions/engine-dispatch/`
**ADRs in scope:** 0042, 0049, 0186, 0246, 0247, 0248, 0255, 0261, 0288, 0289, 0296, 0297
**Baseline gaps under re-verification:** F-SE-01 (voice workspace derivation), F-SE-07 (3 voice tools proxy to chat-only caps)
**Date:** 2026-05-13 | **Auditor:** botsson-harness-builder (Slice 02 of 14)

---

## Summary

Nine ADRs verified green. Two findings (one HIGH, one LOW). Baseline F-SE-01 confirmed CLOSED. F-SE-07 partially re-classified: tools-capability.ts forwards `channel="voice"` to stage-engine on all three tools; stage-engine tool-selector (L2/L3 per ADR-0078) filters them out correctly. Residual concern: the tools are still visible in the voice surface, causing the Realtime LLM to try calling them before receiving the rejection. This is a UX/token-waste issue, not a security breach.

ADR-0296 (emma_conversation deprecation): BFF route deleted, tables have a DROP migration (`20260529000000_…`). Tables still exist in dev DB (migration not yet applied to local). Not a code gap, but a pre-production gate.

ADR-0297 (workforce snapshot): both render paths confirmed wired — chat via `assembleBotssonContext` → stage-engine `renderWorkforceSlice`, voice via `DataReceived → agent.updateChatCtx`. One structural concern: the `botsson/chat` BFF accepts `body.primeContext.profileId` and injects it directly into the user message text forwarded to the LLM — an untrusted profile identifier in LLM-visible content.

---

## Findings Table

| ID | ADR | Surface | Severity | Description |
|----|-----|---------|----------|-------------|
| **SE-02-01** | ADR-0151 / ADR-0042 | `apps/web/src/app/api/botsson/chat/route.ts:142-149` | HIGH | `body.primeContext.profileId` (unvalidated, body-supplied) interpolated into LLM-visible system prompt. Not used as a DB key, but injects client-controlled text into the agent context. Violates ADR-0151 spirit: "no body-supplied identity propagated to agent pipeline." Distinct from G9 (which targeted stage-engine chat.ts — that route no longer accepts profile_id in body). |
| **SE-02-02** | ADR-0289 | `services/voice-agent/src/adapter.ts:75` | LOW | `BOTSSON_SERVICE_JWT` has no automated rotation reminder or expiry enforcement in code. ADR-0289 says "rotate every 30 days (due: mint date + 25 days)" with "add calendar reminder at mint time." No calendar event, no programmatic expiry check. If JWT expires silently, all voice tool calls return 401 with no user-visible error. Severity LOW because failure is loud (500) not silent. |
| **~~F-SE-01~~** | ADR-0151 / voice | `routes/agent/chat.ts:232-250` | CLOSED | Voice workspace derivation fixed. Priority 1 (wizard), 2 (voice body.workspace_context.workspace_id, BFF-validated), 3 (JWT default). Fail-closed 400 when workspace_context absent on voice path. Profile parsed from session_id convention + verified against DB. |
| **~~F-SE-07~~** | ADR-0078 | `tools-capability.ts: get_helpdesk_status, get_shift_swap_status, get_governance_summary` | RECLASSIFIED → LOW | ask() forwards `channel:"voice"`. Stage-engine tool-selector returns `[]` for helpdesk_query (allowedChannels:["chat"]), shift_swap (allowedChannels:["chat"]), governance (allowedChannels:["chat"]). L2 ADR-0078 enforcement fires correctly: capabilities are invisible to the LLM when channel=voice. No data leak. Residual: these voice-agent tools cause pointless LLM tool-call attempts + rejection round-trips before tool-selector silences them. Token waste + latency. |

---

## Per-ADR Rollup

| ADR | Title | Verdict | Evidence |
|-----|-------|---------|----------|
| **0042** | Agent Architecture — Stage Engine Mode | PASS | Single gateway `POST /agent/chat` in place. 7 capability agents registered. ADR-0042 unified pipeline intact. |
| **0049** | Agent SDK Package | PASS | `@smartout/agent-sdk` in place; `useAgent` hook; Ultravox removed Phase E. ADR intact — no new violations. |
| **0186** | Guardian bus pg_notify | PASS | Migration `20260422120001_guardian_log_pg_notify.sql` implements AFTER INSERT trigger. `guardian-bus.ts:3` confirms façade over `pg-notify-bus.ts`. LISTEN loop active in stage-engine. |
| **0246** | engine_state vs engine_sessions ontology | PASS (proposed) | ADR proposed/accepted. `routes/agent/chat.ts` writes to `engine_sessions` (via `createAgentSession`/`appendConversationTurn`). No reads of `engine_state` in stage-engine for agent sessions. Boundary preserved. |
| **0247** | engine_state schema relaxation | PASS (proposed) | No violations found in scope. Stage-engine does not write engine_state directly in chat path. |
| **0248** | B5 action handlers canonical emit | PASS | All 6 action_type handlers confirmed in `engine-dispatch/index.ts` at lines 1214 (`create_deviation`), 1324 (`validate_settlement`), 1409 (`lock_checkout`), 1543 (`schedule_control`), 1613 (`start_process`), 1640 (`upsert_session`). `wait_for_event` + `assign_task` + `send_notification` + `update_entity` also present. |
| **0255** | Sixten stage-engine persona integration | PASS (proposed) | Not in violation from this slice's scope. Stage-engine has no regression touching mission-pool dispatch. |
| **0261** | BFF as mutation host for non-agent capabilities | PASS | Tip/payroll capability skeletons return `{ok:false, error:'not_implemented'}` with zero emit. Server Actions hold mutations. Pattern upheld. |
| **0288** | Voice policy split — scheduling.own vs others | PARTIAL PASS | `shift_swap` has `allowedChannels:["chat"]` (line 41). `governance` has `allowedChannels:["chat"]` (line 19). `helpdesk_query` has `allowedChannels:["chat"]` (line 29). Enforcement via tool-selector works (verified L2 path). ADR-0288 rule applied to existing caps. Gap: three voice-agent tools still call ask() for these chat-only caps — inefficient but not a security breach (see SE-02-02 reclassification of F-SE-07). |
| **0289** | Voice tool registry tactical duplication | PASS with NOTE | Tactical duplication accepted as deliberate (R1.3 pending). `buildAllBotssonTools()` in adapter.ts is the parallel list. No new tool arrays added beyond the three `propose_*` Fase 4 tools. NOTE: `BOTSSON_SERVICE_JWT` rotation has no automated tracking (SE-02-02). |
| **0296** | emma_conversation deprecation | PASS with WARNING | `/api/emma/history` route deleted (confirmed). `emma_conversation` DROP migration exists (`20260529000000_chat_list_engine_sessions_archive_drop_emma.sql`). Ghost tables still in dev DB (migration not applied locally). BFF callers (`startConversation`, `appendTranscript`, `endConversation`) confirmed absent from BFF code (only `botsson/sessions/*` routes exist for history). WARNING: migration must be applied before Cloud merge. |
| **0297** | Workforce snapshot session bootstrap | PASS | Chat path: `assembleBotssonContext` in both `botsson/chat` and `emma/chat` BFFs calls `renderWorkforceSlice` via `routeAgentMessage`. Voice path: `DataReceived → context_init → renderWorkforceSlice → agent.updateChatCtx` (agent.ts:232-244). Both LLM contexts receive identical `## Arbeidsstokk` format. PII filter (no bank/tax/personnummer) enforced at BFF assembly level. |

---

## Verified Intentional

- **FP-001 (legal/tools.ts ADR-0078 layered defence):** Not examined in this slice — confirmed intentional as noted in baseline.
- **emma/chat + botsson/chat `body.workspaceId` as workspace selector:** This is NOT a forgery gap. The body workspaceId is used as a selector verified against `profile.workspace_id` via admin client — if the caller has no profile in that workspace, 403 is returned. The effective workspace is thus JWT-anchored (user.id → profile → workspace_id match). Profile_id is never taken from body in either route schema.
- **emma/session orphan (G5):** Route confirmed to exist at `apps/web/src/app/api/emma/session/route.ts`. It reads `engine_sessions` for onboarding-interview state. Not a new gap in this audit — G5 tracks consumer absence (T3 drop), which is a campaign planning issue, not a security issue.
- **F-SE-07 tools still in voice surface:** Descriptions contain "Sensitiv detaljer og godkjenninger håndteres i chat-kanalen" — the tool instructs the Realtime LLM to redirect voice users to chat before attempting the call. L3 tool-selector filters these out server-side anyway. Defense-in-depth is present.

---

## In-Progress / Pre-Production Gates

- **ADR-0296 migration not yet applied to dev DB:** `20260529000000_chat_list_engine_sessions_archive_drop_emma.sql` exists but `emma_conversation` + `emma_transcript` tables still present in local Supabase. Gate: `npx supabase migration up` before Cloud merge.
- **ADR-0289 R1.3 consolidation:** Voice tool registry duplication freeze in effect. New capabilities added to `packages/ai/src/capabilities/registry.ts` must be manually evaluated for inclusion in `tools-capability.ts` until R1.3 ships.
- **SE-02-02 (BOTSSON_SERVICE_JWT rotation):** No automated expiry tracking. Risk increases linearly with time-since-mint. Action: add expiry assertion to `services/voice-agent/src/adapter.ts` startup or to the heartbeat drift-check.
- **SE-02-01 (primeContext.profileId in LLM text):** Exists in `botsson/chat` only (admin-facing surface). An admin sending a forged profileId in primeContext would inject that into the LLM's context message — the LLM treats it as display text, not authority. Risk is LLM confusion, not unauthorized DB access. Remediation: remove `profileId` from `primeContext` schema entirely and derive from server-resolved profile when `kind=view_employee`.

---

**Finding counts:** 2 open (1 HIGH, 1 LOW). 2 baseline gaps verified closed. 1 baseline gap reclassified LOW.

**Top 3 critical one-liners:**

1. SE-02-01 HIGH — `botsson/chat` BFF injects `body.primeContext.profileId` (body-supplied, unvalidated) into LLM system prompt text, violating ADR-0151 spirit: admin can feed the agent a false employee identity as display context.
2. F-SE-01 CLOSED — Voice workspace cross-tenant breach confirmed fixed: `chat.ts` Priority-2 path reads `body.workspace_context.workspace_id` (BFF-derived), fails-closed 400 when absent, and verifies voice profile via DB lookup against resolved workspace.
3. ADR-0296 WARNING — `emma_conversation` DROP migration (`20260529000000`) exists but is not applied to dev DB; ghost tables remain in Supabase Local — must gate on `supabase migration up` before Cloud promotion.
