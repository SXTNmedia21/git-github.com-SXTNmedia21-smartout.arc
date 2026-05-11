---
title: Slice 01 — capability-tools Audit
status: done
created: 2026-05-10
updated: 2026-05-10
module: audit
tags: [audit, capability-tools, adr, smoke]
mode: smoke
baseline: 2026-05-10-adr-contract-validation
---

# Slice 01 — capability-tools Audit

**Run date:** 2026-05-10
**Branch:** feat/botsson-arena-phase-f0-perimeter
**Surface:** `packages/ai/src/capabilities/**/tools.ts` (28 files)
**ADRs in scope:** ADR-0151, ADR-0173, ADR-0186, ADR-0204, ADR-0238, ADR-0240
**Traps applied:** L-0176 (docstring vs body), L-0177 (silent workspace fallback)
**FP applied:** FP-001 (`validate_aml_14_6` channel inversion — layered defense, working as designed)

---

## Summary

1. **F-CT-01 (HIGH, UNCHANGED)** — `billing-query/tools.ts`: file header claims `emit()` per-invocation; all 6 execute() bodies have zero `emit()` calls. L-0176 5th occurrence.
2. **F-CT-02 (HIGH, UNCHANGED)** — `communication/tools.ts`: `sendMessage` INSERTs to `channel_message` with no `callGateAction` or `gatedMutation`. ADR-0099/ADR-0204 violation.
3. **F-CT-03 (HIGH, UNCHANGED)** — `guardian/tools.ts`: `acknowledgeSignal` UPDATEs `guardian_signal` with no gate and no `emit()`. ADR-0099 + ADR-0186 violation.
4. **F-CT-04 (MEDIUM, NEW L-0176 INSTANCE)** — `onboarding/tools.ts`: `add_key_fact` line 730 docstring claims "gate_action("memory") via callGateAction"; body (lines 760-790) has no `callGateAction` call — delegates directly to `saveMemory()` without the gate the docstring asserts. Underlying gate-bypass finding unchanged; docstring-vs-body gap is new on this branch.
5. **F-CT-EW-01 (PASS, NEW)** — `engine-world/tools.ts` (new on this branch): `report_observation` uses full `gatedMutation()` (ADR-0204 Pathway A+B), server-derived `workspace_id` (ADR-0151), emit after gate (ADR-0186). Gold-standard implementation.

---

## Findings Table

| ID | Severity | File:approx-line | ADR/Rule | Evidence |
|----|----------|-----------------|----------|----------|
| F-CT-01 | HIGH | `billing-query/tools.ts:1-17` (header) vs all execute() bodies | L-0176, ADR-0186 | Header: "ADR-0134: emit() called on every tool invocation". Bodies: zero `emit()` calls, no `@smartout/telemetry` import. Affects 6 tools. |
| F-CT-02 | HIGH | `communication/tools.ts:174-184` | ADR-0099, ADR-0204 | `sendMessage` calls `.from("channel_message").insert(...)` with no `callGateAction` or `gatedMutation` before it. `isAiAllowedInChannel()` is application-level policy — not the C4 gate_action chain. |
| F-CT-03 | HIGH | `guardian/tools.ts:83-91` | ADR-0099, ADR-0204, ADR-0186 | `acknowledgeSignal` calls `.from("guardian_signal").update(...)` with no gate (no `callGateAction`, no `gatedMutation`) and no `emit()`. Two-violation stack. |
| F-CT-04 | MEDIUM | `onboarding/tools.ts:730` (docstring) vs 760-790 (body) | L-0176, ADR-0099 | Docstring: "gate_action("memory") via callGateAction". Body: calls `saveMemory()` directly, no `callGateAction` before. Gate-bypass is baseline finding; docstring assertion is new L-0176 instance on this branch. |
| F-CT-05 | MEDIUM | `personal/tools.ts:85,161,239,418` | ADR-0204 | `callGateAction` present before writes but domain writes go direct (no `gatedMutation` wrapper). Pathway B (cascade_gate_write) skipped for 4 mutation tools. Baseline finding, unchanged. |
| F-CT-06 | LOW | `onboarding/tools.ts:596,613` | ADR-0196 Inv-11 (spirit) | `scrape_website` emits `"onboarding.scrape_completed"` before the external call (phase: "called"), then again after (phase: "completed"). Same event name for both phases causes double-count for event consumers. |
| F-CT-07 | LOW | `profile/tools.ts` (getProfile execute()) | ADR-0151 | `getProfile` queries by `profile_id` only — no `workspace_id` filter. UUID PK + RLS provide real guard; missing belt-and-suspenders filter inconsistent with other 3 tools in the capability. |

---

## Per-ADR Rollup

