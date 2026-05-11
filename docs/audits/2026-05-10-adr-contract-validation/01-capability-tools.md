---
title: Audit Slice 01 — Capability Tools
status: done
updated: 2026-05-10
created: 2026-05-10
module: agent-ai
tags: [audit, capabilities, adr-0151, adr-0186, adr-0204, l-0176, l-0177]
---

# Audit Slice 01 — Capability Tools

**Run date:** 2026-05-10  
**Branch:** campaign/botsson-arena  
**Surface:** `packages/ai/src/capabilities/**/tools.ts` (28 files)  
**ADR cluster:** ADR-0078, ADR-0099, ADR-0134, ADR-0151, ADR-0173, ADR-0186, ADR-0196, ADR-0204, ADR-0240  
**Mandatory traps:** L-0176 (docstring vs body), L-0177 (silent workspace fallback)  
**Known FPs applied:** FP-001 (validate_aml_14_6 channel inversion), FP-002 (Riksavtalen tariff rates), FP-003 (useRoster dept filter), FP-004 (WalkAiProvider crash)  
**Auditor:** system-agent-coordinator (Sonnet 4.6)

---

## Summary Table

| Finding | Severity | Capability | Tool(s) | ADR/Rule |
|---------|----------|-----------|---------|----------|
| F-CT-01 | HIGH | billing-query | all 6 | L-0176: file header claims emit() on every invocation; body has zero emit() calls |
| F-CT-02 | HIGH | communication | sendMessage | ADR-0099/ADR-0196 Inv-13: mutation INSERT without callGateAction or gatedMutation |
| F-CT-03 | HIGH | guardian | acknowledgeSignal | ADR-0099/ADR-0204: mutation UPDATE without gate; also missing emit() (ADR-0186) |
| F-CT-04 | MEDIUM | onboarding | add_key_fact | ADR-0099: delegates to saveMemory() which lacks gate; tool has no C4 gate protection |
| F-CT-05 | MEDIUM | personal | addNote, createTask, setReminder, updateSetting | ADR-0204: callGateAction then direct DB write, not gatedMutation wrapper |
| F-CT-06 | LOW | onboarding | scrape_website | ADR-0196 Inv-11 spirit: emit fires before external call, not after success |
| F-CT-07 | LOW | profile | getProfile | Missing workspace_id scope on profile read (safe by UUID PK, no belt-and-suspenders) |

**Capabilities audited:** availability, billing-query, business-intelligence, communication, contract, contract-intake, engine-world, governance, guardian, helpdesk_query, journey-authoring, journey, kb_query, legal, memory, mission, onboarding, operations-intelligence, operations, payroll, personal, profile, schedule, shift-lifecycle, shift-swap, tips, training, ui  
**Total tools traced:** ~90 (across 28 capabilities)  
**PASS (no findings):** 20 capabilities  
**FINDINGS:** 5 capabilities (7 findings: 3 HIGH, 2 MEDIUM, 2 LOW)

---

## Findings

---

### F-CT-01 [HIGH] — billing-query: L-0176 docstring vs body mismatch (emit)

**File:** `packages/ai/src/capabilities/billing-query/tools.ts`  
**Lines:** header comment lines 1–17 vs all tool execute() bodies  
**ADR/Rule:** L-0176, ADR-0186 (telemetry contract)

**Evidence:**  
File header states: `"ADR-0134: emit() called on every tool invocation (called + cost-events)"`.  
Body reality: Zero `emit()` calls in any of the 6 tool execute() functions. No import of `@smartout/telemetry`. The word "emit" does not appear in the function bodies.

Tools affected: `listMyInvoices`, `getMyInvoice`, `explainInvoiceBasis`, `listOverdue`, `listInvoiceDispatches`, `getUsageSnapshot`.

**Risk:** Billing reads produce no activity_trail entries, no PostHog events, no engine_event routing for any billing access. Audit trail is blind to all AI-surfaced invoice reads. If any of these tools evolve to return PII or trigger side effects, the missing telemetry will not be added because the docstring already claims compliance.

