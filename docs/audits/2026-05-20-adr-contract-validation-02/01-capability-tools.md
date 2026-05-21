---
title: "Audit Slice 01 — Capability Tools (ADR-0151/0173/0186/0204/0238/0240)"
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, capability-tools, adr]
---

# Audit Slice 01 — Capability Tools

## Summary (top 5)

1. **CT-01 HIGH** — `shift-lifecycle/tools.ts`: `publishShift` + `approveShift` perform direct `.update()` on `schedule_shift` / `shift_approval` **outside `gatedMutation()`**. Both tools call `callGateAction()` (Pathway A only) but skip `cascade_gate_write` (Pathway B). ADR-0204 §§1-3 mandates the dual-gate orchestrator; L-0176 trap: docstring says "gate via callGateAction" but the body skips the composition requirement. Unchanged from baseline.

2. **CT-02 HIGH** — `payroll/tools.ts`: `updatePayrollProfile`, `setPensionScheme` use gate-then-direct-update pattern. Docstring for `updatePayrollProfile` explicitly states *"gate-then-update is the established payroll convention"* — this is an in-line ADR override that was never accepted as an ADR amendment. Same structural gap as CT-01 (Pathway A only, no Pathway B). Unchanged from baseline.

3. **CT-03 MEDIUM** — `journey/tools.ts`: `publishMissionTool` and `publishGuideTool` call `callGateAction()` (Pathway A only), then write `engine_missions`/`engine_stages`/`journey_guide` directly. They do NOT use `gatedMutation()`. The gate wrapping is partial (ADR-0204 Pathway A only, Pathway B absent). `journey-authoring/publishDraftTool` correctly uses `gatedMutation()`. Inconsistency across journey capability family.

4. **CT-04 MEDIUM** — `personal/tools.ts`: `addNote`, `createTask`, `setReminder`, `updateSetting` call `callGateAction()` then write directly. Multi-write tool `setReminder` inserts into 3 tables (`engine_event`, `engine_trigger`, `engine_delayed_trigger`) without `gatedMutation()` wrapping, meaning only Pathway A gate applies to all three writes as a single gate evaluation. No correlation chain.

5. **CT-05 MEDIUM** — `helpdesk_query/tools.ts` `openTicket`: inserts `channel` row (query_thread) and `channel_member` rows (2 members) **outside** `gatedMutation()` after `callGateAction()` pass. The gate evaluates the open_ticket action but the subsequent channel + member inserts have no Pathway B `cascade_gate_write`. ADR-0204 §1 is violated. `resolveTicket` has the same pattern.

---

## Findings Table

| ID | Severity | File:Line | ADR | Evidence |
|---|---|---|---|---|
| CT-01 | HIGH | `shift-lifecycle/tools.ts:177-180` (publishShift), `:350-362` (approveShift) | ADR-0204 | `callGateAction()` then direct `.update()` — no `gatedMutation()` orchestrator. Pathway B absent. L-0176: docstring "ADR-0099 gate" but body skips cascade_gate_write. |
| CT-02 | HIGH | `payroll/tools.ts:200-206` (updatePayrollProfile), `:370-379` (setPensionScheme) | ADR-0204 | Docstring at line 69 explicitly documents "gate-then-update is established payroll convention" — informal ADR override without accepted ADR amendment. Pathway A only. |
| CT-03 | MEDIUM | `journey/tools.ts:461-503` (publishMission), `:686-703` (publishGuide) | ADR-0204 | `callGateAction()` then direct `.insert()` into `engine_missions`/`engine_stages`/`journey_guide`. No `gatedMutation()` wrapper. `runDevTool`/`runGuidedTool` have same gap at `engine_state`/`engine_state_step` inserts. |
| CT-04 | MEDIUM | `personal/tools.ts:100-111` (addNote), `:172-181` (createTask), `:256-303` (setReminder), `:440-448` (updateSetting) | ADR-0204 | All four mutations: `callGateAction()` → direct `.insert()/.update()`. `setReminder` makes 3 sequential writes across 3 tables under 1 gate evaluation with no `cascade_gate_write`. |
| CT-05 | MEDIUM | `helpdesk_query/tools.ts:118-148` (openTicket channel+member inserts), `:600-608` (resolveTicket engine_state update) | ADR-0204 | Gate passes at open_ticket/resolve_ticket; subsequent DB writes (channel INSERT, channel_member INSERT, engine_state UPDATE) are direct — outside gatedMutation() orchestrator. |
| CT-06 | LOW | `shift-lifecycle/tools.ts:587-602` (clockInCheck) | ADR-0151 | `params.profile_id` is accepted as a body parameter and passed directly to `is_employee_blocked` RPC. Comment says "Must match ctx.profileId unless caller is admin" — no enforcement. Admin bypass is implicitly possible. ADR-0151 requires server-side derivation. |
| CT-07 | LOW | `journey/tools.ts:460` (publishMissionTool) | ADR-0240 | ADR-0240 proposed delegation of `journey + journey_version` writes to `publish_mission`. `journey-authoring/tools.ts` does perform the insert (line 484-519) under `gatedMutation()`. `publish_mission` tool writes `engine_missions`/`engine_stages` but NOT `journey`/`journey_version` (correct per delegation). Delegation contract partially honored but ADR-0240 still `proposed` status — not `accepted`. Track until acceptance. |
| CT-08 | INFO | `task/tools.ts:519-530` (createSession) | ADR-0204 | `createSession` inserts `session_task` directly after `gateTaskAction()`. Pattern is `callGateAction()` variant (see `gate.ts` `gateTaskAction`). Same Pathway-A-only concern as CT-01 but task capability may have an accepted carve-out via ADR-0298 §Authority. Verify ADR-0298 resolution before escalating. |
| CT-09 | INFO | `journey-authoring/tools.ts:90-110` (saveDraftTool), `:460-543` (publishDraftTool) | ADR-0204 | Both tools correctly use `gatedMutation()`. `publishDraftTool` documents ADR-0240 cross-namespace note at line 453-457 acknowledging the deferred delegation. |