| ADR | Compliant | Partial | Violation |
|-----|-----------|---------|-----------|
| ADR-0151 (server-derived workspace_id) | 27 files | 0 | 1 (profile/getProfile — no workspace filter on read) |
| ADR-0173 (journey capability model) | All 4 journey caps present | — | 0 |
| ADR-0186 (emit on mutations) | 23 caps | 1 (billing-query — L-0176) | 1 (guardian/acknowledgeSignal — no emit on UPDATE) |
| ADR-0204 (gatedMutation orchestrator) | 20 caps | 2 (personal — Pathway A only; onboarding/add_key_fact — no gate at all) | 2 (communication/sendMessage, guardian/acknowledgeSignal — no gate) |
| ADR-0238 (Botsson surface disambiguation) | Out-of-scope for tools.ts layer | — | — |
| ADR-0240 (journey-authoring boundary) | PASS — publishDraftTool uses gatedMutation; no cross-namespace direct writes | — | 0 |

---

## Delta vs Baseline

### Closed since 2026-05-10 baseline
None — no capability tools were remediated in this sortie (scope was stage-engine + landing).

### Unchanged (baseline findings still open)
- F-CT-01 HIGH — billing-query L-0176 (6 tools, 0 emit)
- F-CT-02 HIGH — communication/sendMessage no gate
- F-CT-03 HIGH — guardian/acknowledgeSignal no gate + no emit
- F-CT-04 MEDIUM — onboarding/add_key_fact gate-bypass (underlying)
- F-CT-05 MEDIUM — personal 4-tool callGateAction-then-direct-write
- F-CT-06 LOW — onboarding/scrape_website double event name
- F-CT-07 LOW — profile/getProfile no workspace_id scope

### New since baseline

**F-CT-04 gains a NEW L-0176 instance** (docstring-vs-body, not a new finding ID but a new violation layer):

`onboarding/tools.ts:730` now explicitly states "gate_action("memory") via callGateAction" in the tool comment block. Body at lines 760-790 calls `saveMemory()` directly with no `callGateAction`. The baseline recorded the gate-bypass; this branch added a false docstring claim on top of the existing gap. Severity stays MEDIUM (gate-bypass dominates); L-0176 pattern is now confirmed on `add_key_fact` in addition to the 6 billing-query tools.

**F-CT-EW-01 PASS — engine-world/tools.ts (new file, no violations)**

New file `packages/ai/src/capabilities/engine-world/tools.ts` on this branch. Per-tool trace:

| Tool | gate | emit() | workspace_id source | Verdict |
|------|------|--------|---------------------|---------|
| read_surface | read-only (L-0094) | no | ctx.workspaceId (query filter) | PASS |
| read_surface_class | read-only (L-0094) | no | ctx.workspaceId (query filter) | PASS |
| report_observation | `gatedMutation()` — Pathway A (gate_action) + Pathway B (cascade_gate_write) | yes — `"engine_world observation_written"` + conditional `"engine_world status_changed"` | ctx.workspaceId (ADR-0151 cited in body) | PASS |

All ADR-0151, ADR-0186, ADR-0204 requirements satisfied in body (not just docstring). Gold-standard.

**contract/tools.ts — sendEmployeeContract emit addition (PASS)**

This branch added `void emit({ event: "contract sent", workspace_id: ctx.workspaceId, actor_id: ctx.profileId, ... })` after a successful contract send. `workspace_id` and `actor_id` are server-derived from `ctx`. Gate is via `gateMutation(ctx, "send_employee_contract", ...)` at line 342 (unchanged). Emit addition is clean; `recipient_email ?? ""` is in the emit `data` payload (not identity derivation), safe given the non-null contract guard at lines 359-360. No new violations introduced.

---

## Verified Intentional

**FP-001** — `packages/ai/src/capabilities/legal/tools.ts` `validate_aml_14_6`: allowedChannels includes voice at capability level; tool body rejects voice at Layer 3. ADR-0078 layered defense working as designed. Not re-flagged.

---

## In-Progress

None — this sortie (feat/botsson-arena-phase-f0-perimeter) touched only `services/stage-engine/` and `apps/landing/`. The capability-tools changes on this branch are:
- `contract/tools.ts` — emit addition to `sendEmployeeContract` (PASS, closes a telemetry gap)
- `engine-world/tools.ts` — new file (PASS)
- `onboarding/tools.ts` — full rewrite with 10 tools (F-CT-04 gate-bypass unchanged; new L-0176 docstring instance on add_key_fact)
- `onboarding/gate.ts`, `onboarding/index.ts` — supporting files (not traced, out of tool-body scope)
- `registry.ts`, `types.ts` — metadata only

No remediation for F-CT-01 / F-CT-02 / F-CT-03 / F-CT-05 / F-CT-06 / F-CT-07 in scope.

---

*Audit complete. Findings are READ-ONLY. Remediation = separate sorties.*