**Recommendation:** Add `emit("billing_query called", ...)` per tool invocation (or a single wrapper emit per billing query session). Remove the header claim until bodies satisfy it. Tools are read-only so gate is not required — only telemetry is missing.

---

### F-CT-02 [HIGH] — communication: sendMessage mutation without gate

**File:** `packages/ai/src/capabilities/communication/tools.ts`  
**Lines:** sendMessage execute() body, INSERT to `channel_message` (approx lines 174–184)  
**ADR/Rule:** ADR-0099, ADR-0196 Invariant 13, ADR-0204

**Evidence:**  
`sendMessage` execute():
1. Checks `channel_member` membership
2. Calls `isAiAllowedInChannel()` policy function
3. Calls `.from("channel_message").insert({...})` directly
4. Calls `emit("channel.message.sent", ...)` after insert

Step 3 has no `callGateAction(...)` or `gatedMutation(...)` before the INSERT. The `isAiAllowedInChannel()` check is an application-level policy guard — it is NOT the C4 gate_action authority system (engine_authority_config / gate_evaluation rows). ADR-0196 Invariant 13 states: "gate_action is mandatory on every mutation regardless of default authority level."

**Risk:** The channel_message INSERT bypasses the C4 authority chain entirely. There is no gate_evaluation row for any channel message AI sends. A workspace admin cannot inspect, override, or audit-trail the authority decision. Four-eyes escalation is impossible.

**Recommendation:** Add `callGateAction(supabase, ctx.workspaceId, ctx.profileId, { capability: "communication.send_message", channel, actionType: "send_message", entityId: channelId })` before the INSERT. Keep `isAiAllowedInChannel` as a pre-gate policy check — it's additive, not a replacement.

---

### F-CT-03 [HIGH] — guardian: acknowledgeSignal mutation without gate or emit

**File:** `packages/ai/src/capabilities/guardian/tools.ts`  
**Lines:** `acknowledgeSignal` execute() body (approx lines 58–92)  
**ADR/Rule:** ADR-0099, ADR-0196 Invariant 13, ADR-0204, ADR-0186

**Evidence:**  
`acknowledgeSignal` execute():
1. No channel guard
2. No `callGateAction(...)`
3. No `gatedMutation(...)`
4. Direct `.from("guardian_signal").update({ status: "acknowledged", acknowledged_by: ctx.profileId, acknowledged_at: ... })` with `.eq("workspace_id", ctx.workspaceId).eq("signal_id", params.signal_id)`
5. No `emit(...)` after update

Two violations:
- **ADR-0099/ADR-0204**: Mutation without gate — the guardian signal acknowledgement mutates audit-relevant state with no authority record.
- **ADR-0186**: Missing emit — the update produces no activity_trail, PostHog, or engine_event entries.

Read-only tools `getSignals` and `getWorkspaceHealth` correctly omit gate/emit (read-only per L-0094).

**Risk:** Guardian signal acknowledgement is an audit-relevant action (it changes what the platform considers "seen" vs "unseen"). Without gate: no authority chain. Without emit: no audit trail. This is particularly bad for a guardian capability that exists to provide oversight.

**Recommendation:**
1. Add `callGateAction` with capability `"guardian.acknowledge"` before the UPDATE.
2. Add `emit("guardian signal_acknowledged", ...)` after successful UPDATE.

---

### F-CT-04 [MEDIUM] — onboarding: add_key_fact bypasses C4 gate via saveMemory() delegation

**File:** `packages/ai/src/capabilities/onboarding/tools.ts`  
**Lines:** `add_key_fact` execute() body (approx lines 760–790)  
**ADR/Rule:** ADR-0099, ADR-0196 Invariant 13

**Evidence:**  
`add_key_fact` calls `saveMemory(ctx, ...)` from `packages/ai/src/capabilities/memory/memory-writer.ts` directly. The `saveMemory()` function does NOT call `gate_action` — only `saveMemoryTool.execute()` does (which delegates to the same `saveMemory()` after calling `callGateAction` first).

