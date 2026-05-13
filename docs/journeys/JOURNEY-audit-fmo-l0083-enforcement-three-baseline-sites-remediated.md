---
title: "Journey — 3 baseline mobile L-0083 sites remediated"
feature: audit-fmo-l0083-enforcement
journey: three-baseline-sites-remediated
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: mobile
tags: [journey, remediation, baseline]
---

# Journey: F-MO-01/02/03 baseline sites all use fail-fast pattern

**Role:** auditor running grep

**Precondition:** Remediation complete.

## Happy Path

1. `grep -rn '\?\? ""' apps/mobile/src/` near identifier columns → 0 hits
2. ShiftClockView, use-training-data, use-swap-requests use getProfileContext() or throw on missing identity
3. Synthesis F-MO-01/02/03 → CLOSED

**Postcondition:** No silent corruption path to activity_trail.

## Verification

- [ ] grep returns 0 on identifier `?? ""` in mobile src
- [ ] 3 files no longer carry the trap pattern
- [ ] Synthesis annotated

**Mark verified when checked.**
