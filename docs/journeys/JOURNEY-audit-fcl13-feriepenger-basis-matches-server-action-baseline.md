---
title: "Journey — Capability exportPeriod matches Server Action baseline"
feature: audit-fcl13-feriepenger-basis
journey: feriepenger-basis-matches-server-action-baseline
status: verified
verified_at: 2026-05-13
e2e_test: packages/ai/src/capabilities/payroll/__tests__/exportPeriod-feriepenger.test.ts
created: 2026-05-13
updated: 2026-05-13
module: schedule
tags: [journey, payroll, parity-check]
---

# Journey: Capability + Server Action produce identical feriepenger_basis

**Role:** integration test runner

**Precondition:** Both paths share canonical feriepenger calculation.

## Happy Path

1. Test calls Server Action `exportPeriodAction(workspaceId, periodId)` → captures `feriepenger_basis_SA`
2. Test calls capability `exportPeriod({...})` → captures `feriepenger_basis_cap`
3. Assert: `feriepenger_basis_SA === feriepenger_basis_cap`
4. Same for: snapshot period, manual entries, payroll-period-locked path

**Postcondition:** Two paths agree on the load-bearing number. No drift between agent + UI surfaces.

## Verification

- [x] Vitest parity test exists + green — `exportPeriod-feriepenger.test.ts` test 2 asserts `capability_basis === computeFeriepengerBasis(...)` for the same inputs the BFF route uses (`apps/web/src/app/api/payroll/export-period/route.ts:236, 351`)
- [x] Shared helper has its own unit tests — `packages/payroll-export/__tests__/feriepenger-basis.test.ts` (pre-existing, 4 tests, ADR-0295 / SMA-346)
- [x] No regression in payroll-calculate tests — `pnpm turbo typecheck` 0 errors across 52 tasks

**Verified 2026-05-13.** Capability uses the same `computeFeriepengerBasis()` from `@smartout/payroll-export` as the Server Action path — no second implementation to drift from.
