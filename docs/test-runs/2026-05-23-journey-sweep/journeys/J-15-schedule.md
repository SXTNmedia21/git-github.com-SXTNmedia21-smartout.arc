---
title: J-15 Schedule — density / heatmap / conflict
status: FAIL
journey_docs: [JOURNEY-admin-daily-loop.md (Journey 2 — shift conflict)]
spec: apps/e2e/schedule/density.spec.ts
result: 0 passed / 4 failed
evidence: ../evidence/run-15-schedule.log
---

# J-15 Schedule — FAIL (0/4)

## All 4 tests fail with `Page crashed` navigating to `/dashboard/schedule`

### Tests
- J1 — density preference persists across reload
- J2 — Pulse mode heatmap baseline + conflict escape
- J3 — conflict-strip survives all 4 tiers (incl. voice event dispatch)
- J4 — new user with no preference defaults to 'default'

## Hypothesis (high confidence)
- `/dashboard/schedule` is heavy (many client components, density renderer, heatmap, conflict detector)
- During tight RAM pressure (concurrent runs), chromium tab crashes navigating to it
- Could also be a real perf regression (page memory leak / runtime error)

## Action
- Re-run isolated when RAM > 6 Gi avail
- If still crashes solo: real regression — investigate `/dashboard/schedule` page bundle + initial fetch chain
