---
title: "Journey — Capability exportPeriod matches Server Action baseline"
feature: audit-fcl13-feriepenger-basis
journey: feriepenger-basis-matches-server-action-baseline
status: draft
verified_at: null
e2e_test: null
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

- [ ] Vitest parity test exists + green
- [ ] If shared helper extracted: helper has its own unit tests
- [ ] No regression in payroll-calculate tests

**Mark verified when all checked.**
