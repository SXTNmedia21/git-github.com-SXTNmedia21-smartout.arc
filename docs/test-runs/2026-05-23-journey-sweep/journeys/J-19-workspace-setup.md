---
title: J-19 Workspace setup wizard
status: FAIL (blocked)
journey_docs:
  - JOURNEY-billing-erik-seed-erik-login.md (workspace setup precondition)
  - JOURNEY-dashboard-redesign.md
spec: apps/e2e/tests/workspace-setup-flow.spec.ts
result: 0 passed / 1 failed / 10 did not run
evidence: ../evidence/run-19-workspace-setup.log + run-24-workspace-setup-rerun.log
---

# J-19 Workspace Setup Wizard — FAIL (blocked by BUG-8)

## Confirmation across two runs
- Run 19 (8:08): same FK error + 1 fail + 10 dnr
- Run 24 rerun (8:14): same — confirms BUG-8 is not transient cascade, it's a real schema bug

## Tests blocked
1. shows wizard for workspace needing setup @smoke
2. step 1 shows document drop after data hidden
3. can navigate to step 3 (about) via Neste buttons
4. governance step shows industry-relevant toggles
5. can expand policy list on governance step
6. can add team member on team step
7. wizard disappears when setup complete @smoke
8. skip saves to sessionStorage and persists
9. clearing sessionStorage dismiss flag makes wizard reappear
10. can navigate all 9 steps: welcome → handbook → complete
11. after wizard complete, StrategicView shows

## Action
Fix BUG-8 (channel FK), then rerun.
