---
title: "Dual-Gate Transitional Architecture (gate_action + cascade_gate_write)"
id: ADR-0229
status: proposed
layer: decision
created: 2026-04-28
updated: 2026-04-28
---

# ADR-0229: Dual-Gate Transitional Architecture (`gate_action` + `cascade_gate_write` → unified `gate_evaluate`)

## Context and Problem Statement

Two RPC gates currently coexist in production and answer different C4 questions:

- `gate_action` (ADR-0099) — capability/authority gate. Reads `engine_authority_config`, reads `engine_process.allowed_channels`, four-eyes via `gate_evaluation` history (ADR-0101). Used by 5 capability families via local `packages/ai/src/capabilities/*/gate.ts` thunks.
- `cascade_gate_write` (ADR-0091 WP2) — data-rule gate. Reads `workspace_framework_binding`, scans `framework_trigger`, creates `change_proposal` if matched. Used by Server Actions via `packages/supabase/src/gate-client.ts` (`gatedInsert/Update/Delete`).

Council 2026-04-28 (run-council, Phase 5 chair self-reversal per L-0147) verified three live invariant breaches:

1. Capability tools call only `gate_action` — silently bypass framework-rule gate (e.g. `shift-lifecycle/tools.ts` writes to `schedule_shift` without invoking `cascade_gate_write`; Riksavtalen overtime cap matches are never evaluated, `gate_evaluation` records `applied`, no `change_proposal` exists).
2. Server Actions call only `cascade_gate_write` — silently bypass authority gate (employee invoking via DevTools/replay attack passes if no `framework_trigger` matches).
3. **CVE-class:** `cascade_gate_write` exposes no `channel` parameter (`GateContext` at `packages/supabase/src/gate-client.ts:74-99` lacks the field). Voice-initiated Server Action mutations bypass ADR-0078 entirely. Surface is small today (Server Actions are web-only) but expands when Phase C1 (mobile LiveKit, ADR-0135) and Phase B4 (helpdesk voice tickets) ship.

ADR-0196 Invariant 13 ("gate_action on every mutation") is therefore systematically violated by Server Action paths without documented exemption. Wave 2A (council 2026-04-18) approved `entityIdColumn` mandatory on `gate-client`; Wave 2B (capability dual-gate migration) was blocked on this reconciliation ADR.

## Decision Drivers

- ADR-0078 voice safety must hold across both gate paths.
- ADR-0101 four-eyes scoping requires single-row-per-mutation `gate_evaluation` semantics; two RPCs writing different column subsets to the same table breaks per-entity scoping.
- Capability authority gate fires twice in agent flows already (`services/stage-engine/src/core/agent-router.ts:221` + capability `gate.ts:63`) — adding a third RPC stack per mutation is unacceptable latency.
- ESLint rules `smartout/no-direct-supabase-write` (warn) and `smartout/no-gated-write-in-capabilities` (error) already exist as enforcement primitives.
- 5 near-identical `callGateAction()` thunks in `packages/ai/src/capabilities/*/gate.ts` (~535 lines duplicate; per-surface channel default claim in `journey/gate.ts:13-17` is aspirational, not load-bearing — verified by Supervisor Phase 3).
- Intent-coverage CI (ADR-0189) covers `gate_action` callers but NOT Server Action `ctx.capability` strings.

## Considered Options

1. **Option A — Two-gate stacking.** Every mutation calls both RPCs in sequence. Doubles RPC roundtrips, creates two `gate_evaluation` rows per mutation with no FK linking them, breaks ADR-0101 scoping. Triple-evaluation in agent flows (router + capability + new cascade call). **Rejected.**
2. **Option B — Unify into single `gate_evaluate` RPC.** Authority + framework + channel + four-eyes evaluated in one call, single audit row, deprecates both existing RPCs. Right architectural endpoint. Cannot ship now: requires `cascade_gate_write` to gain `channel` field, requires shadow-mode infrastructure for safe migration, requires `contract_intake` (ADR-0099 violation) to close first.
3. **Option C — Keep separate + CI parity check + clear docs.** Both gates mandatory at every mutation site. CI enforces. Voice CVE remains until `cascade_gate_write` channel parameter ships.

## Decision Outcome

Chosen option: **"Option C now → Option B destination"**, because:

- Option A is rejected on audit + latency grounds (above).
- Option B is the correct endpoint but cannot ship until (a) `cascade_gate_write` accepts a `channel` parameter (ADR-0230), (b) `contract_intake` ADR-0099 violation closes, (c) ADR-0189 CI parity extends to Server Action `ctx.capability`, (d) shadow-mode comparison infrastructure exists in `gate_evaluation`.
- Option C is shippable now and surfaces the silent bypasses through CI rather than masking them.
- Phase 5 chair self-reversal (steward voted C-only Phase 3 → C-now/B-destination Phase 5 after code-trace evidence from 3 reviewers).

