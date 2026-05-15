---
title: "Audit Slice 01 — capability-tools ADR compliance"
status: done
created: 2026-05-15
updated: 2026-05-15
module: audit
tags: [audit, capability-tools, adr]
---

# Audit Slice 01 — Capability Tools

**Scope:** `packages/ai/src/capabilities/**/tools.ts` (32 files)
**ADRs checked:** 0151, 0173, 0186, 0204, 0238, 0240, 0287
**Baseline delta vs 2026-05-13:** 0 regressions on ADR-0287 CI baseline; 3 new findings, 1 confirmed open.
**Known false positives excluded:** FP-001 (legal/tools.ts channel inversion), FP-005 (lovsen_query not shipped).

---

## Summary (Top 5)

| # | Severity | Finding | Capability | ADR |
|---|---|---|---|---|
| 1 | HIGH | `publish_mission`, `run_dev`, `run_guided` perform domain writes OUTSIDE `gatedMutation.execute()` callback after authority-gate passes | journey | 0204 |
| 2 | HIGH | `data_rule` deny in `callGateAction` sentinel adapter returns `allow=true` — tools proceed to write even when Pathway B blocks | journey, shift-lifecycle (all sentinel users) | 0204 |
| 3 | MEDIUM | `onboarding/tools.ts` `update_season`: `season_budget.insert()` at line 274 executes AFTER `callGateAction` but is a second write outside the gated callback — no cascaded Pathway B evaluation for the second table | onboarding | 0204 |
| 4 | MEDIUM | `guardian/tools.ts` `acknowledge_signal`: mutation gated via `callGateAction`, but no `emit()` call; ADR-0186 fanout relies on `guardian_log` INSERT trigger — no guardian_log write either | guardian | 0186 |
| 5 | LOW | ADR-0240 is still `proposed` (not `accepted`); `publishDraftTool` in `journey-authoring/tools.ts` is registered in the tools array and exposed to the agent despite ADR-0240 requiring it stay unregistered until `journey.publish_mission` exposes an inter-capability surface | journey-authoring | 0240 |

---

## Findings Table

| ID | Severity | Capability | File:Line | ADR | Description |
|---|---|---|---|---|---|
| F-CT-02 | HIGH | journey | journey/tools.ts:461-503 | 0204 | `publishMissionTool.execute()` calls `callGateAction()` for authority, then performs `engine_missions.insert()` + `engine_stages.insert()` OUTSIDE any `gatedMutation.execute()` callback. Pathway B (`cascade_gate_write`) is never evaluated for these domain writes. |
| F-CT-03 | HIGH | journey | journey/tools.ts:196, 239, 940, 991 | 0204 | Same pattern in `runDevTool` and `runGuidedTool`: `callGateAction()` → `engine_state.insert()` + `engine_state_step.insert()` outside `gatedMutation.execute()`. |
| F-CT-04 | HIGH | all sentinel users | shift-lifecycle/gate.ts:181-188, journey/gate.ts:146-152 | 0204 | `callGateAction` adapter maps `denied_by:'data_rule'` → `allow:true` per "legacy contract." With the SS-4 sentinel this path is documented as defensive, but it is LIVE CODE: if the sentinel entity_type accidentally matches a `framework_trigger` row, Pathway B can block while Pathway A passes, and the adapter silently turns a cascade deny into a write-permit. No CI check catches this drift. |
| F-CT-05 | MEDIUM | onboarding | onboarding/tools.ts:274 | 0204 | `update_season` tool: `season.insert()` is gated via `callGateAction`, but the immediately-following `season_budget.insert()` (1:1 companion row) is a second write outside the gate scope. Any cascade rule blocking `season_budget` writes would be bypassed. |
| F-CT-06 | MEDIUM | guardian | guardian/tools.ts:103-108 | 0186 | `acknowledge_signal` gate-checks then `.update(guardian_signal ...)` directly. No `emit()` call at all. ADR-0186 routes guardian events via `guardian_log` INSERT → pg_notify trigger; a direct `guardian_signal.update()` without an accompanying `guardian_log.insert()` (or `emitGuardianEvent()`) produces no guardian bus event. |
| F-CT-07 | LOW | journey-authoring | journey-authoring/tools.ts:292-556 | 0240 | `publishDraftTool` is present in the tools array export. ADR-0240 §Decision Outcome states: "until Phase 1 lands, `publishDraftTool` stays unregistered (removed from `packages/ai/src/capabilities/journey-authoring/index.ts` exports + `tools` array)." Current code wraps all 3 writes in `gatedMutation` (the L-0176 risk is closed), but the registration-gate required by ADR-0240 status:proposed may still apply if ADR-0240 has not been promoted. |
| F-CT-08 | INFO | journey | journey/tools.ts:684-704 | 0204 | `publishGuideTool`: calls `callGateAction()` then `.upsert(journey_guide...)` outside `gatedMutation.execute()`. Same pattern as F-CT-02. `journey_guide` upsert is not inside the execute callback. |

---

## Per-ADR Rollup

### ADR-0151 (profile_id server-derivation)
**PASS.** All capability tools use `ctx.profileId` from `AgentToolContext`. No tool accepts `profile_id` from schema params as actor identity. L-0177 patterns verified: `operations/tools.ts` resolves `deptId` from a profile row but fail-fast branches correctly (lines 210-220 return early if no dept found, not silent fallback). `journey-authoring/tools.ts` reads `sessionRow.workspace_id` and cross-checks against `ctx.workspaceId` (line 334) — fail-fast on mismatch. No silent workspace_id fallback found.

