---
title: J-29 Day Line — create / attach-routine / edit-hours
status: FAIL
journey_docs:
  - JOURNEY-day-line-create.md
  - JOURNEY-day-line-attach-routine.md
  - JOURNEY-day-line-edit-hours.md
spec: apps/e2e/tests/day-line/
result: 1 passed / 2 failed / 8 skipped
evidence: ../evidence/run-29-day-line.log
---

# J-29 Day Line — FAIL

Direct mapping to 3 JOURNEY docs not previously covered. Most tests skip — likely missing `day_line` + `department_session` seed for "today".

## Action
- Inspect `evidence/run-29-day-line.log` for skip reasons + 2 failure causes
- Likely overlaps with BUG-4/5 from dagslinjen sweep