## Rules & Consequences

### Phase 0 (now → 2 weeks) — Option C in force

- Both gates mandatory at every mutation site touching governance-affected tables.
- Capability tools MUST call `gate_action` (already enforced by `no-gated-write-in-capabilities`).
- Server Actions MUST call BOTH `gate_action` (via shared helper, not per-capability `gate.ts` thunks) AND `cascade_gate_write` (via `gate-client.ts`).
- ADR-0196 Invariant 13 amendment lands separately to formalize this (single-evaluation dedup rule for agent double-fire is part of that amendment).
- Drop the 5 per-capability `gate.ts` thunks; replace with single shared `packages/ai/src/lib/gate-action.ts` helper.

### Phase B1 (weeks 3-6) — preparing unification

- ADR-0230 lands `cascade_gate_write` with `channel` + `downgrade_to` fields. Migration extends RPC signature, `GateContext` gains required `channel: SessionChannel`.
- Shadow-mode logging: every mutation that calls both gates writes a `gate_correlation_id` (UUID) into both `gate_evaluation` rows so dual-row audit is reconcilable.
- Capability tools migrated one-at-a-time to call BOTH gates (was: `gate_action` only).

### Phase B2-B4 (weeks 7-12) — unification cutover

- Author unified `gate_evaluate` RPC subsuming both. Channel-aware. Framework-binding-aware. Single `gate_evaluation` row per call.
- Per-capability migration: shadow comparison ≥7 days zero-divergence required before cutover. Non-zero divergence blocks cutover and surfaces in council weekly report.
- After all capabilities + Server Actions migrated, deprecate `gate_action` and `cascade_gate_write` RPCs (drop in a final migration).

### Trust Gate — REJECTED for new mutation PRs

No new capability tool, Server Action, or `emit()` routing change merges until P0-P5 complete:

| # | Item | Phase |
|---|------|-------|
| P0 | Close `contract_intake` ADR-0099 violation | A1 |
| P1 | ADR-0196 amendment lands | Phase 0 |
| P2 | ADR-0189 CI parity extended to Server Action `ctx.capability` | A4 |
| P3 | This ADR (0226) accepted | Phase 0 |
| P4 | ADR-0137 confirm as accepted (gate_action stacking dedup in agent-router) | Phase 0 |
| P5 | ADR-0230 lands (channel parameter on `cascade_gate_write`) | B1 |

### Consequences

- **Good, because** voice safety (ADR-0078) becomes enforceable across BOTH gate paths once P5 lands.
- **Good, because** capability authority + data rule decisions become reconcilable via `gate_correlation_id` during the transitional period.
- **Good, because** ADR-0101 four-eyes scoping is preserved at the unified-RPC endpoint (single row per mutation).
- **Bad, because** Phase 0-B1 imposes double-RPC latency on every mutation. Mitigated by ADR-0137 dedup at agent-router level.
- **Bad, because** transitional state requires CI vigilance — silent bypass detection depends on lint + CI rather than runtime guards.
- **Agent Impact:** Capability authors MUST call shared `gateAction()` helper from `packages/ai/src/lib/gate-action.ts`; Server Action authors MUST call both `gateAction()` AND `gatedUpdate/Insert/Delete` from `gate-client.ts`. PRs that touch mutation paths require explicit dual-gate verification in PR description until Phase B4 closes.

## References

- ADR-0078 (voice forbidden for critical data)
- ADR-0091 (cascade_gate_write WP2)
- ADR-0099 (gate_action)
- ADR-0101 (four-eyes via gate_evaluation history)
- ADR-0137 (gate_action stacking semantics — confirm as accepted in Phase 0)
- ADR-0189 (CI parity for authority seed — extend to Server Action capability strings)
- ADR-0196 (mutation invariants — amendment lands Phase 0)
- ADR-0230 (cascade_gate_write channel parameter — proposed)
- L-0147 (Phase 3 chair self-reversal pattern)
- L-0164 (channel divergence asymmetry — voice CVE pattern)
- L-0165 (gate double-evaluation in agent flows)
- L-0166 (journey/tools.ts direct writes — ADR-0091 violation pattern)
- L-0167 (framework-binding-missing asymmetry)
- L-0168 (audit inflation — false-claim pattern in council briefings, 6th occurrence)

> After writing: register in `docs/decisions/0000-decision-log.md`.
