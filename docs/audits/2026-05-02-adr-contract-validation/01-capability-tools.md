---
title: Capability Tools ADR Contract Validation — Slice 1
status: draft
updated: 2026-05-02
created: 2026-05-02
module: audit
tags: [audit, adr, capabilities, tools, security]
---

## Summary — Top 5 Findings by Severity

1. **CRITICAL — `journey-authoring/publishDraftTool`: docstring claims gatedMutation wraps journey + journey_version inserts; body does direct inserts (L-0176 + ADR-0204)**
   `packages/ai/src/capabilities/journey-authoring/tools.ts:444-487`: `.from("journey").insert(...)` and `.from("journey_version").insert(...)` are bare direct writes with no `gatedMutation()` wrapper. Docstring at line 284 claims `"ADR-0204 gatedMutation surrounds the journey + journey_version inserts"`. The body violates this. Additionally `wizard_session` status update at line 486 is also ungated. (ADR-0173 cross-namespace violation: journey-authoring writing directly to `journey` and `journey_version` tables owned by `journey.publish_mission` — ADR-0240 delegation required.)

2. **CRITICAL — `helpdesk_query/resolveTicket`: direct `engine_state` update with no callGateAction (ADR-0186/ADR-0204)**
   `packages/ai/src/capabilities/helpdesk_query/tools.ts:553-560`: `.from("engine_state").update({status:"complete",...})` with no `callGateAction`. Authorization uses a custom role-check pattern instead. No `gatedMutation()`. Violation of ADR-0186 and ADR-0204.

3. **HIGH — `contract/tools.ts`: mutation tools (`createEmployeeContract`, `sendEmployeeContract`, `forkTemplate`, `publishWorkspaceTemplate`, `deprecateWorkspaceTemplate`) have no callGateAction (ADR-0186/ADR-0204)**
   All mutation tools in `packages/ai/src/capabilities/contract/tools.ts` use a custom `resolveActorRole()` check (line 181-191) but never call `callGateAction`. Direct writes at lines 239-254, 340-344, 457-482, 557-569, 648-656. No `gatedMutation()`. This replaces the ADR-0099/0186/0204 gate with an ad-hoc role lookup — bypass-able if `profileId` resolves to wrong workspace row. ADR-0151 partial: `resolveActorRole` uses `ctx.profileId` (server-derived) so ADR-0151 is satisfied for actor resolution, but workspace scoping of mutations relies on WHERE clauses, not gate.

4. **HIGH — `operations/tools.ts`: `createDeviation` and `completeTask` write directly without callGateAction (ADR-0186/ADR-0204)**
   `packages/ai/src/capabilities/operations/tools.ts:198-209` (`deviation` insert) and lines `243-249` (`session_task` update) both mutate without any `callGateAction` or `gatedMutation()` call. No gate anywhere in the file.

5. **MEDIUM — `helpdesk_query/openTicket`: direct `channel` insert and `channel_member` inserts without callGateAction (ADR-0186)**
   `packages/ai/src/capabilities/helpdesk_query/tools.ts:93-123`: for private-mode desk, inserts a new `channel` row + two `channel_member` rows via direct `.from(...).insert()`. No `callGateAction` before these mutations. The `helpdesk.query.opened` emit (line 138) fires after channel inserts but emit is not a gate.

---

## Findings Table

