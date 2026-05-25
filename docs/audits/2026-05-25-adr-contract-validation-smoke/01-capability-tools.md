---
title: ADR-Contract Audit — Capability Tools (Smoke Mode)
status: done
updated: 2026-05-25
created: 2026-05-25
module: ai-capabilities
tags: [audit, adr-compliance, capability-tools, gatedMutation, telemetry]
---

# ADR-Contract Audit — Capability Tools Slice

**Date:** 2026-05-25
**Scope:** `packages/ai/src/capabilities/**` — every capability tool definition
**Mode:** Smoke (read-only analysis)
**ADR cluster:** ADR-0204, ADR-0240, ADR-0173, ADR-0151, ADR-0358, L-0175, L-0176, L-0177
**Auditor:** Agent a7fdbb9aad1e20a45

---

## Summary

| Severity | Count |
|----------|-------|
| HIGH     | 5     |
| MEDIUM   | 8     |
| LOW      | 6     |
| INFO     | 4     |

**Confidence:** HIGH (all files read; telemetry registry cross-checked)

---

## HIGH Findings

### H-1 — journey, contract, contract-intake: gate called but writes outside gatedMutation exec (ADR-0204 Pathway B not invoked)

**Affected capabilities:** `journey/tools.ts`, `contract/tools.ts`, `contract-intake/tools.ts`

These capabilities call `callGateAction` and check `gate.allow`, then perform DB writes directly outside any `gatedMutation` exec callback. This means:
- Pathway A (gate_action RPC) fires correctly.
- Pathway B (cascade_gate_write — the correlated domain write logged against the gate evaluation) **never fires**.
- The domain write is not correlated to the gate evaluation row in the audit chain.

ADR-0204 mandates both pathways. ADR-0287 mandates `mutateWithGate` (which wraps `gatedMutation`) on all mutation capability tools. These three capabilities predate ADR-0287 and were not migrated.

**Evidence:**
- `journey/tools.ts` — `publishMissionTool` calls `callGateAction`, then calls `supabase.from("engine_missions").insert(...)` directly.
- `contract/tools.ts` — mutation tools use local `gateMutation()` helper (calls `callGateAction`), then writes outside `gatedMutation` wrapper.
- `contract-intake/tools.ts` — `submitFieldGroup` calls `callGateAction`, then `userClient.rpc(...)` outside wrapper.

**Remediation:** Migrate to `mutateWithGate` (ADR-0287 wrapper in `_shared/mutate-with-gate.ts`). Each mutation body must move into the `exec` callback.

---

### H-2 — guardian/tools.ts: acknowledgeSignal inserts to guardian_log bypassing telemetry registry (ADR-0358)

**Affected:** `guardian/tools.ts` — `acknowledgeSignal` tool

The `acknowledgeSignal` mutation does NOT call `emit()`. Instead it directly inserts to `guardian_log` with `event_type: "guardian.signal_acknowledged"`. This bypasses the telemetry registry entirely — no PostHog, no activity_trail routing, no engine_event fan-out.

The registry defines `"guardian_signal acknowledged"` (with space, not dot) at line 3024. The guardian_log insert uses `"guardian.signal_acknowledged"` (dot form) which is a separate, unregistered event name.

Two sub-issues:
1. No `emit()` call at all — ADR-0358 violation (registry-without-emit-site for `guardian_signal acknowledged`).
2. The direct `guardian_log` insert creates a telemetry bypass channel — the pg_notify trigger is the only consumer, audit trail has no structured fan-out.

**Remediation:** Add `await emit({ event: "guardian_signal acknowledged", ... })` after the `guardian_log` insert. The existing direct insert can remain (it drives the pg_notify trigger) but the telemetry emit is required for audit trail routing.

---

### H-3 — training/tools.ts: no gate_action on ANY tool, including PII-exposing getTeamReadiness (ADR-0099, ADR-0151)

**Affected:** `training/tools.ts` — all 3 tools

`getMyTrainingStatus`, `getNextProtocol`, and `getTeamReadiness` have zero gate calls and zero emit calls. `getTeamReadiness` queries `display_name` for all employees — a workspace-wide PII read — with only workspace_id scoping and no gate.

ADR-0201 note (from availability/tools.ts header): "read_only does NOT mean skip the gate." For `getTeamReadiness`, this is particularly problematic: it exposes aggregate PII (display_names + training status for every employee) without any authority check beyond RLS.

**Remediation:**
1. Add `callGateAction` before `getTeamReadiness` (at minimum).
2. Add `emit()` calls with `workspace_id` + `actor_id` for all three tools.

---