`add_key_fact` skips the gate step that `saveMemoryTool.execute()` does. Both end up writing to `engine_memory`. One has C4 gate protection; the other does not.

`add_key_fact` does have `assertCtxIds(ctx)` (ADR-0134 guard) — the identity check is present, but authority check is absent.

**Risk:** An LLM can write arbitrary strings to `engine_memory` via the onboarding `add_key_fact` tool without any C4 authority record. If the workspace has `memory` capability set to `confirm` authority, that configuration is silently bypassed.

**Recommendation:** Add `callGateAction(supabase, ctx.workspaceId, ctx.profileId, { capability: "memory.save", channel, actionType: "add_key_fact" })` before calling `saveMemory()` in `add_key_fact`. Or: delegate to `saveMemoryTool.execute(...)` directly so the gate is inherited.

---

### F-CT-05 [MEDIUM] — personal: callGateAction-then-direct-write pattern (ADR-0204 gap)

**File:** `packages/ai/src/capabilities/personal/tools.ts`  
**Lines:** `addNote`, `createTask`, `setReminder`, `updateSetting` execute() bodies  
**ADR/Rule:** ADR-0204

**Evidence:**  
All four mutation tools follow the pattern:
1. Call `callGateAction(...)` — gate check recorded in gate_evaluation
2. If gate allows: call `.from(...).insert(...)` or `.from(...).update(...)` directly (no `gatedMutation()` wrapper)

ADR-0204 requires domain writes to route through `gatedMutation()` which provides two pathways: Pathway A (gate_action) and Pathway B (cascade_gate_write framework trigger). The direct-write-after-callGateAction pattern satisfies Pathway A only.

Tables written directly: `engine_memory`, `personal_task`, `engine_event`, `engine_trigger`, `engine_delayed_trigger`.

**Risk:** Pathway B (cascade_gate_write) is skipped. If the framework trigger is load-bearing for change proposals or four-eyes escalation, those flows are unreachable for personal capability writes. The gate_evaluation row exists but the domain write is not atomically coupled to the gate decision.

**Recommendation:** Refactor the four mutation tools to wrap DB writes in `gatedMutation()`. This is a mechanical refactor — the `callGateAction` call moves inside `gatedMutation`'s gate options. Priority: medium (lower than F-CT-01 through F-CT-03 since callGateAction is present).

---

### F-CT-06 [LOW] — onboarding: scrape_website pre-emit before external call

**File:** `packages/ai/src/capabilities/onboarding/tools.ts`  
**Lines:** `scrape_website` execute() body  
**ADR/Rule:** ADR-0196 Invariant 11 (spirit)

**Evidence:**  
`scrape_website` emits `"onboarding.scrape_completed"` with `phase: "called"` BEFORE the external scrapling call. Then emits the same event again with `phase: "completed"` after. Invariant 11 states: "emit() fires ONLY after successful DB commit" — by extension, emitting a "completed" event before the action completes is semantically misleading.

The pre-emit approach is intentional per inline comment ("for audit trail of the call itself"). However, using the same event name `"onboarding.scrape_completed"` for both phases is confusing — a consumer filtering on that event gets two hits per scrape, with only the second being an actual completion.

**Risk:** LOW — no gate or telemetry is missing; the duplication is an audit-trail quality issue. Event consumers that count `"onboarding.scrape_completed"` events will double-count scrape invocations.

**Recommendation:** Use distinct event names: `"onboarding.scrape_started"` for the pre-call emit and `"onboarding.scrape_completed"` for the post-call emit. Update the telemetry registry accordingly.

---

### F-CT-07 [LOW] — profile: getProfile missing workspace_id scope

**File:** `packages/ai/src/capabilities/profile/tools.ts`  
**Lines:** `getProfile` execute() body  
**ADR/Rule:** ADR-0151 (defense-in-depth)

**Evidence:**  
`getProfile` queries `profile` table with `.eq("profile_id", ctx.profileId)` only. No `.eq("workspace_id", ctx.workspaceId)` filter. Since `profile_id` is a UUID PK, this is safe in practice — a profile_id cannot be guessed and RLS should enforce workspace isolation. However, ADR-0151 mandates that workspace_id is always server-derived and applied as a query filter (defense-in-depth).

