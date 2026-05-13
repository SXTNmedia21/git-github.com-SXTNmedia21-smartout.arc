---
title: "Journey — exportPeriod returns computed feriepenger_basis"
feature: audit-fcl13-feriepenger-basis
journey: feriepenger-basis-computed-on-capability-export
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: schedule
tags: [journey, payroll, feriepenger, adr-0295]
---

# Journey: Agent-invoked exportPeriod returns real feriepenger_basis

**Role:** agent invoking `payroll.exportPeriod` capability tool

**Precondition:** Fix shipped. ADR-0295 helper accessible.

## Happy Path

1. Agent calls `exportPeriod({ workspace_id, period_id, ... })`
2. Tool computes feriepenger_basis per ADR-0295 (% of qualifying wage base × period)
3. Tool returns export JSON with `feriepenger_basis: <real-number>` (not 0)
4. Output consumed by accountant for lønnsgrunnlag

**Postcondition:** Lønnsgrunnlag carries real feriepenger basis. Tripletex/Visma receive correct data.

## Verification

- [ ] Vitest: known fixture period → expected feriepenger_basis value (matches Server Action result)
- [ ] No `feriepenger_basis: 0` literal in source unless test fixture
- [ ] Synthesis F-CL-13 → CLOSED

**Mark verified when all checked.**