### H-4 — schedule/tools.ts: no gate_action on any of 6 tools (ADR-0099, ADR-0201)

**Affected:** `schedule/tools.ts` — all 6 tools

`getMyShifts`, `getShiftColleagues`, `getTodaySchedule`, `getShiftDetail`, `getWorkspaceSchedule`, `getDateScheduleForMe` — none call `gate_action`. `getWorkspaceSchedule` performs a role check via `ctx.userContext?.role` but this is not a gate_action call.

Schedule data includes colleague assignments and full shift rosters — non-trivial PII aggregation. Per ADR-0201, read-only does not exempt from gate_action.

Note: the `agent.schedule.workspace_queried` and `agent.schedule.date_queried_self` events ARE registered in the telemetry registry (lines 4931, 4946) but `emit()` is never called from these tools.

**Remediation:** Add `callGateAction` per tool and corresponding `emit()` calls matching the registered event names.

---

### H-5 — availability/tools.ts: queryOthersAvailability accepts workspace_id as body parameter (ADR-0151)

**Affected:** `availability/tools.ts` — `queryOthersAvailability` tool

The schema accepts `workspace_id` as a parameter. The tool validates `params.workspace_id !== ctx.workspaceId` and returns an error on mismatch, but the parameter still exists in the body schema and is passed into queries.

ADR-0151 is explicit: workspace_id must be server-derived from `AgentToolContext`, never supplied from the request body. Accepting it in the schema makes it forgeable at the tool call level even if the validation block catches the obvious mismatch — the intent of ADR-0151 is that the field cannot exist in the schema at all.

**Remediation:** Remove `workspace_id` from the tool schema. Use `ctx.workspaceId` exclusively for all queries.

---

## MEDIUM Findings

### M-1 — guardian/tools.ts: acknowledgeSignal writes outside gatedMutation (ADR-0204)

Same structural issue as H-1 — `acknowledgeSignal` calls `callGateAction` then writes directly to `guardian_signal` and `guardian_log` outside a `gatedMutation` exec callback. Pathway B not invoked. Treated as MEDIUM here (also H-2 captures the telemetry bypass, which is the higher-risk element).

---

### M-2 — journey-authoring/tools.ts: no emit() calls on any tool (ADR-0358)

**Affected:** `journey-authoring/tools.ts` — all 4 tools

`saveDraftTool` and `publishDraftTool` are mutation tools that use `gatedMutation()` correctly (ADR-0204 compliant). However, neither emits via `emit()`. `checkDuplicatesTool` and `lookupJourneysTool` are read-only — less critical but should emit for analytics.

No events from this capability appear in `packages/telemetry/src/registry.ts`.

**Remediation:** Define and register journey-authoring events in the telemetry registry, then add `emit()` calls in tool bodies.

---

### M-3 — availability/tools.ts: emit calls use void emit() without nonEmpty() (inconsistency with ADR-0134)

**Affected:** `availability/tools.ts` — all 3 tools

Emit calls use `void emit({ workspace_id: ctx.workspaceId, actor_id: ctx.profileId, ... })` without `nonEmpty()` wrapping. Compare to task, shift-lifecycle, routine, day-line — all use `nonEmpty(ctx.workspaceId, "workspace_id")`. Without `nonEmpty()`, empty-string IDs silently corrupt `activity_trail` and `engine_event` routing (ADR-0134).

---

### M-4 — scheduler/tools.ts: emit calls use void emit() without nonEmpty() (ADR-0134)

Same class as M-3. `proposePlan`, `acceptProposal`, `rejectProposal` all use `void emit(...)` with `ctx.workspaceId`/`ctx.profileId` directly. Given that scheduler tools are mutation-heavy (write `change_proposal` rows), the missing `nonEmpty()` guard is higher risk here than in read-heavy capabilities.

---

### M-5 — business-intelligence/tools.ts: emit calls use void emit() without nonEmpty() (ADR-0134)

All 6 tools use `void emit(...)` without `nonEmpty()`. However, `assertCtxIds()` is called first and returns an error string on empty IDs — so the fail-fast IS present but as a soft error (returns string), not a throw. Slightly weaker than the `nonEmpty()` pattern which throws in dev/test.

---

### M-6 — contract/tools.ts, contract-intake/tools.ts: emit calls use void emit() without nonEmpty() (ADR-0134)

Mutation tools in both capabilities use `void emit(...)` with raw `ctx.workspaceId`. Same class as M-3/M-4. Combined with H-1 (writes outside gatedMutation), this makes these capabilities the lowest compliance-state pair in the codebase.

---

### M-7 — helpdesk_query/tools.ts: resolveTicket write runs outside gatedMutation (ADR-0204)