The other 3 tools in the capability (`getTeam`, `getContractStatus`, `searchProfilesByName`) all apply workspace_id scope.

**Risk:** LOW — UUID PK makes cross-workspace leakage practically impossible. RLS provides the real guard. This is a missing belt-and-suspenders filter, not a direct vulnerability.

**Recommendation:** Add `.eq("workspace_id", ctx.workspaceId)` to the `getProfile` query for consistency with ADR-0151 and the other tools in this capability.

---

## Per-Capability Per-Tool Tables

### availability (3 tools)

| Tool | gate (callGateAction / gatedMutation) | emit() present | workspace_id source | Verdict |
|------|--------------------------------------|---------------|---------------------|---------|
| setOwnAvailability | callGateAction before INSERT | yes | ctx.workspaceId | PASS |
| clearOwnAvailability | callGateAction before UPDATE | yes | ctx.workspaceId | PASS |
| queryOthersAvailability | read-only (no gate required) | yes | ctx.workspaceId | PASS |

---

### billing-query (6 tools) — F-CT-01

| Tool | gate (callGateAction / gatedMutation) | emit() present | workspace_id source | Verdict |
|------|--------------------------------------|---------------|---------------------|---------|
| listMyInvoices | read-only (not required) | NO (body) | resolveCompanyId(ctx) | FAIL — L-0176 |
| getMyInvoice | read-only (not required) | NO (body) | resolveCompanyId(ctx) | FAIL — L-0176 |
| explainInvoiceBasis | read-only (not required) | NO (body) | resolveCompanyId(ctx) | FAIL — L-0176 |
| listOverdue | read-only (not required) | NO (body) | resolveCompanyId(ctx) | FAIL — L-0176 |
| listInvoiceDispatches | read-only (not required) | NO (body) | resolveCompanyId(ctx) | FAIL — L-0176 |
| getUsageSnapshot | read-only (not required) | NO (body) | resolveCompanyId(ctx) | FAIL — L-0176 |

Note: Header claims "ADR-0134: emit() called on every tool invocation". All 6 bodies have zero emit() calls and no @smartout/telemetry import.

---

### business-intelligence (6 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| scrapeBusiness | read-only | yes (called+cost events) | ctx.workspaceId | PASS |
| lookupBrreg | read-only | yes | ctx.workspaceId | PASS |
| getIndustryDefaults | read-only | yes | ctx.workspaceId | PASS |
| extractKeyFacts | read-only | yes | ctx.workspaceId | PASS |
| mergeBusinessData | read-only | yes | ctx.workspaceId | PASS |
| classifyBusiness | read-only | yes | ctx.workspaceId | PASS |

---

### communication (5 tools) — F-CT-02

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| listChannels | read-only | yes | ctx.workspaceId | PASS |
| getChannelHistory | read-only | yes | ctx.workspaceId | PASS |
| sendMessage | MISSING — INSERT without callGateAction/gatedMutation | yes (post-insert) | ctx.workspaceId | FAIL — ADR-0099 |
| searchMessages | read-only | yes | ctx.workspaceId | PASS |
| summarizeChannel | read-only | yes | ctx.workspaceId | PASS |

---

### contract (10 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| getContractTemplate | read-only | no (read-only acceptable) | ctx.workspaceId | PASS |
| listWorkspaceTemplates | read-only | no | ctx.workspaceId | PASS |
| previewContract | read-only | no | ctx.workspaceId | PASS |
| createEmployeeContract | gateMutation() (callGateAction internal) | yes | ctx.workspaceId | PASS |
| sendEmployeeContract | gateMutation() | yes | ctx.workspaceId | PASS |
| getContractStatus | read-only | no | ctx.workspaceId | PASS |
| listPendingSignatures | read-only | no | ctx.workspaceId | PASS |
| forkTemplate | gateMutation() | yes | ctx.workspaceId | PASS |
| publishWorkspaceTemplate | gateMutation() | yes | ctx.workspaceId | PASS |
| deprecateWorkspaceTemplate | gateMutation() | yes | ctx.workspaceId | PASS |

