---
title: Slice 01 — capability-tools Audit
status: done
created: 2026-05-13
updated: 2026-05-13
module: audit
tags: [audit, capability-tools, adr]
---

# Slice 01 — capability-tools Audit

Surface: `packages/ai/src/capabilities/**/tools.ts` (+ `index.ts`, `*-tools.ts`)
ADRs: 0151, 0173, 0186, 0204, 0238, 0240, 0287, 0301
Date: 2026-05-13

## Summary

1. **journey-authoring** — `saveDraftTool` + `publishDraftTool` wrap writes in `gatedMutation` but never call `emit()` to telemetry registry → ADR-0134 phantom-mutation, L-0234 dual-emit gap. **HIGH**
2. **personal** — 5/5 mutation tools call `callGateAction` then write directly (no `gatedMutation` wrapper) → ADR-0287 PASS, ADR-0204 backlog. **MEDIUM**
3. **task** (ADR-0301 Sortie 3) — fully compliant: `gateTaskAction` before every `.insert/.update`, `resolveAssigneeWorkspaceMembership` enforces L-0177 fail-fast on cross-workspace assignee, all 5 write tools emit. **PASS (verified intentional)**.
4. **F-CT-01 (billing-query)** — current header makes no ADR-0134 emit claim; 6 read tools, 0 mutations. Either baseline was stale or remediated. **CLEARED**.
5. **F-CT-05 (personal)** — gate present; ADR-0204 orchestrator-wrapper still absent → demoted from HIGH to MEDIUM (ADR-0204 backlog), not ADR-0287 violation.

## Findings