`resolveTicket` calls `callGateAction` then executes `supabase.from("engine_state").update(...)` directly. Same pattern as H-1. Gate Pathway B not invoked. This is a significant mutation (terminal state transition on engine_state with SLA trigger cancellation).

---

### M-8 — onboarding/tools.ts: update_business and update_season write outside gatedMutation (ADR-0204)

Both mutation tools call `callGateAction` then write directly. Same ADR-0204 Pathway B gap as H-1. Mitigation: `update_season` inserts a `season_budget` companion row with a comment acknowledging the gate is umbrella-scoped (`@authority-gate-companion` note), but the body remains outside `gatedMutation` exec.

---

## LOW Findings

### L-1 — journey/tools.ts: emit calls use ctx.workspaceId without nonEmpty() (ADR-0134)

`publishMissionTool` and siblings emit with raw `ctx.workspaceId`. Lower risk given the gate-then-write pattern catches missing context before mutations, but inconsistent with best-practice.

---

### L-2 — communication/tools.ts: sendMessage emit inconsistency — channel.message.sent lacks nonEmpty() while inline_confirm_card emit has it

`sendMessage` has two emit calls. The `inline_confirm_card` emit uses `nonEmpty()`. The primary `channel.message.sent` emit uses raw `ctx.workspaceId`. Inconsistency within the same tool body.

---

### L-3 — memory/tools.ts: no emit() call on save_memory tool (ADR-0358)

`save_memory` calls `callGateAction`, then `saveMemory()` (internal helper), then `recordTurn()` (internal recording hook). No `emit()` call from the tool body. The recording hook (`recordTurn`) is a no-op outside stage-engine and does not route to telemetry destinations. If the `memory.saved` event needs to appear in activity_trail or PostHog, it is currently missing.

**Note:** No `memory.*` events appear in the telemetry registry — possible intentional design (memory writes are private by default), but should be documented if intentional.

---

### L-4 — operations/tools.ts: getMyTasks and getSessionInfo have no gate, getDepartmentStatus has no gate; only createDeviation is gated

Three of four tools in `operations/tools.ts` are read-only and ungated. Lower risk, but `getMyTasks` fetches assigned task lists (session data) and `getDepartmentStatus` returns session + staffing counts. Per ADR-0201, read tools should still call gate_action.

---

### L-5 — profile/tools.ts: all 3 tools read-only, no gate, no emit

`getProfile`, `getTeam`, `getContractStatus` — no gate calls, no emit. `getContractStatus` returns contract metadata (signed_at, starts_at, ends_at, status) — arguably PII-adjacent. Consistent with older capability pattern but does not follow ADR-0201.

---

### L-6 — ui/tools.ts: navigate_to, fill_field, highlight_element — no gate, no emit

UI broadcast tools do no DB writes. No gate needed per design (broadcast via ctx.broadcast callback, not DB mutation). However, no emit means no activity_trail record of agent-initiated navigation commands. Low risk but worth noting.

---

## INFO Notes

### I-1 — channel-admin/tools/: all 6 tools are Sortie-1 skeletons returning not_implemented

All 6 channel-admin tools (`archive_channel`, `change_member_role`, `invite_to_channel`, `leave_channel`, `mute_channel`, `rename_channel`) return `{ ok: false, error: "not_implemented" }`. ADR-0196 Invariant 11 compliance: no phantom emits. Not a compliance finding — correct skeleton pattern.

---

### I-2 — tips/tools.ts: all 4 tools are Sortie-1 skeletons returning not_implemented

Same as I-1. Correct skeleton pattern.

---

### I-3 — mission/tools.ts: intentionally read-only, no gate, no emit — documented design

`getActiveMissions` and `getWorkspaceRoadmap` are explicitly documented as read-only with no gate or emit (header comment: "All tools are read-only — no gate_action call, no emit(). Voice-safe: no PII, no write mutations."). This is a design choice rather than an oversight. However, `getWorkspaceRoadmap` fetches deviations assigned to the caller — audit visibility would benefit from an emit.

---

### I-4 — governance/tools.ts: intentionally ungated per ADR-0379a

`checkReadiness` and `listMandatoryProtocolsForRole` are explicitly documented as not calling `gate_action` per ADR-0379a. This is an accepted architectural decision. Read-only, low PII exposure.

---

## Per-Capability Compliance Table