---

### contract-intake (3 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| getIntakeProgress | read-only (PII presence only, not value) | no | ctx.workspaceId | PASS |
| submitFieldGroup | callGateAction before RPC | yes | ctx.workspaceId | PASS |
| declineIntake | callGateAction before RPC | yes | ctx.workspaceId | PASS |

---

### engine-world (3 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| read_surface | read-only (per L-0094) | no | ctx.workspaceId | PASS |
| read_surface_class | read-only (per L-0094) | no | ctx.workspaceId | PASS |
| report_observation | gatedMutation() (ADR-0204 Pathway A+B) | yes (observation_written + status_changed) | ctx.workspaceId (ADR-0151 enforced) | PASS |

Note: Gold-standard ADR-0204 implementation. Pre-UPSERT read for status_changed detection is correct.

---

### governance (1 tool)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| checkReadiness | read-only | no | ctx.workspaceId | PASS |

---

### guardian (3 tools) — F-CT-03

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| getSignals | read-only | no (L-0094) | ctx.workspaceId | PASS |
| getWorkspaceHealth | read-only | no (L-0094) | ctx.workspaceId | PASS |
| acknowledgeSignal | MISSING — UPDATE without callGateAction or gatedMutation | MISSING | ctx.workspaceId | FAIL — ADR-0099 + ADR-0186 |

---

### helpdesk_query (4 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| listMyQueue | read-only | no | ctx.workspaceId | PASS |
| getTicket | read-only | no | ctx.workspaceId | PASS |
| openTicket | callGateAction before INSERT | yes | ctx.workspaceId | PASS |
| resolveTicket | callGateAction before UPDATE | yes | ctx.workspaceId | PASS |

Note: `spawnSlaBreachTrigger` / `cancelSlaBreachTrigger` are internal helpers called only within gated tool paths — not standalone tools.

---

### journey-authoring (4 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| checkDuplicates | read-only | no | ctx.workspaceId | PASS |
| lookupJourneys | read-only | no | ctx.workspaceId | PASS |
| saveDraft | gatedMutation() | yes | ctx.workspaceId | PASS |
| publishDraft | gatedMutation() (wraps 3 writes; ADR-0240 cross-namespace mitigated) | yes | ctx.workspaceId | PASS |

---

### journey (4 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| lookupJourneys | read-only | no | ctx.workspaceId | PASS |
| checkDuplicates | read-only | no | ctx.workspaceId | PASS |
| saveDraft | callGateAction before INSERT | yes | ctx.workspaceId | PASS |
| publishMission | callGateAction before INSERT | yes (post-IR-validation only, Inv-11 correct) | ctx.workspaceId | PASS |

---

### kb_query (1 tool)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| searchKb | read-only RPC | no | ctx.workspaceId | PASS |

---

### legal (3 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| validateAml146 | read-only (FP-001 applies) | yes | ctx.workspaceId | PASS |
| citeLaw | read-only | yes | ctx.workspaceId | PASS |
| classifyAmendment | callGateAction (default_allow: false per ADR-0249) | yes | ctx.workspaceId | PASS |

---

### memory (1 tool)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| saveMemoryTool | callGateAction + four-eyes discrimination (not string match — L-0133) | yes (delegated to saveMemory post-gate) | ctx.workspaceId | PASS |

---

### mission (2 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| getActiveMissions | read-only | no (explicit) | ctx.workspaceId | PASS |
| getWorkspaceRoadmap | read-only | no (explicit) | ctx.workspaceId | PASS |

---