| ID | Sev | File:Line | ADR | Evidence |
|----|-----|-----------|-----|----------|
| F-CT-01 | MEDIUM | `journey-authoring/tools.ts:53` (saveDraft), `:292` (publishDraft) | ADR-0134, ADR-0186, L-0234 | Zero `emit(` in file. saveDraftTool uses `gatedMutation` (line 100) writing to `wizard_session`; publishDraftTool uses `gatedMutation` (line 460) writing to `journey` + `journey_version` + `wizard_session`. `gatedMutation` writes `gate_evaluation` rows, but registry `emit()` (PostHog+activity_trail+engine_event) is never called. ADR-0134: "every mutation emits". |
| F-CT-02 | MEDIUM | `journey-authoring/tools.ts:482-525,537` | ADR-0240 | publishDraftTool still writes directly to `journey` + `journey_version` (cross-namespace into `journey.publish_mission`'s frozen-4 surface). Acknowledged in comment lines 452-457; ADR-0240 Phase 1 delegation NOT yet implemented. eslint-disable comments admit ADR-0173 boundary breach. |
| F-CT-03 | MEDIUM | `personal/tools.ts:81,158,236,415` | ADR-0204 | All five personal mutation tools (`add_note`, `create_task`, `set_reminder`, `save_preference`, `complete_personal_task` etc.) call `callGateAction` followed by direct `.insert`/`.update` on `engine_memory`/`personal_task`. No `gatedMutation` wrapper → no dual-gate composition (Pathway A only, no Pathway B / `cascade_gate_write`). Baseline F-CT-05 confirms ongoing. |
| F-CT-04 | LOW | `journey-authoring/tools.ts:283-290` | L-0176 | Docstring lines 283-290 claim ADR-0204 + ADR-0240 compliance. Body conforms to ADR-0204 (uses `gatedMutation`) but explicitly does NOT conform to ADR-0240 (still writes journey + journey_version directly). Comment lines 452-457 acknowledge this; docstring should mention "ADR-0240 pending delegation" explicitly. Same drift class as L-0176 but in-progress. |
| F-CT-05 | LOW | `availability/tools.ts:121,207,321` | ADR-0134 | `void emit(...)` (fire-and-forget) on three writes. `void` suppresses awaiter — if emit fails (telemetry queue down) the audit_trail row is lost silently. Pattern repeats in onboarding/tools.ts:183,287, journey-authoring (none), shift-lifecycle:229,367. `void emit` is project convention but worth noting for failure-mode. |

## Per-ADR Rollup

- **ADR-0151** (server-derived profile_id): All sampled tools take `profile_id` from `ctx.profileId` not body. shift-swap explicitly comments "actor_profile_id comes from ctx.profileId, never from tool params" (line 164). No violations.
- **ADR-0173** (capability frozen-4 + boundaries): `journey-authoring/publishDraft` violates by writing `journey`/`journey_version` (owned by `journey.publish_mission`). Acknowledged in code comments — in-progress per ADR-0240 Phase 1.
- **ADR-0186** (telemetry emit): journey-authoring tools.ts entire file has zero `emit()` calls despite mutations. HIGH gap.
- **ADR-0204** (gatedMutation orchestrator): journey-authoring, engine-world, journey, contract-intake comply (use `gatedMutation`). personal, availability, onboarding, communication, operations, shift-lifecycle, contract, memory, helpdesk_query, shift-swap, payroll, task all call `callGateAction` directly (Pathway A only) without orchestrator — ADR-0204 backlog (15 capability tool files affected).
- **ADR-0238** (Botsson surface disambiguation): out of scope for tools.ts files — this is BotssonShell concern.
- **ADR-0240** (journey-authoring → publish_mission delegation): NOT YET implemented. publishDraftTool still writes directly. In-progress.
- **ADR-0287** (gate_action mandatory on mutation tools): All sampled mutation tools call `gate_action` (via `callGateAction` / `gateTaskAction` / `gatedMutation`). No bare mutation-without-gate found. PASS.
- **ADR-0301** (task capability unify): Sortie 3 implementation verified. `task/tools.ts` 5 write tools all gated. `resolveAssigneeWorkspaceMembership` enforces L-0177. `aliasTaskVerbs` shim in router.ts (verified by ADR text, not re-inspected in this slice — scope is capability tools). PASS.

## Verified Intentional

- **billing-query, kb_query, training, profile, schedule, ui, mission, governance, business-intelligence, legal, tips, operations-intelligence/learn-tools, tips, season** — read-only capabilities with no mutations; absence of `emit()` / `gate_action` is correct.
- **helpdesk_query private helpers** (lines 353, 385, 700) write to `engine_event` / `engine_delayed_trigger` / cancel via `engine_delayed_trigger.update` from within `scheduleBreachEvent` and `cancelBreachEvent` workflow helpers. Tool-level gates at lines 57 (open_ticket) and 517 (resolve_ticket) cover the user-visible action; internal engine writes are workflow scaffolding, not user mutations.
- **task.list_mine direct UNION** (ADR-0301 Clarification 1): RPC `fn_list_my_tasks` is SECURITY DEFINER; direct table UNION with JWT-scoped client is intentional per the ADR.
- **`void emit(...)` pattern** (multiple files): project convention; not a finding unless audit-trail guarantees become contract requirements.
- **FP-001 legal/tools.ts**: per-tool body channel guards are intentional defence-in-depth (ADR-0078 layered). Not re-flagged.

## In-Progress

- **payroll/tools.ts** — active sortie `payroll-wt-1`, 16 commits ahead of campaign. 13 mutations, 28 gate references, 15 emits — shape looks healthy at high level. Not deep-traced (filter directive).
- **ADR-0204 orchestrator rollout** — 15 capability tool files still on direct `callGateAction` pattern (Pathway A only). Not single-tool fixes; expect future SS-5+ campaign to migrate.
- **ADR-0240 publishDraft delegation** — Phase 1 (expose `journey.publish_mission` as inter-capability call surface) not yet shipped. publishDraftTool registered + functional but cross-namespace.

## Method Notes

- Read ADRs 0151, 0173, 0186, 0204, 0238, 0240, 0287, 0301 (titles + key sections).
- Globbed 30 `capabilities/*/tools.ts` files; tallied mutations (`.insert/.update/.delete/.upsert/.rpc`), gates (`callGateAction|gatedMutation|gate*Action`), emits.
- Spot-checked F-CT-01 baseline (billing-query header) and F-CT-05 baseline (personal/tools.ts gate-call positions).
- For each anomaly, read body around mutation site to verify docstring-vs-body (L-0176) and workspace_id resolution (L-0177).
- Not deep-traced: payroll (in-progress filter), every secondary subtool file in operations-intelligence (covered by spot-check).