| Capability | ADR | Verdict | File:Line | Evidence |
|---|---|---|---|---|
| journey-authoring `publishDraftTool` | ADR-0204 | 🔴 violation | tools.ts:444 | `.from("journey").insert()` — no gatedMutation |
| journey-authoring `publishDraftTool` | ADR-0204 | 🔴 violation | tools.ts:464 | `.from("journey_version").insert()` — no gatedMutation |
| journey-authoring `publishDraftTool` | ADR-0204 | 🔴 violation | tools.ts:486 | `.from("wizard_session").update()` — no gatedMutation |
| journey-authoring `publishDraftTool` | ADR-0240 | 🔴 violation | tools.ts:444-487 | Direct writes to `journey`+`journey_version` tables owned by `journey.publish_mission`; must delegate per ADR-0240 |
| journey-authoring `publishDraftTool` | L-0176 | 🔴 violation | tools.ts:284 | Docstring claims gatedMutation wraps journey+version inserts; body has 3 direct writes outside gatedMutation |
| journey-authoring `saveDraftTool` | ADR-0204 | ✅ compliant | tools.ts:90-111 | Uses `gatedMutation()` correctly |
| journey-authoring `checkDuplicatesTool` | ADR-0186 | ✅ compliant | tools.ts:135 | Read-only; no gate required |
| journey-authoring `lookupJourneysTool` | ADR-0186 | ✅ compliant | tools.ts:208 | Read-only; no gate required |
| journey `runDevTool` | ADR-0186 | ✅ compliant | tools.ts:116 | callGateAction before insert |
| journey `publishMissionTool` | ADR-0186 | ✅ compliant | tools.ts:435 | callGateAction before insert |
| journey `publishGuideTool` | ADR-0186 | ✅ compliant | tools.ts:667 | callGateAction before upsert |
| journey `runGuidedTool` | ADR-0186 | ✅ compliant | tools.ts:795 | callGateAction before insert |
| journey (all 4 tools) | ADR-0151 | ✅ compliant | tools.ts:103,368,591,782 | workspaceId + profileId from ctx; MISSING_CONTEXT guard present |
| contract `createEmployeeContract` | ADR-0186 | 🔴 violation | tools.ts:203-293 | No callGateAction; custom resolveActorRole() is not ADR-0099 gate |
| contract `sendEmployeeContract` | ADR-0186 | 🔴 violation | tools.ts:303-365 | No callGateAction; custom role check only |
| contract `forkTemplate` | ADR-0186 | 🔴 violation | tools.ts:414-512 | No callGateAction; direct insert at line 457 |
| contract `publishWorkspaceTemplate` | ADR-0186 | 🔴 violation | tools.ts:514-594 | No callGateAction; direct update at line 557 |
| contract `deprecateWorkspaceTemplate` | ADR-0186 | 🔴 violation | tools.ts:596-680 | No callGateAction; direct update at line 648 |
| contract (read-only tools) | ADR-0186 | ✅ compliant | tools.ts:14-173 | Read-only; no gate required |
| contract `createEmployeeContract` | ADR-0151 | ⚠️ partial | tools.ts:202,206 | `profile_id` accepted from body params (line 202 schema); workspace scoping via WHERE, not gate. `resolveActorRole` uses ctx.profileId correctly. |
| contract-intake `submitFieldGroup` | ADR-0186 | ✅ compliant | tools.ts:138 | callGateAction before write |
| contract-intake `declineIntake` | ADR-0186 | ✅ compliant | tools.ts:306 | callGateAction before RPC |
| contract-intake (all) | ADR-0151 | ✅ compliant | tools.ts:138,306 | ctx.profileId used; never from body |
| contract-intake `declineIntake` | ADR-0186 | ⚠️ partial | tools.ts:357-364 | Direct `engine_state_step` update (line 358) AFTER gate approval — inside allowed path but no second gate call; acceptable since primary gate passed |
| helpdesk_query `openTicket` | ADR-0186 | 🔴 violation | tools.ts:93-123 | Direct `channel` + `channel_member` inserts with no callGateAction |
| helpdesk_query `resolveTicket` | ADR-0186 | 🔴 violation | tools.ts:553-560 | Direct `engine_state` update with no callGateAction |
| helpdesk_query `listMyQueue` | ADR-0186 | ✅ compliant | tools.ts:376 | Read-only |
| helpdesk_query `getTicket` | ADR-0186 | ✅ compliant | tools.ts:418 | Read-only |
| helpdesk_query `openTicket` `spawnSlaBreachTrigger` | ADR-0186 | 🔴 violation | tools.ts:315-369 | Direct `engine_event` + `engine_delayed_trigger` inserts inside helper; no gate |
| helpdesk_query (all) | ADR-0151 | ✅ compliant | tools.ts | profileId from ctx; workspace_id cross-checked |
| operations `createDeviation` | ADR-0186 | 🔴 violation | tools.ts:198-209 | Direct `.from("deviation").insert()` — no callGateAction |
| operations `completeTask` | ADR-0186 | 🔴 violation | tools.ts:243-249 | Direct `.from("session_task").update()` — no callGateAction |
| operations read tools | ADR-0186 | ✅ compliant | tools.ts | Read-only |
| operations (all) | ADR-0151 | ✅ compliant | tools.ts | ctx.profileId + ctx.workspaceId |
| shift-lifecycle (all) | ADR-0186 | ✅ compliant | tools.ts:156,281,421,479,591 | callGateAction before every mutation |
| shift-lifecycle (all) | ADR-0151 | ✅ compliant | tools.ts | ctx.profileId only; shift ownership via server-side query |
| shift-lifecycle `clockInCheck` | ADR-0151 | ⚠️ partial | tools.ts:576-583 | `profile_id` accepted from body (schema line 578); tool description notes must match ctx.profileId — no server enforcement |
| shift-swap (all mutations) | ADR-0186 | ✅ compliant | tools.ts:165,235,306 | callGateAction before every mutation RPC |
| shift-swap | ADR-0151 | ✅ compliant | tools.ts:165,235,306 | actor_profile_id from ctx.profileId; comment confirms ADR-0151 |
| guardian (all) | ADR-0186 | ✅ compliant | tools.ts | Only `acknowledgeSignal` mutates; no callGateAction present |
| guardian `acknowledgeSignal` | ADR-0186 | ⚠️ partial | tools.ts:83-88 | Direct update; no callGateAction. Workspace-scoped WHERE. ADR-0186 requires gate. |
| guardian | ADR-0151 | ✅ compliant | tools.ts:64,83 | ctx.workspaceId + ctx.profileId |
| profile (all) | ADR-0186 | ✅ compliant | tools.ts | All read-only |
| profile | ADR-0151 | ✅ compliant | tools.ts:19,39 | ctx.profileId used; never body-derived |
| memory `saveMemoryTool` | ADR-0186 | ✅ compliant | tools.ts:159 | callGateAction (SS-1 fix); four-eyes properly handled |
| memory | ADR-0151 | ✅ compliant | tools.ts:164 | entityId = ctx.profileId |
| payroll (all mutations) | ADR-0186 | ✅ compliant | tools.ts:77,171,238,321,389,474 | callGateAction before every mutation |
| payroll | ADR-0151 | ✅ compliant | tools.ts:93-100 | Workspace membership verify-before-use on all cross-profile reads |
| availability (all) | ADR-0186 | ✅ compliant | tools.ts:78,166,270 | callGateAction before every mutation/read |
| availability | ADR-0151 | ✅ compliant | tools.ts:98-99 | profile_id = ctx.profileId on insert |
| training (all) | ADR-0186 | ✅ compliant | tools.ts | All read-only; no mutations |
| governance `checkReadiness` | ADR-0186 | ✅ compliant | tools.ts | Read-only; documented intentionally ungated |
| schedule (all) | ADR-0186 | ✅ compliant | tools.ts | All read-only |
| schedule `getShiftColleagues` | ADR-0151 | ⚠️ partial | tools.ts:123 | `.eq("id", params.shift_id)` — PK is `schedule_shift_id`; wrong column, always-empty result (bug, not security) |
| communication `sendMessage` | ADR-0186 | ⚠️ partial | tools.ts:173-179 | Direct `channel_message` insert; no callGateAction. `isAiAllowedInChannel` gate is policy-only, not ADR-0099 authority gate |
| communication (reads) | ADR-0186 | ✅ compliant | tools.ts | Read-only |
| billing-query (all) | ADR-0186 | ✅ compliant | tools.ts | All read-only; company scoping via resolveCompanyId |
| billing-query `getUsageSnapshot` | ADR-0151 | ⚠️ partial | tools.ts:257-258 | `workspace_id` accepted from body params; not server-derived. resolveCompanyId anchors company but workspace_id filter is body-supplied |
| kb_query `searchKb` | ADR-0186 | ✅ compliant | tools.ts | Read-only RPC |
| personal (mutations) | ADR-0186 | ✅ compliant | tools.ts:85,161,239 | callGateAction before every write |
| personal `get_history` | ADR-0186 | ✅ compliant | tools.ts:360 | Read-only; documented ungated |
| tips (all) | ADR-0186 | ✅ compliant | tools.ts | All return not_implemented — no mutations |
| tips | ADR-0196 | ✅ compliant | tools.ts | No phantom emit in skeletons |
| legal (all stubs) | ADR-0186 | ✅ compliant | tools.ts | Stubs; `classifyAmendment` is server-only; no live mutations yet |
| mission (all) | ADR-0186 | ✅ compliant | tools.ts | All read-only; documented no gate |
| operations-intelligence `triageEvent` | ADR-0186 | ✅ compliant | tools.ts | Read-only classification; no mutations |
| ui (all) | ADR-0186 | ✅ compliant | tools.ts | No DB mutations — WebSocket broadcast only |
| journey-authoring `publishDraftTool` | ADR-0173 | 🔴 violation | tools.ts:444-487 | Writes to `journey`+`journey_version` (frozen-4 namespace) from journey_authoring; ADR-0240 requires delegation to journey.publish_mission |

