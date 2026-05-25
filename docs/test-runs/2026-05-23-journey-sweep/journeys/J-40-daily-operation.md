---
title: J-40 Daily Operation — clockout / recon / roster / sessions / tasks / watchdog
status: PARTIAL (PASS-dominant)
journey_docs:
  - JOURNEY-shift-clock.md
  - JOURNEY-admin-daily-loop.md (reconciliation segment)
  - JOURNEY-absence-approval.md (related)
  - JOURNEY-daily-operation-* (multiple)
spec: apps/e2e/tests/daily-operation-*.spec.ts (7 specs)
result: 14 passed / 7 failed / 4 skipped / 4 did not run
evidence: ../evidence/run-40-daily-operation.log
---

# J-40 Daily Operation — PARTIAL (14/29)

Core daily-loop flows largely work. Failures concentrated in specific surfaces (watchdog demoter, roster add-shift edge cases).

## Action
- Inspect 7 failures — likely seed-gap + UI testid drift in places
- Map specific failures to JOURNEY-* docs
