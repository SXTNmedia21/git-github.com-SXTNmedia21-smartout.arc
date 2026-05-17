---
title: "Plan — f-cl-12-feriepenger-recalc-pattern-b"
status: in_progress
updated: 2026-05-16
created: 2026-05-16
module: payroll
tags: [plan, payroll, feriepenger, capability, adr-0293, pattern-b, recalc]
---

# Plan — f-cl-12-feriepenger-recalc-pattern-b

> Branch: `feat/payroll-f-cl-12-feriepenger-recalc-pattern-b` | Worktree: /home/sxtnl/dev/smartout.ai-payroll-wt-1 | Base: `campaign/payroll` | Module: payroll | Started: 2026-05-16 | Council: Payroll Sortie-Triplet 2026-05-16 (verdict APPROVE)

## Goal

Wire ADR-0293 Pattern B `computeFeriepengerBasis` recalc into 3 agent-invoked mutation capability tools so feriepenger_basis is recomputed on supplement add/delete + line override (same shape as F-CL-13 commit `58d40f500`). Includes F-CL-17 misattribution cleanup.

## ADR / Audit refs

- ADR-0293 (Pattern B sync-recalc chain) — accepted
- ADR-0295 (feriepenger boundary) — accepted, field-level positioning
- ADR-0287 (gate_action mandatory on mutation capability tools) — pattern enforcement
- F-CL-12 audit synthesis (docs/audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md) — OPEN
- F-CL-13 commit `58d40f500` (closed 2026-05-13) — reference shape

## Tasks

### T0 — Per-tool compliance trace (verify Steward Phase 5 assumption)

Per Phase 3 Hard Rules (multi-tool capability ≥2 tools), produce table:

| Tool | Line | gate_action | gatedMutation | emit() | Pattern B recalc | F-CL-17 misattribution |
|---|---|---|---|---|---|---|
| `addManualSupplement` | tools.ts:1559 | ? | ? | ? | MISSING | n/a |
| `deleteManualSupplement` | tools.ts:2534 | ? | ? | ? | MISSING | PRESENT |
| `overrideCalculationLine` | tools.ts:1323 | ? | ? | ? | MISSING | n/a |

Fill `?` columns by reading the bodies. If gate/emit are missing, that's additional scope (escalate).

### T1 — Extract recalc helper signature (if not already in @smartout/payroll-export)

Verify `packages/payroll-export/src/feriepenger.ts` exposes `computeFeriepengerBasis(profile_id, period_id, ctx)` callable from capability layer. If F-CL-13 already exports it correctly, skip — just import.

### T2 — Wire recalc into `addManualSupplement` (tools.ts:1559)

- Before/after pattern: existing supplement INSERT → call helper → update period totals → emit `payroll.feriepenger_basis_computed`
- Keep existing gate_action + emit calls unchanged
- ADR-0204 correlation_id: pass gate_evaluation_id into helper

### T3 — Wire recalc into `deleteManualSupplement` (tools.ts:2534) + F-CL-17 cleanup

- F-CL-17: investigate misattribution. Likely `target_profile_id` resolved from supplement row but supplement.profile_id may be NULL or wrong column. Fix attribution before recalc.
- Then same pattern as T2 with DELETE branch

### T4 — Wire recalc into `overrideCalculationLine` (tools.ts:1323)

- Override changes line value → recalc → update period totals → emit
- Watch for: override may target line whose profile_id differs from caller's; fail-fast (L-0177 pattern, no JWT default)

### T5 — Tests

3 new vitest files mirroring `packages/ai/src/capabilities/payroll/__tests__/exportPeriod-feriepenger.test.ts`:
- `addManualSupplement-feriepenger.test.ts`
- `deleteManualSupplement-feriepenger.test.ts` (+ F-CL-17 misattribution regression)
- `overrideCalculationLine-feriepenger.test.ts`

Assertions per test:
- helper called once per affected profile
- emit fires once per recalc with correct workspace_id, period_id, profile_id, basis_amount, pct_applied
- gate_evaluation_id propagates into emit data
- ADR-0151 fail-fast on missing identity

### T6 — Audit synthesis update

Edit `docs/audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md` — move F-CL-12 + F-CL-17 from "Open" to "Closed" table; reference this branch's HEAD SHA.

### Closure

- T7 — `pnpm turbo typecheck` 52/52
- T8 — journey verified (status: verified in JOURNEY frontmatter)
- T9 — HANDOFF + decision log entries
- T10 — close-feature.sh enforced gates (page-polish + design-audit MUST pass on authored code)

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` 52/52 FULL TURBO
- [ ] Per-tool trace table completed
- [ ] 3 capability tools call `computeFeriepengerBasis` per write
- [ ] 3 vitest suites green
- [ ] F-CL-17 misattribution regression test exists + passes
- [ ] F-CL-12 + F-CL-17 marked CLOSED in audit synthesis
- [ ] HANDOFF written
- [ ] 3 journeys verified
- [ ] decision log updated (no new ADR — pattern follows ADR-0293 + ADR-0295)

## Out of Scope

- Phase 4 dashboard polish (separate S3-candidate-2, deferred)
- POS-driven hour factor (ADR-0320, different surface)
- Mobile lønnsgrunnlag UX (S2 sortie, parallel after S3)
- Label sweep "lønnsslipp"→"lønnsgrunnlag" (S1 sortie, parallel after S3)
- Tripletex sync (Phase 7, campaign scope)