| Capability | Tools (mut/read) | gatedMutation | L-0177 fail-fast | emit + nonEmpty() | ADR-0151 | ADR-0240 | Overall |
|---|---|---|---|---|---|---|---|
| task | 5 mut / 1 read | PASS (callGateAction, not mutateWithGate) | PASS | PASS | PASS | PASS | PASS |
| availability | 3 mut | PARTIAL (callGateAction, not mutateWithGate) | PARTIAL | FAIL (no nonEmpty) | FAIL (workspace_id in schema) | PASS | MEDIUM |
| communication | 1 mut / 4 read | PARTIAL (sendMessage: double gate, no mutateWithGate) | PASS | PARTIAL (inconsistent nonEmpty) | PASS | PASS | LOW |
| schedule | 0 mut / 6 read | FAIL (no gate on any tool) | PASS | FAIL (no emit) | PASS | PASS | HIGH |
| shift-lifecycle | 5 mixed | PASS (2× mutateWithGate + 3× callGateAction+RPC) | PASS | PASS | PASS | PASS | PASS |
| journey | 4 mixed | FAIL (callGateAction but writes outside) | PASS | PARTIAL (no nonEmpty) | PASS | FAIL (acknowledged) |  HIGH |
| journey-authoring | 2 mut / 2 read | PASS (gatedMutation directly) | PASS | FAIL (no emit at all) | PASS | MEDIUM (acknowledged) | MEDIUM |
| shift-swap | 6 mixed | PASS (double-gate documented) | PASS | PASS | PASS | PASS | PASS |
| contract | 5 mut / 5 read | FAIL (callGateAction + writes outside) | PASS | FAIL (no nonEmpty) | PASS | PASS | HIGH |
| contract-intake | 2 mut / 1 read | FAIL (callGateAction + writes outside) | PASS | FAIL (no nonEmpty) | PASS | PASS | HIGH |
| routine | 4 mixed | PASS (callGateAction; attachToLine delegates) | PASS | PASS (nonEmpty used) | PASS | PASS | PASS |
| governance | 2 read | N/A (intentional, ADR-0379a) | PASS | N/A | PASS | PASS | PASS (by design) |
| training | 3 read | FAIL (no gate on any) | PASS | FAIL (no emit) | PASS | PASS | HIGH |
| org | 1 mut | PASS (callGateAction) | PASS | PASS (await emit + nonEmpty) | PASS | PASS | PASS |
| scheduler | 3 mut | PASS (mutateWithGate) | PASS | PARTIAL (no nonEmpty) | PASS | PASS | MEDIUM |
| day-line | 4 mixed | PASS (callGateAction; delegates per ADR-0240) | PASS | PASS (nonEmpty used) | PASS | PASS | PASS |
| guardian | 3 mixed | FAIL (callGateAction + writes outside) | PASS | FAIL (direct guardian_log, no emit) | PASS | PASS | HIGH |
| billing-query | 6 read | N/A (read-only, company-scoped) | PASS (resolveCompanyId throws) | N/A | PASS | PASS | PASS |
| bootstrap | 2 mut / 1 read | PASS (callGateAction) | PASS | PASS (nonEmpty used) | PASS | PASS | PASS |
| bulk_import | 1 read | N/A (read-only) | PASS (storage path prefix check) | PASS (await emit) | PASS | PASS | PASS |
| business-intelligence | 6 read | N/A (external proxy, no DB writes) | PARTIAL (soft assertCtxIds, not throw) | PARTIAL (no nonEmpty) | PASS | PASS | LOW |
| cascade | 2 mut | PASS (mutateWithGate) | PASS (explicit checks) | PASS (await emit) | PASS | PASS | PASS |
| engine-world | 2 read / 1 mut | PASS (gatedMutation directly) | PASS | PASS (void emit, ADR-0134 guard above) | PASS | PASS | PASS |
| helpdesk_query | 2 mut / 2 read | FAIL (callGateAction + resolveTicket writes outside) | PASS | PASS (open_ticket emit) | PASS | PASS | MEDIUM |
| kb_query | 1 read | N/A (RPC-only) | PASS | N/A | PASS | PASS | PASS |
| legal | 4 mixed | PASS (classify_amendment: callGateAction; validate_aml_14_6: no gate needed) | PASS | PASS (void emit) | PASS | PASS | PASS |
| memory | 1 mut | PASS (callGateAction) | PASS | FAIL (no emit) | PASS | PASS | LOW |
| mission | 2 read | N/A (documented: read-only, no gate) | PASS | N/A | PASS | PASS | INFO |
| onboarding | 6 mut / 4 read | FAIL (callGateAction + writes outside for update_business, update_season, add_procedures) | PASS | PARTIAL (void emit, no nonEmpty) | PASS | PASS | MEDIUM |
| operations | 1 mut / 3 read | PARTIAL (createDeviation gated, reads ungated) | PASS | PASS (createDeviation) | PASS | PASS | LOW |
| operations-intelligence | 1+ mut | PASS (triage_event gated) | PASS | PASS (await emit) | PASS | PASS | PASS |
| payroll | 6 mixed | PASS (mutateWithGate on mutations) | PASS | PASS | PASS | PASS | PASS |
| payroll/tariff-tools | 3 mut | PASS (mutateWithGate) | PASS | PASS (await emit) | PASS | PASS | PASS |
| personal | 4 mut / 1 read | PASS (callGateAction) | PASS | PASS (await emit) | PASS | PASS | PASS |
| pos_account_management | 2 mut / 1 read | PASS (mutateWithGate) | PASS | PASS | PASS | PASS | PASS |
| profile | 3 read | N/A (read-only) | PASS | N/A | PASS | PASS | LOW |
| shift_marketplace | 4 mut / 1 read | PASS (mutateWithGate) | PASS | PASS | PASS | PASS | PASS |
| timeline-template | 3 mut / 1 read | PASS (mutateWithGate) | PASS | PASS (nonEmpty used) | PASS | PASS | PASS |
| tips | 4 skeletons | N/A (Sortie-1 stubs) | N/A | N/A | N/A | N/A | INFO |
| ui | 3 read | N/A (broadcast only, no DB writes) | N/A | N/A | N/A | N/A | INFO |
| channel-admin | 6 skeletons | N/A (Sortie-1 stubs) | N/A | N/A | N/A | N/A | INFO |
| scheduler/diagnose-tools | 1 read | N/A (read-only) | PASS | PASS (emit registered) | PASS | PASS | PASS |
| scheduler/tools-template | 1 mut | PASS (mutateWithGate) | PASS | PASS | PASS | PASS | PASS |