### onboarding (10 tools) — F-CT-04, F-CT-06

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| update_business | callGateAction before UPDATE | yes | ctx.workspaceId | PASS |
| update_season | callGateAction before 2 UPSERTs | yes | ctx.workspaceId | PASS |
| add_departments | in-memory only, no DB (intentional per 2026-05-04 decision) | no (no mutation) | ctx.workspaceId | PASS |
| add_locations | in-memory only | no | ctx.workspaceId | PASS |
| add_zones | in-memory only | no | ctx.workspaceId | PASS |
| add_procedures | callGateAction + Layer 3 voice guard | yes | ctx.workspaceId | PASS |
| scrape_website | read-only external call | yes (pre+post, same event name — F-CT-06) | ctx.workspaceId | WARN — F-CT-06 |
| search_company | read-only | no (asymmetric with scrape_website) | ctx.workspaceId | PASS |
| identify_company | read-only | no | ctx.workspaceId | PASS |
| add_key_fact | MISSING callGateAction — delegates to saveMemory() directly | yes (delegated) | ctx.workspaceId | FAIL — F-CT-04 |

---

### operations-intelligence (1 tool)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| triageEvent | read-only (classification, no domain write) | yes | ctx.workspaceId | PASS |

---

### operations (5 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| getMyTasks | read-only | no | ctx.workspaceId | PASS |
| getSessionInfo | read-only | no | ctx.workspaceId | PASS |
| getDepartmentStatus | read-only | no | ctx.workspaceId | PASS |
| createDeviation | callGateAction before INSERT | yes | ctx.workspaceId | PASS |
| completeTask | callGateAction before UPDATE | yes | ctx.workspaceId | PASS |

---

### payroll (6 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| getPayrollSummary | assertChatChannel() + callGateAction | yes | ctx.workspaceId | PASS |
| getPayPeriods | assertChatChannel() + callGateAction | yes | ctx.workspaceId | PASS |
| getLedgerEntries | assertChatChannel() + callGateAction | yes | ctx.workspaceId | PASS |
| reconcilePeriod | assertChatChannel() + callGateAction | yes | ctx.workspaceId | PASS |
| exportLedger | assertChatChannel() + callGateAction | yes | ctx.workspaceId | PASS |
| validateAml14 | assertChatChannel() + callGateAction | yes | ctx.workspaceId | PASS |

Note: ADR-0151 compliance via `.eq("workspace_id", ctx.workspaceId)` on target profile queries.

---

### personal (5 tools) — F-CT-05

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| getHistory | read-only | yes | ctx.workspaceId | PASS |
| addNote | callGateAction then direct INSERT to engine_memory (no gatedMutation) | yes | ctx.workspaceId | WARN — F-CT-05 |
| createTask | callGateAction then direct INSERT to personal_task | yes | ctx.workspaceId | WARN — F-CT-05 |
| setReminder | callGateAction then direct INSERT to engine_event/engine_trigger | yes | ctx.workspaceId | WARN — F-CT-05 |
| updateSetting | callGateAction then direct UPDATE to engine_delayed_trigger | yes | ctx.workspaceId | WARN — F-CT-05 |

Note: Pathway A (gate_action record) present; Pathway B (cascade_gate_write) absent.

---

### profile (4 tools) — F-CT-07

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| getProfile | read-only | no | ctx.profileId only — missing workspace_id scope (F-CT-07) | WARN — F-CT-07 |
| getTeam | read-only | no | ctx.workspaceId | PASS |
| getContractStatus | read-only | no | ctx.workspaceId | PASS |
| searchProfilesByName | read-only | no | ctx.workspaceId | PASS |

---

### schedule (4 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| getMyShifts | read-only | no | ctx.workspaceId | PASS |
| getShiftColleagues | read-only | no | ctx.workspaceId | PASS |
| getTodaySchedule | read-only | no | ctx.workspaceId | PASS |
| getShiftDetail | read-only | no | ctx.workspaceId | PASS |

---

### shift-lifecycle (5 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| publishShift | callGateAction + readiness gate (WS-A4) + Layer 3 voice guard | yes (gate_denied + success paths) | ctx.workspaceId | PASS |
| approveShift | callGateAction + readiness gate (WS-A4) + chat-only guard | yes (four_eyes_pending + denied + success) | ctx.workspaceId | PASS |
| interpretShift | callGateAction + system-only guard | yes | ctx.workspaceId | PASS |
| settleShift | callGateAction + system-only guard + idempotency check | yes (idempotent_hit flag) | ctx.workspaceId | PASS |
| clockInCheck | callGateAction + voice guard | yes (obligation_overdue, conditional) | ctx.workspaceId | PASS |

