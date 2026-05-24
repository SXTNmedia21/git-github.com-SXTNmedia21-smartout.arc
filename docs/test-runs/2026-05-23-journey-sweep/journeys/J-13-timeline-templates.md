---
title: J-13 Timeline Templates — save/apply/scope
status: FAIL
journey_docs:
  - JOURNEY-day-line-attach-routine.md (sibling — template scope)
  - timeline-templates (sortie-specific, no separate JOURNEY-*.md)
spec: apps/e2e/timeline-templates/timeline-templates.spec.ts
result: 0 passed / 3 failed / 3 skipped / 3 did not run
evidence: ../evidence/run-13-timeline-templates.log
---

# J-13 Timeline Templates — FAIL

All 3 attempted tests crashed at login/navigation under RAM pressure.

## Action
- Re-run isolated when RAM > 6 Gi
- If still crashes solo: real regression
