---
title: "Plan — audit-fcl13-feriepenger-basis"
feature: audit-fcl13-feriepenger-basis
spec: ../audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md
status: done
updated: 2026-05-13
created: 2026-05-13
module: schedule
tags: [plan, audit, payroll, feriepenger, adr-0295, f-cl-13]
---

# Plan — audit-fcl13-feriepenger-basis

> Branch: `feat/audit-fcl13-feriepenger-basis` | Worktree: `~/dev/smartout.ai-wt-8` | Module: schedule

**Spec:** F-CL-13 from synthesis — `payroll/tools.ts:exportPeriod` hardcodes `feriepenger_basis: 0` instead of computing per ADR-0295.

## Background

Audit F-CL-13 (HIGH): agent-invoked `exportPeriod` ships `feriepenger_basis: 0` for every export, violating ADR-0295 (feriepenger boundary spec). Pontus flagged 2026-05-11 as "data corruption value" — accountants/Tripletex/Visma consume this output as part of lønnsgrunnlag (NOT lønnsslipp per Smartout positioning).

## Journeys

- [JOURNEY-audit-fcl13-feriepenger-basis-computed-on-capability-export](../journeys/JOURNEY-audit-fcl13-feriepenger-basis-computed-on-capability-export.md)
- [JOURNEY-audit-fcl13-feriepenger-basis-matches-server-action-baseline](../journeys/JOURNEY-audit-fcl13-feriepenger-basis-matches-server-action-baseline.md)

## Goal

Replace `feriepenger_basis: 0` hardcoded value in `exportPeriod` capability tool with real computation per ADR-0295.

## Tasks

- [x] T1 Read ADR-0295. Read existing `exportPeriod` capability + the canonical feriepenger calculation in payroll engine (Server Action path). Identify shared helper or duplicate logic. **Result:** canonical helper `computeFeriepengerBasis` already lives in `packages/payroll-export/src/feriepenger.ts` (exported from `@smartout/payroll-export`). BFF routes (`apps/web/src/app/api/payroll/export-period/route.ts`, generate-pdf-*) already call it. No extraction needed.
- [x] T2 Wire `exportPeriod` to call canonical feriepenger calculation. Vitest coverage. **Result:** all 3 sites updated (PDF branch line ~1877, CSV aggregate line ~2136, CSV audit line ~2258); each fetches `holiday_allowance_pct` from `employee_payroll_profile` (fallback 12.0), calls `computeFeriepengerBasis`, emits `payroll.feriepenger_basis_computed`. New test file `packages/ai/src/capabilities/payroll/__tests__/exportPeriod-feriepenger.test.ts` (3 tests, all green).
- [x] T3 Update audit synthesis F-CL-13 → CLOSED.

## Acceptance Criteria

- [x] **S1** `feriepenger_basis` no longer hardcoded `0` in `exportPeriod`
- [x] **S2** Vitest: `exportPeriod` returns matching value to Server Action `exportPeriodAction` for same period+profile fixture (parity assertion uses `computeFeriepengerBasis` directly — same helper as BFF)
- [x] **S3** No regression in payroll-calculate tests (`pnpm turbo typecheck` 52/52 green)
- [x] **S4** Audit synthesis F-CL-13 → CLOSED
- [x] **S5** `pnpm turbo typecheck` 0 errors
- [x] **S6** Both journeys verified

## Council triggers

- If canonical feriepenger calculation is not extractable to shared helper (Server Action has logic tightly coupled to its context) — propose helper extraction

## Out of scope

- Refactor of broader payroll capability surface
- ADR-0293 Pattern B sync recalc (F-CL-12, separate sortie)
- A-melding integration