---

## Telemetry Registry Cross-Check

**Events emitted by capability tools but NOT found in registry:**

| Event string | Emitting tool | Finding |
|---|---|---|
| `guardian.signal_acknowledged` (dot form) | guardian/tools.ts insert to guardian_log | Not in registry — mismatched naming vs `guardian_signal acknowledged` (space form) |
| `memory.*` (any) | memory/tools.ts | No memory events in registry — intentional or missing |

**Events registered in registry but NO emit-site in capability tools:**

| Event | Registry lines | Finding |
|---|---|---|
| `agent.schedule.workspace_queried` | 4931, 15056 | Registered, no emit in schedule/tools.ts |
| `agent.schedule.date_queried_self` | 4946, 15060 | Registered, no emit in schedule/tools.ts |
| `guardian_signal acknowledged` | 3024, 12808 | Registered, guardian/tools.ts uses direct guardian_log insert instead |
| `guardian_signal dismissed` | 3031, 12812 | Registered, no emit in guardian/tools.ts for dismiss path |

**All other capability events** (bootstrap.*, cascade.*, engine_world.*, timeline_template.*, payroll.*, shift_marketplace.*, legal.*, helpdesk.*, onboarding.*, business_intelligence.*, personal.*, ops.*) have confirmed emit-sites matching registry entries.

---

## Recommended Remediation Priority

1. **Sortie A (HIGH):** Migrate `journey`, `contract`, `contract-intake`, `guardian`, `onboarding` (update_business/update_season) mutation tools to `mutateWithGate` exec callback pattern. These 5 capabilities have ADR-0204 Pathway B gaps.

2. **Sortie B (HIGH + quick win):** Add `emit()` to guardian's `acknowledgeSignal` matching `guardian_signal acknowledged` event name. Fix H-2 + close registry/emit-site gap.

3. **Sortie C (HIGH):** Add `callGateAction` + `emit()` to `training/tools.ts` (3 tools, including PII-exposing `getTeamReadiness`).

4. **Sortie D (HIGH):** Add `callGateAction` + `emit()` to `schedule/tools.ts` (6 tools). Use registered event names `agent.schedule.workspace_queried` and `agent.schedule.date_queried_self`.

5. **Sortie E (MEDIUM, cleanup):** Remove `workspace_id` from availability/queryOthersAvailability schema (ADR-0151). Migrate all `void emit(...)` without `nonEmpty()` to `nonEmpty()` pattern across: availability, scheduler, business-intelligence, communication, onboarding.

6. **Sortie F (MEDIUM):** Add `emit()` + register events for `journey-authoring` (saveDraftTool, publishDraftTool). Decide intentionality for `memory/tools.ts` emit absence.

7. **Sortie G (LOW):** Add gates to `helpdesk_query/resolveTicket` (mutateWithGate), `operations/tools.ts` reads, `profile/tools.ts` reads.
