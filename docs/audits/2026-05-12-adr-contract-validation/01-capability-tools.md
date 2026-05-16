---
title: "ADR-Contract Audit — Slice 01: Capability Tools"
status: done
created: 2026-05-12
updated: 2026-05-12
module: audit
tags: [audit, capability-tools, adr]
---

# Slice 01 — Capability Tools

**Surface audited:** `packages/ai/src/capabilities/**/tools.ts` (28 files)
**ADRs in scope:** ADR-0151, ADR-0173, ADR-0186, ADR-0204, ADR-0238, ADR-0240
**Traps:** L-0176 (docstring ≠ body), L-0177 (silent workspace fallback)

---

## Summary (top 5 findings)

1. **HIGH F-01** — `payroll/tools.ts` 15 mutation tools use `callGateAction` (Pathway A only); zero use `gatedMutation` (Pathway A + B). No ADR exempts payroll from ADR-0204 dual-gate mandate. Docstring at line 68 calls it "established payroll convention" but no ADR documents this exception.
2. **HIGH F-02** — `governance/tools.ts:62-67` `protocol_assignment` query filters by `profile_id` only; table has `workspace_id` column, but the query omits `.eq("workspace_id", ctx.workspaceId)`. Profile-membership pre-check at line 48-57 is workspace-scoped, but the subsequent assignments query is not. Cross-workspace assignment leak under service-role.
3. **MEDIUM F-03** — `payroll/tools.ts:828` (`lockPeriod`): `defineTool` call is missing the `capability:` field. ADR-0099 / intent-classifier require the field to gate tool dispatch and route capability authority.
4. **MEDIUM F-04** — `payroll/tools.ts:1558` (`addManualSupplement`): same pattern — `defineTool` missing `capability:` field.
5. **INFO F-05** — `journey-authoring/tools.ts:451-455` comment acknowledges ADR-0240 cross-namespace write boundary (journey + journey_version writes inside `journey_authoring` rather than delegating to `journey.publish_mission`). Tracked separately per ADR-0240 §Decision. Not re-flagged as violation; logged as open ADR-0240 follow-up.

---

## Findings Table

| ID | Severity | File:line | ADR | Evidence |
|----|----------|-----------|-----|----------|
| F-01 | HIGH | `payroll/tools.ts:68,145,199,342,424,542,677,841,944,1018,1096,1178,1255,1361,1580` | ADR-0204 | All 15 mutation tools use `callGateAction` (Pathway A only). No `gatedMutation` wrapper. No ADR documents the exception. Docstring claims "established payroll convention" without a backing ADR reference. |
| F-02 | HIGH | `governance/tools.ts:62-67` | ADR-0151 | `protocol_assignment` query omits `.eq("workspace_id", ctx.workspaceId)`. Table has `workspace_id` column (confirmed in `database.types.ts`). Profile pre-check (lines 48-57) is workspace-scoped but the subsequent assignment fetch is not — under supabaseAdmin (RLS bypassed) this leaks assignments from other workspaces. |
| F-03 | MEDIUM | `payroll/tools.ts:828-834` | ADR-0099 | `lockPeriod` `defineTool({...})` has no `capability:` field. Tool name used by intent-classifier + tool-selector for authority lookup — without it the tool has no declared capability scope and cannot be authority-gated per ADR-0099. |
| F-04 | MEDIUM | `payroll/tools.ts:1558-1572` | ADR-0099 | `addManualSupplement` same — `defineTool` missing `capability:` field. |
| F-05 | INFO | `journey-authoring/tools.ts:451-457` | ADR-0240 | Comment acknowledges cross-namespace write (journey + journey_version owned by `journey.publish_mission` per ADR-0173) is an open ADR-0240 follow-up. `publishDraftTool` body does wrap all 3 writes in `gatedMutation` (ADR-0204 satisfied today); delegation refactor is deferred. Not a current violation. |

---

## Per-ADR Rollup

| ADR | Compliant | Partial | Violation | Notes |
|-----|-----------|---------|-----------|-------|
| ADR-0151 | 27 files | — | 1 | `governance/tools.ts` — protocol_assignment query no workspace_id filter |
| ADR-0173 | — | — | — | `journey.run_dev`, `publish_mission`, `publish_guide`, `run_guided` all registered and named correctly. journey-authoring 3+1 tools in scope. No naming violation. |
| ADR-0186 | N/A | — | — | ADR-0186 is stage-engine internal (guardian-bus pg_notify). No capability tool produces `emitGuardianEvent` directly in this surface. Not applicable. |
| ADR-0204 | 13 files | 1 | 1 | `journey-authoring/tools.ts` and `journey/tools.ts` fully compliant. `payroll/tools.ts` uses Pathway A only across 15 mutation tools — Pathway B (`cascade_gate_write`) absent. `engine-world/tools.ts` compliant (uses `gatedMutation`). |
| ADR-0238 | N/A | — | — | Surface is capability tools, not page layouts. No `BotssonShell` / `DomainChatOwnership` code in scope. |
| ADR-0240 | — | 1 | — | `publishDraftTool` has open ADR-0240 delegation follow-up. Body is gate-wrapped (ADR-0204 satisfied). Partial: namespace boundary issue deferred by documented plan. |

