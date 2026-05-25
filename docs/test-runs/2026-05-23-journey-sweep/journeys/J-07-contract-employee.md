---
title: J-07 Contract Employee — 5-journey suite
status: PARTIAL
journey_docs:
  - JOURNEY-client-contract.md
  - JOURNEY-contract-module.md
  - JOURNEY-contract-preview-editor.md
  - JOURNEY-contract-binding-auto-seed.md
  - JOURNEY-contract-enhancements.md
  - JOURNEY-contract-composition-engine.md
  - JOURNEY-contract-signed-active-cascade.md
spec: apps/e2e/contract-employee/ + apps/e2e/tests/contract-employee/
result: 9 passed / 1 failed / 40 skipped / 6 did not run
evidence: ../evidence/run-07-contract-employee.log
---

# J-07 Contract Employee — PARTIAL

## Highlights — PASS (9)
- Walt (employee contract signing surface): 4 tests pass
  - Unauth redirect, no_pending panel, pending state card, just_signed panel, no_profile state
- Empty-state when employee has no contract ✓
- DB-level enforcement crons (obligation-due-soon, obligation-overdue) ✓
- Shift-cost snapshot with contract_pay_rule on clock-out ✓

## Failure — BUG-8: /api/contracts/send returns 400 instead of 202
- Test: `Journey 2 — Admin sender kontrakt (API-level) › happy path — send oppretter stub-kontrakt og flipper status til sent`
- Expected: 202 Accepted
- Received: 400 Bad Request
- Hypothesis: Zod schema validation mismatch (request body or DocuSeal stub config drift)
- Action: trace `/api/contracts/send` handler and golden test data

## SKIPPED — 40 tests
- All `contract-employee/journey-*.spec.ts` (newer 5-journey suite) → 17 skip, indicating `test.skip()` or missing precondition
- `tests/contract-employee/journey-1-define-basis.spec.ts` → 5 skip
- `journey-2-send-drawer.spec.ts` → 4 skip
- Hypothesis: shared fixture (contract template + workspace seed) absent

## Action
- Diagnose /api/contracts/send 400
- Run contract-intake-harness setup to satisfy skip preconditions