### ADR-0173 (four named journey capabilities)
**PASS.** `journey/tools.ts` exports exactly `runDevTool`, `publishMissionTool`, `publishGuideTool`, `runGuidedTool` under the four frozen capability names (`journey.run_dev`, `journey.publish_mission`, `journey.publish_guide`, `journey.run_guided`). `journey-authoring` is a separate fifth capability (per ADR-0239, not ADR-0173). No capability name drift found.

### ADR-0186 (guardian bus via pg-notify)
**PARTIAL FAIL** — F-CT-06. `acknowledge_signal` mutates `guardian_signal` without writing to `guardian_log` or calling `emitGuardianEvent()`. The `guardian_signal.update()` mutation therefore produces no guardian bus event. `get_signals` and `get_workspace_health` are read-only — no emission expected. The ADR's call-site rule ("call `emitGuardianEvent()` — do not bypass it to write guardian_log directly") is technically silent on whether `acknowledge_signal` must emit a guardian event specifically, but the spirit of the ADR (every guardian state change produces a bus event) is violated. Severity: MEDIUM.

### ADR-0204 (gatedMutation composition orchestrator)
**PARTIAL FAIL** — F-CT-02, F-CT-03, F-CT-04, F-CT-05, F-CT-08.

The sentinel adapter pattern in `journey/gate.ts` and `shift-lifecycle/gate.ts` is architecturally sound for authority-only evaluation (Pathway A). The gap is that domain writes in `publish_mission`, `run_dev`, `run_guided`, `publish_guide`, and `onboarding.update_season` occur OUTSIDE the `gatedMutation.execute()` callback, meaning Pathway B (cascade_gate_write) is not evaluated for those domain tables.

ADR-0204 §1 specifies the `execute` callback runs INSIDE the orchestrator's RPC transaction ONLY IF both policies allow. The sentinel pattern calls `gatedMutation` for authority evaluation (Pathway A only), then performs writes independently. This is Pathway A + independent write, not the dual-gate ADR-0204 prescribed flow.

The CI check (`gate-action-coverage.ts`) passes for these tools because it uses identifier-based (not ordering-based) detection — `callGateAction` is present in the body, so the CI considers the tool gated. This is an acknowledged limitation per ADR-0287 §"Bad, because AST fragility."

**Partially mitigated by:** `journey-authoring/tools.ts publishDraftTool` uses `gatedMutation` with a proper execute callback (the gold-standard pattern) — no gap there.

### ADR-0238 (Botsson surface disambiguation)
**N/A for capability tools.** ADR-0238 concerns frontend pages mounting `<DomainChatOwnership>`. No capability tool code references BotssonShell or DomainChatOwnership. Not applicable at this layer.

### ADR-0240 (journey-authoring tool boundary)
**PARTIAL** — F-CT-07. `publishDraftTool` body now wraps all writes in `gatedMutation` (the L-0176 body violation is closed). However, ADR-0240 is still `proposed` (not `accepted`), and the ADR's transition requirement — "removed from tools array until Phase 1 lands" — may conflict with the tool's current registration. If ADR-0240 was promoted to accepted and Phase 1 has not landed, the registration violates the ADR. If ADR-0240 is still proposed and the decision was to ship the gate-wrapped version instead (per the `journey-authoring/tools.ts:453-457` note), this is intentional. **Recommend confirming ADR-0240 status and updating its frontmatter.**

### ADR-0287 (gate_action mandatory on mutation tools)
**PASS per CI baseline.** ADR-0287 2026-05-13 baseline: 43 passing / 0 violating / 89 read-only. Current code shows no regression — all mutation tools have a gate identifier in their execute body. The CI does not catch F-CT-02/03/05/08 because those are ordering/placement issues, not identifier-presence issues.

---

## Verified Intentional

- **FP-001** — `legal/tools.ts:87` channel inversion: `allowedChannels=["chat","voice","system"]` is ADR-0078 union per layer 1+2; confirmed intentional.
- **FP-005** — `industry_intelligence.lovsen_query` is not shipped; no default-allow gap today.
- **shift-swap RPCs** — `initiate_shift_swap`, `respond_to_shift_swap`, `cancel_shift_swap` are mutation RPCs; all gated via `callGateAction` before invocation. The RPCs are SECURITY DEFINER with RLS. Pathway B not invoked (same pattern as F-CT-02/03 but for mutation-RPCs — documented pattern in shift-swap).
- **sentinel data_rule→allow mapping** — documented as SS-4 defensive behavior in gate.ts comments. The risk (F-CT-04) is real but narrow: requires a `framework_trigger` row whose `entity_type` column accidentally matches the `__authority_shadow_<cap>__` prefix.

---

## In-Progress

- ADR-0240 promotion to `accepted` is a prerequisite for resolving F-CT-07 definitively.
- SS-5 (ADR-0204 rollout) aims to migrate per-capability `gate.ts` files to full `gatedMutation` orchestration — would close F-CT-02/03/08 when complete.

---

## Delta vs 2026-05-13

| Change | Detail |
|---|---|
| New finding: F-CT-02/03/08 | journey/tools.ts domain writes outside gatedMutation.execute() — not flagged in prior slice (May-13 slice 01 focused on F-CT-01 journey-authoring emit) |
| New finding: F-CT-04 | data_rule sentinel bypass documented but added as explicit finding for tracking |
| New finding: F-CT-05 | onboarding season_budget double-write gap — new capability added since May-13 |
| New finding: F-CT-06 | guardian acknowledge_signal no guardian bus emit |
| F-CT-07 | ADR-0240 registration ambiguity — status unchanged, publishDraftTool body now gated (L-0176 CLOSED) |
| F-CT-01 (May-13) | journey-authoring zero emit — CLOSED: publishDraftTool now uses gatedMutation with emit |
| ADR-0287 CI baseline | Confirmed 0 new violations (43 passing, CI identifier-based check) |