---

## Per-ADR Rollup

### ADR-0151 — profile_id server-derivation
- Compliant: 20 capabilities
- Partial: 3 (contract — body param `profile_id` accepted; shift-lifecycle `clockInCheck` — body param; billing-query `getUsageSnapshot` — body `workspace_id`)
- Violation: 0

### ADR-0173 — frozen-4 capability boundary
- Compliant: 24 capabilities
- Violation: 1 (`journey-authoring/publishDraftTool` writes directly to `journey` + `journey_version`)

### ADR-0186 — gatedMutation / callGateAction required for every write
- Compliant: 14 capabilities (guardian read-only class; profile; training; governance; schedule; kb_query; billing-query; tips-stubs; legal-stubs; mission; ui; memory; payroll; availability)
- Partial: 4 (guardian `acknowledgeSignal` — direct update; communication `sendMessage` — policy-only gate; contract-intake `declineIntake` — secondary write after gate; schedule — read-only so N/A)
- Violation: 5 (contract mutations; helpdesk_query mutations; operations mutations; journey-authoring `publishDraftTool`)

### ADR-0204 — gatedMutation pattern (gatedUpdate / cascade_gate_write)
- Compliant: 1 explicit user (`journey-authoring/saveDraftTool`)
- Violation: 1 (`journey-authoring/publishDraftTool` — docstring claims compliance, body does not)
- Not applicable: most capabilities use `callGateAction` pattern (ADR-0186), which is the pre-ADR-0204 gate; migration to gatedMutation is in progress

### ADR-0238 — Botsson surface disambiguation
- Compliant: all (no capability tool mounts BotssonShell; ADR-0238 is a page-layer concern)
- N/A: 25 (capability tools do not render UI)

### ADR-0240 — journey-authoring tool boundary
- Compliant: 3 (`saveDraftTool`, `checkDuplicatesTool`, `lookupJourneysTool`)
- Violation: 1 (`publishDraftTool` — writes to `journey` + `journey_version` directly instead of delegating to `journey.publish_mission`)

### L-0176 — docstring claims vs body reality
- Clean: 24 capabilities
- Violation: 1 (`journey-authoring/publishDraftTool` line 284 docstring vs lines 444-487 body)

### L-0177 — workspace_id from body-supplied row without fail-fast
- Clean: 24 capabilities
- Partial: 1 (billing-query `getUsageSnapshot` — `workspace_id` from body, anchored on company but not server-resolved; not a silent fallback but also not server-derived)