---

## Per-ADR Rollup

| ADR | Status | Verdict | Notes |
|---|---|---|---|
| ADR-0151 (workspace_id server-derived) | accepted | ⚠️ | CT-06: `clockInCheck` accepts `params.profile_id` from body without enforcement. All other tools derive IDs from `ctx`. |
| ADR-0173 (four frozen capabilities) | accepted | ✅ | All four journey capabilities (`run_dev`, `publish_mission`, `publish_guide`, `run_guided`) present and correctly named. No cross-namespace writes from non-owning capabilities detected. `journey-authoring` writes `wizard_session`, `journey`, `journey_version` with documented ADR-0240 deferred delegation note. |
| ADR-0186 (guardian bus pg_notify) | accepted | ✅ | Not directly applicable to capability tools surface. No direct `guardian_log` writes detected in scoped files. |
| ADR-0204 (gatedMutation orchestrator) | accepted | 🔴 | CT-01, CT-02, CT-03, CT-04, CT-05: five capability families use Pathway-A-only pattern (callGateAction → direct write). `timeline_template` and `journey-authoring` are compliant via `mutateWithGate`/`gatedMutation`. |
| ADR-0238 (DomainChatOwnership) | accepted | ✅ | Not applicable to tools.ts surface (UI layer, not capability tools). |
| ADR-0240 (publishDraft delegation) | proposed | ⚠️ | `journey-authoring/publishDraftTool` performs `journey`+`journey_version` inserts under `gatedMutation()` (Pathway A+B compliant) with documented ADR-0240 deferred delegation note. ADR still `proposed`. CT-07 tracks this. |

---

## Verified Intentional

- **FP-001 (legal capability allowedChannels UNION pattern)**: Not present in scoped tools.ts files.
- **FP-005 (engine_authority_config capability row for legal vs industry_intelligence)**: Not applicable to this slice.
- `timeline_template/tools.ts`: All four tools use `mutateWithGate()` (ADR-0287/0204 compliant). ✅
- `journey-authoring/tools.ts`: `saveDraftTool` and `publishDraftTool` use `gatedMutation()`. ✅
- `journey/tools.ts`: ADR-0134 guards (non-empty workspaceId/profileId) present on all four tools. ✅
- `helpdesk_query/tools.ts`: `listMyQueue` and `getTicket` are read-only — no gate required. ✅
- `task/tools.ts`: `listMine` is ungated read per ADR-0298 R4. ✅
- `personal/tools.ts`: `getHistory` is read-only — no gate required. ✅

---

## In-Progress (mid-campaign — mark as "in-progress", not "violation")

- `payroll/tools.ts` (CT-02): campaign/payroll active — gate-then-update pattern is the established payroll convention per file header. If campaign/payroll ships a `gatedMutation()` migration, CT-02 closes.
- `shift-lifecycle/tools.ts` (CT-01): campaign/world-best-wfm active — cascade-related capabilities. Track for this campaign's closure scope.

---

## Notable Baseline Comparison

Baseline `00-SYNTHESIS.md` (2026-05-20 pre-PR-#432) lists under theme "Capability mutation patterns (ADR-0204 + ADR-0173 + ADR-0240)" — `payroll/tools.ts`, `shift-lifecycle/tools.ts`, `timeline-template/tools.ts`, `personal/tools.ts`, `helpdesk_query/tools.ts` as MEDIUM (not HIGH). This audit **upgrades CT-01 and CT-02 to HIGH** because:
- `shift-lifecycle` mutations (publishShift, approveShift) operate on governance-gated tables (`schedule_shift`, `shift_approval`) without `cascade_gate_write`. The `change_proposal` row that ADR-0204 §4 requires for blocked data-rule path is never created.
- `payroll` docstring explicitly documents the deviation from ADR-0204 without an accepted ADR amendment. The "established convention" claim in a docstring is L-0176 class.

`timeline-template/tools.ts` is **CLEARED** from the baseline mutation-pattern concern — all four tools now use `mutateWithGate()` correctly.