Note: Emit on readiness_gap denial is present — this is correct (the gate is soft-denied, event records the gap). Invariant 11 still holds: no domain write occurs on denial paths.

---

### shift-swap (5 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| getSwapRequests | read-only | no | ctx.workspaceId | PASS |
| getSwapEligibility | read-only | no | ctx.workspaceId | PASS |
| requestSwap | callGateAction before RPC + chat-only guard | yes (shift_swap.requested) | ctx.workspaceId | PASS |
| respondToSwap | callGateAction before RPC + chat-only guard | yes (shift_swap.accepted or rejected) | ctx.workspaceId | PASS |
| cancelSwap | callGateAction before RPC + chat-only guard | yes (shift_swap.cancelled) | ctx.workspaceId | PASS |

---

### tips (4 tools — Sortie 1 skeletons)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| tipsSetPotTool | skeleton — returns not_implemented, no DB write | no (ADR-0196 Inv-11 correct) | n/a | PASS — skeleton |
| tipsAdjustShareTool | skeleton | no | n/a | PASS — skeleton |
| tipsApproveDistributionTool | skeleton | no | n/a | PASS — skeleton |
| tipsQueryOwnShareTool | skeleton | no | n/a | PASS — skeleton |

Note: Skeletons correctly omit gate and emit per ADR-0196 Invariant 11 — no phantom emit before body lands in Sortie 2/3.

---

### training (3 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| getMyTrainingStatus | read-only | no | ctx.workspaceId | PASS |
| getNextProtocol | read-only | no | ctx.workspaceId | PASS |
| getTeamReadiness | read-only + RPC | no | ctx.workspaceId | PASS |

---

### ui (5 tools)

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| navigateTool | side-effect via ctx.broadcast (no DB write) | no (UI commands, not domain mutations) | ctx.sessionId only | PASS |
| fillFieldTool | side-effect via ctx.broadcast | no | ctx.sessionId only | PASS |
| highlightTool | side-effect via ctx.broadcast | no | ctx.sessionId only | PASS |
| showPanelTool | side-effect via ctx.broadcast | no | ctx.sessionId only | PASS |
| toastTool | side-effect via ctx.broadcast | no | ctx.sessionId only | PASS |

Note: UI tools have no DB writes. Gate and emit are inapplicable. broadcast is side-effect-only.

---

## Remediation Priority

1. **F-CT-02 (HIGH)** — `communication/sendMessage`: Add `callGateAction` before INSERT. Blocking for any workspace with `communication` capability at `confirm` authority or higher. One-sortie fix.

2. **F-CT-03 (HIGH)** — `guardian/acknowledgeSignal`: Add `callGateAction` + `emit`. Blocking for platform-admin guardian oversight integrity. One-sortie fix.

3. **F-CT-01 (HIGH)** — `billing-query` header L-0176: Add emit per tool or remove false header claim. Audit trail integrity for all billing reads. One-sortie fix (add emit wrapper or drop claim).

4. **F-CT-04 (MEDIUM)** — `onboarding/add_key_fact`: Add `callGateAction` before `saveMemory()`. Low blast radius but silent authority bypass. Can bundle with next onboarding sortie.

5. **F-CT-05 (MEDIUM)** — `personal/*` tools: Refactor 4 tools to use `gatedMutation()`. Mechanical. Bundle as a single sortie.

6. **F-CT-06 (LOW)** — `onboarding/scrape_website`: Rename pre-call emit. Minor audit-trail quality fix.

7. **F-CT-07 (LOW)** — `profile/getProfile`: Add `.eq("workspace_id", ...)`. One-line fix. Include in next profile sortie.

---

*Audit complete. Findings are READ-ONLY. Remediation = separate sorties.*
