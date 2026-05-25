---
title: J-10 Procedure Engine — routine create + shift location
status: PARTIAL
journey_docs: [JOURNEY-procedure-engine-*.md]
spec: apps/e2e/procedure-engine/
result: 3 passed / 2 failed / 3 did not run
evidence: ../evidence/run-10-procedure-engine.log
---

# J-10 Procedure Engine — PARTIAL (3/5 pass)

## Pass
- DB-level: shift inserted with location_id via service-role ✓
- DB-level: shift with NULL location_id valid ✓
- DB-level: location_id from wrong workspace rejected by FK ✓

## Fail (BUG-OOM-1)
- J2-A — RoutineForm renders at /dashboard/hms/governance — `Target crashed` during `submitLoginAndWait` (login form click → chromium tab crash)
- J4-A1 — AddShiftDialog location combobox — same `Target crashed` on login

## Hypothesis
- Both UI tests crash chromium at login button click — RAM-induced OOM (WSL2 swap=0B + heavy Next.js 16 dev bundle + concurrent test runs)
- DB tests pass because they don't launch chromium

## Action
- Re-run with single-spec invocation when RAM > 4 Gi avail
- If still crashes: real bug in login submit path
