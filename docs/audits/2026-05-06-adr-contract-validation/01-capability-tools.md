---
title: Slice 01 — capability-tools Audit
status: done
created: 2026-05-06
updated: 2026-05-06
module: audit
tags: [audit, capability-tools, adr]
---

# Slice 01 — Capability Tools Audit

**Scope:** `packages/ai/src/capabilities/**/tools.ts` + `**/index.ts`
**ADRs:** 0151, 0173, 0186, 0204, 0238, 0240
**Traps:** L-0176 (docstring lying about gate compliance), L-0177 (silent workspace_id fallback)

---

## Summary (Top 5)

1. **MEDIUM — `helpdesk_query/tools.ts` + `operations/tools.ts`: Pathway A only (no `gatedMutation` orchestrator)** — Both capabilities call `callGateAction` (Pathway A) before mutations but do NOT wrap their domain writes in `gatedMutation()`. ADR-0204 requires both Pathway A + B in sequence for every mutation. These are SS-5 migration targets but that status is not documented at the call sites.

2. **MEDIUM — `season/` mutation tools: zero `emit()` calls** — `create-season.ts`, `set-revenue.ts`, `save-playbook.ts` all write to DB with no `emit()`. `season/index.ts:78` explicitly defers: "no tool emits in M3 (telemetry wiring lands M4)." This is tracked and intentional but represents an open ADR-0004/ADR-0116 gap for all 3 mutation tools.

3. **LOW — `onboarding/tools.ts`: all mutation bodies are stubs** — 9 mutation tools (`update_business`, `update_season`, `add_departments`, `add_locations`, `add_zones`, `add_procedures`, etc.) return `"Not implemented yet — body lands in T1.6."`. No gate calls, no emit. Stubs are expected (campaign in-progress: `feat/botsson-arena-voice-plane-consolidation`), but the registered capability exposes 9 tools that silently fail.

4. **CLOSED (vs baseline) — `journey-authoring/publishDraftTool`: docstring now matches body** — Baseline found body had 3 direct writes outside `gatedMutation` while docstring claimed compliance. Body now wraps all 3 writes (journey INSERT, journey_version INSERT, wizard_session UPDATE) inside a single `gatedMutation()` execute callback. ADR-0204 satisfied. Cross-namespace writes acknowledged in body comment at line 454-457 pending ADR-0240 delegation refactor.

5. **CLOSED (vs baseline) — `legal/classify_amendment`: gate now present** — Baseline found zero `callGateAction` calls in body. Body now calls `callGateAction` at line 263 before any stub classification. Gate fail-closed. `emit()` present at line 298.

---

## Findings Table

| ID | Sev | File:Line | ADR | Evidence |
|----|-----|-----------|-----|----------|
| F-01 | MEDIUM | `helpdesk_query/tools.ts:119-146` | ADR-0204 | `channel.insert` + `channel_member.insert` in `open_ticket` after `callGateAction` but outside `gatedMutation()`. No `cascade_gate_write` policy run. |
| F-02 | MEDIUM | `helpdesk_query/tools.ts:600-608` | ADR-0204 | `engine_state.update` in `resolve_ticket` after `callGateAction` but outside `gatedMutation()`. No `cascade_gate_write` policy run. |
| F-03 | MEDIUM | `operations/tools.ts:222-232` | ADR-0204 | `deviation.insert` in `createDeviation` after `callGateAction` but outside `gatedMutation()`. No `cascade_gate_write`. |
| F-04 | MEDIUM | `operations/tools.ts:287-299` | ADR-0204 | `session_task.update` in `completeTask` after `callGateAction` but outside `gatedMutation()`. No `cascade_gate_write`. |
| F-05 | MEDIUM | `tools/season/create-season.ts` | ADR-0004 | `create-season` inserts to `season`, `season_budget`, `day_factor`, `hour_factor` with zero `emit()` calls. Season index defers to M4. |
| F-06 | MEDIUM | `tools/season/set-revenue.ts` | ADR-0004 | `set-revenue` updates `season_budget` with zero `emit()` calls. |
| F-07 | MEDIUM | `tools/season/save-playbook.ts` | ADR-0004 | `save-playbook` updates `season.description` with zero `emit()` calls. |
| F-08 | LOW | `onboarding/tools.ts:83-86,113-115,148-151,187-189` etc | ADR-0099 | 9 mutation tool bodies are stubs returning `"Not implemented yet"`. No gate calls, no emit. Campaign in-progress. |
| F-09 | LOW | `journey-authoring/tools.ts:460` | ADR-0240 | `publishDraftTool` still writes `journey` + `journey_version` directly (inside `gatedMutation`). ADR-0240 "Option 1 — Delegate" to `journey.publish_mission` NOT yet implemented. Tool body documents this at line 454-457. |

---

## Per-ADR Rollup

### ADR-0151 (profile_id server-derived)
**PASS.** All mutation tools guard `ctx.profileId` with fail-fast returns before gate calls. `helpdesk_query/tools.ts:507-510` and `operations/tools.ts:186-189` have explicit guards. `journey-authoring/tools.ts:68-78` has three guards. No tool accepts `profile_id` from body input. `workspace_id` is derived from `ctx.workspaceId` (stage-engine resolved) throughout.