---

## Verified Intentional (False Positives)

| Finding | Why intentional |
|---------|----------------|
| FP-001 `legal/tools.ts:87` — `validate_aml_14_6` channel "inversion" | Confirmed by known-false-positives.md FP-001. Layer 1 capability `allowedChannels` is the union perimeter; Layer 3 body guard is defence-in-depth. Working as designed. |
| `payroll/tools.ts:68` "gate-then-update" docstring | NOT confirmed intentional — no backing ADR. Flagged as F-01. |
| `payroll/tools.ts` — `lockPeriod` body calls `callGateAction` then direct `.update()` | Gate IS present (Pathway A compliant); F-03 is about missing `capability:` field in `defineTool`, not about gate absence. |

---

## In-Progress (Mid-Campaign)

**Campaign `campaign/payroll`** — merged to development 16:24 UTC 2026-05-12.

| Finding | File | Status |
|---------|------|--------|
| F-01 (payroll single-gate) | `payroll/tools.ts` | IN-PROGRESS — may be a deliberate Phase 1 decision pending ADR; campaign just merged. Recommend ADR or explicit migration to `gatedMutation` before GA. |
| F-03, F-04 (missing `capability:` on `lockPeriod`, `addManualSupplement`) | `payroll/tools.ts` | IN-PROGRESS — likely closure churn from campaign. Both tools have `callGateAction` bodies that hardcode `CAPABILITY` constant — the intent is clear, the `defineTool` field is missing. |

---

## Per-Tool Gate Table (mutation tools only, ADR-0204 mandate)

| Tool | capability field | gate_action | gatedMutation | emit | Verdict |
|------|-----------------|-------------|---------------|------|---------|
| `saveDraftTool` (journey-authoring) | ✅ | via gatedMutation | ✅ | N/A (gatedMutation emits) | PASS |
| `publishDraftTool` (journey-authoring) | ✅ | via gatedMutation | ✅ | N/A | PASS (ADR-0240 delegation deferred) |
| `runDevTool` (journey) | ✅ | `callGateAction` pre-insert | insert outside gatedMutation | ✅ | PARTIAL — `engine_state` + `engine_state_step` inserts at lines 196-249 are outside `gatedMutation`. No `cascade_gate_write`. Consistent with other journey tools. |
| `publishMissionTool` (journey) | ✅ | `callGateAction` pre-insert | inserts outside gatedMutation | ✅ | PARTIAL — same pattern as runDevTool. |
| `publishGuideTool` (journey) | ✅ | `callGateAction` pre-upsert | upsert outside gatedMutation | ✅ | PARTIAL |
| `runGuidedTool` (journey) | ✅ | `callGateAction` pre-insert | inserts outside gatedMutation | ✅ | PARTIAL |
| `updatePayrollProfile` | ✅ | `callGateAction` ✅ | ❌ | ✅ | FAIL ADR-0204 (Pathway A only) |
| `setPensionScheme` | ✅ | `callGateAction` ✅ | ❌ | ✅ | FAIL ADR-0204 |
| `lockPeriod` | ❌ missing | `callGateAction` ✅ | ❌ | ✅ | FAIL ADR-0204 + missing capability field |
| `acknowledgeDeviation` | ✅ | `callGateAction` ✅ | ❌ | ✅ | FAIL ADR-0204 |
| `setOvertimeMode` | ✅ | `callGateAction` ✅ | ❌ | ✅ | FAIL ADR-0204 |
| `adjustTimebankBalance` | ✅ | `callGateAction` ✅ | ❌ | ✅ | FAIL ADR-0204 |
| `forceTimebankPayout` | ✅ | `callGateAction` ✅ | ❌ | ✅ | FAIL ADR-0204 |
| `overrideCalculationLine` | ✅ | `callGateAction` ✅ | ❌ | ✅ | FAIL ADR-0204 |
| `addManualSupplement` | ❌ missing | `callGateAction` ✅ | ❌ | implied | FAIL ADR-0204 + missing capability field |
| `exportPeriod` | ✅ | `callGateAction` ✅ | ❌ | ✅ | FAIL ADR-0204 |
| `deleteManualSupplement` | ✅ | `callGateAction` ✅ | ❌ | ✅ | FAIL ADR-0204 |
| `report_observation` (engine-world) | ✅ | via gatedMutation | ✅ | ✅ | PASS |
| `gateMutation` wrapper (contract/tools.ts) | ✅ | `callGateAction` ✅ | ❌ | ✅ | FAIL ADR-0204 — contract mutations use local `gateMutation` helper (Pathway A only) |

**Note on `journey` tools (runDevTool, publishMissionTool, etc.):** these use `callGateAction` (Pathway A) before direct DB writes. This is PARTIAL — not full `gatedMutation` (dual-gate). Consistent pattern across 4 journey tools; may be intentional pre-ADR-0204-SS4 state (ADR-0204 Rollout SS-4 covers migration of per-cap gate helpers). Mark PARTIAL not FAIL pending SS-4 migration status.