### ADR-0173 (four journey capabilities, frozen-4 boundaries)
**PARTIAL.** `journey-authoring` writes `journey` + `journey_version` tables (frozen-4 owned by `journey.publish_mission` per ADR-0240). This is documented as deliberate interim approach at `journey-authoring/tools.ts:454-457` — the ADR-0240 delegation refactor is tracked but not yet implemented. No other capability boundary violations detected across the 25+ capabilities scanned.

### ADR-0186 (emitGuardianEvent via pg_notify)
**PASS for in-scope tools.** All capabilities emit guardian-facing signals through `emit()` from `@smartout/telemetry` (which routes to the guardian bus). No direct `guardian_log` inserts found in tools.ts files. ADR-0186 compliance is correct — capabilities should NOT write `guardian_log` directly; they emit to `@smartout/telemetry`.

### ADR-0204 (gatedMutation orchestrator)
**PARTIAL.** Tools using `gatedMutation` directly: `journey-authoring/saveDraftTool`, `journey-authoring/publishDraftTool`. Tools using `callGateAction` wrapper (delegates to `gatedMutation` inside `gate.ts`): `shift-lifecycle`, `contract`, `contract-intake`, `memory`, `journey`, `onboarding`(gate.ts), `payroll`, `personal`, `availability`. Tools using `callGateAction` but NO `gatedMutation` in the domain write path: `helpdesk_query` (F-01, F-02), `operations` (F-03, F-04). These are the SS-5 migration targets. `legal/classify_amendment` uses `callGateAction` for a stub (no mutation yet).

### ADR-0238 (Botsson surface disambiguation)
**OUT OF SCOPE for tools.ts** — this ADR governs `BotssonShell` + `<DomainChatOwnership>` in the frontend, not capability tools. No relevant violations in `packages/ai/`.

### ADR-0240 (journey-authoring tool boundary — delegate to publish_mission)
**PARTIAL — ADR is still `proposed`.** `publishDraftTool` now wraps the `journey`/`journey_version` writes inside `gatedMutation()` (closes ADR-0204 + L-0176 violations from baseline). The cross-namespace boundary concern (delegation to `journey.publish_mission`) remains unimplemented. Tool body explicitly documents this at lines 454-457.

---

## Delta vs 2026-05-02 Baseline

### CLOSED (previously CRITICAL or HIGH, now resolved)

| Baseline finding | Resolution |
|---|---|
| `journey-authoring/publishDraftTool` body had 3 direct writes outside `gatedMutation` | **CLOSED.** All 3 writes now inside `gatedMutation()` execute callback. |
| `journey-authoring/publishDraftTool` docstring falsely claimed ADR-0204 compliance | **CLOSED.** Docstring now accurately describes `gatedMutation` wrapping + acknowledges ADR-0240 pending delegation. |
| `legal/classify_amendment`: no `callGateAction` in body | **CLOSED.** `callGateAction` now at line 263, fail-closed. |
| `helpdesk_query` open/resolve direct writes | **PARTIAL CLOSED.** Gate now present (`callGateAction`). Still lacks `gatedMutation` orchestrator (Pathway B). Status: MEDIUM, down from CRITICAL. |
| `operations` createDeviation/completeTask direct writes | **PARTIAL CLOSED.** Gate now present (`callGateAction`). Still lacks `gatedMutation` orchestrator. Status: MEDIUM, down from HIGH. |
| `gatedMutation()` SS-5 path emits zero (7 tools dark) | **PARTIALLY RESOLVED.** `helpdesk_query` and `operations` mutation tools now emit via `emit()`. Season tools still emit nothing (tracked/deferred to M4). Net: 5 of 7 dark tools now emit. |

### REGRESSED
None detected.

### NEW (not in baseline)
- F-08: `onboarding/tools.ts` stub bodies registered as live tools (9 stubs). Campaign in-progress — flagged for tracking.
- F-09: `publishDraftTool` cross-namespace write now explicit (was unregistered in baseline, so undetectable).

---

## Verified Intentional (Known False Positives)

- **FP-001 (inherited):** `validate_aml_14_6` `allowedChannels=["chat","voice","system"]` at capability level with per-tool voice block — confirmed ADR-0078 layered defense. Working as designed.
- **Season M4 deferral:** Zero `emit()` in 3 season mutation tools. `season/index.ts:78` explicitly defers telemetry wiring to M4. Intentional, tracked.
- **`helpdesk_query/spawnSlaBreachTrigger`:** Multi-table writes (`engine_event`, `engine_trigger`, `engine_delayed_trigger`) at lines 353-395 inside `open_ticket`. These are SLA infrastructure writes, not domain entity mutations. Not gated individually — they are conditional branches inside the already-gated `open_ticket` execute path. Acceptable under current ADR-0235 design.
- **`personal/tools.ts:258-303`:** `set_reminder` writes 3 engine tables (`engine_event`, `engine_trigger`, `engine_delayed_trigger`) after `callGateAction`. Same pattern as SLA spawn — infrastructure orchestration, not a cascade-gated entity. Acceptable.

---

## In-Progress Mid-Campaign (Mark as "in-progress", not "violation")

- `onboarding/tools.ts` stubs — campaign `feat/botsson-arena-voice-plane-consolidation` (DIRTY). All 9 stub bodies expected to land in T1.6.
- ADR-0240 delegation (`publishDraftTool` → `journey.publish_mission`) — ADR is `proposed`. Phase 1 requires `journey.publish_mission` to expose an inter-capability call surface. No `journey/` capability currently exposes such surface. Tracked, not yet implementable.

---

*Word count: ~1100*
